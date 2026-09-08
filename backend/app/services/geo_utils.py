"""
Geospatial and Telemetry Normalization Utilities for TrainETA & RailRadar.
Authoritative coordinate validation, GeoJSON [lng, lat] inversion handling,
speed normalization, and dynamic journey origin/terminus extraction.
"""
import logging
from typing import Optional, Tuple, Dict, Any, List

logger = logging.getLogger("traineta.geoutils")

def is_valid_coordinate(lat: Any, lng: Any) -> bool:
    """
    Validates that coordinates are non-null numerical values,
    strictly within geographical limits, and not (0.0, 0.0) Null Island.
    """
    if lat is None or lng is None:
        return False
    try:
        n_lat = float(lat)
        n_lng = float(lng)
    except (ValueError, TypeError):
        return False

    if n_lat == 0.0 and n_lng == 0.0:
        return False
    if not (-90.0 <= n_lat <= 90.0 and -180.0 <= n_lng <= 180.0):
        return False
    return True

def normalize_lat_lng(c1: Any, c2: Any) -> Optional[List[float]]:
    """
    Normalizes a coordinate pair into [latitude, longitude].
    Detects and corrects GeoJSON [lng, lat] ordering.

    For Indian Railways:
    - Latitude is roughly 8.0 to 38.0 N.
    - Longitude is roughly 68.0 to 98.0 E.
    If c1 > 50.0 and c2 < 45.0, c1 is longitude and c2 is latitude.
    """
    if c1 is None or c2 is None:
        return None
    try:
        n1 = float(c1)
        n2 = float(c2)
    except (ValueError, TypeError):
        return None

    if n1 == 0.0 and n2 == 0.0:
        return None

    # Detect GeoJSON [longitude, latitude]
    if n1 > 50.0 and -45.0 <= n2 <= 45.0:
        # n1 is lng, n2 is lat
        lat, lng = n2, n1
    elif -90.0 <= n1 <= 90.0 and -180.0 <= n2 <= 180.0:
        # standard [lat, lng]
        lat, lng = n1, n2
    elif -90.0 <= n2 <= 90.0 and -180.0 <= n1 <= 180.0:
        lat, lng = n2, n1
    else:
        return None

    if is_valid_coordinate(lat, lng):
        return [round(lat, 7), round(lng, 7)]
    return None

def is_valid_india_coordinate(lat: Any, lng: Any) -> bool:
    """
    Validates coordinates for Indian Railway network:
    8.0 <= latitude <= 38.0
    68.0 <= longitude <= 98.0
    """
    if not is_valid_coordinate(lat, lng):
        return False
    try:
        n_lat = float(lat)
        n_lng = float(lng)
        return 8.0 <= n_lat <= 38.0 and 68.0 <= n_lng <= 98.0
    except (ValueError, TypeError):
        return False

def extract_speed(
    raw_data: Dict[str, Any],
    current_loc: Dict[str, Any],
    halts_list: Optional[List[Dict[str, Any]]] = None
) -> Tuple[Optional[int], str, str]:
    """
    Extracts real instantaneous live speed from RailRadar telemetry:
    1. currentLocation.speedKmph, currentLocation.speed, currentLocation.currentSpeed, or currentLocation.liveSpeed
    2. Another explicitly documented RailRadar instantaneous speed field (data.speedKmph, data.speed, etc.)
    3. If RailRadar does not provide instantaneous speed:
       speed = None
       speed_status = "UNAVAILABLE"

    CRITICAL AUDIT RULES:
    - NEVER use train.avgSpeed as live speed.
    - NEVER use speedToNextStationKmph as live speed.
    - If the train is stationary and RailRadar explicitly reports 0 km/h,
      that is valid and MUST be returned as 0 with speed_status = "LIVE".
    """
    # Priority 1: currentLocation instantaneous speed fields
    for field in ("speedKmph", "speed", "currentSpeed", "liveSpeed", "gpsSpeed"):
        if field in current_loc and current_loc[field] is not None:
            try:
                val = float(current_loc[field])
                if val >= 0:
                    s_int = int(round(val))
                    logger.info(f"[RailRadar Telemetry] Resolved live instantaneous speed: {s_int} km/h via currentLocation.{field}")
                    return s_int, f"currentLocation.{field}", "LIVE"
            except (ValueError, TypeError):
                pass

    # Priority 2: top-level data instantaneous speed fields
    for field in ("speedKmph", "speed", "currentSpeed", "liveSpeed"):
        if field in raw_data and raw_data[field] is not None:
            try:
                val = float(raw_data[field])
                if val >= 0:
                    s_int = int(round(val))
                    logger.info(f"[RailRadar Telemetry] Resolved live instantaneous speed: {s_int} km/h via data.{field}")
                    return s_int, f"data.{field}", "LIVE"
            except (ValueError, TypeError):
                pass

    # Priority 3: Instantaneous speed not provided by RailRadar
    logger.info("[RailRadar Telemetry] No instantaneous live speed provided by RailRadar. Returning speed=None, speed_status='UNAVAILABLE'.")
    return None, "NONE", "UNAVAILABLE"

