from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.services.prediction_service import PredictionService

class ETAService:
    @staticmethod
    def get_train_eta(db: Session, train_id: str) -> Optional[Dict[str, Any]]:
        """
        Delegates to PredictionService and ETAPredictor to provide stable ETA predictions.
        Preserves baseline contract: train_id, scheduled_eta, predicted_eta, predicted_delay, confidence, prediction_type.
        """
        return PredictionService.get_baseline_prediction(db, train_id)

    @staticmethod
    def calculate_demo_eta(db: Session, train_number: str) -> Optional[Dict[str, Any]]:
        """Compatibility method for existing callers."""
        return PredictionService.get_baseline_prediction(db, train_number)
