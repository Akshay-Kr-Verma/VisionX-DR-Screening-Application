from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database.database import get_db
from app.models.patient import Patient
from app.models.user import User
from app.models.screening import Screening
from app.schemas.patient import (
    PatientProfileCreate,
    PatientProfileResponse,
    StaffPatientCreate
)
from app.dependencies.auth import require_role, get_current_user
from app.services.auth_service import hash_password


router = APIRouter(
    prefix="/patients",
    tags=["Patients"]
)


# ============================================================
# GET ALL PATIENTS (Staff, Doctor, Admin)
# ============================================================

@router.get("")
def list_patients(
    search: Optional[str] = Query(None),
    current_user: User = Depends(
        require_role("staff", "doctor", "admin")
    ),
    db: Session = Depends(get_db)
):
    query = db.query(Patient)

    if search:
        search_filter = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Patient.patient_id.ilike(search_filter),
                Patient.name.ilike(search_filter),
                Patient.phone.ilike(search_filter)
            )
        )

    patients = query.order_by(Patient.id.desc()).all()

    result = []
    for pat in patients:
        screenings = (
            db.query(Screening)
            .filter(Screening.patient_id == pat.id)
            .order_by(Screening.screened_at.desc())
            .all()
        )

        latest_screening = screenings[0] if screenings else None

        result.append({
            "id": pat.id,
            "patient_id": pat.patient_id,
            "name": pat.name or (pat.user.name if pat.user else "Unnamed Patient"),
            "email": pat.user.email if pat.user else None,
            "gender": pat.gender,
            "date_of_birth": pat.date_of_birth.isoformat() if pat.date_of_birth else None,
            "phone": pat.phone,
            "address": pat.address,
            "emergency_contact": pat.emergency_contact,
            "diabetes_type": pat.diabetes_type,
            "medical_history": pat.medical_history,
            "screening_count": len(screenings),
            "latest_prediction": latest_screening.prediction if latest_screening else None,
            "latest_severity_level": latest_screening.severity_level if latest_screening else None,
            "latest_priority": latest_screening.priority if latest_screening else None,
            "latest_screened_at": latest_screening.screened_at if latest_screening else None,
            "latest_status": latest_screening.status if latest_screening else None
        })

    return result


def generate_next_patient_id(db: Session) -> str:
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
# REGISTER PATIENT BY STAFF / ADMIN
# ============================================================

@router.post("/register-staff")
def register_patient_by_staff(
    payload: StaffPatientCreate,
    current_user: User = Depends(
        require_role("staff", "admin")
    ),
    db: Session = Depends(get_db)
):
    if not payload.name or not payload.name.strip():
        raise HTTPException(
            status_code=400,
            detail="Patient name is required"
        )

    linked_user = None

    # If email provided, check if user exists or create account
    if payload.email:
        existing_user = db.query(User).filter(
            User.email == payload.email
        ).first()

        if existing_user:
            if existing_user.patient:
                raise HTTPException(
                    status_code=400,
                    detail=f"Patient profile already exists for {payload.email} with ID {existing_user.patient.patient_id}"
                )
            linked_user = existing_user
        else:
            linked_user = User(
                name=payload.name.strip(),
                email=payload.email,
                password_hash=hash_password("patient123"),
                role="patient"
            )
            db.add(linked_user)
            db.flush()

    # Generate guaranteed unique sequential patient ID
    patient_id = generate_next_patient_id(db)

    new_patient = Patient(
        user_id=linked_user.id if linked_user else None,
        patient_id=patient_id,
        name=payload.name.strip(),
        date_of_birth=payload.date_of_birth,
        gender=payload.gender,
        phone=payload.phone,
        address=payload.address,
        emergency_contact=payload.emergency_contact,
        diabetes_type=payload.diabetes_type,
        medical_history=payload.medical_history
    )

    db.add(new_patient)
    db.commit()
    db.refresh(new_patient)

    return {
        "message": "Patient registered successfully",
        "patient": {
            "id": new_patient.id,
            "patient_id": new_patient.patient_id,
            "name": new_patient.name,
            "email": linked_user.email if linked_user else None,
            "gender": new_patient.gender,
            "phone": new_patient.phone,
            "diabetes_type": new_patient.diabetes_type,
            "medical_history": new_patient.medical_history
        }
    }


