from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.user import User
from app.models.patient import Patient
from app.schemas.auth import RegisterRequest, LoginRequest
from app.services.auth_service import (
    hash_password,
    verify_password
)
from app.services.jwt_service import create_access_token


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)


def _generate_next_patient_id(db: Session) -> str:
    """Generate a unique sequential patient ID like P-000007."""
    all_patients = db.query(Patient.patient_id).all()
    max_num = 0
    for (pid,) in all_patients:
        if pid and pid.startswith("P-"):
            try:
                num = int(pid[2:])
                if num > max_num:
                    max_num = num
            except ValueError:
                pass
    return f"P-{max_num + 1:06d}"


# ============================================================
# DEMO USERS HELPER (Quick login & testing)
# ============================================================

@router.get("/demo-users")
def get_demo_users():
    return [
        {
            "role": "admin",
            "name": "System Administrator",
            "email": "admin@visionx.com",
            "password": "admin123",
            "badge": "Full Access / Management"
        },
        {
            "role": "doctor",
            "name": "Dr. Sarah Chen, MD",
            "email": "doctor@visionx.com",
            "password": "doctor123",
            "badge": "Priority Triage & Clinical Notes"
        },
        {
            "role": "staff",
            "name": "Alex Miller",
            "email": "staff@visionx.com",
            "password": "staff123",
            "badge": "Patient Reg & Retinal Screening"
        },
        {
            "role": "patient",
            "name": "John Doe",
            "email": "patient@visionx.com",
            "password": "patient123",
            "badge": "Patient Records & PDF Reports"
        }
    ]


# ============================================================
# REGISTER
# ============================================================

@router.post("/register")
def register_user(
    user_data: RegisterRequest,
    db: Session = Depends(get_db)
):
    existing_user = db.query(User).filter(
        User.email == user_data.email
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    hashed_password = hash_password(
        user_data.password
    )

    new_user = User(
        name=user_data.name,
        email=user_data.email,
        password_hash=hashed_password,
        role="patient"
    )

    db.add(new_user)

    try:
        db.flush()

        patient_id = _generate_next_patient_id(db)

        new_patient = Patient(
            user_id=new_user.id,
            patient_id=patient_id,
            name=new_user.name
        )

        db.add(new_patient)
        db.commit()

        db.refresh(new_user)
        db.refresh(new_patient)

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Unable to create patient account: {str(e)}"
        )

    return {
        "message": "Patient registered successfully",
        "user": {
            "id": new_user.id,
            "name": new_user.name,
            "email": new_user.email,
            "role": new_user.role
        },
        "patient": {
            "patient_id": new_patient.patient_id
        }
    }


# ============================================================
# LOGIN
# ============================================================

@router.post("/login")
def login_user(
    login_data: LoginRequest,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(
        User.email == login_data.email
    ).first()

    if not user or not verify_password(
        login_data.password,
        user.password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    access_token = create_access_token(
        user_id=user.id,
        role=user.role
    )

    patient_data = None
    if user.patient:
        patient_data = {
            "id": user.patient.id,
            "patient_id": user.patient.patient_id,
            "name": user.patient.name,
            "phone": user.patient.phone,
            "gender": user.patient.gender
        }

    return {
        "message": "Login successful",
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role
        },
        "patient": patient_data
    }