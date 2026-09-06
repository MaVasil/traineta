from pydantic import BaseModel, Field
from typing import List, Optional
from app.schemas.route import RouteStationItem

class TrainItemResponse(BaseModel):
    train_number: str = Field(..., example="12401")
    train_name: str = Field(..., example="Demo Express")
    source: str = Field(..., example="Hyderabad")
    source_code: Optional[str] = Field("HYB", example="HYB")
    destination: str = Field(..., example="Chennai")
    destination_code: Optional[str] = Field("MAS", example="MAS")
    status: str = Field(..., example="MINOR_DELAY") # ON_TIME, MINOR_DELAY, MAJOR_DELAY
    delay_minutes: int = Field(0, example=6)

    class Config:
        from_attributes = True

class TrainDetailsResponse(BaseModel):
    train_number: str = Field(..., example="12401")
    train_name: str = Field(..., example="Demo Express")
    source: str = Field(..., example="Hyderabad")
    destination: str = Field(..., example="Chennai")
    current_station: str = Field(..., example="Warangal")
    current_station_code: Optional[str] = Field("WL", example="WL")
    next_station: str = Field(..., example="Vijayawada")
    next_station_code: Optional[str] = Field("BZA", example="BZA")
    current_speed: int = Field(..., example=78)
    current_delay: int = Field(..., example=6)
    scheduled_eta: str = Field(..., example="22:36")
    predicted_eta: str = Field(..., example="22:42")
    prediction_confidence: int = Field(..., example=91)
    timeline: List[RouteStationItem] = []
