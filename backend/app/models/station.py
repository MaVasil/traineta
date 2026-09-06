import uuid
from datetime import datetime
from sqlalchemy import Column, String, Numeric, DateTime
from sqlalchemy.orm import relationship
from app.db.database import Base

class Station(Base):
    __tablename__ = "stations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    station_code = Column(String(10), unique=True, nullable=False, index=True)
    station_name = Column(String(100), nullable=False)
    city = Column(String(100), nullable=False)
    latitude = Column(Numeric(9, 6), nullable=False)
    longitude = Column(Numeric(9, 6), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    routes = relationship("TrainRoute", back_populates="station", cascade="all, delete-orphan")
    historical_runs = relationship("HistoricalRun", back_populates="station")
    predictions = relationship("ETAPrediction", back_populates="station")
    delay_events = relationship("DelayEvent", back_populates="station")

    # Compatibility property
    @property
    def journey_histories(self):
        return self.historical_runs
