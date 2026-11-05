from datetime import datetime
from pydantic import BaseModel
from typing import Optional, Dict


class DoctorReviewRequest(BaseModel):
    doctor_notes: str
    prescribed_medication: Optional[str] = None
    treatment_plan: Optional[str] = None
    status: str = "REVIEWED"


class DualEyeReviewRequest(BaseModel):
    right_eye_screening_id: Optional[int] = None
    right_eye_notes: Optional[str] = None
    left_eye_screening_id: Optional[int] = None
    left_eye_notes: Optional[str] = None
    prescribed_medication: Optional[str] = None
    treatment_plan: Optional[str] = None
    status: str = "REVIEWED"


class ScreeningResponse(BaseModel):
    screening_id: int
    patient_id: str
    patient_name: Optional[str] = None
    image_filename: str
    image_path: Optional[str] = None
    gradcam_path: Optional[str] = None
    prediction: str
    confidence: float
    severity_level: int
    priority: str
    status: str
    doctor_notes: Optional[str] = None
    prescribed_medication: Optional[str] = None
    treatment_plan: Optional[str] = None
    doctor_name: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    screened_at: datetime
    probability_distribution: Optional[Dict[str, float]] = None
