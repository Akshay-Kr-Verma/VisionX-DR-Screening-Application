import os
from PIL import Image
from app.database.database import SessionLocal
from app.models.user import User
from app.models.patient import Patient
from app.models.screening import Screening
from app.services.ml_service import predict_with_gradcam
from app.services.auth_service import verify_password
from app.routes.auth import login_user, LoginRequest
from app.routes.patient import list_patients, register_patient_by_staff, StaffPatientCreate
from app.routes.screening import get_doctor_triage_queue, review_screening_by_doctor, DoctorReviewRequest
from app.routes.admin import get_admin_stats, get_all_users

def run_tests():
    db = SessionLocal()
    print("==================================================")
    print("1. Testing Demo Authentication for all 4 roles...")
    print("==================================================")
    
    roles = [
        ("admin@visionx.com", "admin123", "admin"),
        ("doctor@visionx.com", "doctor123", "doctor"),
        ("staff@visionx.com", "staff123", "staff"),
        ("patient@visionx.com", "patient123", "patient")
    ]
    
    tokens = {}
    users_dict = {}
    
    for email, pwd, expected_role in roles:
        req = LoginRequest(email=email, password=pwd)
        res = login_user(req, db)
        assert res["access_token"], f"No access token for {email}"
        assert res["user"]["role"] == expected_role, f"Expected {expected_role}, got {res['user']['role']}"
        tokens[expected_role] = res["access_token"]
        users_dict[expected_role] = db.query(User).filter(User.email == email).first()
        print(f"  [PASS] {expected_role.upper()}: Logged in successfully ({res['user']['name']})")

    print("\n==================================================")
    print("2. Testing Patient Registration by Screening Staff...")
    print("==================================================")
    staff_user = users_dict["staff"]
    new_patient_payload = StaffPatientCreate(
        name="Sunita Deshmukh",
        gender="Female",
        date_of_birth="1978-06-22",
        phone="+91 98765 43210",
        diabetes_type="Type 2 (12 yrs)",
        medical_history="Uncontrolled diabetes, HbA1c 9.1%, Mild peripheral neuropathy."
    )
    reg_res = register_patient_by_staff(new_patient_payload, staff_user, db)
    assert reg_res["patient"]["patient_id"], "No patient_id returned"
    new_pat_id = reg_res["patient"]["patient_id"]
    print(f"  [PASS] Successfully registered patient {new_patient_payload.name} with ID: {new_pat_id}")

    print("\n==================================================")
    print("3. Testing Grad-CAM explainability generation...")
    print("==================================================")
    dummy_img = Image.new("RGB", (300, 300), color=(180, 45, 30))
    grad_res = predict_with_gradcam(dummy_img, save_files=True)
    assert grad_res["image_path"], "No fundus image path"
    assert grad_res["gradcam_path"], "No Grad-CAM path"
    assert grad_res["priority"] in ["URGENT", "HIGH", "MEDIUM", "ROUTINE"]
    print(f"  [PASS] Grad-CAM generated: DR Prediction = '{grad_res['prediction']}', Priority = {grad_res['priority']}")
    print(f"  [PASS] Saved fundus at: {grad_res['image_path']}, Grad-CAM at: {grad_res['gradcam_path']}")

    print("\n==================================================")
    print("4. Testing Doctor Priority Triage Queue...")
    print("==================================================")
    doc_user = users_dict["doctor"]
    triage = get_doctor_triage_queue(status="ALL", priority="ALL", search=None, current_user=doc_user, db=db)
    assert len(triage) > 0, "Triage queue is empty"
    print(f"  [PASS] Found {len(triage)} cases in triage queue.")
    print(f"  [PASS] Top priority item in queue: ID #{triage[0]['screening_id']} - Priority: {triage[0]['priority']} - Severity: {triage[0]['prediction']}")

    print("\n==================================================")
    print("5. Testing Doctor Examination & Prescription...")
    print("==================================================")
    target_screening = triage[0]
    review_req = DoctorReviewRequest(
        doctor_notes="Dilated exam verifies moderate dot-blot hemorrhages and macula exudate threatening fovea. Advised immediate OCT scan.",
        prescribed_medication="Fenofibrate 145mg OD; Carboxymethylcellulose eye drops 0.5% TDS; Glycemic optimization with endocrinologist.",
        treatment_plan="OCT Macula Scan + Consider Focal Laser Photocoagulation; 6-Week Follow-up.",
        status="REVIEWED"
    )
    rev_res = review_screening_by_doctor(target_screening["screening_id"], review_req, doc_user, db)
    assert rev_res["screening"]["status"] == "REVIEWED"
    assert rev_res["screening"]["doctor_notes"] == review_req.doctor_notes
    print(f"  [PASS] Doctor review submitted successfully for Screening #{target_screening['screening_id']}")

    print("\n==================================================")
    print("6. Testing Admin Statistics & Governance...")
    print("==================================================")
    admin_user = users_dict["admin"]
    stats = get_admin_stats(admin_user, db)
    assert stats["total_patients"] > 0
    assert stats["total_screenings"] > 0
    print(f"  [PASS] Admin Stats: Total Patients = {stats['total_patients']}, Total Screenings = {stats['total_screenings']}")
    print(f"  [PASS] Severity Breakdown: {stats['severity_distribution']}")
    print(f"  [PASS] Roles Breakdown: {stats['user_roles']}")

    users_list = get_all_users(admin_user, db)
    assert len(users_list) >= 4
    print(f"  [PASS] Admin User Management: {len(users_list)} registered users managed.")

    db.close()
    print("\n==================================================")
    print("ALL 6 HEALTHCARE & AI SUITE TESTS PASSED!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
