from fastapi import (
    APIRouter,
    Depends,
    HTTPException
)

from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.patient import Patient
from app.models.user import User

from app.schemas.patient import (
    PatientProfileCreate,
    PatientProfileResponse
)

from app.dependencies.auth import require_role


router = APIRouter(
    prefix="/patients",
    tags=["Patients"]
)


# ============================================================
# GET CURRENT PATIENT PROFILE
# ============================================================

@router.get("/me")
def get_my_patient_profile(
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

    return {
        "user": {
            "id": current_user.id,
            "name": current_user.name,
            "email": current_user.email,
            "role": current_user.role
        },

        "patient": {
            "id": patient.id,
            "patient_id": patient.patient_id,
            "date_of_birth": patient.date_of_birth,
            "gender": patient.gender,
            "phone": patient.phone,
            "address": patient.address,
            "emergency_contact": patient.emergency_contact
        }
    }


# ============================================================
# CREATE PATIENT PROFILE
# ============================================================
#
# Kept for compatibility with the previous prototype.
# New registrations automatically receive a Patient record.
# ============================================================

@router.post(
    "/profile",
    response_model=PatientProfileResponse
)
def create_patient_profile(
    profile_data: PatientProfileCreate,
    current_user: User = Depends(
        require_role("patient")
    ),
    db: Session = Depends(get_db)
):

    existing_profile = db.query(Patient).filter(
        Patient.user_id == current_user.id
    ).first()

    if existing_profile:

        raise HTTPException(
            status_code=400,
            detail="Patient profile already exists"
        )

    patient_id = f"P-{current_user.id:06d}"

    new_patient = Patient(
        user_id=current_user.id,
        patient_id=patient_id,
        date_of_birth=profile_data.date_of_birth,
        gender=profile_data.gender,
        phone=profile_data.phone,
        address=profile_data.address,
        emergency_contact=profile_data.emergency_contact
    )

    db.add(new_patient)
    db.commit()
    db.refresh(new_patient)

    return new_patient