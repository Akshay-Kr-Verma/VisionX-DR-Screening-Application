import React from "react";
import { Printer, X, Download, ShieldCheck, AlertCircle, Eye, Calendar, User, FileText } from "lucide-react";

export default function ClinicalReportModal({ screening, patient, onClose }) {
  if (!screening) return null;

  const handlePrint = () => {
    window.print();
  };

  const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
  const fundusUrl = screening.image_path ? `${API_BASE}${screening.image_path}` : null;
  const gradcamUrl = screening.gradcam_path ? `${API_BASE}${screening.gradcam_path}` : null;

  const formattedDate = screening.screened_at
    ? new Date(screening.screened_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      })
    : new Date().toLocaleDateString();

  const reviewedDate = screening.reviewed_at
    ? new Date(screening.reviewed_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric"
      })
    : null;

  return (
    <div className="report-modal-overlay">
      <div className="report-modal-container">
        {/* ACTION BAR (Hidden when printing) */}
        <div className="report-actions-bar no-print">
          <div className="report-actions-left">
            <span className="report-badge">Official Clinical Diagnostic Report</span>
            <span className="report-id-tag">ID: #VX-SCR-{screening.screening_id || screening.id}</span>
          </div>
          <div className="report-actions-right">
            <button className="btn-print" onClick={handlePrint}>
              <Printer size={16} /> Print / Save as PDF
            </button>
            <button className="btn-close-modal" onClick={onClose} aria-label="Close">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* PRINTABLE REPORT DOCUMENT */}
        <div className="clinical-report-sheet printable-document">
          {/* HEADER */}
          <header className="report-header">
            <div className="clinic-brand">
              <div className="clinic-logo-mark">VX</div>
              <div>
                <h1 className="clinic-name">VisionX Retina Institute</h1>
                <p className="clinic-tagline">Advanced AI-Assisted Retinal Screening & Teleophthalmology</p>
                <p className="clinic-address">Medical AI Screening Center | Dept. of Vitreoretinal Diseases</p>
              </div>
            </div>
            <div className="report-meta">
              <div className="meta-item">
                <span className="meta-label">Report Number</span>
                <span className="meta-value">VX-{screening.screening_id || screening.id}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Screening Date</span>
                <span className="meta-value">{formattedDate}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Review Status</span>
                <span className={`status-pill ${screening.status === "REVIEWED" ? "status-reviewed" : "status-pending"}`}>
                  {screening.status === "REVIEWED" ? "CLINICALLY REVIEWED" : "PENDING PHYSICIAN REVIEW"}
                </span>
              </div>
            </div>
          </header>

          <hr className="report-divider" />

          {/* PATIENT DEMOGRAPHICS SECTION */}
          <section className="report-section patient-demographics-section">
            <h3 className="section-title"><User size={16} /> Patient Demographics</h3>
            <div className="demographics-grid">
              <div className="demo-cell">
                <span className="demo-label">Patient Full Name:</span>
                <strong className="demo-val">{screening.patient_name || patient?.name || "Patient"}</strong>
              </div>
              <div className="demo-cell">
                <span className="demo-label">Patient ID:</span>
                <strong className="demo-val">{screening.patient_id || patient?.patient_id || "-"}</strong>
              </div>
              <div className="demo-cell">
                <span className="demo-label">Gender / DOB:</span>
                <span className="demo-val">{screening.patient_gender || patient?.gender || "Unspecified"} / {screening.patient_dob || patient?.date_of_birth || "N/A"}</span>
              </div>
              <div className="demo-cell">
                <span className="demo-label">Contact Phone:</span>
                <span className="demo-val">{screening.patient_phone || patient?.phone || "N/A"}</span>
              </div>
              <div className="demo-cell">
                <span className="demo-label">Diabetes Type & Duration:</span>
                <span className="demo-val">{screening.diabetes_type || patient?.diabetes_type || "Type 2 Diabetic"}</span>
              </div>
              <div className="demo-cell">
                <span className="demo-label">Medical History:</span>
                <span className="demo-val">{screening.medical_history || patient?.medical_history || "No specific systemic history recorded."}</span>
              </div>
            </div>
          </section>

          {/* AI RETINOPATHY CLASSIFICATION */}
          <section className="report-section ai-findings-section">
            <h3 className="section-title"><ShieldCheck size={16} /> Deep Learning AI Screening Assessment</h3>
            <div className="findings-summary-card">
              <div className="severity-badge-row">
                <div className={`severity-level-box level-${screening.severity_level}`}>
                  <span className="severity-lvl-num">Level {screening.severity_level}</span>
                  <span className="severity-lvl-title">{screening.prediction || screening.severity_name}</span>
                </div>
                <div className="priority-triage-box">
                  <span className="triage-label">Triage Priority</span>
                  <span className={`priority-tag priority-${screening.priority?.toLowerCase()}`}>
                    {screening.priority}
                  </span>
                </div>
                <div className="confidence-box">
                  <span className="conf-label">Model Confidence</span>
                  <strong className="conf-val">{screening.confidence}%</strong>
                </div>
              </div>
            </div>
          </section>

          {/* RETINAL IMAGING & GRAD-CAM EXPLAINABILITY */}
          <section className="report-section imaging-section">
            <h3 className="section-title"><Eye size={16} /> Retinal Fundus & Grad-CAM Explainability Heatmap</h3>
            <p className="section-desc">
              Grad-CAM (Gradient-weighted Class Activation Mapping) highlights specific retinal regions—such as microaneurysms, hemorrhages, hard exudates, or neovascularization—that triggered the AI severity prediction.
            </p>
            <div className="report-images-grid">
              <div className="report-img-card">
                <div className="report-img-wrapper">
                  {fundusUrl ? (
                    <img src={fundusUrl} alt="Original Retinal Fundus" className="report-img" />
                  ) : (
                    <div className="img-placeholder">Fundus Image Unavailable</div>
                  )}
                </div>
                <div className="img-caption">
                  <strong>Figure A:</strong> Raw Color Retinal Fundus Image
                </div>
              </div>
              <div className="report-img-card">
                <div className="report-img-wrapper">
                  {gradcamUrl ? (
                    <img src={gradcamUrl} alt="Grad-CAM Activation Heatmap" className="report-img" />
                  ) : (
                    <div className="img-placeholder">Grad-CAM Heatmap Unavailable</div>
                  )}
                </div>
                <div className="img-caption">
                  <strong>Figure B:</strong> Grad-CAM Heatmap (Warm colors mark lesion regions)
                </div>
              </div>
            </div>
          </section>

          {/* DOCTOR CLINICAL EVALUATION & TREATMENT PLAN */}
          <section className="report-section doctor-eval-section">
            <h3 className="section-title"><FileText size={16} /> Ophthalmologist Clinical Diagnosis & Recommendations</h3>
            
            {screening.status === "REVIEWED" ? (
              <div className="doctor-review-details">
                <div className="review-block">
                  <h4 className="block-subtitle">Clinical Findings & Notes:</h4>
                  <p className="block-content doctor-notes-text">
                    {screening.doctor_notes || "Clinical verification completed. AI findings are consistent with fundus examination."}
                  </p>
                </div>

                {screening.prescribed_medication && (
                  <div className="review-block">
                    <h4 className="block-subtitle">Prescribed Medication & Pharmacotherapy:</h4>
                    <p className="block-content medication-text">
                      {screening.prescribed_medication}
                    </p>
                  </div>
                )}

                {screening.treatment_plan && (
                  <div className="review-block">
                    <h4 className="block-subtitle">Recommended Surgical Intervention / Treatment Plan:</h4>
                    <p className="block-content treatment-text">
                      {screening.treatment_plan}
                    </p>
                  </div>
                )}

                <div className="review-signoff-row">
                  <div>
                    <span className="signoff-label">Attending Physician:</span>
                    <strong>{screening.doctor_name || "Dr. Sarah Chen, MD (Ophthalmologist)"}</strong>
                    {reviewedDate && <span className="signoff-date"> | Reviewed on: {reviewedDate}</span>}
                  </div>
                  <div className="signature-line">
                    <div className="signature-stamp">CLINICALLY VERIFIED</div>
                    <span className="sign-caption">Authorized Electronic Signature</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="pending-review-notice">
                <AlertCircle size={20} className="notice-icon" />
                <div>
                  <strong>Preliminary Screening Assessment</strong>
                  <p>
                    This screening is queued in the clinical triage system and is awaiting formal verification by an attending retina specialist.
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* FOOTER & DISCLAIMER */}
          <footer className="report-footer">
            <p className="disclaimer-text">
              <strong>Medical Disclaimer:</strong> This document is generated by the VisionX AI Screening Platform incorporating Deep Learning (EfficientNet-B0) and Grad-CAM explainability algorithms. AI screening results are intended to support certified eye care practitioners and do not substitute a comprehensive dilated eye examination by an ophthalmologist.
            </p>
            <div className="footer-credits">
              <span>VisionX Health Technologies | Confidential Medical Record</span>
              <span>Generated on: {new Date().toLocaleDateString()}</span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
