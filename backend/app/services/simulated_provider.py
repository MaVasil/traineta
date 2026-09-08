from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.services.provider_base import DataProvider
from app.services.simulation_service import SimulationService

class SimulatedProvider(DataProvider):
    """
    Wraps the existing SimulationService to conform to the DataProvider interface.
    """
    def __init__(self):
        self.db = SessionLocal()

    def __del__(self):
        try:
            self.db.close()
        except:
            pass

    def get_live_status(self, train_number: str) -> Optional[Dict[str, Any]]:
        """
        Advances the simulation and returns the normalized status.
        """
        try:
            # Reusing the existing simulation logic
            simulated_data = SimulationService.advance_train_simulation(self.db, train_number)
            if not simulated_data:
                return None
                
            # Normalization to common format
            return {
                "train_number": simulated_data.get("train_number"),
                "train_name": simulated_data.get("train_name"),
                "current_station": simulated_data.get("current_station"),
                "previous_station": simulated_data.get("source_city"), # Approximated for sim
                "next_station": simulated_data.get("next_station"),
                "current_delay_minutes": simulated_data.get("current_delay_minutes", 0),
                "scheduled_arrival": simulated_data.get("scheduled_arrival_at_next"),
                "scheduled_departure": simulated_data.get("scheduled_departure_at_next"),
                "actual_arrival": simulated_data.get("predicted_arrival_at_next"), # approximated
                "actual_departure": None,
                "latitude": simulated_data.get("latitude"),
                "longitude": simulated_data.get("longitude"),
                "speed_kmph": simulated_data.get("speed"),
                "timestamp": simulated_data.get("last_updated"),
                "source": "SIMULATED",
                "data_status": "LIVE"
            }
        except Exception as e:
            print(f"[SimulatedProvider] Error advancing train {train_number}: {e}")
            return None
