import io
from datetime import datetime
from typing import Optional

from fastapi import (
    APIRouter,
    File,
    UploadFile,
    HTTPException,
    Form,
    Depends,
    Query
)
from PIL import Image
from sqlalchemy.orm import Session
from sqlalchemy import case, or_

from app.database.database import get_db
from app.models.patient import Patient
from app.models.screening import Screening
from app.models.user import User
from app.services.ml_service import (
    predict_image,
    predict_with_gradcam,
    DR_LEVELS,
    PRIORITY_MAP,
    CLINICAL_RECOMMENDATIONS
)
from app.schemas.screening import DoctorReviewRequest, DualEyeReviewRequest
from app.dependencies.auth import require_role, get_current_user


router = APIRouter(
    prefix="/screenings",
    tags=["Screenings"]
)

ALLOWED_IMAGE_TYPES = [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "image/webp"
]


# ============================================================
# HELPER: SCREENING DICT BUILDER
# ============================================================

def format_screening_dict(screening: Screening):
    pat = screening.patient
    user = pat.user if pat else None
    patient_name = pat.name if pat and pat.name else (user.name if user else "Unknown Patient")

    return {
        "screening_id": screening.id,
        "id": screening.id,
        "patient_id": pat.patient_id if pat else "Unknown",
        "patient_name": patient_name,
        "patient_gender": pat.gender if pat else None,
        "patient_phone": pat.phone if pat else None,
        "patient_dob": pat.date_of_birth.isoformat() if pat and pat.date_of_birth else None,
        "diabetes_type": pat.diabetes_type if pat else None,
        "medical_history": pat.medical_history if pat else None,
        "filename": screening.image_filename,
        "image_path": screening.image_path,
        "gradcam_path": screening.gradcam_path,
        "eye_side": getattr(screening, "eye_side", None) or "Right Eye",
        "prediction": screening.prediction,
        "severity_name": screening.prediction,
        "severity_level": screening.severity_level,
        "confidence": screening.confidence,
        "priority": screening.priority,
        "status": screening.status,
        "doctor_notes": screening.doctor_notes,
        "prescribed_medication": screening.prescribed_medication,
        "treatment_plan": screening.treatment_plan,
        "doctor_name": screening.doctor.name if screening.doctor else None,
        "doctor_email": screening.doctor.email if screening.doctor else None,
        "reviewed_at": screening.reviewed_at.isoformat() if screening.reviewed_at else None,
        "screened_at": screening.screened_at.isoformat() if screening.screened_at else None
    }


# ============================================================
# STAFF SCREENING UPLOAD (AI + Grad-CAM + Priority Queueing)
# ============================================================

@router.post("/staff-upload")
async def staff_upload_screening(
    patient_id: str = Form(...),
    image: UploadFile = File(...),
    eye_side: str = Form("Right Eye"),
    current_user: User = Depends(require_role("staff", "admin", "doctor")),
    db: Session = Depends(get_db)
):
    if image.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Please upload a valid retinal fundus image (JPEG, PNG, or JPG)"
        )

    patient = db.query(Patient).filter(
        Patient.patient_id == patient_id.strip()
    ).first()

    if not patient:
        raise HTTPException(
            status_code=404,
            detail=f"Patient with ID '{patient_id}' not found. Please register the patient first."
        )

    image_bytes = await image.read()

    try:
        pil_image = Image.open(io.BytesIO(image_bytes))
        result = predict_with_gradcam(pil_image, save_files=True)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Unable to process retinal fundus image: {str(e)}"
        )

    new_screening = Screening(
        patient_id=patient.id,
        image_filename=image.filename,
        image_path=result["image_path"],
        gradcam_path=result["gradcam_path"],
        eye_side=eye_side,
        prediction=result["prediction"],
        confidence=result["confidence"],
        severity_level=result["severity_level"],
        priority=result["priority"],
        status="PENDING_REVIEW",
        screened_by_id=current_user.id,
        screened_at=datetime.utcnow()
    )

    db.add(new_screening)
    db.commit()
    db.refresh(new_screening)

    response_data = format_screening_dict(new_screening)
    response_data["clinical_action"] = result["clinical_action"]
    response_data["suggested_treatment"] = result["suggested_treatment"]
    response_data["suggested_medication"] = result["suggested_medication"]
    response_data["follow_up"] = result["follow_up"]
    response_data["probability_distribution"] = result["probability_distribution"]

    return response_data


# ============================================================
# DOCTOR TRIAGE QUEUE (Sorted by Priority: Urgent -> High -> Medium -> Routine)
# ============================================================

