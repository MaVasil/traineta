"""RailRadar Data Provider for live railway operational telemetry."""
import httpx
import logging
import time
from typing import Dict, Any, Optional, Tuple, List
from datetime import datetime, timezone
from app.config import settings
from app.services.provider_base import DataProvider

logger = logging.getLogger(__name__)

class RailRadarProvider(DataProvider):
    """
    Client for RailRadar API.
    Provides live train status and normalizes the response into standardized schema.
    """
    BASE_URL = "https://api.railradar.in/v1"
    _cache: Dict[str, Tuple[float, Dict[str, Any]]] = {}
    CACHE_TTL_SECONDS: float = 30.0

    def __init__(self):
        self.api_key = settings.RAILRADAR_API_KEY
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json"
        } if self.api_key else {}
        self.timeout = 10.0

    def get_live_status(self, train_number: str) -> Optional[Dict[str, Any]]:
        """
        Fetches live train status from RailRadar.
        Handles HTTP errors gracefully and normalizes the response.
        Uses in-memory cache to prevent 429 rate limit errors on rapid sequential queries.
        """
        if not self.api_key:
            logger.error("[RailRadarProvider] RAILRADAR_API_KEY is not configured.")
            return None

        clean_train_num = str(train_number).strip()
        now = time.time()
        cached = self._cache.get(clean_train_num)
        if cached and (now - cached[0] < self.CACHE_TTL_SECONDS):
            logger.debug(f"[RailRadar] Using cached live telemetry for train {clean_train_num}")
            return cached[1]

        endpoint = f"{self.BASE_URL}/trains/{clean_train_num}/live"
        logger.info(f"[RailRadar] Requesting train {clean_train_num}")
        
        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.get(endpoint, headers=self.headers)
            
            if response.status_code == 200:
                logger.info(f"[RailRadar] HTTP 200")
            elif response.status_code == 401:
                logger.error("[RailRadarProvider] 401 Unauthorized - Invalid or missing RailRadar API Key.")
                return None
            elif response.status_code == 404:
                logger.warning(f"[RailRadarProvider] 404 Not Found - Train {clean_train_num} has no live tracking data on RailRadar.")
                return None
            elif response.status_code == 429:
                logger.warning("[RailRadarProvider] 429 Too Many Requests - RailRadar API rate limit reached.")
                if cached:
                    logger.info(f"[RailRadarProvider] Returning recent cached data for {clean_train_num} due to 429 rate limit.")
                    return cached[1]
                return None
            elif response.status_code == 503:
                logger.warning(f"[RailRadarProvider] 503 Service Unavailable - RailRadar upstream service error for {clean_train_num}.")
                return None
            
            response.raise_for_status()
            data = response.json()
            
            if not data.get("success"):
                logger.warning(f"[RailRadarProvider] API returned unsuccessful payload for train {clean_train_num}: {data.get('message', 'No detail')}")
                return None
            
            logger.info(f"[RailRadar] Received live train data")
            normalized = self._normalize(clean_train_num, data.get("data", {}))
            normalized["data_source"] = "railradar"
            logger.info(f"[Backend] Returning RailRadar-derived data to frontend")
            self._cache[clean_train_num] = (time.time(), normalized)
            return normalized
            
        except httpx.TimeoutException:
            logger.error(f"[RailRadarProvider] Timeout after {self.timeout}s fetching data for train {clean_train_num}")
            return None
        except httpx.RequestError as e:
            logger.error(f"[RailRadarProvider] Network/HTTP request error for train {clean_train_num}: {e}")
            return None
        except Exception as e:
            logger.error(f"[RailRadarProvider] Unexpected exception fetching train {clean_train_num}: {e}")
            return None

    def _is_stale(self, last_updated_str: Optional[str]) -> bool:
        """Determines if the provider's timestamp exceeds the configured freshness threshold."""
        if not last_updated_str:
            return False
        try:
            # Handle ISO format with or without timezone
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

    def _normalize(self, requested_train: str, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transforms RailRadar specific JSON into the normalized internal structure.
        Uses null/None for unavailable fields rather than fabricating fake coordinates or speeds.
        Preserves signed delay values (negative = ahead of schedule, zero = on time, positive = delayed).
        Constructs rich route timeline from real RailRadar halts with accurate progression status.
        """
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

        # Coordinates & Speed: strictly None if absent or not provided
        lat = current_loc.get("lat")
        lng = current_loc.get("lng")
        speed = current_loc.get("speed")
        
        latitude = float(lat) if lat is not None else None
        longitude = float(lng) if lng is not None else None
        speed_kmph = int(speed) if speed is not None else None

        last_updated = raw_data.get("lastUpdatedAt")
        is_live_flag = bool(raw_data.get("isLive", True))
        
        # Determine data_status: LIVE vs STALE
        if self._is_stale(last_updated) or not is_live_flag:
            data_status = "STALE"
        else:
            data_status = "LIVE"

        halts_raw = raw_data.get("halts") or raw_data.get("route") or []
        source_city = raw_data.get("source") or (halts_raw[0].get("stationName") if halts_raw else "Origin")
        source_code = (halts_raw[0].get("stationCode") if halts_raw else "SRC")
        dest_city = raw_data.get("destination") or (halts_raw[-1].get("stationName") if halts_raw else "Destination")
        dest_code = (halts_raw[-1].get("stationCode") if halts_raw else "DST")

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

        # Build normalized timeline items
        timeline = []
        for idx, h in enumerate(halts_raw):
            code = (h.get("stationCode") or h.get("station_code") or "").strip()
            name = (h.get("stationName") or h.get("station_name") or code).strip()
            is_halt = bool(h.get("isHalt", True))
            raw_status = (h.get("status") or "").lower()

            if (current_station_code and code.upper() == current_station_code.upper()) or raw_status == "at-station":
                status = "CURRENT"
                state = "current"
            elif next_station_code and code.upper() == next_station_code.upper():
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

            # Parse delays
            delay_val = h.get("delayArrival")
            if delay_val is None:
                delay_val = h.get("delayDeparture")
            try:
                st_delay = int(delay_val) if delay_val is not None else 0
            except (ValueError, TypeError):
                st_delay = 0

            # Parse distance
            dist_val = h.get("distance")
            try:
                distance = float(dist_val) if dist_val is not None else 0.0
            except (ValueError, TypeError):
                distance = 0.0

            # Parse speed
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

            timeline.append({
                "sequence": int(h.get("sequence", idx + 1)),
                "station_code": code,
                "station_name": name,
                "code": code,
                "name": name,
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
                "data_source": "railradar"
            })

        return {
            "id": str(raw_data.get("trainNumber", requested_train)),
            "train_id": str(raw_data.get("trainNumber", requested_train)),
            "train_number": str(raw_data.get("trainNumber", requested_train)),
            "train_name": raw_data.get("trainName") or f"Express {requested_train}",
            "source": source_city,
            "source_code": source_code,
            "destination": dest_city,
            "destination_code": dest_code,
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
            "speed_kmph": speed_kmph,
            "speed": speed_kmph,
            "timestamp": last_updated or datetime.utcnow().isoformat(),
            "source_type": "RAILRADAR",
            "data_source": "railradar",
            "data_status": data_status,
            "is_live": is_live_flag,
            "tracking_mode": raw_data.get("trackingMode"),
            "timeline": timeline,
            "halts": timeline
        }
