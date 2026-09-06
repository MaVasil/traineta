from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from backend.app.models.train import Train
from backend.app.models.train_position import TrainPosition
from backend.app.models.prediction import ETAPrediction

class TrackingService:
    @staticmethod
    def get_live_tracking(db: Session, train_number: str) -> Optional[dict]:
        train = db.query(Train).filter(Train.train_number == train_number).first()
        if not train:
            return None

        pos = db.query(TrainPosition).filter(TrainPosition.train_id == train.id).order_by(TrainPosition.recorded_at.desc()).first()
        pred = db.query(ETAPrediction).filter(ETAPrediction.train_id == train.id).order_by(ETAPrediction.created_at.desc()).first()

        lat = float(pos.latitude) if pos else 17.9689
        lng = float(pos.longitude) if pos else 79.5941
        speed = pos.speed if pos else 78
        curr_st = pos.current_station.station_name if pos and pos.current_station else "Warangal"
        curr_code = pos.current_station.station_code if pos and pos.current_station else "WL"
        next_st = pos.next_station.station_name if pos and pos.next_station else "Vijayawada"
        next_code = pos.next_station.station_code if pos and pos.next_station else "BZA"
        delay = pos.current_delay_minutes if pos else 6

        sch_eta = pred.scheduled_eta.strftime("%H:%M") if pred else "22:36"
        prd_eta = pred.predicted_eta.strftime("%H:%M") if pred else "22:42"
        confidence = pred.confidence if pred else 91

        return {
            "train_number": train.train_number,
            "train_name": train.train_name,
            "latitude": lat,
            "longitude": lng,
            "speed": speed,
            "current_station": curr_st,
            "current_station_code": curr_code,
            "next_station": next_st,
            "next_station_code": next_code,
            "delay_minutes": delay,
            "scheduled_eta": sch_eta,
            "predicted_eta": prd_eta,
            "confidence": confidence,
            "data_mode": "SIMULATED",
            "last_updated": pos.recorded_at if pos else datetime.utcnow()
        }
