import os
import sys
from sqlalchemy import text
from app.database.database import engine, SessionLocal
from app.models.user import User
from app.models.patient import Patient
from app.models.screening import Screening
from app.services.auth_service import hash_password

def migrate():
    print("Running database migrations...")
    cols_to_add_screenings = [
        ("image_path", "VARCHAR(500) NULL"),
        ("gradcam_path", "VARCHAR(500) NULL"),
        ("severity_level", "INT DEFAULT 0"),
        ("priority", "VARCHAR(20) DEFAULT 'ROUTINE'"),
        ("status", "VARCHAR(50) DEFAULT 'PENDING_REVIEW'"),
        ("doctor_notes", "TEXT NULL"),
        ("prescribed_medication", "TEXT NULL"),
        ("treatment_plan", "VARCHAR(255) NULL"),
        ("reviewed_by_doctor_id", "INT NULL"),
        ("reviewed_at", "DATETIME NULL"),
        ("screened_by_id", "INT NULL")
    ]

    cols_to_add_patients = [
        ("name", "VARCHAR(150) NULL"),
        ("diabetes_type", "VARCHAR(50) NULL"),
        ("medical_history", "TEXT NULL")
    ]

    with engine.begin() as conn:
        curr_scr = [r[0] for r in conn.execute(text("DESCRIBE screenings")).fetchall()]
        for col_name, col_type in cols_to_add_screenings:
            if col_name not in curr_scr:
                print(f"Adding column '{col_name}' to screenings...")
                conn.execute(text(f"ALTER TABLE screenings ADD COLUMN {col_name} {col_type}"))
                
        curr_pat = [r[0] for r in conn.execute(text("DESCRIBE patients")).fetchall()]
        for col_name, col_type in cols_to_add_patients:
            if col_name not in curr_pat:
                print(f"Adding column '{col_name}' to patients...")
                conn.execute(text(f"ALTER TABLE patients ADD COLUMN {col_name} {col_type}"))

        try:
            conn.execute(text("ALTER TABLE patients MODIFY COLUMN user_id INT NULL"))
            print("Set patients.user_id to nullable successfully")
        except Exception as e:
            print(f"Notice on patients.user_id: {e}")

    print("Migration completed.")

    # Seed default role users if they don't exist
    db = SessionLocal()
    try:
        users_to_ensure = [
            {
                "name": "System Administrator",
                "email": "admin@visionx.com",
                "password": "admin123",
                "role": "admin"
            },
            {
                "name": "Dr. Sarah Chen, MD (Retina Specialist)",
                "email": "doctor@visionx.com",
                "password": "doctor123",
                "role": "doctor"
            },
            {
                "name": "Alex Miller (Screening Staff)",
                "email": "staff@visionx.com",
                "password": "staff123",
                "role": "staff"
            },
            {
                "name": "John Doe (Patient)",
                "email": "patient@visionx.com",
                "password": "patient123",
                "role": "patient",
                "gender": "Male",
                "phone": "+1 (555) 234-5678",
                "dob": "1972-04-15",
                "diabetes_type": "Type 2 (8 years)",
                "medical_history": "Hypertension, HbA1c 7.8%, Type 2 diabetes diagnosed 2018."
            }
        ]

        for u_data in users_to_ensure:
            existing = db.query(User).filter(User.email == u_data["email"]).first()
            if not existing:
                print(f"Creating user: {u_data['email']} ({u_data['role']})...")
                user = User(
                    name=u_data["name"],
                    email=u_data["email"],
                    password_hash=hash_password(u_data["password"]),
                    role=u_data["role"]
                )
                db.add(user)
                db.flush()

                if u_data["role"] == "patient":
                    pat = Patient(
                        user_id=user.id,
                        patient_id=f"P-{user.id:06d}",
                        name=u_data["name"],
                        gender=u_data.get("gender"),
                        phone=u_data.get("phone"),
                        diabetes_type=u_data.get("diabetes_type"),
                        medical_history=u_data.get("medical_history")
                    )
                    db.add(pat)
                db.commit()
            else:
                # Update role if needed
                if existing.role != u_data["role"]:
                    existing.role = u_data["role"]
                    db.commit()
                print(f"User {u_data['email']} already exists with role {existing.role}")

        # Update existing patients name if empty
        patients = db.query(Patient).all()
        for p in patients:
            if p.user and not p.name:
                p.name = p.user.name
        db.commit()

        # Update severity_level for existing screenings if 0 and prediction mentions other levels
        screenings = db.query(Screening).all()
        pred_map = {
            "No Diabetic Retinopathy": 0,
            "Mild Diabetic Retinopathy": 1,
            "Moderate Diabetic Retinopathy": 2,
            "Severe Diabetic Retinopathy": 3,
            "Proliferative Diabetic Retinopathy": 4
        }
        for s in screenings:
            if s.prediction in pred_map:
                s.severity_level = pred_map[s.prediction]
                if s.severity_level == 4:
                    s.priority = "URGENT"
                elif s.severity_level == 3:
                    s.priority = "HIGH"
                elif s.severity_level == 2:
                    s.priority = "MEDIUM"
                else:
                    s.priority = "ROUTINE"
            if not s.status:
                s.status = "PENDING_REVIEW"
        db.commit()

        print("Seeding and sync completed successfully!")
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
