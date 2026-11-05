from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database.database import get_db
from app.models.user import User
from app.models.patient import Patient
from app.models.screening import Screening
from app.schemas.admin import AdminUserCreate, AdminUserUpdate
from app.dependencies.auth import require_role, get_current_user
from app.services.auth_service import hash_password

router = APIRouter(
    prefix="/admin",
    tags=["Admin"]
)


@router.get("/stats")
def get_admin_stats(
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db)
):
    total_patients = db.query(Patient).count()
    total_screenings = db.query(Screening).count()
    pending_screenings = db.query(Screening).filter(
        Screening.status == "PENDING_REVIEW"
    ).count()
    reviewed_screenings = db.query(Screening).filter(
        Screening.status == "REVIEWED"
    ).count()

    urgent_cases = db.query(Screening).filter(
        Screening.priority.in_(["URGENT", "HIGH"])
    ).count()

    # Severity distribution
    severity_counts = {
        "0": 0, "1": 0, "2": 0, "3": 0, "4": 0
    }
    sev_rows = db.query(
        Screening.severity_level,
        func.count(Screening.id)
    ).group_by(Screening.severity_level).all()

    for sev, count in sev_rows:
        severity_counts[str(sev)] = count

    # Role distribution
    role_counts = {
        "admin": 0, "doctor": 0, "staff": 0, "patient": 0
    }
    role_rows = db.query(
        User.role,
        func.count(User.id)
    ).group_by(User.role).all()

    for r, count in role_rows:
        if r in role_counts:
            role_counts[r] = count

    return {
        "total_patients": total_patients,
        "total_screenings": total_screenings,
        "pending_screenings": pending_screenings,
        "reviewed_screenings": reviewed_screenings,
        "urgent_cases": urgent_cases,
        "severity_distribution": severity_counts,
        "user_roles": role_counts
    }


@router.get("/users")
def get_all_users(
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db)
):
    users = db.query(User).all()
    result = []
    for u in users:
        pat_id = u.patient.patient_id if u.patient else None
        result.append({
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "role": u.role,
            "patient_id": pat_id
        })
    return result


@router.post("/users")
def create_user_by_admin(
    payload: AdminUserCreate,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db)
):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="A user with this email already exists"
        )

    valid_roles = ["admin", "doctor", "staff", "patient"]
    if payload.role not in valid_roles:
        raise HTTPException(
            status_code=400,
            detail=f"Role must be one of: {', '.join(valid_roles)}"
        )

    new_user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role
    )
    db.add(new_user)
    db.flush()

    if payload.role == "patient":
        pat_id = f"P-{new_user.id:06d}"
        new_patient = Patient(
            user_id=new_user.id,
            patient_id=pat_id,
            name=payload.name
        )
        db.add(new_patient)

    db.commit()
    db.refresh(new_user)

    return {
        "message": "User created successfully",
        "user": {
            "id": new_user.id,
            "name": new_user.name,
            "email": new_user.email,
            "role": new_user.role
        }
    }


@router.put("/users/{user_id}")
def update_user_by_admin(
    user_id: int,
    payload: AdminUserUpdate,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.name:
        user.name = payload.name
        if user.patient:
            user.patient.name = payload.name

    if payload.role:
        valid_roles = ["admin", "doctor", "staff", "patient"]
        if payload.role not in valid_roles:
            raise HTTPException(
                status_code=400,
                detail=f"Role must be one of: {', '.join(valid_roles)}"
            )
        user.role = payload.role

    if payload.password:
        user.password_hash = hash_password(payload.password)

    db.commit()
    db.refresh(user)

    return {
        "message": "User updated successfully",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role
        }
    }


@router.delete("/users/{user_id}")
def delete_user_by_admin(
    user_id: int,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db)
):
    if user_id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot delete your own admin account"
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        # 1. If this user is linked to a patient, delete all their screenings first
        if user.patient:
            db.query(Screening).filter(Screening.patient_id == user.patient.id).delete(synchronize_session=False)
            db.delete(user.patient)

        # 2. Nullify references if this user was a screener or reviewer
        db.query(Screening).filter(Screening.screened_by_id == user.id).update(
            {Screening.screened_by_id: None}, synchronize_session=False
        )
        db.query(Screening).filter(Screening.reviewed_by_doctor_id == user.id).update(
            {Screening.reviewed_by_doctor_id: None}, synchronize_session=False
        )

        db.delete(user)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Unable to delete user: {str(e)}"
        )

    return {"message": "User deleted successfully"}
