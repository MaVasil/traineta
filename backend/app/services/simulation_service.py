import uuid
import random
from datetime import datetime
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from app.models.train import Train
from app.models.station import Station
from app.models.route import TrainRoute
from app.models.train_position import TrainPosition
from app.services.train_service import TrainService
from app.services.eta_service import ETAService

DATA_MODE_DISCLAIMER = "DEMO / SIMULATED DATA"

class SimulationService:
    """
    Railway Corridor Telemetry Simulator.
    Advances the simulated train along its scheduled route milestones
    and updates train_positions in PostgreSQL.
    """

    @classmethod
    def advance_train_simulation(cls, db: Session, train_number: str) -> Optional[Dict[str, Any]]:
        """
        Advances the simulated train along its scheduled route milestones
        and commits the updated position to the PostgreSQL database.
        Returns the full train details payload.
        """
        train = TrainService.find_train(db, train_number)
        if not train:
            return None

        # Fetch route ordered by sequence
        routes = (
            db.query(TrainRoute)
            .filter(TrainRoute.train_id == train.id)
            .order_by(TrainRoute.sequence_number.asc())
            .all()
        )
        if len(routes) < 2:
            return TrainService.get_train_details(db, train.train_number)

        # Fetch current position
        pos = (
            db.query(TrainPosition)
            .filter(TrainPosition.train_id == train.id)
            .order_by(TrainPosition.recorded_at.desc())
            .first()
        )

        if not pos or not pos.current_station_id:
            curr_st = routes[0].station
            next_st = routes[1].station
            new_pos = TrainPosition(
                id=str(uuid.uuid4()),
                train_id=train.id,
                latitude=curr_st.latitude,
                longitude=curr_st.longitude,
                speed=78,
                current_station_id=curr_st.id,
                next_station_id=next_st.id,
                current_delay_minutes=0,
                recorded_at=datetime.utcnow()
            )
            db.add(new_pos)
            db.commit()
            return TrainService.get_train_details(db, train.train_number)

        # Find current route index
        curr_idx = next((i for i, r in enumerate(routes) if r.station_id == pos.current_station_id), -1)
        if curr_idx == -1:
            curr_idx = 0

        # Advance to the next station (simulating a hop)
        next_idx = (curr_idx + 1) % len(routes)
        target_route = routes[next_idx]
        next_next_route = routes[(next_idx + 1) % len(routes)]

        speed_variation = (random.random() - 0.48) * 4
        new_speed = min(105, max(55, round((pos.speed or 78) + speed_variation)))

        delay_delta = 1 if random.random() > 0.6 else (-1 if random.random() > 0.8 else 0)
        new_delay = max(0, pos.current_delay_minutes + delay_delta)

        # Rather than overwriting, let's update the latest pos record to prevent bloating train_positions for this demo,
        # or we could add a new record. The frontend just fetches the latest anyway.
        # Let's add a new record for historical trace, but maybe just keep updating if we poll every 3s.
        # Let's just update the existing one for simplicity and avoiding massive DB growth on a 3s polling loop.
        pos.latitude = target_route.station.latitude
        pos.longitude = target_route.station.longitude
        pos.speed = new_speed
        pos.current_station_id = target_route.station_id
        pos.next_station_id = next_next_route.station_id
        pos.current_delay_minutes = new_delay
        pos.recorded_at = datetime.utcnow()

        # Update train status based on delay
        if new_delay == 0:
            train.status = 'ON TIME'
        elif new_delay <= 10:
            train.status = 'MINOR DELAY'
        else:
            train.status = 'MAJOR DELAY'

        db.commit()
        db.refresh(pos)  # Ensure SQLAlchemy reloads updated values after commit

        # Fetch and return the updated detailed info
        details = TrainService.get_train_details(db, train.train_number)
        if details:
            details["data_mode"] = DATA_MODE_DISCLAIMER
            # Coordinates: pull from freshly-refreshed pos record
            details["latitude"] = float(pos.latitude)
            details["longitude"] = float(pos.longitude)

            # Merge ETA prediction fields so ETACard has live data
            try:
                eta = ETAService.get_train_eta(db, train.train_number)
                if eta:
                    details["scheduled_eta"] = eta.get("scheduled_eta", details.get("scheduled_eta", "22:36"))
                    details["predicted_eta"] = eta.get("predicted_eta", details.get("predicted_eta", "22:42"))
                    details["confidence"] = eta.get("confidence", 0.91)
                    details["prediction_type"] = eta.get("prediction_type", "BASELINE")
                    details["baseline_eta"] = eta.get("baseline_eta")
                    details["baseline_delay"] = eta.get("baseline_delay")
            except Exception:
                pass  # ETA enrichment is best-effort; don't fail the simulate_step response

        return details
