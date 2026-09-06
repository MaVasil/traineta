from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.prediction import ETAPredictionResponse
from app.services.eta_service import ETAService

router = APIRouter(prefix="/api/predictions", tags=["ETA Predictions"])

@router.get("/{train_number}", response_model=ETAPredictionResponse, summary="Get train arrival ETA prediction")
def get_prediction(train_number: str, db: Session = Depends(get_db)):
    """Provides estimated arrival time calculated using track geometry and section delay offsets."""
    prediction = ETAService.calculate_demo_eta(db, train_number)
    if not prediction:
        raise HTTPException(status_code=404, detail=f"ETA prediction for train '{train_number}' not found")
    return prediction
