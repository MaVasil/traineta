import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Numeric, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.db.database import Base

class TrainPosition(Base):
    __tablename__ = "train_positions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    train_id = Column(String(36), ForeignKey("trains.id", ondelete="CASCADE"), nullable=False, index=True)
    latitude = Column(Numeric(9, 6), nullable=False)
    longitude = Column(Numeric(9, 6), nullable=False)
    speed = Column(Integer, default=0)
    current_station_id = Column(String(36), ForeignKey("stations.id", ondelete="SET NULL"), nullable=True)
    next_station_id = Column(String(36), ForeignKey("stations.id", ondelete="SET NULL"), nullable=True)
    current_delay_minutes = Column(Integer, default=0)
    recorded_at = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    train = relationship("Train", back_populates="positions")
    current_station = relationship("Station", foreign_keys=[current_station_id])
    next_station = relationship("Station", foreign_keys=[next_station_id])
