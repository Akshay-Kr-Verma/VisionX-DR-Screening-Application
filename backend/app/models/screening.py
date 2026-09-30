from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database.database import Base


class Screening(Base):
    __tablename__ = "screenings"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True
    )

    patient_id = Column(
        Integer,
        ForeignKey("patients.id"),
        nullable=False
    )

    image_filename = Column(
        String(255),
        nullable=False
    )

    prediction = Column(
        String(100),
        nullable=False
    )

    confidence = Column(
        Float,
        nullable=False
    )

    screened_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    patient = relationship(
        "Patient",
        backref="screenings"
    )