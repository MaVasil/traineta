import os
import json
import joblib
from backend.app.ml.feature_engineering import create_features

MODEL_DIR = os.path.join(os.path.dirname(__file__), "artifacts")
MODEL_PATH = os.path.join(MODEL_DIR, "eta_model.joblib")
META_PATH = os.path.join(MODEL_DIR, "eta_model_metadata.json")

class MLEtaPredictor:
    """
    ML-based ETA Predictor that loads the trained artifact and makes predictions.
    If the model is unavailable, it fails gracefully so the service can fallback.
    """
    def __init__(self):
        self.model = None
        self.metadata = {}
        self.load_model()

    def load_model(self):
        try:
            if os.path.exists(MODEL_PATH) and os.path.exists(META_PATH):
                self.model = joblib.load(MODEL_PATH)
                with open(META_PATH, "r") as f:
                    self.metadata = json.load(f)
                print(f"Loaded ML model: {self.metadata.get('model_name')} v{self.metadata.get('model_version')}")
        except Exception as e:
            print(f"Failed to load ML model: {e}")

    def is_available(self) -> bool:
        return self.model is not None

    def predict_remaining_minutes(
        self,
        current_delay: float,
        speed: float,
        distance_km: float,
        scheduled_hour: int,
        day_of_week: int,
        avg_station_delay: float
    ) -> float:
        """
        Predicts remaining travel time in minutes based on real-time features.
        """
        if not self.is_available():
            raise ValueError("ML Model not loaded.")
        
        # Build features DataFrame
        df = create_features(
            current_delay=current_delay,
            speed=speed,
            distance_km=distance_km,
            scheduled_hour=scheduled_hour,
            day_of_week=day_of_week,
            avg_station_delay=avg_station_delay
        )
        
        # Predict
        predicted_minutes = self.model.predict(df)[0]
        
        # Ensure it doesn't predict something completely impossible (like negative travel time)
        min_possible = (distance_km / max(1, speed)) * 60 * 0.5  # half the base time at least
        return max(float(min_possible), float(predicted_minutes))

    def get_confidence(self, predicted_minutes: float, distance_km: float) -> float:
        """
        Confidence is based on model R2 score and distance remaining.
        Closer distance = higher confidence.
        """
        base_confidence = self.metadata.get("R2", 0.70)
        
        # Adjust based on distance (closer = more confident)
        if distance_km < 10:
            adj = 0.10
        elif distance_km < 30:
            adj = 0.05
        elif distance_km > 100:
            adj = -0.10
        else:
            adj = 0.0

        conf = base_confidence + adj
        return max(0.40, min(0.98, float(conf)))

ml_predictor = MLEtaPredictor()
