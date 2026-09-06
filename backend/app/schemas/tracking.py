from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class LiveTrackingResponse(BaseModel):
    train_number: str = Field(..., example="12401")
    train_name: Optional[str] = Field(None, example="Demo Express")
    latitude: float = Field(..., example=17.9689)
    longitude: float = Field(..., example=79.5941)
    speed: int = Field(..., example=78)
    current_station: str = Field(..., example="Warangal")
    current_station_code: Optional[str] = Field(None, example="WL")
    next_station: str = Field(..., example="Vijayawada")
    next_station_code: Optional[str] = Field(None, example="BZA")
    delay_minutes: int = Field(..., example=6)
    scheduled_eta: str = Field(..., example="22:36")
    predicted_eta: str = Field(..., example="22:42")
    confidence: int = Field(..., example=91)
    data_mode: str = Field("SIMULATED", example="SIMULATED")
    last_updated: Optional[datetime] = None
