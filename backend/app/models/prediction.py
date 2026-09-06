import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db.database import Base

class ETAPrediction(Base):
    __tablename__ = "eta_predictions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    train_id = Column(String(36), ForeignKey("trains.id", ondelete="CASCADE"), nullable=False, index=True)
    station_id = Column(String(36), ForeignKey("stations.id", ondelete="CASCADE"), nullable=False)
    scheduled_eta = Column(DateTime, nullable=False)
    predicted_eta = Column(DateTime, nullable=False)
    predicted_delay_minutes = Column(Integer, default=0)
    confidence = Column(Float, default=0.75)
    prediction_type = Column(String(50), default="BASELINE")
    model_version = Column(String(50), default="v1-baseline")
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    train = relationship("Train", back_populates="predictions")
    station = relationship("Station", back_populates="predictions")