@router.get("/doctor-triage")
def get_doctor_triage_queue(
    status: Optional[str] = Query("ALL"),
    priority: Optional[str] = Query("ALL"),
    search: Optional[str] = Query(None),
    current_user: User = Depends(require_role("doctor", "admin")),
    db: Session = Depends(get_db)
):
    query = db.query(Screening).join(Patient, Screening.patient_id == Patient.id)

    if status and status != "ALL":
        query = query.filter(Screening.status == status)

    if priority and priority != "ALL":
        query = query.filter(Screening.priority == priority)

    if search:
        search_filter = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Patient.patient_id.ilike(search_filter),
                Patient.name.ilike(search_filter),
                Screening.prediction.ilike(search_filter)
            )
        )

    # Priority ordering: URGENT (4) -> HIGH (3) -> MEDIUM (2) -> ROUTINE (1, 0)
    priority_order = case(
        (Screening.priority == "URGENT", 1),
        (Screening.priority == "HIGH", 2),
        (Screening.priority == "MEDIUM", 3),
        else_=4
    )

    screenings = query.order_by(
        priority_order,
        Screening.screened_at.desc()
    ).all()

    return [format_screening_dict(s) for s in screenings]


# ============================================================
# GET SINGLE SCREENING DETAILS
# ============================================================

@router.get("/{screening_id}")
def get_screening_by_id(
    screening_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    screening = db.query(Screening).filter(
        Screening.id == screening_id
    ).first()

    if not screening:
        raise HTTPException(
            status_code=404,
            detail=f"Screening #{screening_id} not found"
        )

    # Permission check for patients
    if current_user.role == "patient":
        if screening.patient.user_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to view this screening record"
            )

    data = format_screening_dict(screening)
    # Add clinical guidelines for that severity
    rec = CLINICAL_RECOMMENDATIONS.get(screening.severity_level, {})
    data["standard_guidelines"] = rec
    return data


# ============================================================
# DOCTOR REVIEW & DIAGNOSIS / TREATMENT PRESCRIPTION
# ============================================================

@router.put("/{screening_id}/doctor-review")
def review_screening_by_doctor(
    screening_id: int,
    review_data: DoctorReviewRequest,
    current_user: User = Depends(require_role("doctor", "admin")),
    db: Session = Depends(get_db)
):
    screening = db.query(Screening).filter(
        Screening.id == screening_id
    ).first()

    if not screening:
        raise HTTPException(
            status_code=404,
            detail=f"Screening #{screening_id} not found"
        )

    screening.doctor_notes = review_data.doctor_notes.strip()
    screening.prescribed_medication = (
        review_data.prescribed_medication.strip()
        if review_data.prescribed_medication
        else None
    )
    screening.treatment_plan = (
        review_data.treatment_plan.strip()
        if review_data.treatment_plan
        else None
    )
    screening.status = review_data.status or "REVIEWED"
    screening.reviewed_by_doctor_id = current_user.id
    screening.reviewed_at = datetime.utcnow()

    db.commit()
    db.refresh(screening)

    return {
        "message": "Screening review and clinical plan submitted successfully",
        "screening": format_screening_dict(screening)
    }


# ============================================================
# DUAL EYE DOCTOR REVIEW (Both Eyes Evaluated Together)
# ============================================================

@router.put("/patient/{patient_id_str}/doctor-review-dual")
def review_dual_eye_screening(
    patient_id_str: str,
    review_data: DualEyeReviewRequest,
    current_user: User = Depends(require_role("doctor", "admin")),
    db: Session = Depends(get_db)
):
    now = datetime.utcnow()
    updated_screenings = []

    # Update Right Eye screening
    if review_data.right_eye_screening_id:
        r_scr = db.query(Screening).filter(Screening.id == review_data.right_eye_screening_id).first()
        if r_scr:
            r_scr.doctor_notes = (review_data.right_eye_notes or "").strip()
            r_scr.prescribed_medication = (review_data.prescribed_medication or "").strip() or None
            r_scr.treatment_plan = (review_data.treatment_plan or "").strip() or None
            r_scr.status = review_data.status or "REVIEWED"
            r_scr.reviewed_by_doctor_id = current_user.id
            r_scr.reviewed_at = now
            updated_screenings.append(format_screening_dict(r_scr))

    # Update Left Eye screening
    if review_data.left_eye_screening_id:
        l_scr = db.query(Screening).filter(Screening.id == review_data.left_eye_screening_id).first()
        if l_scr:
            l_scr.doctor_notes = (review_data.left_eye_notes or "").strip()
            l_scr.prescribed_medication = (review_data.prescribed_medication or "").strip() or None
            l_scr.treatment_plan = (review_data.treatment_plan or "").strip() or None
            l_scr.status = review_data.status or "REVIEWED"
            l_scr.reviewed_by_doctor_id = current_user.id
            l_scr.reviewed_at = now
            updated_screenings.append(format_screening_dict(l_scr))

    db.commit()

    return {
        "message": "Dual eye clinical review and treatment plan submitted successfully",
        "screenings": updated_screenings
    }


