from pydantic import BaseModel, Field
from typing import List, Optional

class RouteStationItem(BaseModel):
    sequence: int = Field(..., example=1)
    name: str = Field(..., example="Hyderabad")
    code: Optional[str] = Field(None, example="HYB")
    status: str = Field(..., example="COMPLETED") # COMPLETED, CURRENT, UPCOMING
    scheduled_arrival: Optional[str] = Field(None, example="20:45")
    scheduled_departure: Optional[str] = Field(None, example="20:50")
    distance_from_source: Optional[float] = Field(0.0, example=132.0)

class TrainRouteResponse(BaseModel):
    train_number: str = Field(..., example="12401")
    stations: List[RouteStationItem]
