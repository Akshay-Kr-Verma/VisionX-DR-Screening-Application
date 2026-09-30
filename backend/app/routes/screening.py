import io

from fastapi import (
    APIRouter,
    File,
    UploadFile,
    HTTPException,
    Form,
    Depends
)

from PIL import Image
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.patient import Patient
from app.models.screening import Screening
from app.models.user import User
from app.services.ml_service import predict_image
from app.dependencies.auth import require_role


router = APIRouter(
    prefix="/screenings",
    tags=["Screenings"]
)


# ============================================================
# DR SEVERITY LEVELS
# ============================================================

DR_LEVELS = {
    0: "No Diabetic Retinopathy",
    1: "Mild Diabetic Retinopathy",
    2: "Moderate Diabetic Retinopathy",
    3: "Severe Diabetic Retinopathy",
    4: "Proliferative Diabetic Retinopathy"
}


# ============================================================
# COMMON IMAGE VALIDATION
# ============================================================

ALLOWED_IMAGE_TYPES = [
    "image/jpeg",
    "image/png",
    "image/jpg"
]


# ============================================================
# PREDICT DIABETIC RETINOPATHY
#
# Used mainly for STAFF.
# Staff provides the patient ID manually.
# ============================================================

@router.post("/predict")
async def predict_screening(
    patient_id: str = Form(...),
    image: UploadFile = File(...),
    db: Session = Depends(get_db)
):

    # --------------------------------------------------------
    # 1. Validate file type
    # --------------------------------------------------------

    if image.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Please upload a JPEG or PNG image"
        )

    # --------------------------------------------------------
    # 2. Find patient
    # --------------------------------------------------------

    patient = db.query(Patient).filter(
        Patient.patient_id == patient_id
    ).first()

    if not patient:
        raise HTTPException(
            status_code=404,
            detail=f"Patient with ID {patient_id} not found"
        )

    # --------------------------------------------------------
    # 3. Read uploaded image
    # --------------------------------------------------------

    image_bytes = await image.read()

    try:

        pil_image = Image.open(
            io.BytesIO(image_bytes)
        )

        # ----------------------------------------------------
        # 4. Run ML prediction
        # ----------------------------------------------------

        result = predict_image(pil_image)

    except Exception as e:

        raise HTTPException(
            status_code=400,
            detail=f"Unable to process image: {str(e)}"
        )

    # --------------------------------------------------------
    # 5. Get severity level
    # --------------------------------------------------------

    class_index = result["class_index"]

    if class_index not in DR_LEVELS:
        raise HTTPException(
            status_code=500,
            detail="Invalid prediction class returned by model"
        )

    severity_level = class_index
    severity_name = DR_LEVELS[class_index]

    # --------------------------------------------------------
    # 6. Save screening result
    # --------------------------------------------------------

    new_screening = Screening(
        patient_id=patient.id,
        image_filename=image.filename,
        prediction=severity_name,
        confidence=result["confidence"]
    )

    db.add(new_screening)
    db.commit()
    db.refresh(new_screening)

    # --------------------------------------------------------
    # 7. Return prediction result
    # --------------------------------------------------------

    return {
        "screening_id": new_screening.id,
        "patient_id": patient.patient_id,
        "filename": image.filename,
        "severity_level": severity_level,
        "severity_name": severity_name,
        "prediction": severity_name,
        "confidence": result["confidence"],
        "class_index": class_index,
        "screened_at": new_screening.screened_at
    }


# ============================================================
# GET PATIENT SCREENING HISTORY
#
# Existing endpoint.
#
# Example:
# GET /screenings/patient/P-000003
# ============================================================

@router.get("/patient/{patient_id}")
def get_patient_screenings(
    patient_id: str,
    db: Session = Depends(get_db)
):

    # --------------------------------------------------------
    # 1. Find patient
    # --------------------------------------------------------

    patient = db.query(Patient).filter(
        Patient.patient_id == patient_id
    ).first()

    if not patient:
        raise HTTPException(
            status_code=404,
            detail=f"Patient with ID {patient_id} not found"
        )

    # --------------------------------------------------------
    # 2. Get all screenings
    # --------------------------------------------------------

    screenings = (
        db.query(Screening)
        .filter(
            Screening.patient_id == patient.id
        )
        .order_by(
            Screening.screened_at.desc()
        )
        .all()
    )

    # --------------------------------------------------------
    # 3. Return screening history
    # --------------------------------------------------------

    return [
        {
            "screening_id": screening.id,
            "patient_id": patient.patient_id,
            "filename": screening.image_filename,
            "prediction": screening.prediction,
            "confidence": screening.confidence,
            "screened_at": screening.screened_at
        }
        for screening in screenings
    ]


