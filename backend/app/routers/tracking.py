from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.tracking import LiveTrackingResponse
from app.services.tracking_service import TrackingService

router = APIRouter(prefix="/api/tracking", tags=["Tracking"])

@router.get("/{train_number}", response_model=LiveTrackingResponse, summary="Get live train tracking telemetry")
def get_live_tracking(train_number: str, db: Session = Depends(get_db)):
    """Returns live telemetry including coordinates, speed, delays, and milestone predictions."""
    tracking = TrackingService.get_live_tracking(db, train_number)
    if not tracking:
        raise HTTPException(status_code=404, detail=f"Live telemetry for train '{train_number}' not found")
    return tracking
