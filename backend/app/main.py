
import os

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database.database import Base, engine

from app.models.user import User
from app.models.patient import Patient
from app.models.screening import Screening

from app.routes.auth import router as auth_router
from app.routes.patient import router as patient_router
from app.routes.screening import router as screening_router
from app.routes.admin import router as admin_router

from app.dependencies.auth import get_current_user


# --------------------------------------------------
# Database table initialization
# --------------------------------------------------

Base.metadata.create_all(bind=engine)


# --------------------------------------------------
# Upload directories for fundus and Grad-CAM images
# --------------------------------------------------

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_DIR = os.path.join(BACKEND_DIR, "uploads")

FUNDUS_DIR = os.path.join(UPLOAD_DIR, "fundus")
GRADCAM_DIR = os.path.join(UPLOAD_DIR, "gradcam")

os.makedirs(FUNDUS_DIR, exist_ok=True)
os.makedirs(GRADCAM_DIR, exist_ok=True)


# --------------------------------------------------
# FastAPI application
# --------------------------------------------------

app = FastAPI(
    title="VisionX DR Screening API",
    description=(
        "Backend API for the VisionX Diabetic Retinopathy "
        "Screening Application with Explainability (Grad-CAM) "
        "and Role-Based Healthcare Portals"
    ),
    version="2.0.0"
)


# --------------------------------------------------
# CORS configuration
# --------------------------------------------------

# Local development origins
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# Add deployed frontend URL through environment variable
frontend_url = os.getenv("FRONTEND_URL", "")

if frontend_url:
    deployed_origins = [
        url.strip().rstrip("/")
        for url in frontend_url.split(",")
        if url.strip()
    ]

    allowed_origins.extend(deployed_origins)

# Remove duplicate origins
allowed_origins = list(set(allowed_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------
# Serve uploaded images
# --------------------------------------------------

app.mount(
    "/uploads",
    StaticFiles(directory=UPLOAD_DIR),
    name="uploads"
)


# --------------------------------------------------
# Register API routers
# --------------------------------------------------

app.include_router(auth_router)
app.include_router(patient_router)
app.include_router(screening_router)
app.include_router(admin_router)


# --------------------------------------------------
# Root endpoint
# --------------------------------------------------

@app.get("/")
def root():
    return {
        "message": "VisionX DR Screening & Explainability API is running",
        "version": "2.0.0",
        "status": "healthy"
    }


# --------------------------------------------------
# Health check endpoint
# --------------------------------------------------

@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }


# --------------------------------------------------
# Current authenticated user profile
# --------------------------------------------------

@app.get("/auth/me")
def get_my_profile(
    current_user: User = Depends(get_current_user)
):
    patient_data = None

    if current_user.patient:
        p = current_user.patient

        patient_data = {
            "id": p.id,
            "patient_id": p.patient_id,
            "name": p.name or current_user.name,
            "gender": p.gender,
            "phone": p.phone,
            "date_of_birth": (
                p.date_of_birth.isoformat()
                if p.date_of_birth
                else None
            ),
            "diabetes_type": p.diabetes_type,
            "medical_history": p.medical_history
        }

    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role,
        "patient": patient_data
    }