# ============================================================
# GET CURRENT LOGGED-IN PATIENT SCREENING HISTORY
#
# New authenticated endpoint.
#
# Example:
# GET /screenings/me
#
# The patient ID comes from the JWT.
# The frontend does NOT need to send the patient ID.
# ============================================================

@router.get("/me")
def get_my_screenings(
    current_user: User = Depends(
        require_role("patient")
    ),
    db: Session = Depends(get_db)
):

    # --------------------------------------------------------
    # 1. Find patient belonging to logged-in user
    # --------------------------------------------------------

    patient = db.query(Patient).filter(
        Patient.user_id == current_user.id
    ).first()

    if not patient:
        raise HTTPException(
            status_code=404,
            detail="Patient profile not found"
        )

    # --------------------------------------------------------
    # 2. Get patient's screenings
    # --------------------------------------------------------

    screenings = (
        db.query(Screening)
        .filter(
            Screening.patient_id == patient.id
        )
        .order_by(
            Screening.screened_at.desc()
        )
        .all()
    )

    # --------------------------------------------------------
    # 3. Return history
    # --------------------------------------------------------

    return [
        {
            "screening_id": screening.id,
            "patient_id": patient.patient_id,
            "filename": screening.image_filename,
            "prediction": screening.prediction,
            "confidence": screening.confidence,
            "screened_at": screening.screened_at
        }
        for screening in screenings
    ]


# ============================================================
# PREDICT FOR CURRENT LOGGED-IN PATIENT
#
# New authenticated endpoint.
#
# Example:
# POST /screenings/predict/me
#
# The frontend only sends the image.
# Patient identity comes from JWT.
# ============================================================

@router.post("/predict/me")
async def predict_my_screening(
    image: UploadFile = File(...),

    current_user: User = Depends(
        require_role("patient")
    ),

    db: Session = Depends(get_db)
):

    # --------------------------------------------------------
    # 1. Validate file type
    # --------------------------------------------------------

    if image.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Please upload a JPEG or PNG image"
        )

    # --------------------------------------------------------
    # 2. Find patient belonging to logged-in user
    # --------------------------------------------------------

    patient = db.query(Patient).filter(
        Patient.user_id == current_user.id
    ).first()

    if not patient:
        raise HTTPException(
            status_code=404,
            detail="Patient profile not found"
        )

    # --------------------------------------------------------
    # 3. Read uploaded image
    # --------------------------------------------------------

    image_bytes = await image.read()

    try:

        pil_image = Image.open(
            io.BytesIO(image_bytes)
        )

        # ----------------------------------------------------
        # 4. Run ML prediction
        # ----------------------------------------------------

        result = predict_image(pil_image)

    except Exception as e:

        raise HTTPException(
            status_code=400,
            detail=f"Unable to process image: {str(e)}"
        )

    # --------------------------------------------------------
    # 5. Get severity level
    # --------------------------------------------------------

    class_index = result["class_index"]

    if class_index not in DR_LEVELS:
        raise HTTPException(
            status_code=500,
            detail="Invalid prediction class returned by model"
        )

    severity_level = class_index
    severity_name = DR_LEVELS[class_index]

    # --------------------------------------------------------
    # 6. Save screening result
    # --------------------------------------------------------

    new_screening = Screening(
        patient_id=patient.id,
        image_filename=image.filename,
        prediction=severity_name,
        confidence=result["confidence"]
    )

    db.add(new_screening)
    db.commit()
    db.refresh(new_screening)

    # --------------------------------------------------------
    # 7. Return result
    # --------------------------------------------------------

    return {
        "screening_id": new_screening.id,
        "patient_id": patient.patient_id,
        "filename": image.filename,
        "severity_level": severity_level,
        "severity_name": severity_name,
        "prediction": severity_name,
        "confidence": result["confidence"],
        "class_index": class_index,
        "screened_at": new_screening.screened_at
    }