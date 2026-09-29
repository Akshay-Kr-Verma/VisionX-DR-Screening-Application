from fastapi import FastAPI, Depends

from app.database.database import Base, engine
from app.models.user import User
from app.models.patient import Patient
from app.routes.auth import router as auth_router
from app.routes.patient import router as patient_router
from app.dependencies.auth import get_current_user, require_role


# Create database tables
Base.metadata.create_all(bind=engine)


app = FastAPI(
    title="VisionX DR Screening API",
    description="Backend API for the VisionX Diabetic Retinopathy Screening Application",
    version="1.0.0"
)


# Register authentication routes
app.include_router(auth_router)

# Register patient routes
app.include_router(patient_router)


@app.get("/")
def root():
    return {
        "message": "VisionX DR Screening API is running",
        "status": "success"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }


@app.get("/db-test")
def database_test():
    try:
        with engine.connect() as connection:
            return {
                "status": "success",
                "message": "MySQL database connected successfully"
            }

    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }


# Protected endpoint
@app.get("/auth/me")
def get_my_profile(
    current_user: User = Depends(get_current_user)
):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role
    }


# Temporary RBAC test endpoint
@app.get("/admin/test")
def admin_test(
    current_user: User = Depends(
        require_role("admin")
    )
):
    return {
        "message": "Admin access granted",
        "user": current_user.email,
        "role": current_user.role
    }