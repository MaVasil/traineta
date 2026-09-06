from pydantic import BaseModel, Field
from typing import List, Dict, Any

class AdminSummaryResponse(BaseModel):
    active_trains: int = Field(..., example=12)
    delayed_trains: int = Field(..., example=4)
    on_time_trains: int = Field(..., example=8)
    average_delay_minutes: float = Field(..., example=4.2)
    prediction_accuracy_percent: float = Field(..., example=94.8)
    active_simulations: int = Field(1, example=1)
    system_status: str = Field("OPERATIONAL", example="OPERATIONAL")
    data_mode: str = Field("DEMO_SIMULATED", example="DEMO_SIMULATED")

class AdminAnalyticsResponse(BaseModel):
    accuracy_trend: List[Dict[str, Any]]
    delay_distribution: List[Dict[str, Any]]
    status_share: List[Dict[str, Any]]
    station_delays: List[Dict[str, Any]]
    data_mode: str = Field("DEMO_SIMULATED", example="DEMO_SIMULATED")
