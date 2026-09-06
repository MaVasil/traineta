from typing import List, Optional, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.services.train_service import TrainService
from backend.app.services.tracking_service import TrackingService
from backend.app.services.eta_service import ETAService
from backend.app.services.simulation_service import SimulationService

router = APIRouter(prefix="/api/trains", tags=["Trains"])

@router.get("", summary="List all monitored trains")
def list_trains(db: Session = Depends(get_db)):
    """Returns all monitored railway corridor express trains backed by Supabase."""
    return TrainService.get_all_trains(db)

@router.get("/search", summary="Search and filter trains")
def search_trains(
    q: Optional[str] = Query(None, description="Search by train number, express name, or city"),
    status: Optional[str] = Query(None, description="Filter by status (ON_TIME, MINOR_DELAY, MAJOR_DELAY)"),
    source: Optional[str] = Query(None, description="Filter by origin city"),
    destination: Optional[str] = Query(None, description="Filter by destination city"),
    db: Session = Depends(get_db)
):
    """Search trains using safe parameterized queries."""
    return TrainService.search_trains(db, query=q, status=status, source=source, destination=destination)

@router.get("/{train_id}/route", summary="Get train route milestones and coordinates")
def get_train_route(train_id: str, db: Session = Depends(get_db)):
    """
    Returns transit stations in sequence_number ASC order and track coordinates:
    {
      "train_id": "12401",
      "stations": [
        {
          "sequence": 1,
          "station_name": "Hyderabad",
          "latitude": 17.3850,
          "longitude": 78.4867
        }
      ],
      "route_coordinates": []
    }
    """
    route_data = TrainService.get_train_route(db, train_id)
    if not route_data:
        raise HTTPException(status_code=404, detail=f"Route for train '{train_id}' not found")
    return route_data

@router.get("/{train_id}/map", summary="Get full geospatial map payload for Leaflet")
def get_train_map(train_id: str, db: Session = Depends(get_db)):
    """
    Returns complete geospatial telemetry for Leaflet rendering:
    {
      "train_id": "12401",
      "current_position": { "latitude": 17.8500, "longitude": 79.4000 },
      "current_station": "Warangal",
      "next_station": "Vijayawada",
      "speed": 78,
      "delay_minutes": 6,
      "timestamp": "...",
      "stations": [],
      "route_coordinates": []
    }
    """
    map_data = TrainService.get_train_map(db, train_id)
    if not map_data:
        raise HTTPException(status_code=404, detail=f"Map telemetry for train '{train_id}' not found")
    return map_data

@router.get("/{train_id}/position", summary="Get latest train position from train_positions")
def get_train_position(train_id: str, db: Session = Depends(get_db)):
    """
    Reads the latest position from train_positions using the latest timestamp.
    Returns: latitude, longitude, current station, next station, speed, delay, timestamp.
    """
    pos_data = TrainService.get_train_position(db, train_id)
    if not pos_data:
        raise HTTPException(status_code=404, detail=f"Position for train '{train_id}' not found")
    return pos_data

@router.get("/{train_id}/eta", summary="Get dynamic ML or baseline ETA prediction")
def get_train_eta(train_id: str, db: Session = Depends(get_db)):
    """
    Dynamic ML or Baseline ETA prediction following the architecture:
    eta_service.py -> prediction_service.py -> MLEtaPredictor/BaselineETAPredictor
    """
    eta_data = ETAService.get_train_eta(db, train_id)
    if not eta_data:
        raise HTTPException(status_code=404, detail=f"ETA prediction for train '{train_id}' not found")
    return eta_data

@router.get("/{train_id}/timeline", summary="Get route station timeline categorized by status")
def get_train_timeline(train_id: str, db: Session = Depends(get_db)):
    """
    Builds timeline categorized into COMPLETED, CURRENT, and UPCOMING in correct sequence.
    """
    timeline_data = TrainService.get_train_timeline(db, train_id)
    if not timeline_data:
        raise HTTPException(status_code=404, detail=f"Timeline for train '{train_id}' not found")
    return timeline_data

@router.get("/{train_id}/details", summary="Get full train details")
def get_train_details(train_id: str, db: Session = Depends(get_db)):
    """Returns comprehensive train metadata, telemetry, and timeline."""
    details = TrainService.get_train_details(db, train_id)
    if not details:
        raise HTTPException(status_code=404, detail=f"Train '{train_id}' not found")
    return details

@router.get("/{train_id}/live", summary="Get live train tracking telemetry")
def get_train_live(train_id: str, db: Session = Depends(get_db)):
    """Returns real-time GPS coordinates, speed, block delays, and predictions."""
    tracking = TrackingService.get_live_tracking(db, train_id)
    if not tracking:
        raise HTTPException(status_code=404, detail=f"Live telemetry for train '{train_id}' not found")
    return tracking

@router.get("/{train_id}/simulate_step", summary="Advance simulation by one step")
def simulate_train_step(train_id: str, db: Session = Depends(get_db)):
    """Advances the simulation by one waypoint and returns updated telemetry."""
    details = SimulationService.advance_train_simulation(db, train_id)
    if not details:
        raise HTTPException(status_code=404, detail=f"Could not simulate step for train '{train_id}'")
    return details


@router.get("/{train_id}", summary="Get train by ID or number")
def get_train(train_id: str, db: Session = Depends(get_db)):
    """Returns train metadata and current status for a given train ID or number."""
    train = TrainService.find_train(db, train_id)
    if not train:
        raise HTTPException(status_code=404, detail=f"Train '{train_id}' not found")
    all_trains = TrainService.get_all_trains(db)
    item = next((t for t in all_trains if t["train_number"] == train.train_number), None)
    return item or {
        "id": train.id,
        "train_id": train.train_number,
        "train_number": train.train_number,
        "train_name": train.train_name,
        "source": train.source_station.city if train.source_station else "Hyderabad",
        "source_code": train.source_station.station_code if train.source_station else "HYB",
        "destination": train.destination_station.city if train.destination_station else "Chennai",
        "destination_code": train.destination_station.station_code if train.destination_station else "MAS",
        "status": train.status,
        "delay_minutes": 0,
    }
