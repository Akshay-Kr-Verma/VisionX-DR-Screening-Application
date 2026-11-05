from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey
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

    image_path = Column(
        String(500),
        nullable=True
    )

    gradcam_path = Column(
        String(500),
        nullable=True
    )

    eye_side = Column(
        String(50),
        default="Right Eye",
        nullable=True
    )

    prediction = Column(
        String(100),
        nullable=False
    )

    confidence = Column(
        Float,
        nullable=False
    )

    severity_level = Column(
        Integer,
        default=0,
        nullable=False
    )

    priority = Column(
        String(20),
        default="ROUTINE",
        nullable=False
    )

    status = Column(
        String(50),
        default="PENDING_REVIEW",
        nullable=False
    )

    doctor_notes = Column(
        Text,
        nullable=True
    )

    prescribed_medication = Column(
        Text,
        nullable=True
    )

    treatment_plan = Column(
        String(255),
        nullable=True
    )

    reviewed_by_doctor_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True
    )

    reviewed_at = Column(
        DateTime,
        nullable=True
    )

    screened_by_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True
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

    doctor = relationship(
        "User",
        foreign_keys=[reviewed_by_doctor_id],
        backref="doctor_reviews"
    )

    screener = relationship(
        "User",
        foreign_keys=[screened_by_id],
        backref="screenings_performed"
    )