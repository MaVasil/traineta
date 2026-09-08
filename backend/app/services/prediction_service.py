from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models.train import Train
from app.models.train_position import TrainPosition
from app.models.route import TrainRoute
from app.models.prediction import ETAPrediction
from app.ml.predictor import ml_predictor

class BaselineETAPredictor:
    """
    Baseline Heuristic ETA Predictor (Fallback).
    """
    def __init__(self, model_version: str = "v1-baseline"):
        self.model_version = model_version

    def predict(
        self,
        train_number: str,
        current_delay: Optional[int],
        speed: Optional[int],
        distance_km: float,
        scheduled_arrival: Optional[str] = None
    ) -> Dict[str, Any]:
        # Nominal travel time in minutes based on distance and speed (safe against None and <= 0)
        speed_val = int(speed) if (speed is not None and speed > 0) else 70
        effective_speed = max(30, speed_val)
        nominal_travel_min = max(5, int((distance_km / effective_speed) * 60))

        now = datetime.now()
        if scheduled_arrival:
            try:
                # If scheduled_arrival is 'HH:MM' or 'HH:MM:SS'
                parts = [int(p) for p in scheduled_arrival.split(":")[:2]]
                sch_time = now.replace(hour=parts[0], minute=parts[1], second=0, microsecond=0)
                if sch_time < now - timedelta(hours=2):
                    sch_time += timedelta(days=1)
                scheduled_dt = sch_time
            except Exception:
                scheduled_dt = now + timedelta(minutes=nominal_travel_min)
        else:
            scheduled_dt = now + timedelta(minutes=nominal_travel_min)

        delay_val = int(current_delay) if current_delay is not None else 0
        predicted_dt = scheduled_dt + timedelta(minutes=delay_val)
        confidence = max(0.60, min(0.95, 0.85 - (delay_val * 0.005)))

        return {
            "train_id": train_number,
            "scheduled_eta": scheduled_dt.strftime("%H:%M"),
            "predicted_eta": predicted_dt.strftime("%H:%M"),
            "predicted_delay": delay_val,
            "confidence": round(float(confidence), 2),
            "prediction_type": "BASELINE",
            "model_version": self.model_version,
            "data_mode": "REALTIME OPERATIONAL / BASELINE"
        }