# ============================================================
# GET CURRENT PATIENT PROFILE (Authenticated Patient)
# ============================================================

@router.get("/me")
def get_my_patient_profile(
    current_user: User = Depends(
        require_role("patient")
    ),
    db: Session = Depends(get_db)
):
    # Primary: patient linked by user_id
    patient = db.query(Patient).filter(
        Patient.user_id == current_user.id
    ).first()

    if not patient:
        # Fallback: check if a staff-registered patient shares this user's email
        # (staff may have used this email when registering, creating a linked user)
        linked_via_email = (
            db.query(Patient)
            .join(User, Patient.user_id == User.id)
            .filter(User.email == current_user.email)
            .first()
        )
        if linked_via_email:
            patient = linked_via_email
        else:
            # Auto-create patient profile for self-registered users
            patient_id = generate_next_patient_id(db)
            patient = Patient(
                user_id=current_user.id,
                patient_id=patient_id,
                name=current_user.name
            )
            db.add(patient)
            db.commit()
            db.refresh(patient)

    return {
        "id": patient.id,
        "patient_id": patient.patient_id,
        "name": patient.name or current_user.name,
        "email": current_user.email,
        "date_of_birth": patient.date_of_birth.isoformat() if patient.date_of_birth else None,
        "gender": patient.gender,
        "phone": patient.phone,
        "address": patient.address,
        "emergency_contact": patient.emergency_contact,
        "diabetes_type": patient.diabetes_type,
        "medical_history": patient.medical_history
    }


# ============================================================
# GET SPECIFIC PATIENT PROFILE BY PATIENT_ID
# ============================================================

@router.get("/{patient_id}")
def get_patient_details(
    patient_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    patient = db.query(Patient).filter(
        Patient.patient_id == patient_id
    ).first()

    if not patient:
        raise HTTPException(
            status_code=404,
            detail=f"Patient with ID {patient_id} not found"
        )

    # Permission check: patients can only view their own
    if current_user.role == "patient" and patient.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to view this patient profile"
        )

    screenings = (
        db.query(Screening)
        .filter(Screening.patient_id == patient.id)
        .order_by(Screening.screened_at.desc())
        .all()
    )

    return {
        "id": patient.id,
        "patient_id": patient.patient_id,
        "name": patient.name or (patient.user.name if patient.user else "Patient"),
        "email": patient.user.email if patient.user else None,
        "gender": patient.gender,
        "date_of_birth": patient.date_of_birth.isoformat() if patient.date_of_birth else None,
        "phone": patient.phone,
        "address": patient.address,
        "emergency_contact": patient.emergency_contact,
        "diabetes_type": patient.diabetes_type,
        "medical_history": patient.medical_history,
        "screenings": [
            {
                "screening_id": s.id,
                "image_filename": s.image_filename,
                "image_path": s.image_path,
                "gradcam_path": s.gradcam_path,
                "prediction": s.prediction,
                "confidence": s.confidence,
                "severity_level": s.severity_level,
                "priority": s.priority,
                "status": s.status,
                "doctor_notes": s.doctor_notes,
                "prescribed_medication": s.prescribed_medication,
                "treatment_plan": s.treatment_plan,
                "doctor_name": s.doctor.name if s.doctor else None,
                "reviewed_at": s.reviewed_at,
                "screened_at": s.screened_at
            }
            for s in screenings
        ]
    }


# ============================================================
# DELETE PATIENT (Admin and Staff)
# ============================================================

@router.delete("/{patient_id}")
def delete_patient(
    patient_id: str,
    current_user: User = Depends(require_role("admin", "staff")),
    db: Session = Depends(get_db)
):
    patient = db.query(Patient).filter(Patient.patient_id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient with ID {patient_id} not found")

    try:
        # Delete all screenings for this patient first
        db.query(Screening).filter(Screening.patient_id == patient.id).delete(synchronize_session=False)

        # If linked to a user account whose role is 'patient', delete the user account too
        linked_user = patient.user
        db.delete(patient)

        if linked_user and linked_user.role == "patient":
            db.delete(linked_user)

        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Unable to delete patient: {str(e)}"
        )

    return {"message": f"Patient {patient_id} and all associated records deleted successfully"}