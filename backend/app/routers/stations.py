import uuid
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.database import get_db
from app.models.station import Station

def is_valid_uuid(val: str) -> bool:
    try:
        uuid.UUID(str(val))
        return True
    except (ValueError, TypeError, AttributeError):
        return False

router = APIRouter(prefix="/api/stations", tags=["Stations"])

@router.get("", summary="List all corridor railway stations")
def list_stations(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    """
    Returns list of corridor stations with validated numerical latitude and longitude:
    id, station_code, station_name, city, latitude, longitude.
    """
    stations = db.query(Station).order_by(Station.station_name.asc()).all()
    results = []
    for s in stations:
        try:
            lat = float(s.latitude)
            lng = float(s.longitude)
        except (TypeError, ValueError):
            lat = 0.0
            lng = 0.0

        results.append({
            "id": s.id,
            "station_code": s.station_code,
            "station_name": s.station_name,
            "city": s.city,
            "latitude": lat,
            "longitude": lng,
            "created_at": s.created_at.isoformat() if s.created_at else None
        })
    return results

@router.get("/{station_id}", summary="Get station by ID or code")
def get_station(station_id: str, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Returns station details by UUID id or 3-4 letter station code (e.g. HYB, KZJ, WL, BZA)."""
    st_val = str(station_id).strip()
    st_upper = st_val.upper()
    if is_valid_uuid(st_val):
        station = db.query(Station).filter(
            or_(
                Station.id == st_val,
                Station.station_code == st_upper
            )
        ).first()
    else:
        station = db.query(Station).filter(Station.station_code == st_upper).first()

    if not station:
        raise HTTPException(status_code=404, detail=f"Station '{station_id}' not found")

    try:
        lat = float(station.latitude)
        lng = float(station.longitude)
    except (TypeError, ValueError):
        lat = 0.0
        lng = 0.0

    return {
        "id": station.id,
        "station_code": station.station_code,
        "station_name": station.station_name,
        "city": station.city,
        "latitude": lat,
        "longitude": lng,
        "created_at": station.created_at.isoformat() if station.created_at else None
    }
