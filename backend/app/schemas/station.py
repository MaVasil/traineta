from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class StationBase(BaseModel):
    station_code: str = Field(..., example="HYB")
    station_name: str = Field(..., example="Hyderabad Deccan")
    city: str = Field(..., example="Hyderabad")
    latitude: float = Field(..., example=17.392000)
    longitude: float = Field(..., example=78.473500)

class StationResponse(StationBase):
    id: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
