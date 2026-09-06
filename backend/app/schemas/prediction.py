from pydantic import BaseModel, Field
from typing import Optional

class ETAPredictionResponse(BaseModel):
    train_number: str = Field(..., example="12401")
    train_name: Optional[str] = Field(None, example="Demo Express")
    target_station: str = Field(..., example="Vijayawada")
    target_station_code: Optional[str] = Field(None, example="BZA")
    current_speed: int = Field(..., example=78)
    remaining_distance_km: float = Field(..., example=207.0)
    current_delay_minutes: int = Field(..., example=6)
    scheduled_eta: str = Field(..., example="22:36")
    predicted_eta: str = Field(..., example="22:42")
    confidence: int = Field(..., example=91)
    calculation_method: str = Field("DEMO_DETERMINISTIC_HEURISTIC", example="DEMO_DETERMINISTIC_HEURISTIC")
    disclaimer: str = Field("DEMO MODE • SIMULATED REAL-TIME DATA", example="DEMO MODE • SIMULATED REAL-TIME DATA")
