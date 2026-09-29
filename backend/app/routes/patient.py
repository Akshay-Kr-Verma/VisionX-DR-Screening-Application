from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.user import User
from app.models.patient import Patient
from app.schemas.patient import (
    PatientProfileCreate,
    PatientProfileResponse
)
from app.dependencies.auth import require_role


router = APIRouter(
    prefix="/patients",
    tags=["Patients"]
)


@router.post(
    "/me",
    response_model=PatientProfileResponse
)
def create_patient_profile(
    patient_data: PatientProfileCreate,
    current_user: User = Depends(
        require_role("patient")
    ),
    db: Session = Depends(get_db)
):

    # Check if patient profile already exists
    existing_patient = db.query(Patient).filter(
        Patient.user_id == current_user.id
    ).first()

    if existing_patient:
        raise HTTPException(
            status_code=400,
            detail="Patient profile already exists"
        )

    # Generate application-level patient ID
    patient_id = f"P-{current_user.id:06d}"

    new_patient = Patient(
        user_id=current_user.id,
        patient_id=patient_id,
        date_of_birth=patient_data.date_of_birth,
        gender=patient_data.gender,
        phone=patient_data.phone,
        address=patient_data.address,
        emergency_contact=patient_data.emergency_contact
    )

    db.add(new_patient)
    db.commit()
    db.refresh(new_patient)

    return PatientProfileResponse(
        patient_id=new_patient.patient_id,
        name=current_user.name,
        email=current_user.email,
        date_of_birth=new_patient.date_of_birth,
        gender=new_patient.gender,
        phone=new_patient.phone,
        address=new_patient.address,
        emergency_contact=new_patient.emergency_contact
    )


@router.get(
    "/me",
    response_model=PatientProfileResponse
)
def get_patient_profile(
    current_user: User = Depends(
        require_role("patient")
    ),
    db: Session = Depends(get_db)
):

    patient = db.query(Patient).filter(
        Patient.user_id == current_user.id
    ).first()

    if not patient:
        raise HTTPException(
            status_code=404,
            detail="Patient profile not found"
        )

    return PatientProfileResponse(
        patient_id=patient.patient_id,
        name=current_user.name,
        email=current_user.email,
        date_of_birth=patient.date_of_birth,
        gender=patient.gender,
        phone=patient.phone,
        address=patient.address,
        emergency_contact=patient.emergency_contact
    )