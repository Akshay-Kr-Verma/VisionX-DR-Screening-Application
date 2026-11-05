from datetime import date
from pydantic import BaseModel, EmailStr
from typing import Optional


class PatientProfileCreate(BaseModel):
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None


class StaffPatientCreate(BaseModel):
    name: str
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    diabetes_type: Optional[str] = None
    medical_history: Optional[str] = None


class PatientProfileResponse(BaseModel):
    patient_id: str
    name: str
    email: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    diabetes_type: Optional[str] = None
    medical_history: Optional[str] = None