class PredictionService:
    _baseline_predictor = BaselineETAPredictor()

    @classmethod
    def get_baseline_prediction(cls, db: Session, train_id: str) -> Optional[Dict[str, Any]]:
        """Resolves train from database and generates ETA prediction, using ML if available."""
        from app.services.train_service import TrainService
        train = TrainService.find_train(db, train_id)
        if not train:
            # Dynamic discovery fallback if train_id looks like a train number
            clean_id = str(train_id).strip()
            if clean_id.isdigit() and len(clean_id) in (4, 5, 6):
                from app.services.train_discovery_service import TrainDiscoveryService
                disc = TrainDiscoveryService.discover_train(clean_id, db=db)
                if disc.get("success"):
                    train = TrainService.find_train(db, clean_id)
            if not train:
                return None

        # Fetch latest position from train_positions
        pos = (
            db.query(TrainPosition)
            .filter(TrainPosition.train_id == train.id)
            .order_by(TrainPosition.recorded_at.desc())
            .first()
        )

        current_delay = int(pos.current_delay_minutes) if (pos and pos.current_delay_minutes is not None) else 0
        speed = int(pos.speed) if (pos and pos.speed is not None and pos.speed > 0) else None

        # Fetch route details
        routes = (
            db.query(TrainRoute)
            .filter(TrainRoute.train_id == train.id)
            .order_by(TrainRoute.sequence_number.asc())
            .all()
        )

        distance_km = 45.0
        scheduled_str = None
        sch_hour = datetime.now().hour
        day_of_week = datetime.now().weekday()
        
        if pos and pos.next_station_id and routes:
            next_route = next((r for r in routes if r.station_id == pos.next_station_id), None)
            curr_route = next((r for r in routes if r.station_id == pos.current_station_id), None)
            if next_route:
                if next_route.scheduled_arrival:
                    scheduled_str = next_route.scheduled_arrival.strftime("%H:%M")
                    sch_hour = next_route.scheduled_arrival.hour
                if curr_route:
                    distance_km = max(10.0, float(next_route.distance_from_source - curr_route.distance_from_source))
        elif routes and len(routes) > 1:
            dest_route = routes[-1]
            if dest_route.scheduled_arrival:
                scheduled_str = dest_route.scheduled_arrival.strftime("%H:%M")
                sch_hour = dest_route.scheduled_arrival.hour
            distance_km = float(dest_route.distance_from_source)

        # Baseline prediction
        baseline_res = cls._baseline_predictor.predict(
            train_number=train.train_number,
            current_delay=current_delay,
            speed=speed,
            distance_km=distance_km,
            scheduled_arrival=scheduled_str
        )
        
        # ML prediction
        if ml_predictor.is_available():
            try:
                eff_speed = float(speed) if (speed is not None and speed > 0) else 75.0
                # Use ML model
                predicted_minutes = ml_predictor.predict_remaining_minutes(
                    current_delay=float(current_delay),
                    speed=eff_speed,
                    distance_km=distance_km,
                    scheduled_hour=sch_hour,
                    day_of_week=day_of_week,
                    avg_station_delay=0.0 # Simplification for real-time
                )
                
                confidence = ml_predictor.get_confidence(predicted_minutes, distance_km)
                
                now = datetime.now()
                sch_dt = now
                if scheduled_str:
                    try:
                        parts = [int(p) for p in scheduled_str.split(":")[:2]]
                        sch_time = now.replace(hour=parts[0], minute=parts[1], second=0, microsecond=0)
                        if sch_time < now - timedelta(hours=2):
                            sch_time += timedelta(days=1)
                        sch_dt = sch_time
                    except Exception:
                        sch_dt = now + timedelta(minutes=int(distance_km/70 * 60))
                
                base_travel_time = (distance_km / max(1.0, eff_speed)) * 60.0
                added_delay = predicted_minutes - base_travel_time
                ml_delay = current_delay + added_delay
                
                # Ensure delay doesn't become magically negative when it shouldn't
                ml_delay = max(0, ml_delay)
                
                pred_dt = sch_dt + timedelta(minutes=ml_delay)
                
                res = {
                    "train_id": train.train_number,
                    "scheduled_eta": sch_dt.strftime("%H:%M"),
                    "predicted_eta": pred_dt.strftime("%H:%M"),
                    "predicted_delay": int(ml_delay),
                    "confidence": round(confidence, 2),
                    "prediction_type": "ML",
                    "model_version": ml_predictor.metadata.get("model_version", "1.0"),
                    "model_name": ml_predictor.metadata.get("model_name"),
                    "baseline_eta": baseline_res["predicted_eta"],
                    "baseline_delay": baseline_res["predicted_delay"]
                }
                
                # Determine station_id for prediction
                prediction_station_id = None
                if pos and pos.next_station_id:
                    prediction_station_id = pos.next_station_id
                elif routes and len(routes) > 0:
                    prediction_station_id = routes[-1].station_id
                
                # Persist prediction only if we have a station
                if prediction_station_id:
                    try:
                        db.add(ETAPrediction(
                            train_id=train.id,
                            station_id=prediction_station_id,
                            scheduled_eta=sch_dt,
                            predicted_eta=pred_dt,
                            predicted_delay_minutes=int(ml_delay),
                            confidence=confidence,
                            prediction_type="ML",
                            model_version=res["model_version"]
                        ))
                        db.commit()
                    except Exception as db_err:
                        db.rollback()
                        print(f"Failed to persist ETAPrediction: {db_err}")
                
                return res
            except Exception as e:
                print(f"ML Prediction failed, falling back to baseline: {e}")
                
        return baseline_res
