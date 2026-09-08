import os
import uuid
import time
import logging
import httpx
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models.train import Train
from app.models.station import Station
from app.models.train_position import TrainPosition
from app.services.provider_factory import get_provider
from app.services.provider_base import DataProvider

logger = logging.getLogger("traineta.pipeline")

class RealtimePipeline:
    """
    Real-Time Operational Data Pipeline (Phase 5).
    Continuously collects, normalizes, validates, and persists real operational train snapshots
    into Supabase train_positions for building historical operational datasets.
    """
    _last_run_timestamp: Optional[str] = None
    _total_cycles: int = 0
    _total_snapshots_persisted: int = 0
    _last_cycle_stats: Dict[str, Any] = {}
    _backoff_until: float = 0.0
    _dynamic_active_trains: set = set()

    @classmethod
    def register_dynamic_train(cls, train_number: str) -> None:
        """Registers a dynamically discovered train into the active pipeline tracking set."""
        clean_num = str(train_number).strip()
        if clean_num and clean_num not in cls._dynamic_active_trains:
            cls._dynamic_active_trains.add(clean_num)
            logger.info(f"[RealtimePipeline] Train {clean_num} registered in dynamic active tracking set. Total dynamic: {len(cls._dynamic_active_trains)}")

    @classmethod
    def get_configured_train_numbers(cls, db: Optional[Session] = None) -> List[str]:
        """
        Returns a controlled, deduplicated list of active train numbers to poll.
        Combines configured PIPELINE_ACTIVE_TRAINS with dynamically discovered trains and database trains.
        """
        configured_str = settings.PIPELINE_ACTIVE_TRAINS or ""
        configured_list = [t.strip() for t in configured_str.split(",") if t.strip()]

        # Combine configured + dynamic trains
        all_trains = set(configured_list).union(cls._dynamic_active_trains)

        if all_trains:
            return sorted(list(all_trains))

        # Fallback to database trains
        if db:
            try:
                db_trains = db.query(Train.train_number).all()
                return [t[0] for t in db_trains if t[0]]
            except Exception as e:
                logger.warning(f"[RealtimePipeline] Could not query trains from database: {e}")

        # Supabase REST fallback if db query fails
        return cls._fetch_train_numbers_from_supabase_rest()

    @classmethod
    def _fetch_train_numbers_from_supabase_rest(cls) -> List[str]:
        """Queries train numbers directly from Supabase REST API as fallback."""
        if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
            return ["12759", "12760", "12401", "12605", "12728", "12704", "12616"]
        try:
            headers = {
                "apikey": settings.SUPABASE_KEY,
                "Authorization": f"Bearer {settings.SUPABASE_KEY}"
            }
            with httpx.Client(timeout=5.0) as client:
                r = client.get(f"{settings.SUPABASE_URL}/rest/v1/trains?select=train_number", headers=headers)
                if r.status_code == 200:
                    return [item["train_number"] for item in r.json() if "train_number" in item]
        except Exception as e:
            logger.warning(f"[RealtimePipeline] Supabase REST train query fallback failed: {e}")
        return ["12759", "12760", "12401", "12605", "12728", "12704", "12616"]

    @classmethod
    def resolve_station(cls, db: Optional[Session], station_code_or_name: Optional[str]) -> Optional[str]:
        """
        Resolves station code or name against public.stations.
        Prefers station_code, falls back to station_name / city.
        Returns station UUID string if found, otherwise None.
        Never fabricates fake stations.
        """
        if not station_code_or_name:
            return None

        clean_val = str(station_code_or_name).strip()
        
        if db:
            try:
                # 1. Try exact station_code match
                st = db.query(Station).filter(Station.station_code.ilike(clean_val)).first()
                if st:
                    return st.id
                # 2. Try station_name match
                st = db.query(Station).filter(Station.station_name.ilike(clean_val)).first()
                if st:
                    return st.id
                # 3. Try city match
                st = db.query(Station).filter(Station.city.ilike(clean_val)).first()
                if st:
                    return st.id
            except Exception as e:
                logger.debug(f"[RealtimePipeline] DB station lookup exception for '{clean_val}': {e}")

        # Supabase REST fallback for station lookup
        if settings.SUPABASE_URL and settings.SUPABASE_KEY:
            try:
                headers = {
                    "apikey": settings.SUPABASE_KEY,
                    "Authorization": f"Bearer {settings.SUPABASE_KEY}"
                }
                with httpx.Client(timeout=3.0) as client:
                    # Query by code
                    r = client.get(f"{settings.SUPABASE_URL}/rest/v1/stations?station_code=ilike.{clean_val}&select=id", headers=headers)
                    if r.status_code == 200 and r.json():
                        return r.json()[0]["id"]
                    # Query by name
                    r = client.get(f"{settings.SUPABASE_URL}/rest/v1/stations?station_name=ilike.{clean_val}&select=id", headers=headers)
                    if r.status_code == 200 and r.json():
                        return r.json()[0]["id"]
            except Exception as e:
                logger.debug(f"[RealtimePipeline] Supabase REST station lookup failed for '{clean_val}': {e}")

        # Auto-provision station dynamically into public.stations
        KNOWN_STATION_COORDS = {
            "SC": ("Secunderabad Jn", "Secunderabad", 17.4334, 78.5042),
            "HYB": ("Hyderabad Deccan", "Hyderabad", 17.3917, 78.4716),
            "SPE": ("Sullurupeta", "Sullurupeta", 13.7020, 80.0210),
            "GDR": ("Gudur Junction", "Gudur", 14.1463, 79.8504),
            "NLR": ("Nellore", "Nellore", 14.4426, 79.9865),
            "OGL": ("Ongole", "Ongole", 15.5057, 80.0499),
            "CLX": ("Chirala", "Chirala", 15.8246, 80.3521),
            "BPP": ("Bapatla", "Bapatla", 15.9042, 80.4674),
            "TEL": ("Tenali Junction", "Tenali", 16.2430, 80.6400),
            "KMT": ("Khammam", "Khammam", 17.2473, 80.1514),
            "MABD": ("Mahbubabad", "Mahbubabad", 17.5986, 80.0039),
            "SKZR": ("Sirpur Kaghaznagar", "Kaghaznagar", 19.3314, 79.4842),
            "BPQ": ("Balharshah", "Balharshah", 19.8540, 79.3510),
            "NGP": ("Nagpur", "Nagpur", 21.1524, 79.0888),
            "R": ("Raipur", "Raipur", 21.2514, 81.6296),
            "BSP": ("Bilaspur", "Bilaspur", 22.0797, 82.1409),
            "TATA": ("Tatanagar", "Jamshedpur", 22.7719, 86.2029),
            "HWH": ("Howrah", "Kolkata", 22.5850, 88.3426),
            "MAS": ("Chennai Central", "Chennai", 13.0827, 80.2707),
            "MS": ("Chennai Egmore", "Chennai", 13.0802, 80.2612),
            "TBM": ("Tambaram", "Chennai", 12.9249, 80.1000),
            "BZA": ("Vijayawada Junction", "Vijayawada", 16.5186, 80.6198),
            "KZJ": ("Kazipet Junction", "Kazipet", 17.9784, 79.5218),
            "WL": ("Warangal", "Warangal", 17.9689, 79.5941),
        }
        clean_code = clean_val.upper()[:10]
        st_meta = KNOWN_STATION_COORDS.get(clean_code)
        st_name = st_meta[0] if st_meta else clean_val[:100]
        st_city = st_meta[1] if st_meta else clean_val[:100]
        st_lat = st_meta[2] if st_meta else 0.0
        st_lng = st_meta[3] if st_meta else 0.0

        if db:
            try:
                new_st = Station(
                    id=str(uuid.uuid4()),
                    station_code=clean_code,
                    station_name=st_name,
                    city=st_city,
                    latitude=st_lat,
                    longitude=st_lng
                )
                db.add(new_st)
                db.commit()
                logger.info(f"[RealtimePipeline] Auto-provisioned missing station {clean_code} ({st_name}) into public.stations.")
                return new_st.id
            except Exception as e:
                db.rollback()
                logger.debug(f"[RealtimePipeline] Station auto-provision exception for '{clean_val}': {e}")

        if settings.SUPABASE_URL and settings.SUPABASE_KEY:
            try:
                headers = {
                    "apikey": settings.SUPABASE_KEY,
                    "Authorization": f"Bearer {settings.SUPABASE_KEY}",
                    "Content-Type": "application/json",
                    "Prefer": "return=representation"
                }
                with httpx.Client(timeout=3.0) as client:
                    st_id = str(uuid.uuid4())
                    r = client.post(
                        f"{settings.SUPABASE_URL}/rest/v1/stations",
                        headers=headers,
                        json={
                            "id": st_id,
                            "station_code": clean_code,
                            "station_name": st_name,
                            "city": st_city,
                            "latitude": st_lat,
                            "longitude": st_lng
                        }
                    )
                    if r.status_code in (200, 201) and r.json():
                        logger.info(f"[RealtimePipeline] Auto-provisioned missing station {clean_code} ({st_name}) via Supabase REST.")
                        return r.json()[0]["id"]
            except Exception as e:
                logger.debug(f"[RealtimePipeline] Supabase REST auto-provision failed for '{clean_val}': {e}")

        logger.info(f"[RealtimePipeline] Station reference '{clean_val}' could not be resolved to a known station in public.stations. Setting FK to NULL.")
        return None

    # Alias for backwards compatibility
    resolve_station_reference = resolve_station


    @classmethod
    def resolve_train_id(cls, db: Optional[Session], train_number: str) -> Optional[str]:
        """Finds the database UUID for a train number."""
        clean_num = str(train_number).strip()
        if db:
            try:
                tr = db.query(Train).filter(Train.train_number == clean_num).first()
                if tr:
                    return tr.id
            except Exception as e:
                logger.debug(f"[RealtimePipeline] DB train lookup exception for '{clean_num}': {e}")

        if settings.SUPABASE_URL and settings.SUPABASE_KEY:
            try:
                headers = {
                    "apikey": settings.SUPABASE_KEY,
                    "Authorization": f"Bearer {settings.SUPABASE_KEY}"
                }
                with httpx.Client(timeout=3.0) as client:
                    r = client.get(f"{settings.SUPABASE_URL}/rest/v1/trains?train_number=eq.{clean_num}&select=id", headers=headers)
                    if r.status_code == 200 and r.json():
                        return r.json()[0]["id"]
            except Exception as e:
                logger.debug(f"[RealtimePipeline] Supabase REST train lookup failed for '{clean_num}': {e}")

        return None

    @classmethod
    def should_deduplicate(
        cls,
        db: Optional[Session],
        train_id: str,
        current_station_id: Optional[str],
        current_delay_minutes: int,
        data_status: str,
        min_interval_seconds: int = 60
    ) -> bool:
        """
        Deduplication rule: Skips inserting an exact duplicate snapshot if the latest
        persisted observation for this train has identical station, delay, and status
        recorded within min_interval_seconds.
        """
        # Try checking via DB session
        if db:
            try:
                latest = (
                    db.query(TrainPosition)
                    .filter(TrainPosition.train_id == train_id)
                    .order_by(TrainPosition.recorded_at.desc())
                    .first()
                )
                if latest:
                    # Check field match
                    same_station = (latest.current_station_id == current_station_id)
                    same_delay = (latest.current_delay_minutes == current_delay_minutes)
                    same_status = (latest.data_status == data_status)
                    if same_station and same_delay and same_status and latest.recorded_at:
                        now = datetime.utcnow()
                        if (now - latest.recorded_at).total_seconds() < min_interval_seconds:
                            return True
            except Exception as e:
                logger.debug(f"[RealtimePipeline] DB deduplication check failed: {e}")

        # Supabase REST fallback deduplication check
        if settings.SUPABASE_URL and settings.SUPABASE_KEY:
            try:
                headers = {
                    "apikey": settings.SUPABASE_KEY,
                    "Authorization": f"Bearer {settings.SUPABASE_KEY}"
                }
                with httpx.Client(timeout=3.0) as client:
                    r = client.get(
                        f"{settings.SUPABASE_URL}/rest/v1/train_positions?train_id=eq.{train_id}&order=recorded_at.desc&limit=1",
                        headers=headers
                    )
                    if r.status_code == 200 and r.json():
                        latest_row = r.json()[0]
                        same_station = (latest_row.get("current_station_id") == current_station_id)
                        same_delay = (latest_row.get("current_delay_minutes") == current_delay_minutes)
                        same_status = (latest_row.get("data_status") == data_status)
                        if same_station and same_delay and same_status and latest_row.get("recorded_at"):
                            try:
                                rec_dt = datetime.fromisoformat(latest_row["recorded_at"].replace("Z", "+00:00"))
                                now = datetime.now(timezone.utc) if rec_dt.tzinfo else datetime.utcnow()
                                if abs((now - rec_dt).total_seconds()) < min_interval_seconds:
                                    return True
                            except Exception:
                                pass
            except Exception as e:
                logger.debug(f"[RealtimePipeline] REST deduplication check failed: {e}")

        return False

    @classmethod
    def persist_snapshot(
        cls,
        db: Optional[Session],
        train_id: str,
        normalized_data: Dict[str, Any],
        current_station_id: Optional[str],
        next_station_id: Optional[str]
    ) -> Optional[str]:
        """
        Persists a validated operational snapshot to train_positions.
        Supports SQLAlchemy session with direct Supabase REST resilience.
        Returns the created snapshot record ID.
        """
        snapshot_id = str(uuid.uuid4())
        recorded_at_dt = datetime.utcnow()
        recorded_at_iso = recorded_at_dt.isoformat()

        # Extract values
        latitude = normalized_data.get("latitude")
        longitude = normalized_data.get("longitude")
        speed = normalized_data.get("speed_kmph")
        current_delay = int(normalized_data.get("current_delay_minutes", 0))
        data_source = normalized_data.get("source", "RAILRADAR")
        data_status = normalized_data.get("data_status", "LIVE")

        persisted = False

        # Attempt 1: SQLAlchemy session
        if db:
            try:
                pos = TrainPosition(
                    id=snapshot_id,
                    train_id=train_id,
                    latitude=latitude,
                    longitude=longitude,
                    speed=speed,
                    current_station_id=current_station_id,
                    next_station_id=next_station_id,
                    current_delay_minutes=current_delay,
                    recorded_at=recorded_at_dt,
                    data_source=data_source,
                    data_status=data_status
                )
                db.add(pos)
                db.commit()
                persisted = True
                logger.info(f"[RealtimePipeline] Persisted snapshot {snapshot_id} for train_id {train_id} via SQLAlchemy.")
            except Exception as e:
                db.rollback()
                logger.warning(f"[RealtimePipeline] SQLAlchemy persist failed, falling back to Supabase REST: {e}")

        # Attempt 2: Supabase REST API
        if not persisted and settings.SUPABASE_URL and settings.SUPABASE_KEY:
            try:
                headers = {
                    "apikey": settings.SUPABASE_KEY,
                    "Authorization": f"Bearer {settings.SUPABASE_KEY}",
                    "Content-Type": "application/json",
                    "Prefer": "return=representation"
                }
                payload = {
                    "id": snapshot_id,
                    "train_id": train_id,
                    "latitude": latitude,
                    "longitude": longitude,
                    "speed": speed,
                    "current_station_id": current_station_id,
                    "next_station_id": next_station_id,
                    "current_delay_minutes": current_delay,
                    "recorded_at": recorded_at_iso,
                    "data_source": data_source,
                    "data_status": data_status
                }
                with httpx.Client(timeout=8.0) as client:
                    r = client.post(f"{settings.SUPABASE_URL}/rest/v1/train_positions", headers=headers, json=payload)
                    if r.status_code in (200, 201):
                        persisted = True
                        logger.info(f"[RealtimePipeline] Persisted snapshot {snapshot_id} for train_id {train_id} via Supabase REST API.")
                    else:
                        logger.error(f"[RealtimePipeline] Supabase REST persist failed: HTTP {r.status_code} - {r.text}")
            except Exception as e:
                logger.error(f"[RealtimePipeline] Supabase REST persist exception: {e}")

        if persisted:
            cls._total_snapshots_persisted += 1
            return snapshot_id
        return None

    @classmethod
    def poll_train(cls, train_number: str, provider: Optional[DataProvider] = None, db: Optional[Session] = None) -> Dict[str, Any]:
        """
        Executes pipeline workflow for a single train:
        1. Fetch live data through provider abstraction
        2. Normalize and validate response
        3. Resolve station references
        4. Check deduplication
        5. Persist operational snapshot to train_positions
        """
        clean_train = str(train_number).strip()
        active_provider = provider or get_provider()

        start_t = time.time()
        result: Dict[str, Any] = {
            "train_number": clean_train,
            "success": False,
            "status": "UNAVAILABLE",
            "persisted": False,
            "snapshot_id": None,
            "delay_minutes": None,
            "source": active_provider.__class__.__name__,
            "duration_ms": 0
        }

        try:
            # 1. Fetch live data
            live_data = active_provider.get_live_status(clean_train)
            if not live_data:
                result["status"] = "UNAVAILABLE"
                result["error"] = "Provider returned no data or request failed"
                logger.warning(f"[RealtimePipeline] No data returned from provider for train {clean_train}")
                return result

            # 2. Extract validated fields
            data_source = live_data.get("source", "RAILRADAR")
            data_status = live_data.get("data_status", "LIVE")
            delay = live_data.get("current_delay_minutes", 0)

            result["status"] = data_status
            result["source"] = data_source
            result["delay_minutes"] = delay
            result["current_station"] = live_data.get("current_station")
            result["next_station"] = live_data.get("next_station")
            result["latitude"] = live_data.get("latitude")
            result["longitude"] = live_data.get("longitude")
            result["speed_kmph"] = live_data.get("speed_kmph")

            # 3. Resolve train ID in database
            train_id = cls.resolve_train_id(db, clean_train)
            if not train_id:
                result["error"] = f"Train '{clean_train}' does not exist in trains table."
                logger.warning(f"[RealtimePipeline] Train '{clean_train}' not found in trains table; skipping persistence.")
                result["success"] = True  # Successfully queried provider, but cannot persist without FK
                return result

            result["train_id"] = train_id

            # 4. Resolve station references
            curr_code = live_data.get("current_station_code") or live_data.get("current_station")
            next_code = live_data.get("next_station_code") or live_data.get("next_station")
            curr_st_id = cls.resolve_station(db, curr_code)
            next_st_id = cls.resolve_station(db, next_code)

            # 5. Deduplication check
            if cls.should_deduplicate(db, train_id, curr_st_id, delay, data_status):
                result["success"] = True
                result["deduplicated"] = True
                result["message"] = "Snapshot is identical to recent observation; deduplication applied."
                logger.info(f"[RealtimePipeline] Train {clean_train} snapshot skipped due to deduplication.")
                return result

            # 6. Persist snapshot
            snapshot_id = cls.persist_snapshot(db, train_id, live_data, curr_st_id, next_st_id)
            if snapshot_id:
                result["success"] = True
                result["persisted"] = True
                result["snapshot_id"] = snapshot_id
            else:
                result["error"] = "Failed to persist snapshot to database."

        except Exception as e:
            logger.error(f"[RealtimePipeline] Error processing train {clean_train}: {e}", exc_info=True)
            result["error"] = str(e)
        finally:
            result["duration_ms"] = round((time.time() - start_t) * 1000, 2)

        return result

    @classmethod
    def run_pipeline_cycle(cls) -> Dict[str, Any]:
        """
        Executes one full polling cycle across all configured active trains.
        Guarantees isolation: error on one train does not halt others.
        """
        cycle_start = time.time()
        cls._total_cycles += 1
        cls._last_run_timestamp = datetime.utcnow().isoformat()

        # Check rate-limit backoff
        if time.time() < cls._backoff_until:
            wait_remaining = round(cls._backoff_until - time.time(), 1)
            logger.warning(f"[RealtimePipeline] Polling cycle throttled due to provider rate limit. Backoff remaining: {wait_remaining}s")
            return {
                "cycle_number": cls._total_cycles,
                "status": "THROTTLED",
                "timestamp": cls._last_run_timestamp,
                "backoff_remaining_seconds": wait_remaining,
                "trains_polled": 0,
                "results": []
            }

        provider = get_provider()
        train_numbers = cls.get_configured_train_numbers()
        
        results = []
        success_count = 0
        persisted_count = 0
        error_count = 0

        # Try to obtain a DB session
        db = None
        try:
            db = SessionLocal()
        except Exception as e:
            logger.warning(f"[RealtimePipeline] Could not open SessionLocal (will use REST fallback): {e}")

        try:
            for train_num in train_numbers:
                res = cls.poll_train(train_num, provider=provider, db=db)
                results.append(res)
                if res.get("success"):
                    success_count += 1
                if res.get("persisted"):
                    persisted_count += 1
                if res.get("error"):
                    error_count += 1

                # If rate limited (429), back off
                if "429" in str(res.get("error", "")):
                    cls._backoff_until = time.time() + 60.0
                    logger.warning("[RealtimePipeline] Rate limit detected; backing off for 60 seconds.")
                    break
        finally:
            if db:
                try:
                    db.close()
                except Exception:
                    pass

        total_duration = round(time.time() - cycle_start, 3)

        summary = {
            "cycle_number": cls._total_cycles,
            "timestamp": cls._last_run_timestamp,
            "provider": provider.__class__.__name__,
            "total_trains_configured": len(train_numbers),
            "trains_processed": len(results),
            "success_count": success_count,
            "persisted_count": persisted_count,
            "error_count": error_count,
            "duration_seconds": total_duration,
            "results": results
        }

        cls._last_cycle_stats = summary
        logger.info(
            f"[RealtimePipeline] Cycle #{cls._total_cycles} complete in {total_duration}s: "
            f"{persisted_count} persisted, {success_count} success, {error_count} errors."
        )
        return summary

    @classmethod
    def get_status(cls) -> Dict[str, Any]:
        """Returns pipeline operational health and statistics."""
        return {
            "pipeline_enabled": settings.PIPELINE_ENABLED,
            "provider": settings.TRAIN_DATA_PROVIDER,
            "poll_interval_seconds": settings.RAILRADAR_POLL_INTERVAL_SECONDS,
            "stale_threshold_seconds": settings.TRAIN_DATA_STALE_THRESHOLD_SECONDS,
            "configured_trains": cls.get_configured_train_numbers(),
            "total_cycles_executed": cls._total_cycles,
            "total_snapshots_persisted": cls._total_snapshots_persisted,
            "last_run_timestamp": cls._last_run_timestamp,
            "last_cycle_stats": cls._last_cycle_stats
        }
