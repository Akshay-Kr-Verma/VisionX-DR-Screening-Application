from datetime import date

from pydantic import BaseModel


class PatientProfileCreate(BaseModel):
    date_of_birth: date | None = None
    gender: str | None = None
    phone: str | None = None
    address: str | None = None
    emergency_contact: str | None = None


class PatientProfileResponse(BaseModel):
    patient_id: str
    name: str
    email: str
    date_of_birth: date | None
    gender: str | None
    phone: str | None
    address: str | None
    emergency_contact: str | None