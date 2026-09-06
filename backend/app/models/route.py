import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Time, Numeric, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.db.database import Base

class TrainRoute(Base):
    __tablename__ = "train_routes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    train_id = Column(String(36), ForeignKey("trains.id", ondelete="CASCADE"), nullable=False, index=True)
    station_id = Column(String(36), ForeignKey("stations.id", ondelete="RESTRICT"), nullable=False)
    sequence_number = Column(Integer, nullable=False)
    scheduled_arrival = Column(Time, nullable=True)
    scheduled_departure = Column(Time, nullable=True)
    distance_from_source = Column(Numeric(7, 2), nullable=False, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("train_id", "sequence_number", name="uq_train_sequence"),
        UniqueConstraint("train_id", "station_id", name="uq_train_station"),
    )

    # Relationships
    train = relationship("Train", back_populates="routes")
    station = relationship("Station", back_populates="routes")

# Compatibility alias
Route = TrainRoute
