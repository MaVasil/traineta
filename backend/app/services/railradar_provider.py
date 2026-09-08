"""RailRadar Data Provider for live railway operational telemetry."""
import json
import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional, Tuple, List

import httpx
from app.config import settings
from app.services.provider_base import DataProvider
from app.services.geo_utils import (
    is_valid_coordinate,
    normalize_lat_lng,
    extract_speed,
    extract_source_destination,
)

logger = logging.getLogger("traineta.railradar")


class RailRadarProvider(DataProvider):
    """
    Client for RailRadar API.
    Provides live train status and normalizes the response into standardized schema.
    Authoritative single source of truth for train position, velocity, and geography.
    """
    BASE_URL = "https://api.railradar.in/v1"
    _cache: Dict[str, Tuple[float, Dict[str, Any]]] = {}
    CACHE_TTL_SECONDS: float = 30.0

    _route_cache: Dict[str, Tuple[float, Dict[str, Any]]] = {}
    ROUTE_CACHE_TTL_SECONDS: float = 86400.0  # 24 hours cache for static route geography

    LIVE_CACHE_TTL_SECONDS: float = 180.0  # 3 minutes disk cache for live status to prevent 429 exhaustion

    # Persistent disk cache path to avoid depleting the 10 req/min API quota
    _CACHE_DIR = Path(__file__).resolve().parent.parent.parent / "data"
    _DISK_CACHE_FILE = _CACHE_DIR / "route_cache.json"
    _DISK_LIVE_CACHE_FILE = _CACHE_DIR / "live_cache.json"

    def __init__(self):
        self.api_key = settings.RAILRADAR_API_KEY
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "x-api-key": self.api_key,
            "Accept": "application/json",
        } if self.api_key else {}
        self.timeout = 10.0
        self._ensure_cache_dir()

    def _ensure_cache_dir(self) -> None:
        try:
            self._CACHE_DIR.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            logger.warning(f"[RailRadarProvider] Could not create cache directory: {e}")

    def _load_disk_route_cache(self) -> Dict[str, Any]:
        if not self._DISK_CACHE_FILE.exists():
            return {}
        try:
            with open(self._DISK_CACHE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"[RailRadarProvider] Error loading disk route cache: {e}")
            return {}

    def _save_disk_route_cache(self, train_num: str, data: Dict[str, Any]) -> None:
        try:
            cache_data = self._load_disk_route_cache()
            cache_data[train_num] = {
                "timestamp": time.time(),
                "data": data,
            }
            with open(self._DISK_CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(cache_data, f, indent=2)
        except Exception as e:
            logger.warning(f"[RailRadarProvider] Error saving disk route cache: {e}")

    def _load_disk_live_cache(self) -> Dict[str, Any]:
        if not self._DISK_LIVE_CACHE_FILE.exists():
            return {}
        try:
            with open(self._DISK_LIVE_CACHE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"[RailRadarProvider] Error loading disk live cache: {e}")
            return {}

    def _save_disk_live_cache(self, train_num: str, data: Dict[str, Any]) -> None:
        try:
            cache_data = self._load_disk_live_cache()
            cache_data[train_num] = {
                "timestamp": time.time(),
                "data": data,
            }
            with open(self._DISK_LIVE_CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(cache_data, f, indent=2)
        except Exception as e:
            logger.warning(f"[RailRadarProvider] Error saving disk live cache: {e}")

    def get_live_status(self, train_number: str) -> Optional[Dict[str, Any]]:
        """
        Fetches live train status from RailRadar.
        Handles HTTP errors gracefully and normalizes the response.
        Uses in-memory & disk cache to prevent 429 rate limit errors on rapid sequential queries.
        """
        if not self.api_key:
            logger.error("[RailRadarProvider] RAILRADAR_API_KEY is not configured.")
            return None

        clean_train_num = str(train_number).strip()
        now = time.time()

        # 1. Check in-memory cache
        cached = self._cache.get(clean_train_num)
        if cached and (now - cached[0] < self.CACHE_TTL_SECONDS):
            logger.debug(f"[RailRadar] Using memory cached live telemetry for train {clean_train_num}")
            return cached[1]

        # 2. Check disk live cache
        disk_cache = self._load_disk_live_cache()
        disk_entry = disk_cache.get(clean_train_num)
        if disk_entry and (now - disk_entry.get("timestamp", 0) < self.LIVE_CACHE_TTL_SECONDS):
            logger.debug(f"[RailRadar] Using disk cached live telemetry for train {clean_train_num}")
            self._cache[clean_train_num] = (disk_entry["timestamp"], disk_entry["data"])
            return disk_entry["data"]

        endpoint = f"{self.BASE_URL}/trains/{clean_train_num}/live"
        logger.info(f"[RailRadar] Requesting train {clean_train_num}")

        for attempt in range(2):
            try:
                with httpx.Client(timeout=self.timeout) as client:
                    response = client.get(endpoint, headers=self.headers)

                if response.status_code == 200:
                    logger.info(f"[RailRadar] HTTP 200 for train {clean_train_num}")
                    data = response.json()
                    if not data.get("success"):
                        logger.warning(f"[RailRadarProvider] API returned unsuccessful payload for train {clean_train_num}: {data.get('message', 'No detail')}")
                        return None

                    logger.info(f"[RailRadar] Received live train data for {clean_train_num}")
                    normalized = self._normalize(clean_train_num, data.get("data", {}))
                    normalized["data_source"] = "railradar"
                    self._cache[clean_train_num] = (time.time(), normalized)
                    self._save_disk_live_cache(clean_train_num, normalized)
                    return normalized

                elif response.status_code == 401:
                    logger.error("[RailRadarProvider] 401 Unauthorized - Invalid or missing RailRadar API Key.")
                    return None
                elif response.status_code == 404:
                    logger.warning(f"[RailRadarProvider] 404 Not Found - Train {clean_train_num} has no live tracking data on RailRadar.")
                    return None
                elif response.status_code == 429:
                    logger.warning(f"[RailRadarProvider] 429 Too Many Requests for {clean_train_num} (attempt {attempt + 1}/2).")
                    if cached:
                        return cached[1]
                    if disk_entry:
                        logger.info(f"[RailRadarProvider] Returning disk cached data for {clean_train_num} due to 429.")
                        return disk_entry["data"]
                    if attempt < 1:
                        time.sleep(3.0)
                        continue
                    return None
                elif response.status_code == 503:
                    logger.warning(f"[RailRadarProvider] 503 Service Unavailable for {clean_train_num}.")
                    return None

            except httpx.TimeoutException:
                logger.error(f"[RailRadarProvider] Timeout after {self.timeout}s fetching data for train {clean_train_num}")
                if cached:
                    return cached[1]
                if disk_entry:
                    return disk_entry["data"]
                return None
            except Exception as e:
                logger.error(f"[RailRadarProvider] Unexpected exception fetching data for train {clean_train_num}: {e}")
                return None

        return disk_entry["data"] if disk_entry else (cached[1] if cached else None)

    def _is_stale(self, last_updated_str: Optional[str]) -> bool:
        """Determines if the provider's timestamp exceeds the configured freshness threshold."""
        if not last_updated_str:
            return False
        try:
            dt = datetime.fromisoformat(last_updated_str)
            if dt.tzinfo is not None:
                now = datetime.now(dt.tzinfo)
            else:
                now = datetime.utcnow()
            elapsed_seconds = abs((now - dt).total_seconds())
            return elapsed_seconds > settings.TRAIN_DATA_STALE_THRESHOLD_SECONDS
        except Exception:
            return False

    @staticmethod
    def _format_time_str(val: Optional[str]) -> Optional[str]:
        """Extracts HH:MM string from ISO timestamp or returns cleaned time string."""
        if not val:
            return None
        try:
            val_str = str(val).strip()
            if not val_str or val_str == "--":
                return None
            if "T" in val_str:
                time_part = val_str.split("T")[1]
                return time_part[:5]
            if " " in val_str:
                time_part = val_str.split(" ")[1]
                return time_part[:5]
            if len(val_str) >= 5 and ":" in val_str:
                return val_str[:5]
            return val_str
        except Exception:
            return None

    def _fetch_route_metadata(self, clean_train_num: str) -> Dict[str, Any]:
        """
        Fetches static route stations and geometry LineString for the train:
        - GET /trains/{clean_train_num} for station coordinates map
        - GET /trains/{clean_train_num}/route for track LineString coordinates
        Uses memory cache and persistent 24-hour disk cache to strictly prevent 429 rate limits.
        """
        now = time.time()
        # 1. Check in-memory cache
        cached = self._route_cache.get(clean_train_num)
        if cached and (now - cached[0] < self.ROUTE_CACHE_TTL_SECONDS):
            return cached[1]

        # 2. Check persistent disk cache
        disk_cache = self._load_disk_route_cache()
        disk_entry = disk_cache.get(clean_train_num)
        if disk_entry:
            ts = disk_entry.get("timestamp", 0)
            data = disk_entry.get("data")
            if data and (now - ts < self.ROUTE_CACHE_TTL_SECONDS):
                self._route_cache[clean_train_num] = (now, data)
                return data

        station_coords_map: Dict[str, Dict[str, Any]] = {}
        stations_list: List[Dict[str, Any]] = []
        route_coordinates: List[List[float]] = []

        try:
            with httpx.Client(timeout=self.timeout) as client:
                # 1. Fetch train stations and coordinates
                r_train = client.get(f"{self.BASE_URL}/trains/{clean_train_num}", headers=self.headers)
                if r_train.status_code == 200:
                    t_data = r_train.json().get("data", {})
                    route_items = t_data.get("route") or []
                    for item in route_items:
                        st = item.get("station") or {}
                        code = (st.get("code") or "").strip().upper()
                        if code:
                            raw_lat = st.get("lat")
                            raw_lng = st.get("lng")
                            norm = normalize_lat_lng(raw_lat, raw_lng) if (raw_lat is not None and raw_lng is not None) else None
                            lat = norm[0] if norm else None
                            lng = norm[1] if norm else None

                            st_info = {
                                "code": code,
                                "name": st.get("name") or code,
                                "lat": lat,
                                "lng": lng,
                                "sequence": item.get("sequence"),
                                "distance": float(item.get("distance", 0.0)),
                            }
                            station_coords_map[code] = st_info
                            stations_list.append({
                                "sequence": item.get("sequence", len(stations_list) + 1),
                                "station_name": st.get("name") or code,
                                "name": st.get("name") or code,
                                "station_code": code,
                                "code": code,
                                "latitude": lat,
                                "longitude": lng,
                                "distance_from_source": float(item.get("distance", 0.0)),
                            })
                elif r_train.status_code == 429:
                    logger.warning(f"[RailRadarProvider] Rate limit 429 when fetching metadata for {clean_train_num}.")
                    if disk_entry and disk_entry.get("data"):
                        return disk_entry["data"]

                # 2. Fetch track GeoJSON geometry LineString
                r_route = client.get(f"{self.BASE_URL}/trains/{clean_train_num}/route", headers=self.headers)
                if r_route.status_code == 200:
                    geojson = r_route.json().get("data", {}).get("geojson", {})
                    geometry = geojson.get("geometry", {})
                    coords = geometry.get("coordinates", [])
                    # GeoJSON is [lng, lat]. normalize_lat_lng handles ordering safely.
                    for pt in coords:
                        if isinstance(pt, (list, tuple)) and len(pt) >= 2:
                            norm_pt = normalize_lat_lng(pt[0], pt[1])
                            if norm_pt:
                                route_coordinates.append(norm_pt)
                elif r_route.status_code == 429:
                    logger.warning(f"[RailRadarProvider] Rate limit 429 when fetching route geometry for {clean_train_num}.")
                    if disk_entry and disk_entry.get("data"):
                        return disk_entry["data"]

        except Exception as e:
            logger.warning(f"[RailRadarProvider] Could not fetch route metadata for train {clean_train_num}: {e}")
            if disk_entry and disk_entry.get("data"):
                return disk_entry["data"]

        result = {
            "station_coords_map": station_coords_map,
            "stations_list": stations_list,
            "route_coordinates": route_coordinates,
        }

        # Cache result if valid data retrieved
        if stations_list or route_coordinates:
            self._route_cache[clean_train_num] = (now, result)
            self._save_disk_route_cache(clean_train_num, result)

        return result

    def _normalize(self, requested_train: str, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transforms RailRadar specific JSON into the normalized internal structure.
        Uses authoritative geo_utils for coordinate validation, speed resolution, and
        dynamic journey origin/destination determination.
        """
        train_num_str = str(raw_data.get("trainNumber", requested_train)).strip()
        current_loc = raw_data.get("currentLocation") or {}
        prev_halt = raw_data.get("previousHalt") or {}
        next_halt = raw_data.get("nextHalt") or {}

        current_station_name = current_loc.get("stationName")
        current_station_code = current_loc.get("stationCode")
        current_station = current_station_name or current_station_code

        prev_station_name = prev_halt.get("stationName")
        prev_station_code = prev_halt.get("stationCode")

        next_station_name = next_halt.get("stationName")
        next_station_code = next_halt.get("stationCode")

        # Signed delay preservation
        raw_delay = raw_data.get("delayMinutes")
        if raw_delay is None:
            raw_delay = current_loc.get("delayMinutes", 0)
        try:
            delay_minutes = int(raw_delay)
        except (ValueError, TypeError):
            delay_minutes = 0

        # Fetch route metadata (station coordinates and track geometry)
        route_meta = self._fetch_route_metadata(train_num_str)
        st_coords_map = route_meta.get("station_coords_map", {})
        stations_list = route_meta.get("stations_list", [])
        route_coordinates = route_meta.get("route_coordinates", [])

        halts_raw = raw_data.get("halts") or raw_data.get("route") or []

        # 1. Dynamic Speed Resolution via geo_utils
        speed_kmph, speed_src, speed_status = extract_speed(raw_data, current_loc, halts_raw)

        # 2. Dynamic Source & Destination Resolution via geo_utils
        source_obj, dest_obj = extract_source_destination(raw_data, halts_raw, st_coords_map)

        # 3. Direct GPS coordinates & Speed from currentLocation
        raw_lat = current_loc.get("lat")
        raw_lng = current_loc.get("lng")
        norm_direct = normalize_lat_lng(raw_lat, raw_lng) if (raw_lat is not None and raw_lng is not None) else None

        # Resolve authentic train position
        curr_code_clean = current_station_code.strip().upper() if current_station_code else ""
        next_code_clean = next_station_code.strip().upper() if next_station_code else ""
        curr_st_coord = st_coords_map.get(curr_code_clean)
        next_st_coord = st_coords_map.get(next_code_clean)

        station_lat = curr_st_coord.get("lat") if curr_st_coord else None
        station_lng = curr_st_coord.get("lng") if curr_st_coord else None

        latitude = None
        longitude = None
        location_type = None

        if norm_direct:
            latitude = norm_direct[0]
            longitude = norm_direct[1]
            location_type = "GPS"
        elif curr_st_coord and is_valid_coordinate(curr_st_coord.get("lat"), curr_st_coord.get("lng")):
            status_val = (current_loc.get("status") or "").lower()
            segment_prog = current_loc.get("segmentProgress")
            try:
                prog_val = float(segment_prog) if segment_prog is not None else None
            except (ValueError, TypeError):
                prog_val = None

            if (
                status_val == "departed"
                and prog_val is not None
                and 0.0 <= prog_val <= 1.0
                and next_st_coord
                and is_valid_coordinate(next_st_coord.get("lat"), next_st_coord.get("lng"))
            ):
                # Mathematically consistent interpolation along segment between stations
                c_lat, c_lng = curr_st_coord["lat"], curr_st_coord["lng"]
                n_lat, n_lng = next_st_coord["lat"], next_st_coord["lng"]
                latitude = round(c_lat + prog_val * (n_lat - c_lat), 7)
                longitude = round(c_lng + prog_val * (n_lng - c_lng), 7)
                location_type = "ESTIMATED"
            else:
                latitude = curr_st_coord["lat"]
                longitude = curr_st_coord["lng"]
                location_type = "STATION"
        elif next_st_coord and is_valid_coordinate(next_st_coord.get("lat"), next_st_coord.get("lng")):
            latitude = next_st_coord["lat"]
            longitude = next_st_coord["lng"]
            location_type = "STATION"
        else:
            latitude = None
            longitude = None
            location_type = "UNAVAILABLE"

        last_updated = raw_data.get("lastUpdatedAt")
        is_live_flag = bool(raw_data.get("isLive", True))

        if self._is_stale(last_updated) or not is_live_flag:
            data_status = "STALE"
        else:
            data_status = "LIVE"

        # Locate indices for current and next stations to determine sequence progression
        curr_idx = -1
        next_idx = -1
        for idx, h in enumerate(halts_raw):
            code = (h.get("stationCode") or "").strip()
            raw_st = (h.get("status") or "").lower()
            if code and current_station_code and code.upper() == current_station_code.upper():
                curr_idx = idx
            elif raw_st == "at-station" and curr_idx == -1:
                curr_idx = idx
            if code and next_station_code and code.upper() == next_station_code.upper():
                next_idx = idx

        # Build normalized timeline items enriched with coordinates
        timeline = []
        for idx, h in enumerate(halts_raw):
            code = (h.get("stationCode") or h.get("station_code") or "").strip().upper()
            name = (h.get("stationName") or h.get("station_name") or code).strip()
            is_halt = bool(h.get("isHalt", True))
            raw_status = (h.get("status") or "").lower()

            if (current_station_code and code == current_station_code.upper()) or raw_status == "at-station":
                status = "CURRENT"
                state = "current"
            elif next_station_code and code == next_station_code.upper():
                status = "NEXT"
                state = "next"
            elif curr_idx != -1 and idx < curr_idx:
                status = "COMPLETED"
                state = "completed"
            elif curr_idx != -1 and idx > curr_idx:
                status = "UPCOMING"
                state = "upcoming"
            elif next_idx != -1 and idx < next_idx:
                status = "COMPLETED"
                state = "completed"
            elif next_idx != -1 and idx > next_idx:
                status = "UPCOMING"
                state = "upcoming"
            elif raw_status in ("departed", "completed"):
                status = "COMPLETED"
                state = "completed"
            else:
                status = "UPCOMING"
                state = "upcoming"

            delay_val = h.get("delayArrival")
            if delay_val is None:
                delay_val = h.get("delayDeparture")
            try:
                st_delay = int(delay_val) if delay_val is not None else 0
            except (ValueError, TypeError):
                st_delay = 0

            dist_val = h.get("distance")
            try:
                distance = float(dist_val) if dist_val is not None else 0.0
            except (ValueError, TypeError):
                distance = 0.0

            speed_val = h.get("speedToNextStationKmph")
            try:
                speed_to_next = float(speed_val) if speed_val is not None else None
            except (ValueError, TypeError):
                speed_to_next = None

            sch_arr = self._format_time_str(h.get("scheduledArrival") or h.get("scheduled_arrival"))
            sch_dep = self._format_time_str(h.get("scheduledDeparture") or h.get("scheduled_departure"))
            act_arr = self._format_time_str(h.get("actualArrival") or h.get("actual_arrival"))
            act_dep = self._format_time_str(h.get("actualDeparture") or h.get("actual_departure"))

            raw_platform = h.get("platform")
            platform = str(raw_platform).strip() if raw_platform is not None and str(raw_platform).strip() else None

            st_geo = st_coords_map.get(code, {})
            st_lat = st_geo.get("lat")
            st_lng = st_geo.get("lng")

            timeline.append({
                "sequence": int(h.get("sequence", idx + 1)),
                "station_code": code,
                "station_name": name,
                "code": code,
                "name": name,
                "latitude": st_lat,
                "longitude": st_lng,
                "is_halt": is_halt,
                "isHalt": is_halt,
                "status": status,
                "state": state,
                "scheduled_arrival": sch_arr,
                "scheduled_departure": sch_dep,
                "actual_arrival": act_arr,
                "actual_departure": act_dep,
                "scheduledArr": sch_arr or "--",
                "scheduledDep": sch_dep or "--",
                "actualArr": act_arr or "--",
                "actualDep": act_dep or "--",
                "delay_minutes": st_delay,
                "delayMin": st_delay,
                "platform": f"Pf {platform}" if platform and not platform.lower().startswith("pf") else platform,
                "distance": distance,
                "distance_from_source": distance,
                "speed_to_next_kmph": speed_to_next,
                "data_source": "railradar",
            })

        return {
            "id": train_num_str,
            "train_id": train_num_str,
            "train_number": train_num_str,
            "train_name": raw_data.get("trainName") or f"Express {train_num_str}",
            "source": source_obj["name"],
            "source_code": source_obj["code"],
            "source_name": source_obj["name"],
            "source_latitude": source_obj["latitude"],
            "source_longitude": source_obj["longitude"],
            "source_station": source_obj["name"],
            "source_details": source_obj,
            "destination": dest_obj["name"],
            "destination_code": dest_obj["code"],
            "destination_name": dest_obj["name"],
            "destination_latitude": dest_obj["latitude"],
            "destination_longitude": dest_obj["longitude"],
            "destination_station": dest_obj["name"],
            "destination_details": dest_obj,
            "current_station": current_station,
            "current_station_code": current_station_code,
            "previous_station": prev_station_name or prev_station_code,
            "previous_station_code": prev_station_code,
            "next_station": next_station_name or next_station_code,
            "next_station_code": next_station_code,
            "current_delay_minutes": delay_minutes,
            "delay_minutes": delay_minutes,
            "status": "ON_TIME" if abs(delay_minutes) <= 5 else ("MINOR_DELAY" if abs(delay_minutes) <= 15 else "MAJOR_DELAY"),
            "scheduled_arrival": None,
            "scheduled_departure": None,
            "actual_arrival": None,
            "actual_departure": None,
            "latitude": latitude,
            "longitude": longitude,
            "location_type": location_type,
            "station_latitude": station_lat,
            "station_longitude": station_lng,
            "speed_kmph": speed_kmph,
            "speed": speed_kmph,
            "speed_status": speed_status,
            "speedStatus": speed_status,
            "speed_unit": "km/h",
            "timestamp": last_updated or datetime.utcnow().isoformat(),
            "source_type": "RAILRADAR",
            "data_source": "railradar",
            "data_status": data_status,
            "is_live": is_live_flag,
            "tracking_mode": raw_data.get("trackingMode"),
            "timeline": timeline,
            "halts": timeline,
            "stations": stations_list if stations_list else timeline,
            "route_coordinates": route_coordinates,
        }
