import uuid
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from backend.app.database import get_db
from backend.app.models.history import HistoricalRun
from backend.app.models.train import Train
from backend.app.models.station import Station

def is_valid_uuid(val: str) -> bool:
    try:
        uuid.UUID(str(val))
        return True
    except (ValueError, TypeError, AttributeError):
        return False

router = APIRouter(prefix="/api/history", tags=["History"])

@router.get("", summary="Get historical run audit records from historical_runs")
def get_history(
    train_id: Optional[str] = Query(None, description="Filter by train ID or train number (e.g. 12401)"),
    station_id: Optional[str] = Query(None, description="Filter by station ID or station code (e.g. BZA, WL, KZJ)"),
    date: Optional[str] = Query(None, description="Filter by journey date (YYYY-MM-DD)"),
    # Compatibility query params
    train_number: Optional[str] = Query(None, description="Compatibility filter for train number"),
    station: Optional[str] = Query(None, description="Compatibility filter for station code"),
    q: Optional[str] = Query(None, description="Search keyword"),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """
    Returns historical arrival records from historical_runs comparing scheduled vs actual arrival.
    Supports filters: train_id, station_id, date.
    Uses eager joinedload to optimize database round-trips.
    """
    query = (
        db.query(HistoricalRun)
        .options(
            joinedload(HistoricalRun.train),
            joinedload(HistoricalRun.station)
        )
        .join(Train, HistoricalRun.train_id == Train.id)
        .join(Station, HistoricalRun.station_id == Station.id)
    )

    target_train = train_id or train_number
    if target_train and target_train != "all":
        t_clean = str(target_train).strip()
        if is_valid_uuid(t_clean):
            query = query.filter(or_(Train.train_number == t_clean, Train.id == t_clean))
        else:
            query = query.filter(Train.train_number == t_clean)

    target_station = station_id or station
    if target_station and target_station != "all":
        st_clean = str(target_station).strip()
        st_val = st_clean.upper()
        if is_valid_uuid(st_clean):
            query = query.filter(or_(Station.station_code == st_val, Station.id == st_clean))
        else:
            query = query.filter(or_(Station.station_code == st_val, Station.station_name.ilike(f"%{st_clean}%")))

    if date and date != "all":
        query = query.filter(HistoricalRun.journey_date == date)

    records = query.order_by(HistoricalRun.journey_date.desc(), HistoricalRun.created_at.desc()).all()

    items = []
    for r in records:
        t = r.train
        s = r.station
        t_num = t.train_number if t else "12401"
        t_name = t.train_name if t else "Demo Express"
        s_name = s.station_name if s else "Vijayawada"
        s_code = s.station_code if s else "BZA"

        sch_arr = r.scheduled_arrival.strftime("%H:%M") if r.scheduled_arrival else "00:00"
        act_arr = r.actual_arrival.strftime("%H:%M") if r.actual_arrival else "00:00"
        pred_arr = sch_arr
        delay_min = r.delay_minutes if r.delay_minutes is not None else 0
        travel_min = r.travel_time_minutes if r.travel_time_minutes is not None else 0

        if q and q.strip():
            kw = q.strip().lower()
            if kw not in t_num.lower() and kw not in t_name.lower() and kw not in s_name.lower() and kw not in s_code.lower():
                continue

        status = "ON TIME" if delay_min == 0 else ("MINOR DELAY" if delay_min <= 5 else "DELAYED")

        items.append({
            "id": r.id,
            "train": f"{t_num} - {t_name}",
            "train_id": t_num,
            "train_number": t_num,
            "train_name": t_name,
            "station": s_name,
            "station_id": s.id if s else None,
            "station_code": s_code,
            "scheduled_arrival": sch_arr,
            "predicted_arrival": pred_arr,
            "actual_arrival": act_arr,
            "travel_time": travel_min,
            "travel_time_minutes": travel_min,
            "delay": delay_min,
            "delay_minutes": delay_min,
            "prediction_error_minutes": abs(delay_min),
            "date": str(r.journey_date),
            "journey_date": str(r.journey_date),
            "status": status,
        })

    return items
