from sqlalchemy import Column, Integer, String, Date, ForeignKey
from sqlalchemy.orm import relationship

from app.database.database import Base


class Patient(Base):
    __tablename__ = "patients"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
        autoincrement=True
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        unique=True
    )

    patient_id = Column(
        String(50),
        unique=True,
        nullable=False,
        index=True
    )

    date_of_birth = Column(
        Date,
        nullable=True
    )

    gender = Column(
        String(20),
        nullable=True
    )

    phone = Column(
        String(20),
        nullable=True
    )

    address = Column(
        String(255),
        nullable=True
    )

    emergency_contact = Column(
        String(100),
        nullable=True
    )

    # Relationship with User
    user = relationship(
        "User",
        back_populates="patient"
    )