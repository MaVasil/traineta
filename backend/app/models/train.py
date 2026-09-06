import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db.database import Base

class Train(Base):
    __tablename__ = "trains"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    train_number = Column(String(10), unique=True, nullable=False, index=True)
    train_name = Column(String(100), nullable=False)
    source_station_id = Column(String(36), ForeignKey("stations.id", ondelete="SET NULL"), nullable=True)
    destination_station_id = Column(String(36), ForeignKey("stations.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(30), default="ON_TIME")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    source_station = relationship("Station", foreign_keys=[source_station_id])
    destination_station = relationship("Station", foreign_keys=[destination_station_id])
    routes = relationship("TrainRoute", back_populates="train", cascade="all, delete-orphan", order_by="TrainRoute.sequence_number")
    positions = relationship("TrainPosition", back_populates="train", cascade="all, delete-orphan", order_by="desc(TrainPosition.recorded_at)")
    predictions = relationship("ETAPrediction", back_populates="train", cascade="all, delete-orphan")
    historical_runs = relationship("HistoricalRun", back_populates="train", cascade="all, delete-orphan")
    delay_events = relationship("DelayEvent", back_populates="train", cascade="all, delete-orphan")

    # Compatibility property
    @property
    def journey_histories(self):
        return self.historical_runs
