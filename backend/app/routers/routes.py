from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.route import TrainRouteResponse
from app.services.train_service import TrainService

router = APIRouter(prefix="/api/routes", tags=["Routes"])

@router.get("/{train_number}", response_model=TrainRouteResponse, summary="Get train itinerary route")
def get_route(train_number: str, db: Session = Depends(get_db)):
    """Returns sequence of stations, arrival and departure timings for a given train."""
    route_data = TrainService.get_train_route(db, train_number)
    if not route_data:
        raise HTTPException(status_code=404, detail=f"Route for train '{train_number}' not found")
    return route_data
