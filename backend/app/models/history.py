import uuid
from datetime import datetime, date
from sqlalchemy import Column, String, Integer, Time, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db.database import Base

class HistoricalRun(Base):
    __tablename__ = "historical_runs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    train_id = Column(String(36), ForeignKey("trains.id", ondelete="CASCADE"), nullable=False, index=True)
    station_id = Column(String(36), ForeignKey("stations.id", ondelete="RESTRICT"), nullable=False, index=True)
    scheduled_arrival = Column(Time, nullable=False)
    actual_arrival = Column(Time, nullable=False)
    travel_time_minutes = Column(Integer, default=0)
    delay_minutes = Column(Integer, default=0)
    journey_date = Column(Date, nullable=False, index=True, default=date.today)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    train = relationship("Train", back_populates="historical_runs")
    station = relationship("Station", back_populates="historical_runs")

# Compatibility alias
JourneyHistory = HistoricalRun