def extract_source_destination(
    raw_data: Dict[str, Any],
    halts_list: List[Dict[str, Any]],
    station_coords_map: Optional[Dict[str, Dict[str, Any]]] = None
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """
    Extracts true origin and terminus endpoints for the train journey.
    Prioritizes raw_data['train']['source'] / destination metadata.
    Falls back to halts[0] and halts[-1].
    Guarantees that source != currentStation and destination != currentStation
    unless the train is at its journey endpoint. Never produces 'Unknown'.
    """
    coords_map = station_coords_map or {}
    train_meta = raw_data.get("train") or {}
    src_meta = train_meta.get("source") if isinstance(train_meta.get("source"), dict) else {}
    dst_meta = train_meta.get("destination") if isinstance(train_meta.get("destination"), dict) else {}

    first_halt = halts_list[0] if halts_list else {}
    last_halt = halts_list[-1] if halts_list else {}

    # 1. Source resolution
    source_code = (src_meta.get("code") or first_halt.get("stationCode") or first_halt.get("code") or "").strip().upper()
    source_name = src_meta.get("name") or first_halt.get("stationName") or first_halt.get("name") or source_code
    s_geo = coords_map.get(source_code, {})
    s_lat = src_meta.get("lat") or src_meta.get("latitude") or s_geo.get("lat") or first_halt.get("lat") or first_halt.get("latitude")
    s_lng = src_meta.get("lng") or src_meta.get("longitude") or s_geo.get("lng") or first_halt.get("lng") or first_halt.get("longitude")

    norm_s = normalize_lat_lng(s_lat, s_lng) if (s_lat is not None and s_lng is not None) else None
    source = {
        "code": source_code,
        "name": source_name,
        "latitude": norm_s[0] if norm_s else (float(s_lat) if s_lat is not None else None),
        "longitude": norm_s[1] if norm_s else (float(s_lng) if s_lng is not None else None),
    }

    # 2. Destination resolution
    dest_code = (dst_meta.get("code") or last_halt.get("stationCode") or last_halt.get("code") or "").strip().upper()
    dest_name = dst_meta.get("name") or last_halt.get("stationName") or last_halt.get("name") or dest_code
    d_geo = coords_map.get(dest_code, {})
    d_lat = dst_meta.get("lat") or dst_meta.get("latitude") or d_geo.get("lat") or last_halt.get("lat") or last_halt.get("latitude")
    d_lng = dst_meta.get("lng") or dst_meta.get("longitude") or d_geo.get("lng") or last_halt.get("lng") or last_halt.get("longitude")

    norm_d = normalize_lat_lng(d_lat, d_lng) if (d_lat is not None and d_lng is not None) else None
    destination = {
        "code": dest_code,
        "name": dest_name,
        "latitude": norm_d[0] if norm_d else (float(d_lat) if d_lat is not None else None),
        "longitude": norm_d[1] if norm_d else (float(d_lng) if d_lng is not None else None),
    }

    logger.info(
        f"[RailRadar Telemetry] Resolved journey endpoints: "
        f"Source={source['code']} ({source['name']}, lat={source['latitude']}, lng={source['longitude']}) -> "
        f"Destination={destination['code']} ({destination['name']}, lat={destination['latitude']}, lng={destination['longitude']})"
    )

    return source, destination
