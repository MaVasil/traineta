import os
import json
import joblib
import pandas as pd
from typing import Dict, Any, Tuple
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import numpy as np

MODEL_DIR = os.path.join(os.path.dirname(__file__), "artifacts")
MODEL_PATH = os.path.join(MODEL_DIR, "eta_model.joblib")
META_PATH = os.path.join(MODEL_DIR, "eta_model_metadata.json")

class MLTrainer:
    def __init__(self):
        os.makedirs(MODEL_DIR, exist_ok=True)
        self.models = {
            "Linear Regression": LinearRegression(),
            "Random Forest": RandomForestRegressor(n_estimators=100, random_state=42),
            "Gradient Boosting": GradientBoostingRegressor(n_estimators=100, learning_rate=0.1, random_state=42)
        }

    def train_and_evaluate(self, df: pd.DataFrame) -> Tuple[Any, Dict[str, Any]]:
        """
        Trains multiple models chronologically (using index assuming generated chronologically), 
        evaluates them, and selects the best one based on MAE.
        """
        # Split chronologically
        n = len(df)
        train_idx = int(n * 0.70)
        val_idx = int(n * 0.85)

        # Target and Features
        target = "remaining_travel_time_minutes"
        features = ['scheduled_hour', 'day_of_week', 'is_rush_hour', 'base_travel_time', 'current_delay', 'current_speed', 'distance_km', 'avg_station_delay']
        
        # Fill NA for avg_station_delay
        df['avg_station_delay'] = df['avg_station_delay'].fillna(0)

        X = df[features]
        y = df[target]

        X_train, y_train = X.iloc[:train_idx], y.iloc[:train_idx]
        X_val, y_val = X.iloc[train_idx:val_idx], y.iloc[train_idx:val_idx]
        X_test, y_test = X.iloc[val_idx:], y.iloc[val_idx:]

        best_model_name = None
        best_model = None
        best_mae = float('inf')
        results = {}

        print("\nTraining models...")
        for name, model in self.models.items():
            model.fit(X_train, y_train)
            preds = model.predict(X_val)
            mae = mean_absolute_error(y_val, preds)
            print(f"{name} Validation MAE: {mae:.2f} minutes")
            
            if mae < best_mae:
                best_mae = mae
                best_model_name = name
                best_model = model

        print(f"\nBest model: {best_model_name}")

        # Evaluate best model on test set
        test_preds = best_model.predict(X_test)
        test_mae = mean_absolute_error(y_test, test_preds)
        test_rmse = np.sqrt(mean_squared_error(y_test, test_preds))
        test_r2 = r2_score(y_test, test_preds)

        print(f"Test MAE:  {test_mae:.2f} minutes")
        print(f"Test RMSE: {test_rmse:.2f} minutes")
        print(f"Test R²:   {test_r2:.2f}")

        # Retrain best model on train+val for final saving
        best_model.fit(X.iloc[:val_idx], y.iloc[:val_idx])

        metadata = {
            "model_name": type(best_model).__name__,
            "model_version": "1.0",
            "training_timestamp": pd.Timestamp.now().isoformat(),
            "training_rows": len(df),
            "features": features,
            "MAE": round(test_mae, 2),
            "RMSE": round(test_rmse, 2),
            "R2": round(test_r2, 2)
        }

        return best_model, metadata

    def save_model(self, model, metadata):
        joblib.dump(model, MODEL_PATH)
        with open(META_PATH, "w") as f:
            json.dump(metadata, f, indent=2)
        print("Model and metadata saved successfully.")
