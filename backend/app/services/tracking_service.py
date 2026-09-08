from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.config import settings
from app.models.train import Train
from app.models.train_position import TrainPosition
from app.models.prediction import ETAPrediction
from app.services.train_service import TrainService
from app.services.geo_utils import is_valid_coordinate

class TrackingService:
    @staticmethod
    def get_live_tracking(db: Session, train_number: str) -> Optional[dict]:
        clean_num = str(train_number).strip()
        from app.services.train_discovery_service import TrainDiscoveryService
        cached_disc = TrainDiscoveryService._discovery_cache.get(clean_num, {}).get("payload", {}).get("train", {})
        
        # If cache is empty or in RailRadar provider mode, ensure RailRadar discovery is executed
        if (not cached_disc or settings.TRAIN_DATA_PROVIDER == "RAILRADAR") and clean_num.isdigit() and len(clean_num) in (4, 5, 6):
            disc = TrainDiscoveryService.discover_train(clean_num, db=db)
            if disc.get("success") and disc.get("train"):
                cached_disc = disc["train"]

        train = TrainService.find_train(db, clean_num)
        if not train and not cached_disc:
            return None

        pos = (
            db.query(TrainPosition)
            .filter(TrainPosition.train_id == train.id)
            .order_by(TrainPosition.recorded_at.desc())
            .first()
        ) if train else None

        pred = (
            db.query(ETAPrediction)
            .filter(ETAPrediction.train_id == train.id)
            .order_by(ETAPrediction.created_at.desc())
            .first()
        ) if train else None

        train_num = train.train_number if train else clean_num
        train_name = (train.train_name if train else cached_disc.get("train_name")) or f"Express {clean_num}"

        # Prioritize live RailRadar GPS / interpolated telemetry
        lat = float(cached_disc["latitude"]) if cached_disc.get("latitude") is not None and is_valid_coordinate(cached_disc.get("latitude"), cached_disc.get("longitude")) else (float(pos.latitude) if (pos and pos.latitude is not None) else None)
        lng = float(cached_disc["longitude"]) if cached_disc.get("longitude") is not None and is_valid_coordinate(cached_disc.get("latitude"), cached_disc.get("longitude")) else (float(pos.longitude) if (pos and pos.longitude is not None) else None)

        station_lat = float(cached_disc["station_latitude"]) if cached_disc.get("station_latitude") is not None else (float(pos.current_station.latitude) if (pos and pos.current_station and pos.current_station.latitude is not None) else None)
        station_lng = float(cached_disc["station_longitude"]) if cached_disc.get("station_longitude") is not None else (float(pos.current_station.longitude) if (pos and pos.current_station and pos.current_station.longitude is not None) else None)

        location_type = cached_disc.get("location_type", "GPS" if lat else "NONE")
        stations = cached_disc.get("stations") or cached_disc.get("timeline") or []
        route_coords = cached_disc.get("route_coordinates") or []

        # Speed resolution: live RailRadar speed takes priority without falling back to DB simulated speed
        if cached_disc:
            speed = cached_disc.get("speed") if cached_disc.get("speed") is not None else cached_disc.get("speed_kmph")
            speed_status = cached_disc.get("speed_status") or cached_disc.get("speedStatus") or ("LIVE" if speed is not None else "UNAVAILABLE")
        else:
            speed = int(pos.speed) if (pos and pos.speed is not None) else None
            speed_status = "LIVE" if speed is not None else "UNAVAILABLE"
        delay = cached_disc.get("delay_minutes", pos.current_delay_minutes if pos else 0)

        # Origin and Terminus endpoints
        source_city = cached_disc.get("source") or (train.source_station.city if train and train.source_station else "Origin")
        source_code = cached_disc.get("source_code") or (train.source_station.station_code if train and train.source_station else "SRC")
        source_lat = cached_disc.get("source_latitude") or (float(train.source_station.latitude) if train and train.source_station and train.source_station.latitude else None)
        source_lng = cached_disc.get("source_longitude") or (float(train.source_station.longitude) if train and train.source_station and train.source_station.longitude else None)
        source_details = cached_disc.get("source_details") or {
            "code": source_code,
            "name": source_city,
            "latitude": source_lat,
            "longitude": source_lng,
        }

        dest_city = cached_disc.get("destination") or (train.destination_station.city if train and train.destination_station else "Destination")
        dest_code = cached_disc.get("destination_code") or (train.destination_station.station_code if train and train.destination_station else "DST")
        dest_lat = cached_disc.get("destination_latitude") or (float(train.destination_station.latitude) if train and train.destination_station and train.destination_station.latitude else None)
        dest_lng = cached_disc.get("destination_longitude") or (float(train.destination_station.longitude) if train and train.destination_station and train.destination_station.longitude else None)
        dest_details = cached_disc.get("destination_details") or {
            "code": dest_code,
            "name": dest_city,
            "latitude": dest_lat,
            "longitude": dest_lng,
        }

        curr_st = cached_disc.get("current_station") or (pos.current_station.station_name if (pos and pos.current_station) else (train.source_station.station_name if train and train.source_station else "In Transit"))
        curr_code = cached_disc.get("current_station_code") or (pos.current_station.station_code if (pos and pos.current_station) else (train.source_station.station_code if train and train.source_station else "TRN"))
        next_st = cached_disc.get("next_station") or (pos.next_station.station_name if (pos and pos.next_station) else (train.destination_station.station_name if train and train.destination_station else "Approaching"))
        next_code = cached_disc.get("next_station_code") or (pos.next_station.station_code if (pos and pos.next_station) else (train.destination_station.station_code if train and train.destination_station else "APR"))

        # Dynamic ETA prediction
        from app.services.eta_service import ETAService
        eta_data = ETAService.get_train_eta(db, train_num)

        sch_eta = eta_data.get("scheduled_eta") if eta_data else (pred.scheduled_eta.strftime("%H:%M") if pred else "22:36")
        prd_eta = eta_data.get("predicted_eta") if eta_data else (pred.predicted_eta.strftime("%H:%M") if pred else "22:42")
        confidence = eta_data.get("confidence") if eta_data else (pred.confidence if pred else 0.91)
        pred_type = eta_data.get("prediction_type") if eta_data else "BASELINE"

        data_source = cached_disc.get("data_source") or (pos.data_source if pos else "RAILRADAR")
        data_status = cached_disc.get("data_status") or (pos.data_status if pos else "LIVE")

        return {
            "train_number": train_num,
            "train_name": train_name,
            "source": source_city,
            "source_code": source_code,
            "source_latitude": source_lat,
            "source_longitude": source_lng,
            "source_details": source_details,
            "destination": dest_city,
            "destination_code": dest_code,
            "destination_latitude": dest_lat,
            "destination_longitude": dest_lng,
            "destination_details": dest_details,
            "latitude": lat,
            "longitude": lng,
            "location_type": location_type,
            "station_latitude": station_lat,
            "station_longitude": station_lng,
            "speed": speed,
            "speed_kmph": speed,
            "speed_status": speed_status,
            "speedStatus": speed_status,
            "speed_unit": "km/h",
            "current_station": curr_st,
            "current_station_code": curr_code,
            "next_station": next_st,
            "next_station_code": next_code,
            "delay_minutes": delay,
            "scheduled_eta": sch_eta,
            "predicted_eta": prd_eta,
            "confidence": confidence,
            "prediction_type": pred_type,
            "data_source": data_source,
            "data_status": data_status,
            "data_mode": data_source,
            "stations": stations,
            "route_coordinates": route_coords,
            "last_updated": cached_disc.get("timestamp") or (pos.recorded_at.isoformat() if (pos and pos.recorded_at) else datetime.utcnow().isoformat())
        }
