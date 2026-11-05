import React, { useState, useEffect } from "react";
import {
  FileText,
  Eye,
  Calendar,
  Pill,
  Syringe,
  Download,
  AlertCircle,
  CheckCircle2,
  Upload,
  User,
  HeartPulse,
  Activity,
  ChevronDown,
  ChevronUp,
  RefreshCw
} from "lucide-react";
import GradCamViewer from "./GradCamViewer";
import ClinicalReportModal from "./ClinicalReportModal";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const severityScale = {
  0: { title: "No Diabetic Retinopathy", desc: "No microaneurysms or retinal vascular abnormalities detected. Annual screening recommended." },
  1: { title: "Mild Diabetic Retinopathy", desc: "Presence of microaneurysms only. Early retinal changes requiring glycemic control." },
  2: { title: "Moderate Diabetic Retinopathy", desc: "More than just microaneurysms, but less than severe. Possible hemorrhages and exudates." },
  3: { title: "Severe Diabetic Retinopathy", desc: "Extensive intraretinal hemorrhages, venous beading, or prominent IRMA. High risk of progression." },
  4: { title: "Proliferative Diabetic Retinopathy", desc: "Neovascularization of the retina or disc, or vitreous/preretinal hemorrhage. Urgent specialist care needed." }
};

export default function PatientDashboard({ token }) {
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Self scan upload
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState("");

  // Report Modal
  const [reportScreening, setReportScreening] = useState(null);

  // Expanded scan details
  const [expandedScanId, setExpandedScanId] = useState(null);

  const authHeaders = {
    Authorization: `Bearer ${token}`
  };

  const loadPatientData = async () => {
    setLoading(true);
    setError("");
    try {
      const profileRes = await fetch(`${API_BASE}/patients/me`, { headers: authHeaders });
      if (!profileRes.ok) throw new Error("Could not load patient profile");
      const profileData = await profileRes.json();
      setProfile(profileData);

      // Fetch screening history — primary endpoint
      const historyRes = await fetch(`${API_BASE}/screenings/me`, { headers: authHeaders });
      if (!historyRes.ok) throw new Error("Could not load scan history");
      let historyData = await historyRes.json();

      // If the backend found no history via /screenings/me but patient has an ID,
      // try fetching by patient_id directly (covers staff-registered patients)
      if (historyData.length === 0 && profileData.patient_id) {
        try {
          const byIdRes = await fetch(
            `${API_BASE}/screenings/patient/${profileData.patient_id}`,
            { headers: authHeaders }
          );
          if (byIdRes.ok) {
            const byIdData = await byIdRes.json();
            if (byIdData.length > 0) historyData = byIdData;
          }
        } catch (_) {
          // Ignore fallback errors
        }
      }

      setHistory(historyData);
      if (historyData.length > 0 && !expandedScanId) {
        setExpandedScanId(historyData[0].screening_id || historyData[0].id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatientData();
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setUploadResult(null);
    setUploadError("");
  };

  const handleSelfUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError("Please select a retinal fundus image.");
      return;
    }

    setUploading(true);
    setUploadError("");
    const formData = new FormData();
    formData.append("image", selectedFile);

    try {
      const res = await fetch(`${API_BASE}/screenings/predict/me`, {
        method: "POST",
        headers: authHeaders,
        body: formData
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Unable to process image.");
      }
      setUploadResult(data);
      await loadPatientData();
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const toggleExpand = (id) => {
    setExpandedScanId(expandedScanId === id ? null : id);
  };

  if (loading) {
    return (
      <div className="patient-loading-state">
        <RefreshCw size={28} className="animate-spin" />
        <p>Loading your medical records & retinal scans...</p>
      </div>
    );
  }

  const latestScan = history.length > 0 ? history[0] : null;

  return (
    <div className="patient-portal-container">
      {/* WELCOME BANNER */}
      <div className="patient-welcome-banner">
        <div className="welcome-banner-content">
          <span className="portal-tag">Patient Health Portal</span>
          <h1>Welcome, {profile?.name || "Patient"}</h1>
          <p>
            Track your retinal screenings, doctor examinations, medication prescriptions, and download official clinical reports.
          </p>
        </div>
        <div className="patient-quick-stats">
          <div className="stat-box">
            <span className="stat-label">Patient ID</span>
            <strong>{profile?.patient_id || "-"}</strong>
          </div>
          <div className="stat-box">
            <span className="stat-label">Total Scans</span>
            <strong>{history.length}</strong>
          </div>
          <div className="stat-box">
            <span className="stat-label">Condition Status</span>
            <strong className="text-highlight">
              {latestScan ? latestScan.prediction : "No scans"}
            </strong>
          </div>
        </div>
      </div>

      {/* PATIENT PROFILE CARD */}
      <div className="patient-summary-card">
        <h3><User size={18} /> Patient Profile & Health Context</h3>
        <div className="patient-profile-grid">
          <div>
            <span>Full Name:</span> <strong>{profile?.name}</strong>
          </div>
          <div>
            <span>Patient ID:</span> <strong>{profile?.patient_id}</strong>
          </div>
          <div>
            <span>Gender:</span> <span>{profile?.gender || "Not specified"}</span>
          </div>
          <div>
            <span>Date of Birth:</span> <span>{profile?.date_of_birth || "N/A"}</span>
          </div>
          <div>
            <span>Contact Phone:</span> <span>{profile?.phone || "N/A"}</span>
          </div>
          <div>
            <span>Diabetes Status:</span> <strong>{profile?.diabetes_type || "Type 2 Diabetic"}</strong>
          </div>
          <div className="col-span-2">
            <span>Medical History:</span> <span>{profile?.medical_history || "No relevant systemic factors noted."}</span>
          </div>
        </div>
      </div>

      {/* RETINAL SCAN & DOCTOR VISIT HISTORY */}
      <div className="patient-history-section">
        <div className="section-header-row">
          <div>
            <h2>Retinal Scan History & Doctor Visits</h2>
            <p>Complete record of AI evaluations, doctor consultations, and prescribed treatments.</p>
          </div>
          <button type="button" className="btn-refresh" onClick={loadPatientData}>
            <RefreshCw size={14} /> Refresh History
          </button>
        </div>

        {history.length === 0 ? (
          <div className="empty-history-box">
            <Eye size={36} />
            <h4>No retinal scans found in your records</h4>
            <p>Upload a fundus image below or visit the screening clinic to record your first scan.</p>
          </div>
        ) : (
          <div className="scans-timeline-list">
            {history.map((scan, index) => {
              const scanId = scan.screening_id || scan.id;
              const isExpanded = expandedScanId === scanId;
              const isLatest = index === 0;

              return (
                <div
                  key={scanId}
                  className={`scan-timeline-card ${isLatest ? "latest-scan" : ""}`}
                >
                  <div className="scan-card-summary" onClick={() => toggleExpand(scanId)}>
                    <div className="scan-summary-left">
                      <div className={`scan-level-avatar level-${scan.severity_level}`}>
                        L{scan.severity_level}
                      </div>
                      <div>
                        <div className="scan-title-row">
                          <span className={`eye-badge ${scan.eye_side?.toLowerCase().includes("left") ? "eye-badge-os" : "eye-badge-od"}`}>
                            {scan.eye_side || "Right Eye"}
                          </span>
                          <h4>{scan.prediction}</h4>
                          {isLatest && <span className="latest-badge">Most Recent</span>}
                          <span className={`status-pill ${scan.status === "REVIEWED" ? "status-reviewed" : "status-pending"}`}>
                            {scan.status === "REVIEWED" ? "Reviewed by Doctor" : "Pending Doctor Review"}
                          </span>
                        </div>
                        <span className="scan-meta-date">
                          <Calendar size={13} /> {new Date(scan.screened_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })} • Screening ID: #{scanId}
                        </span>
                      </div>
                    </div>

                    <div className="scan-summary-right">
                      <button
                        type="button"
                        className="btn-download-report"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReportScreening(scan);
                        }}
                      >
                        <Download size={15} /> Download PDF Report
                      </button>
                      <button type="button" className="btn-expand-toggle">
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                    </div>
                  </div>

                  {/* EXPANDED ACCORDION CONTENT */}
                  {isExpanded && (
                    <div className="scan-card-expanded">
                      {/* DOCTOR NOTES & PRESCRIPTION BLOCK */}
                      <div className="doctor-review-callout">
                        <div className="callout-header">
                          <HeartPulse size={18} />
                          <h4>Physician Evaluation & Treatment Plan</h4>
                          {scan.doctor_name && (
                            <span className="callout-doctor-name">
                              Attending: <strong>{scan.doctor_name}</strong>
                            </span>
                          )}
                        </div>

                        {scan.status === "REVIEWED" ? (
                          <div className="callout-body">
                            <div className="review-subfield">
                              <span className="field-lbl">Doctor Clinical Notes:</span>
                              <p className="field-text">
                                {scan.doctor_notes || "Clinical verification completed by attending ophthalmologist."}
                              </p>
                            </div>

                            {scan.prescribed_medication && (
                              <div className="review-subfield">
                                <span className="field-lbl"><Pill size={14} /> Prescribed Medication:</span>
                                <p className="field-text text-highlight">
                                  {scan.prescribed_medication}
                                </p>
                              </div>
                            )}

                            {scan.treatment_plan && (
                              <div className="review-subfield">
                                <span className="field-lbl"><Syringe size={14} /> Recommended Treatment / Surgery:</span>
                                <p className="field-text text-highlight">
                                  {scan.treatment_plan}
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="pending-eval-alert">
                            <AlertCircle size={18} />
                            <div>
                              <strong>Pending Doctor Verification</strong>
                              <p>
                                Your scan is currently in the doctor triage stream with priority <strong>{scan.priority}</strong>. Your attending physician will update this section shortly.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* GRAD-CAM HEATMAP VIEW */}
                      <div className="expanded-imaging-area">
                        <h4>Retinal Imaging & AI Grad-CAM Explainability</h4>
                        <GradCamViewer
                          fundusUrl={scan.image_path ? `${API_BASE}${scan.image_path}` : null}
                          gradcamUrl={scan.gradcam_path ? `${API_BASE}${scan.gradcam_path}` : null}
                          severityLevel={scan.severity_level}
                          prediction={scan.prediction}
                          confidence={scan.confidence}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* OPTIONAL SELF-SCREENING UPLOAD CARD */}
      <div className="patient-self-upload-card">
        <div className="self-upload-header">
          <Upload size={20} />
          <div>
            <h3>Upload New Fundus Image</h3>
            <p>Perform an additional retinal scan upload for AI analysis.</p>
          </div>
        </div>

        <form onSubmit={handleSelfUpload} className="self-upload-form">
          <label htmlFor="patientSelfFileInput" className="patient-dropzone">
            {previewUrl ? (
              <div className="preview-wrap">
                <img src={previewUrl} alt="Preview" className="dropzone-preview-img" />
                <span>Click to change scan image</span>
              </div>
            ) : (
              <div className="dropzone-prompt">
                <Upload size={24} />
                <span>Select Color Retinal Fundus Image</span>
                <small>JPEG or PNG format</small>
              </div>
            )}
          </label>
          <input
            id="patientSelfFileInput"
            type="file"
            accept="image/jpeg,image/png,image/jpg"
            onChange={handleFileChange}
            hidden
          />

          {uploadError && <div className="alert-box alert-error">{uploadError}</div>}

          <button
            type="submit"
            className="btn-primary-action"
            disabled={uploading || !selectedFile}
          >
            {uploading ? "Analyzing Image..." : "Submit Scan for AI Screening"}
          </button>
        </form>

        {uploadResult && (
          <div className="self-result-alert">
            <CheckCircle2 size={20} />
            <div>
              <strong>Analysis Completed: {uploadResult.severity_name} ({uploadResult.confidence}%)</strong>
              <p>Your scan has been added to your history and forwarded to your doctor triage queue.</p>
            </div>
          </div>
        )}
      </div>

      {/* EDUCATIONAL DR REFERENCE GUIDE */}
      <div className="patient-education-card">
        <h3><Activity size={18} /> Understanding Diabetic Retinopathy (DR) Severity Stages</h3>
        <p className="edu-subtitle">
          Diabetic retinopathy progresses through distinct clinical stages. Early detection and regular screening protect your vision.
        </p>
        <div className="edu-stages-grid">
          {Object.entries(severityScale).map(([lvl, info]) => (
            <div key={lvl} className={`edu-stage-box level-${lvl}`}>
              <div className="stage-num">Level {lvl}</div>
              <h4>{info.title}</h4>
              <p>{info.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CLINICAL REPORT MODAL */}
      {reportScreening && (
        <ClinicalReportModal
          screening={reportScreening}
          patient={profile}
          onClose={() => setReportScreening(null)}
        />
      )}
    </div>
  );
}
