"""Train API router for search, discovery, and telemetry services."""
from typing import List, Optional, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.train_service import TrainService
from app.services.tracking_service import TrackingService
from app.services.eta_service import ETAService
from app.services.simulation_service import SimulationService

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
    """
    Search trains:
    - Numeric query (e.g. 17645): Performs exact train number search with dynamic discovery fallback. Never returns unrelated DB trains.
    - Text query (e.g. Karimnagar): Performs train name / station / city search.
    - Source/Destination: Filters by route.
    """
    clean_q = q.strip() if q else ""
    if clean_q and clean_q.isdigit():
        # Dynamic discovery & lookup strictly for the requested train number
        from app.services.train_discovery_service import TrainDiscoveryService
        disc = TrainDiscoveryService.discover_train(clean_q, db=db)
        if disc.get("success") and disc.get("train"):
            train_data = disc["train"]
            if status and status.lower() != "all" and train_data.get("status", "").lower() != status.lower():
                return []
            if source and source.lower() != "all" and source.lower() not in train_data.get("source", "").lower():
                return []
            if destination and destination.lower() != "all" and destination.lower() not in train_data.get("destination", "").lower():
                return []
            return [train_data]

        # If invalid / not discoverable, return empty list (NEVER unrelated database trains)
        return []

    # Non-numeric query or empty query: perform standard text/corridor search
    return TrainService.search_trains(db, query=clean_q or None, status=status, source=source, destination=destination)

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


@router.get("/discover/{train_number}", summary="Dynamically discover and track a train by number")
def discover_train(train_number: str, db: Session = Depends(get_db)):
    """
    Discovers an unconfigured train from live railway network (RailRadar),
    registers master record in Supabase, and adds to dynamic real-time tracking pipeline.
    """
    from app.services.train_discovery_service import TrainDiscoveryService
    result = TrainDiscoveryService.discover_train(train_number, db=db)
    if not result.get("success"):
        raise HTTPException(status_code=404, detail=result.get("error", f"Train '{train_number}' not found."))
    return result

@router.get("/{train_id}", summary="Get train by ID or number")
def get_train(train_id: str, db: Session = Depends(get_db)):
    """Returns train metadata and current status for a given train ID or number with live RailRadar telemetry."""
    clean_id = str(train_id).strip()
    if clean_id.isdigit():
        from app.services.train_discovery_service import TrainDiscoveryService
        disc = TrainDiscoveryService.discover_train(clean_id, db=db)
        if disc.get("success") and disc.get("train"):
            return disc["train"]
        raise HTTPException(
            status_code=404,
            detail=disc.get("error") or f"Unable to retrieve live train data from RailRadar for train '{train_id}'"
        )

    train = TrainService.find_train(db, train_id)
    if not train:
        raise HTTPException(status_code=404, detail=f"Train '{train_id}' not found")

    from app.config import settings
    if settings.TRAIN_DATA_PROVIDER == "RAILRADAR":
        from app.services.train_discovery_service import TrainDiscoveryService
        disc = TrainDiscoveryService.discover_train(str(train.train_number), db=db)
        if disc.get("success") and disc.get("train"):
            return disc["train"]

    all_trains = TrainService.get_all_trains(db)
    item = next((t for t in all_trains if t["train_number"] == train.train_number), None)
    if item:
        return item
    details = TrainService.get_train_details(db, str(train.train_number))
    if details:
        return details
    return {
        "id": train.id,
        "train_id": train.train_number,
        "train_number": train.train_number,
        "train_name": train.train_name,
        "source": train.source_station.city if train.source_station else "Unknown",
        "source_code": train.source_station.station_code if train.source_station else "SRC",
        "destination": train.destination_station.city if train.destination_station else "Unknown",
        "destination_code": train.destination_station.station_code if train.destination_station else "DST",
        "status": train.status,
        "delay_minutes": 0,
    }