# ============================================================
# GET CURRENT PATIENT'S SCREENING HISTORY (Patient Portal)
# ============================================================

@router.get("/me")
def get_my_screenings(
    current_user: User = Depends(require_role("patient")),
    db: Session = Depends(get_db)
):
    # First: find patient linked by user_id (created during self-registration or staff reg with email)
    patient = db.query(Patient).filter(
        Patient.user_id == current_user.id
    ).first()

    # Fallback: find patient matching by name and phone, or by email match via User table
    # This handles cases where staff registered patient without email, then patient self-registered
    patient_ids_to_check = []
    if patient:
        patient_ids_to_check.append(patient.id)

    # Also search for any patients sharing same email (via their linked user)
    # or directly stored email field (future-proofing)
    if current_user.email:
        email_matched_patients = (
            db.query(Patient)
            .join(User, Patient.user_id == User.id)
            .filter(User.email == current_user.email)
            .all()
        )
        for ep in email_matched_patients:
            if ep.id not in patient_ids_to_check:
                patient_ids_to_check.append(ep.id)

    if not patient_ids_to_check:
        return []

    screenings = (
        db.query(Screening)
        .filter(Screening.patient_id.in_(patient_ids_to_check))
        .order_by(Screening.screened_at.desc())
        .all()
    )

    return [format_screening_dict(s) for s in screenings]


# ============================================================
# PATIENT SELF-PREDICTION (Patient Portal)
# ============================================================

@router.post("/predict/me")
async def predict_my_screening(
    image: UploadFile = File(...),
    current_user: User = Depends(require_role("patient")),
    db: Session = Depends(get_db)
):
    if image.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Please upload a valid JPEG or PNG fundus image"
        )

    patient = db.query(Patient).filter(
        Patient.user_id == current_user.id
    ).first()

    if not patient:
        patient_id = f"P-{current_user.id:06d}"
        patient = Patient(
            user_id=current_user.id,
            patient_id=patient_id,
            name=current_user.name
        )
        db.add(patient)
        db.commit()
        db.refresh(patient)

    image_bytes = await image.read()

    try:
        pil_image = Image.open(io.BytesIO(image_bytes))
        result = predict_with_gradcam(pil_image, save_files=True)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Unable to process retinal fundus image: {str(e)}"
        )

    new_screening = Screening(
        patient_id=patient.id,
        image_filename=image.filename,
        image_path=result["image_path"],
        gradcam_path=result["gradcam_path"],
        eye_side=eye_side,
        prediction=result["prediction"],
        confidence=result["confidence"],
        severity_level=result["severity_level"],
        priority=result["priority"],
        status="PENDING_REVIEW",
        screened_at=datetime.utcnow()
    )

    db.add(new_screening)
    db.commit()
    db.refresh(new_screening)

    response_data = format_screening_dict(new_screening)
    response_data["clinical_action"] = result["clinical_action"]
    response_data["suggested_treatment"] = result["suggested_treatment"]
    response_data["suggested_medication"] = result["suggested_medication"]
    response_data["follow_up"] = result["follow_up"]
    response_data["probability_distribution"] = result["probability_distribution"]

    return response_data


# ============================================================
# LEGACY / PUBLIC PREDICT ENDPOINT (Backward compatibility)
# ============================================================

@router.post("/predict")
async def predict_screening_legacy(
    patient_id: str = Form(...),
    image: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if image.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Please upload a JPEG or PNG image"
        )

    patient = db.query(Patient).filter(
        Patient.patient_id == patient_id.strip()
    ).first()

    if not patient:
        raise HTTPException(
            status_code=404,
            detail=f"Patient with ID {patient_id} not found"
        )

    image_bytes = await image.read()

    try:
        pil_image = Image.open(io.BytesIO(image_bytes))
        result = predict_with_gradcam(pil_image, save_files=True)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Unable to process image: {str(e)}"
        )

    new_screening = Screening(
        patient_id=patient.id,
        image_filename=image.filename,
        image_path=result["image_path"],
        gradcam_path=result["gradcam_path"],
        eye_side=eye_side,
        prediction=result["prediction"],
        confidence=result["confidence"],
        severity_level=result["severity_level"],
        priority=result["priority"],
        status="PENDING_REVIEW",
        screened_at=datetime.utcnow()
    )

    db.add(new_screening)
    db.commit()
    db.refresh(new_screening)

    return format_screening_dict(new_screening)


# ============================================================
# GET PATIENT SCREENINGS BY PATIENT ID
# ============================================================

@router.get("/patient/{patient_id}")
def get_patient_screenings(
    patient_id: str,
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

    screenings = (
        db.query(Screening)
        .filter(Screening.patient_id == patient.id)
        .order_by(Screening.screened_at.desc())
        .all()
    )

    return [format_screening_dict(s) for s in screenings]