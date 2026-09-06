import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db.database import Base

class DelayEvent(Base):
    __tablename__ = "delay_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    train_id = Column(String(36), ForeignKey("trains.id", ondelete="CASCADE"), nullable=False, index=True)
    station_id = Column(String(36), ForeignKey("stations.id", ondelete="SET NULL"), nullable=True)
    delay_minutes = Column(Integer, nullable=False, default=0)
    reason = Column(String(255), nullable=False)
    event_type = Column(String(50), nullable=False, default="SIGNAL")
    recorded_at = Column(DateTime, default=datetime.utcnow, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    train = relationship("Train", back_populates="delay_events")
    station = relationship("Station", back_populates="delay_events")
