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


# ============================================================
# REGISTER
# ============================================================

@router.post("/register")
def register_user(
    user_data: RegisterRequest,
    db: Session = Depends(get_db)
):

    # --------------------------------------------------------
    # Check whether email already exists
    # --------------------------------------------------------

    existing_user = db.query(User).filter(
        User.email == user_data.email
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    # --------------------------------------------------------
    # Hash password
    # --------------------------------------------------------

    hashed_password = hash_password(
        user_data.password
    )

    # --------------------------------------------------------
    # Create user
    # --------------------------------------------------------

    new_user = User(
        name=user_data.name,
        email=user_data.email,
        password_hash=hashed_password,
        role="patient"
    )

    db.add(new_user)

    try:

        # Flush gives us new_user.id without
        # committing the transaction yet.
        db.flush()

        # ----------------------------------------------------
        # Automatically create patient profile
        # ----------------------------------------------------

        patient_id = f"P-{new_user.id:06d}"

        new_patient = Patient(
            user_id=new_user.id,
            patient_id=patient_id
        )

        db.add(new_patient)

        # ----------------------------------------------------
        # Commit both records
        # ----------------------------------------------------

        db.commit()

        db.refresh(new_user)
        db.refresh(new_patient)

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Unable to create patient account"
        )

    # --------------------------------------------------------
    # Return registration result
    # --------------------------------------------------------

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

    # --------------------------------------------------------
    # Find user
    # --------------------------------------------------------

    user = db.query(User).filter(
        User.email == login_data.email
    ).first()

    # --------------------------------------------------------
    # Verify credentials
    # --------------------------------------------------------

    if not user or not verify_password(
        login_data.password,
        user.password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    # --------------------------------------------------------
    # Create JWT
    # --------------------------------------------------------

    access_token = create_access_token(
        user_id=user.id,
        role=user.role
    )

    # --------------------------------------------------------
    # Get patient information if applicable
    # --------------------------------------------------------

    patient_data = None

    if user.role == "patient":

        patient = db.query(Patient).filter(
            Patient.user_id == user.id
        ).first()

        if patient:
            patient_data = {
                "patient_id": patient.patient_id
            }

    # --------------------------------------------------------
    # Return login response
    # --------------------------------------------------------

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