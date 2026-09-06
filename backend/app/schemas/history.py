from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date

class HistoryRecordItem(BaseModel):
    id: str
    train_number: str = Field(..., example="12401")
    train_name: str = Field(..., example="Demo Express")
    station: str = Field(..., example="Vijayawada")
    station_code: str = Field(..., example="BZA")
    scheduled_arrival: str = Field(..., example="22:36")
    predicted_arrival: str = Field(..., example="22:42")
    actual_arrival: str = Field(..., example="22:41")
    prediction_error_minutes: int = Field(..., example=1)
    journey_date: str = Field(..., example="2026-09-04")
    status: str = Field("ON TIME", example="ON TIME")

class HistoryListResponse(BaseModel):
    total: int
    items: List[HistoryRecordItem]
