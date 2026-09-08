import uuid
import time
import logging
import httpx
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models.train import Train
from app.models.station import Station
from app.services.provider_factory import get_provider
from app.services.railradar_provider import RailRadarProvider
from app.services.realtime_pipeline import RealtimePipeline
from app.services.train_service import TrainService

logger = logging.getLogger("traineta.discovery")

class TrainDiscoveryService:
    """
    Dynamic Train Discovery Service.
    Enables users to search and track any real train by number.
    Queries RailRadar when a train is not known locally, registers the train in Supabase,
    and dynamically adds it to the active real-time tracking pipeline.
    """
    _discovery_cache: Dict[str, Dict[str, Any]] = {}
    CACHE_TTL_SECONDS = 600  # 10 minutes cache for discovered metadata

    @classmethod
    def discover_train(cls, train_number: str, db: Optional[Session] = None) -> Dict[str, Any]:
        """
        Discovers a train by train number:
        1. Validates train number.
        2. Checks if train already exists in database.
        3. If not, checks discovery cache.
        4. Queries RailRadar provider.
        5. Creates master record in Supabase trains table.
        6. Registers train into RealtimePipeline dynamic tracking set.
        7. Persists initial live operational snapshot.
        8. Returns clean train representation.
        """
        clean_num = str(train_number).strip()
        if not clean_num or not clean_num.isalnum() or len(clean_num) > 10:
            return {
                "success": False,
                "error": "Invalid train number. Please enter a valid 4-6 digit railway train number.",
                "train": None
            }

        # Live RailRadar Mode: ALWAYS query RailRadar directly for real live telemetry
        if settings.TRAIN_DATA_PROVIDER == "RAILRADAR":
            provider = get_provider()
            logger.info(f"[TrainDiscoveryService] Fetching real live telemetry for train {clean_num} via RailRadarProvider...")
            live_data = None
            try:
                live_data = provider.get_live_status(clean_num)
            except Exception as e:
                logger.error(f"[TrainDiscoveryService] Error querying RailRadar for train {clean_num}: {e}")

            if not live_data:
                return {
                    "success": False,
                    "error": f"Unable to retrieve live train data from RailRadar for train {clean_num}.",
                    "data_source": "railradar",
                    "train": None
                }

            # Master record in Supabase: ensure exists or create
            train_id = RealtimePipeline.resolve_train_id(db, clean_num)
            if not train_id:
                train_id = cls._insert_master_record(clean_num, live_data, db)

            # Persist operational snapshot in background/inline for historical analysis and ML
            if train_id:
                cur_st_id = RealtimePipeline.resolve_station(
                    db,
                    live_data.get("current_station_code") or live_data.get("current_station")
                )
                nxt_st_id = RealtimePipeline.resolve_station(
                    db,
                    live_data.get("next_station_code") or live_data.get("next_station")
                )
                RealtimePipeline.persist_snapshot(db, train_id, live_data, cur_st_id, nxt_st_id)
                RealtimePipeline.register_dynamic_train(clean_num)

            # Build direct LIVE response originating from RailRadar
            timeline_list = live_data.get("timeline") or live_data.get("halts", [])
            logger.info(
                f"[Timeline] Discovered train {clean_num}: total halts={len(timeline_list)}, "
                f"current_station={live_data.get('current_station_code')}, "
                f"next_station={live_data.get('next_station_code')}"
            )

            live_train_dict = {
                "id": clean_num,
                "train_id": clean_num,
                "train_number": clean_num,
                "train_name": live_data.get("train_name") or f"Express {clean_num}",
                "source": live_data.get("source") or "Origin",
                "source_code": live_data.get("source_code") or "SRC",
                "destination": live_data.get("destination") or "Destination",
                "destination_code": live_data.get("destination_code") or "DST",
                "status": live_data.get("status") or "ON_TIME",
                "delay_minutes": live_data.get("current_delay_minutes", 0),
                "current_station": live_data.get("current_station"),
                "current_station_code": live_data.get("current_station_code"),
                "next_station": live_data.get("next_station"),
                "next_station_code": live_data.get("next_station_code"),
                "speed": live_data.get("speed_kmph"),
                "latitude": live_data.get("latitude"),
                "longitude": live_data.get("longitude"),
                "timestamp": live_data.get("timestamp"),
                "source_type": "RAILRADAR",
                "data_source": "railradar",
                "data_status": live_data.get("data_status", "LIVE"),
                "is_live": live_data.get("is_live", True),
                "tracking_enabled": True,
                "timeline": timeline_list,
                "halts": timeline_list
            }

            return {
                "success": True,
                "discovered": True,
                "data_source": "railradar",
                "train": live_train_dict,
                "tracking_enabled": True,
                "message": f"Live telemetry for train {clean_num} retrieved from RailRadar."
            }

        # Step 1: Check if train already exists in database (SIMULATED mode only)
        existing_train_data = cls._find_in_database(clean_num, db)
        if existing_train_data:
            RealtimePipeline.register_dynamic_train(clean_num)
            return {
                "success": True,
                "discovered": False,
                "train": existing_train_data,
                "tracking_enabled": True,
                "message": f"Train {clean_num} is already registered."
            }

        # Step 2: Check discovery cache
        cached = cls._discovery_cache.get(clean_num)
        if cached:
            cached_time = cached.get("_cached_at", 0)
            if time.time() - cached_time < cls.CACHE_TTL_SECONDS:
                if not cached.get("success"):
                    return {
                        "success": False,
                        "error": cached.get("error", f"Train '{clean_num}' not found on railway network."),
                        "train": None
                    }
                RealtimePipeline.register_dynamic_train(clean_num)
                return cached.get("payload", {})

        # Step 3: Query RailRadar Provider for discovery
        provider = get_provider()
        logger.info(f"[TrainDiscoveryService] Discovering new train {clean_num} via {provider.__class__.__name__}...")

        live_data = None
        try:
            live_data = provider.get_live_status(clean_num)
        except Exception as e:
            logger.error(f"[TrainDiscoveryService] Error querying provider for train {clean_num}: {e}")

        if not live_data:
            cls._discovery_cache[clean_num] = {
                "success": False,
                "error": f"Train '{clean_num}' was not found on the live railway network or provider is unavailable.",
                "_cached_at": time.time()
            }
            return {
                "success": False,
                "error": f"Train '{clean_num}' not found in railway network.",
                "train": None
            }

        # Step 4: Extract and normalize master train metadata
        train_name = live_data.get("train_name") or f"Express {clean_num}"
        status = "ON_TIME"
        delay = live_data.get("current_delay_minutes", 0)
        if delay > 10:
            status = "MAJOR_DELAY"
        elif delay > 0:
            status = "MINOR_DELAY"

        # Resolve Source and Destination stations if identifiable from halts
        source_station_id = RealtimePipeline.resolve_station(db, live_data.get("previous_station_code") or live_data.get("previous_station"))
        dest_station_id = RealtimePipeline.resolve_station(db, live_data.get("next_station_code") or live_data.get("next_station"))

        # Step 5: Create Master Train Record in Supabase trains table
        train_uuid = cls._create_train_master_record(
            db=db,
            train_number=clean_num,
            train_name=train_name,
            source_station_id=source_station_id,
            dest_station_id=dest_station_id,
            status=status
        )

        if not train_uuid:
            logger.error(f"[TrainDiscoveryService] Failed to create master record for train {clean_num}.")
            return {
                "success": False,
                "error": "Failed to persist train master record into database.",
                "train": None
            }

        # Step 6: Register in RealtimePipeline dynamic tracking set
        RealtimePipeline.register_dynamic_train(clean_num)

        # Step 7: Persist initial operational snapshot into train_positions
        curr_st_id = RealtimePipeline.resolve_station(db, live_data.get("current_station_code") or live_data.get("current_station"))
        next_st_id = RealtimePipeline.resolve_station(db, live_data.get("next_station_code") or live_data.get("next_station"))
        
        snapshot_id = RealtimePipeline.persist_snapshot(
            db=db,
            train_id=train_uuid,
            normalized_data=live_data,
            current_station_id=curr_st_id,
            next_station_id=next_st_id
        )

        # Step 8: Build clean frontend response payload
        src_city = live_data.get("previous_station") or "Unknown"
        dst_city = live_data.get("next_station") or "Unknown"

        train_payload = {
            "id": clean_num,
            "db_id": train_uuid,
            "train_number": clean_num,
            "train_name": train_name,
            "source": src_city,
            "source_code": live_data.get("previous_station_code") or "SRC",
            "destination": dst_city,
            "destination_code": live_data.get("next_station_code") or "DST",
            "status": status,
            "delay_minutes": delay,
            "current_station": live_data.get("current_station"),
            "current_station_code": live_data.get("current_station_code"),
            "next_station": live_data.get("next_station"),
            "next_station_code": live_data.get("next_station_code"),
            "speed": live_data.get("speed_kmph"),
            "latitude": live_data.get("latitude"),
            "longitude": live_data.get("longitude"),
            "data_source": live_data.get("source", "RAILRADAR"),
            "data_status": live_data.get("data_status", "LIVE"),
            "timestamp": live_data.get("timestamp"),
            "tracking_enabled": True,
            "timeline": live_data.get("timeline") or live_data.get("halts", []),
            "halts": live_data.get("timeline") or live_data.get("halts", [])
        }

        response = {
            "success": True,
            "discovered": True,
            "train": train_payload,
            "tracking_enabled": True,
            "snapshot_id": snapshot_id,
            "message": f"Train {clean_num} ({train_name}) discovered and active tracking initiated."
        }

        # Cache response
        cls._discovery_cache[clean_num] = {
            "success": True,
            "payload": response,
            "_cached_at": time.time()
        }

        logger.info(f"[TrainDiscoveryService] Successfully discovered and registered train {clean_num} ({train_name}).")
        return response

    @classmethod
    def _find_in_database(cls, train_number: str, db: Optional[Session] = None) -> Optional[Dict[str, Any]]:
        """Checks if the train already exists in PostgreSQL / Supabase."""
        clean_num = str(train_number).strip()
        from app.services.train_service import TrainService
        return TrainService.get_train_by_exact_number(db, clean_num)

    @classmethod
    def _create_train_master_record(
        cls,
        db: Optional[Session],
        train_number: str,
        train_name: str,
        source_station_id: Optional[str],
        dest_station_id: Optional[str],
        status: str
    ) -> Optional[str]:
        """Creates or updates a train row in public.trains."""
        train_uuid = str(uuid.uuid4())
        created = False

        # Attempt 1: SQLAlchemy
        if db:
            try:
                tr = Train(
                    id=train_uuid,
                    train_number=train_number,
                    train_name=train_name,
                    source_station_id=source_station_id,
                    destination_station_id=dest_station_id,
                    status=status
                )
                db.add(tr)
                db.commit()
                created = True
                logger.info(f"[TrainDiscoveryService] Inserted train {train_number} via SQLAlchemy.")
            except Exception as e:
                db.rollback()
                logger.warning(f"[TrainDiscoveryService] SQLAlchemy train insert failed: {e}")

        # Attempt 2: Supabase REST
        if not created and settings.SUPABASE_URL and settings.SUPABASE_KEY:
            try:
                headers = {
                    "apikey": settings.SUPABASE_KEY,
                    "Authorization": f"Bearer {settings.SUPABASE_KEY}",
                    "Content-Type": "application/json",
                    "Prefer": "return=representation"
                }
                payload = {
                    "id": train_uuid,
                    "train_number": train_number,
                    "train_name": train_name,
                    "source_station_id": source_station_id,
                    "destination_station_id": dest_station_id,
                    "status": status
                }
                with httpx.Client(timeout=8.0) as client:
                    r = client.post(f"{settings.SUPABASE_URL}/rest/v1/trains", headers=headers, json=payload)
                    if r.status_code in (200, 201):
                        created = True
                        logger.info(f"[TrainDiscoveryService] Inserted train {train_number} via Supabase REST API.")
                    else:
                        logger.error(f"[TrainDiscoveryService] Supabase REST train insert failed: HTTP {r.status_code} - {r.text}")
            except Exception as e:
                logger.error(f"[TrainDiscoveryService] Supabase REST train insert exception: {e}")

        return train_uuid if created else None
