from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime

class LiveTrackingResponse(BaseModel):
    train_number: str = Field(..., example="12401")
    train_name: Optional[str] = Field(None, example="Demo Express")
    source: Optional[str] = Field(None, example="Origin")
    source_code: Optional[str] = Field(None, example="SRC")
    source_latitude: Optional[float] = None
    source_longitude: Optional[float] = None
    source_details: Optional[Any] = None
    destination: Optional[str] = Field(None, example="Destination")
    destination_code: Optional[str] = Field(None, example="DST")
    destination_latitude: Optional[float] = None
    destination_longitude: Optional[float] = None
    destination_details: Optional[Any] = None
    latitude: Optional[float] = Field(None, example=17.9689)
    longitude: Optional[float] = Field(None, example=79.5941)
    location_type: Optional[str] = Field(None, example="GPS")
    station_latitude: Optional[float] = Field(None, example=17.9689)
    station_longitude: Optional[float] = Field(None, example=79.5941)
    speed: Optional[int] = Field(None, example=78)
    speed_kmph: Optional[int] = Field(None, example=78)
    speed_status: Optional[str] = Field("UNAVAILABLE", example="UNAVAILABLE")
    speedStatus: Optional[str] = Field("UNAVAILABLE", example="UNAVAILABLE")
    speed_unit: Optional[str] = Field("km/h", example="km/h")
    current_station: str = Field(..., example="Warangal")
    current_station_code: Optional[str] = Field(None, example="WL")
    next_station: str = Field(..., example="Vijayawada")
    next_station_code: Optional[str] = Field(None, example="BZA")
    delay_minutes: int = Field(..., example=6)
    scheduled_eta: str = Field(..., example="22:36")
    predicted_eta: str = Field(..., example="22:42")
    confidence: float = Field(..., example=0.91)
    data_mode: str = Field("SIMULATED", example="SIMULATED")
    data_source: Optional[str] = Field("RAILRADAR", example="RAILRADAR")
    data_status: Optional[str] = Field("LIVE", example="LIVE")
    stations: Optional[List[Any]] = None
    route_coordinates: Optional[List[Any]] = None
    last_updated: Optional[datetime] = None
