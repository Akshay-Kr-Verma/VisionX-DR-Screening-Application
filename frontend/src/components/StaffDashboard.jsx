import React, { useState, useEffect } from "react";
import {
  Upload,
  UserPlus,
  Users,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Activity,
  Calendar,
  Phone,
  FileText,
  Eye,
  RefreshCw,
  Trash2
} from "lucide-react";
import GradCamViewer from "./GradCamViewer";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export default function StaffDashboard({ token, onLogout }) {
  const [activeTab, setActiveTab] = useState("screen"); // "screen", "register", "directory"
  const [patients, setPatients] = useState([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");

  // Screening state
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [rightFile, setRightFile] = useState(null);
  const [rightPreviewUrl, setRightPreviewUrl] = useState(null);
  const [leftFile, setLeftFile] = useState(null);
  const [leftPreviewUrl, setLeftPreviewUrl] = useState(null);
  const [eyeSide, setEyeSide] = useState("Both Eyes"); // "Both Eyes", "Right Eye", "Left Eye"
  const [analyzing, setAnalyzing] = useState(false);
  const [screeningResult, setScreeningResult] = useState(null);
  const [dualResults, setDualResults] = useState(null);
  const [dualEyeTab, setDualEyeTab] = useState("all"); // "all", "od", "os"
  const [screenError, setScreenError] = useState("");
  const [screenSuccess, setScreenSuccess] = useState("");

  // Patient Registration state
  const [regForm, setRegForm] = useState({
    name: "",
    gender: "Male",
    date_of_birth: "",
    phone: "",
    email: "",
    address: "",
    emergency_contact: "",
    diabetes_type: "Type 2 (5-10 yrs)",
    medical_history: ""
  });
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState("");
  const [regSuccess, setRegSuccess] = useState("");

  const authHeaders = {
    Authorization: `Bearer ${token}`
  };

  // Load patients list
  const fetchPatients = async (query = "") => {
    setLoadingPatients(true);
    try {
      const url = query
        ? `${API_BASE}/patients?search=${encodeURIComponent(query)}`
        : `${API_BASE}/patients`;
      const res = await fetch(url, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setPatients(data);
        if (!selectedPatient && data.length > 0) {
          setSelectedPatient(data[0]);
        }
      }
    } catch (e) {
      console.error("Error fetching patients:", e);
    } finally {
      setLoadingPatients(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const handlePatientSearchChange = (e) => {
    const val = e.target.value;
    setPatientSearch(val);
    fetchPatients(val);
  };

  const handleDeletePatient = async (patientId, patientName) => {
    if (!window.confirm(`Are you sure you want to permanently delete patient "${patientName || patientId}" and all their screening history?`)) return;
    try {
      const res = await fetch(`${API_BASE}/patients/${patientId}`, {
        method: "DELETE",
        headers: authHeaders
      });
      if (res.ok) {
        if (selectedPatient?.patient_id === patientId) {
          setSelectedPatient(null);
        }
        await fetchPatients();
      } else {
        const err = await res.json();
        alert(err.detail || "Unable to delete patient");
      }
    } catch (e) {
      console.error("Error deleting patient:", e);
      alert("Network error: Unable to delete patient");
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setScreeningResult(null);
    setDualResults(null);
    setScreenError("");
    setScreenSuccess("");
  };

  const handleRightFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setRightFile(file);
    setRightPreviewUrl(URL.createObjectURL(file));
    setDualResults(null);
    setScreenError("");
  };

  const handleLeftFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLeftFile(file);
    setLeftPreviewUrl(URL.createObjectURL(file));
    setDualResults(null);
    setScreenError("");
  };

  // Perform AI + Grad-CAM Screening (Single or Both Eyes)
  const handleAnalyzeScreening = async (e) => {
    e.preventDefault();
    if (!selectedPatient) {
      setScreenError("Please select a registered patient first.");
      return;
    }

    if (eyeSide === "Both Eyes") {
      if (!rightFile && !leftFile) {
        setScreenError("Please upload at least one retinal fundus image (Right Eye or Left Eye).");
        return;
      }
    } else {
      if (!selectedFile) {
        setScreenError(`Please upload a retinal fundus image for ${eyeSide}.`);
        return;
      }
    }

    setAnalyzing(true);
    setScreenError("");
    setScreenSuccess("");
    setScreeningResult(null);
    setDualResults(null);

    try {
      if (eyeSide === "Both Eyes") {
        let resRight = null;
        let resLeft = null;

        // Upload Right Eye if present
        if (rightFile) {
          const formRight = new FormData();
          formRight.append("patient_id", selectedPatient.patient_id);
          formRight.append("image", rightFile);
          formRight.append("eye_side", "Right Eye");

          const r = await fetch(`${API_BASE}/screenings/staff-upload`, {
            method: "POST",
            headers: authHeaders,
            body: formRight
          });
          if (!r.ok) {
            const err = await r.json();
            throw new Error(`Right Eye scan failed: ${err.detail || "Error"}`);
          }
          resRight = await r.json();
        }

        // Upload Left Eye if present
        if (leftFile) {
          const formLeft = new FormData();
          formLeft.append("patient_id", selectedPatient.patient_id);
          formLeft.append("image", leftFile);
          formLeft.append("eye_side", "Left Eye");

          const l = await fetch(`${API_BASE}/screenings/staff-upload`, {
            method: "POST",
            headers: authHeaders,
            body: formLeft
          });
          if (!l.ok) {
            const err = await l.json();
            throw new Error(`Left Eye scan failed: ${err.detail || "Error"}`);
          }
          resLeft = await l.json();
        }

        // Overall priority
        const priorityRank = { URGENT: 4, HIGH: 3, MEDIUM: 2, ROUTINE: 1 };
        const rightRank = resRight ? priorityRank[resRight.priority] || 1 : 1;
        const leftRank = resLeft ? priorityRank[resLeft.priority] || 1 : 1;
        const higherResult = rightRank >= leftRank ? resRight : resLeft;

        setDualResults({
          right: resRight,
          left: resLeft,
          primary: higherResult
        });
        setScreeningResult(higherResult);
        setScreenSuccess(
          `Bilateral retinal scan analyzed successfully! Patient routed to doctor triage with ${higherResult.priority} priority.`
        );
      } else {
        // Single eye upload
        const formData = new FormData();
        formData.append("patient_id", selectedPatient.patient_id);
        formData.append("image", selectedFile);
        formData.append("eye_side", eyeSide);

        const res = await fetch(`${API_BASE}/screenings/staff-upload`, {
          method: "POST",
          headers: authHeaders,
          body: formData
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || "Screening failed. Please try again.");
        }

        setScreeningResult(data);
        setScreenSuccess(`Scan analyzed successfully! Automatically routed to doctor triage with ${data.priority} priority.`);
      }

      fetchPatients(); // refresh patient list counts
    } catch (err) {
      setScreenError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  // Register New Patient
  const handleRegisterPatient = async (e) => {
    e.preventDefault();
    if (!regForm.name.trim()) {
      setRegError("Patient name is required.");
      return;
    }

    setRegLoading(true);
    setRegError("");
    setRegSuccess("");

    try {
      const payload = {
        name: regForm.name.trim(),
        gender: regForm.gender,
        date_of_birth: regForm.date_of_birth || null,
        phone: regForm.phone.trim() || null,
        email: regForm.email.trim() || null,
        address: regForm.address.trim() || null,
        emergency_contact: regForm.emergency_contact.trim() || null,
        diabetes_type: regForm.diabetes_type || null,
        medical_history: regForm.medical_history.trim() || null
      };

      const res = await fetch(`${API_BASE}/patients/register-staff`, {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Unable to register patient.");
      }

      setRegSuccess(`Patient registered with ID: ${data.patient.patient_id}`);
      setRegForm({
        name: "",
        gender: "Male",
        date_of_birth: "",
        phone: "",
        email: "",
        address: "",
        emergency_contact: "",
        diabetes_type: "Type 2 (5-10 yrs)",
        medical_history: ""
      });

      // Refresh patients and select this new patient
      await fetchPatients();
      setSelectedPatient(data.patient);
      // Automatically switch to screen tab for convenient workflow
      setActiveTab("screen");
    } catch (err) {
      setRegError(err.message);
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="staff-dashboard-container">
      {/* TABS BAR */}
      <div className="staff-tabs-nav">
        <button
          type="button"
          className={`tab-btn ${activeTab === "screen" ? "active" : ""}`}
          onClick={() => setActiveTab("screen")}
        >
          <Activity size={18} /> New Retinal Screening (AI + Grad-CAM)
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "register" ? "active" : ""}`}
          onClick={() => setActiveTab("register")}
        >
          <UserPlus size={18} /> Register New Patient
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "directory" ? "active" : ""}`}
          onClick={() => setActiveTab("directory")}
        >
          <Users size={18} /> Patient Directory ({patients.length})
        </button>
      </div>

      {/* TAB 1: SCREENING WORKFLOW */}
      {activeTab === "screen" && (
        <div className="screening-workflow-layout">
          <div className="screening-left-form">
            {/* STEP 1: PATIENT SELECTION */}
            <div className="workflow-card">
              <div className="workflow-card-header">
                <span className="step-number">Step 1</span>
                <div>
                  <h3>Select Patient to Screen</h3>
                  <p>Search registered patients or register a new one</p>
                </div>
              </div>

              <div className="patient-selector-controls">
                <div className="search-input-wrap">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Search by name, ID or phone..."
                    value={patientSearch}
                    onChange={handlePatientSearchChange}
                  />
                </div>

                <div className="patient-quick-picker-list">
                  {patients.slice(0, 5).map((p) => (
                    <div
                      key={p.patient_id}
                      className={`patient-picker-item ${selectedPatient?.patient_id === p.patient_id ? "selected" : ""}`}
                      onClick={() => setSelectedPatient(p)}
                    >
                      <div className="picker-avatar">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="picker-info">
                        <strong>{p.name}</strong>
                        <span>{p.patient_id} • {p.gender || "Patient"}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="btn-link-action"
                  onClick={() => setActiveTab("register")}
                >
                  <UserPlus size={14} /> + Register New Patient
                </button>
              </div>

              {selectedPatient && (
                <div className="selected-patient-card">
                  <div className="patient-meta-pill">Selected Patient</div>
                  <h4>{selectedPatient.name}</h4>
                  <div className="patient-chips-row">
                    <span>ID: <strong>{selectedPatient.patient_id}</strong></span>
                    <span>Gender: {selectedPatient.gender || "-"}</span>
                    <span>Phone: {selectedPatient.phone || "N/A"}</span>
                    <span>Diabetes: {selectedPatient.diabetes_type || "Type 2"}</span>
                  </div>
                </div>
              )}
            </div>

            {/* STEP 2: IMAGE UPLOAD */}
            <div className="workflow-card">
              <div className="workflow-card-header">
                <span className="step-number">Step 2</span>
                <div>
                  <h3>Upload Retinal Fundus Image</h3>
                  <p>Upload a color fundus photograph (JPEG / PNG)</p>
                </div>
              </div>

              {/* EYE SIDE SELECTOR */}
              <div className="eye-side-selector">
                <label className="eye-side-label">
                  <Eye size={15} /> Select Eye Being Scanned:
                </label>
                <div className="eye-side-buttons">
                  {["Left Eye", "Right Eye", "Both Eyes"].map((side) => (
                    <button
                      key={side}
                      type="button"
                      className={`eye-side-btn ${eyeSide === side ? "active" : ""}`}
                      onClick={() => setEyeSide(side)}
                    >
                      {side === "Left Eye" && "👁 Left Eye"}
                      {side === "Right Eye" && "👁 Right Eye"}
                      {side === "Both Eyes" && "👁👁 Both Eyes"}
                    </button>
                  ))}
                </div>
              </div>

              {/* CONDITIONAL DROPZONES: DUAL EYE OR SINGLE EYE */}
              {eyeSide === "Both Eyes" ? (
                <div className="dual-eye-dropzone-row">
                  {/* RIGHT EYE (OD) DROPZONE */}
                  <div className="single-eye-upload-box">
                    <div className="eye-box-badge od-badge">👁 OD — Right Eye</div>
                    <label htmlFor="rightEyeFileInput" className="fundus-dropzone mini-dropzone">
                      {rightPreviewUrl ? (
                        <div className="preview-wrap">
                          <img src={rightPreviewUrl} alt="Right Eye Preview" className="dropzone-preview-img" />
                          <span className="change-img-text">Change OD</span>
                        </div>
                      ) : (
                        <div className="dropzone-prompt">
                          <Upload size={22} />
                          <h5>Right Eye (OD) Scan</h5>
                          <small>Select Fundus Image</small>
                        </div>
                      )}
                    </label>
                    <input
                      id="rightEyeFileInput"
                      type="file"
                      accept="image/jpeg,image/png,image/jpg"
                      onChange={handleRightFileChange}
                      hidden
                    />
                  </div>

                  {/* LEFT EYE (OS) DROPZONE */}
                  <div className="single-eye-upload-box">
                    <div className="eye-box-badge os-badge">👁 OS — Left Eye</div>
                    <label htmlFor="leftEyeFileInput" className="fundus-dropzone mini-dropzone">
                      {leftPreviewUrl ? (
                        <div className="preview-wrap">
                          <img src={leftPreviewUrl} alt="Left Eye Preview" className="dropzone-preview-img" />
                          <span className="change-img-text">Change OS</span>
                        </div>
                      ) : (
                        <div className="dropzone-prompt">
                          <Upload size={22} />
                          <h5>Left Eye (OS) Scan</h5>
                          <small>Select Fundus Image</small>
                        </div>
                      )}
                    </label>
                    <input
                      id="leftEyeFileInput"
                      type="file"
                      accept="image/jpeg,image/png,image/jpg"
                      onChange={handleLeftFileChange}
                      hidden
                    />
                  </div>
                </div>
              ) : (
                <>
                  <label htmlFor="fundusFileInput" className="fundus-dropzone">
                    {previewUrl ? (
                      <div className="preview-wrap">
                        <img src={previewUrl} alt="Fundus Preview" className="dropzone-preview-img" />
                        <span className="change-img-text">Click to change image</span>
                      </div>
                    ) : (
                      <div className="dropzone-prompt">
                        <div className="dropzone-icon-circle">
                          <Upload size={28} />
                        </div>
                        <h4>Choose or drag {eyeSide} scan image</h4>
                        <p>Supports high-resolution JPEG, JPG, PNG from standard fundus cameras</p>
                      </div>
                    )}
                  </label>
                  <input
                    id="fundusFileInput"
                    type="file"
                    accept="image/jpeg,image/png,image/jpg"
                    onChange={handleFileChange}
                    hidden
                  />
                </>
              )}

              {screenError && <div className="alert-box alert-error">{screenError}</div>}
              {screenSuccess && <div className="alert-box alert-success">{screenSuccess}</div>}

              <button
                type="button"
                className="btn-primary-action btn-full"
                onClick={handleAnalyzeScreening}
                disabled={
                  analyzing ||
                  !selectedPatient ||
                  (eyeSide === "Both Eyes" ? (!rightFile && !leftFile) : !selectedFile)
                }
              >
                {analyzing ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    Running EfficientNet-B0 & Grad-CAM Analysis...
                  </>
                ) : (
                  <>
                    <Activity size={18} />
                    {eyeSide === "Both Eyes"
                      ? "Run Bilateral AI Screening & Explainability (OD + OS)"
                      : `Run AI Screening for ${eyeSide}`}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* SCREENING RESULT & GRAD-CAM EXPLAINABILITY PANEL */}
          <div className="screening-right-results">
            {screeningResult ? (
              <div className="result-display-suite">
                {/* STATUS & PRIORITY BANNER */}
                <div className={`triage-banner priority-${screeningResult.priority?.toLowerCase()}`}>
                  <div className="banner-icon-area">
                    {screeningResult.severity_level >= 3 ? (
                      <AlertTriangle size={28} />
                    ) : (
                      <CheckCircle2 size={28} />
                    )}
                  </div>
                  <div className="banner-text">
                    <div className="banner-top">
                      <span className="priority-tag-large">
                        PRIORITY: {screeningResult.priority}
                      </span>
                      <span className="queue-status-tag">
                        FORWARDED TO DOCTOR QUEUE
                      </span>
                    </div>
                    <h2>{screeningResult.severity_name}</h2>
                    <p>
                      Patient: <strong>{selectedPatient?.name}</strong> • Eye: <strong>{screeningResult.eye_side || eyeSide}</strong> • Model Confidence: {screeningResult.confidence}%
                    </p>
                  </div>
                </div>

                {/* DUAL EYE RESULT VISUALIZERS IF BILATERAL */}
                {dualResults && (dualResults.right || dualResults.left) ? (
                  <div className="dual-staff-results-grid">
                    {dualResults.right && (
                      <div className="results-card">
                        <div className="results-card-header">
                          <Eye size={18} />
                          <h3>OD (Right Eye): {dualResults.right.severity_name}</h3>
                          <span className={`dr-level-pill level-${dualResults.right.severity_level}`}>
                            Level {dualResults.right.severity_level}
                          </span>
                        </div>
                        <GradCamViewer
                          fundusUrl={`${API_BASE}${dualResults.right.image_path}`}
                          gradcamUrl={`${API_BASE}${dualResults.right.gradcam_path}`}
                          severityLevel={dualResults.right.severity_level}
                          prediction={dualResults.right.prediction}
                          confidence={dualResults.right.confidence}
                        />
                      </div>
                    )}
                    {dualResults.left && (
                      <div className="results-card">
                        <div className="results-card-header">
                          <Eye size={18} />
                          <h3>OS (Left Eye): {dualResults.left.severity_name}</h3>
                          <span className={`dr-level-pill level-${dualResults.left.severity_level}`}>
                            Level {dualResults.left.severity_level}
                          </span>
                        </div>
                        <GradCamViewer
                          fundusUrl={`${API_BASE}${dualResults.left.image_path}`}
                          gradcamUrl={`${API_BASE}${dualResults.left.gradcam_path}`}
                          severityLevel={dualResults.left.severity_level}
                          prediction={dualResults.left.prediction}
                          confidence={dualResults.left.confidence}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  /* SINGLE GRAD-CAM VISUALIZER */
                  <div className="results-card">
                    <div className="results-card-header">
                      <Eye size={18} />
                      <h3>Explainability: Grad-CAM Retinal Lesion Heatmap ({screeningResult.eye_side || eyeSide})</h3>
                    </div>
                    <GradCamViewer
                      fundusUrl={`${API_BASE}${screeningResult.image_path}`}
                      gradcamUrl={`${API_BASE}${screeningResult.gradcam_path}`}
                      severityLevel={screeningResult.severity_level}
                      prediction={screeningResult.prediction}
                      confidence={screeningResult.confidence}
                    />
                  </div>
                )}

                {/* CLINICAL TRIAGE RECOMMENDATION */}
                <div className="results-card">
                  <div className="results-card-header">
                    <FileText size={18} />
                    <h3>Clinical Triage Recommendations</h3>
                  </div>
                  <div className="triage-details-grid">
                    <div className="triage-field">
                      <span className="field-label">Action Guideline:</span>
                      <strong>{screeningResult.clinical_action}</strong>
                    </div>
                    <div className="triage-field">
                      <span className="field-label">Suggested Treatment:</span>
                      <span>{screeningResult.suggested_treatment}</span>
                    </div>
                    <div className="triage-field">
                      <span className="field-label">Suggested Pharmacotherapy:</span>
                      <span>{screeningResult.suggested_medication}</span>
                    </div>
                    <div className="triage-field">
                      <span className="field-label">Recommended Follow-up:</span>
                      <strong className="text-highlight">{screeningResult.follow_up}</strong>
                    </div>
                  </div>
                </div>

                {/* CLASS PROBABILITY BREAKDOWN */}
                {screeningResult.probability_distribution && (
                  <div className="results-card">
                    <div className="results-card-header">
                      <Activity size={18} />
                      <h3>Multi-Class Model Confidence Distribution</h3>
                    </div>
                    <div className="prob-bars-list">
                      {Object.entries(screeningResult.probability_distribution).map(([className, prob]) => (
                        <div key={className} className="prob-bar-item">
                          <div className="prob-bar-labels">
                            <span>{className}</span>
                            <strong>{prob}%</strong>
                          </div>
                          <div className="prob-track">
                            <div
                              className={`prob-fill ${className === screeningResult.prediction ? "active-class" : ""}`}
                              style={{ width: `${Math.max(prob, 2)}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-results-placeholder">
                <div className="placeholder-icon">
                  <Eye size={48} />
                </div>
                <h3>AI Retinal Analysis Workspace</h3>
                <p>
                  Select a registered patient and upload their raw retinal fundus image on the left. The deep learning model will classify DR severity, compute Grad-CAM heatmaps highlighting affected retinal regions, and pass the case directly to the doctor triage queue based on clinical priority.
                </p>
                <div className="workflow-steps-guide">
                  <div className="guide-step">
                    <strong>1. Patient Reg</strong>
                    <span>Store demographics in DB</span>
                  </div>
                  <div className="guide-step">
                    <strong>2. Image Upload</strong>
                    <span>Fundus photograph</span>
                  </div>
                  <div className="guide-step">
                    <strong>3. Grad-CAM</strong>
                    <span>Lesion localization</span>
                  </div>
                  <div className="guide-step">
                    <strong>4. Doctor Triage</strong>
                    <span>Priority sorted queue</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: REGISTER PATIENT */}
      {activeTab === "register" && (
        <div className="patient-registration-view">
          <div className="registration-card">
            <div className="reg-header">
              <div className="reg-icon-box">
                <UserPlus size={24} />
              </div>
              <div>
                <h2>Register New Patient</h2>
                <p>Enter patient demographics and clinical history to register them into VisionX</p>
              </div>
            </div>

            {regError && <div className="alert-box alert-error">{regError}</div>}
            {regSuccess && <div className="alert-box alert-success">{regSuccess}</div>}

            <form onSubmit={handleRegisterPatient} className="reg-form-grid">
              <div className="form-group col-span-2">
                <label>Full Patient Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Patel, Sarah Jenkins"
                  value={regForm.name}
                  onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Gender</label>
                <select
                  value={regForm.gender}
                  onChange={(e) => setRegForm({ ...regForm, gender: e.target.value })}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label>Date of Birth</label>
                <input
                  type="date"
                  value={regForm.date_of_birth}
                  onChange={(e) => setRegForm({ ...regForm, date_of_birth: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Phone Number</label>
                <input
                  type="tel"
                  placeholder="e.g. +1 (555) 019-2834"
                  value={regForm.phone}
                  onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Email Address (Optional for Patient Portal)</label>
                <input
                  type="email"
                  placeholder="patient@example.com"
                  value={regForm.email}
                  onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Diabetes Type & Duration</label>
                <select
                  value={regForm.diabetes_type}
                  onChange={(e) => setRegForm({ ...regForm, diabetes_type: e.target.value })}
                >
                  <option value="Type 2 (< 5 yrs)">Type 2 (&lt; 5 years)</option>
                  <option value="Type 2 (5-10 yrs)">Type 2 (5-10 years)</option>
                  <option value="Type 2 (> 10 yrs)">Type 2 (&gt; 10 years)</option>
                  <option value="Type 1 Diabetic">Type 1 Diabetic</option>
                  <option value="Gestational Diabetes">Gestational Diabetes</option>
                  <option value="Pre-diabetic">Pre-diabetic</option>
                </select>
              </div>

              <div className="form-group">
                <label>Emergency Contact</label>
                <input
                  type="text"
                  placeholder="e.g. Spouse (+1 555-432-1098)"
                  value={regForm.emergency_contact}
                  onChange={(e) => setRegForm({ ...regForm, emergency_contact: e.target.value })}
                />
              </div>

              <div className="form-group col-span-2">
                <label>Residential Address</label>
                <input
                  type="text"
                  placeholder="e.g. 742 Evergreen Terrace, Springfield"
                  value={regForm.address}
                  onChange={(e) => setRegForm({ ...regForm, address: e.target.value })}
                />
              </div>

              <div className="form-group col-span-2">
                <label>Medical History & Systemic Risk Factors</label>
                <textarea
                  rows="3"
                  placeholder="e.g. Hypertension, recent HbA1c: 8.2%, Dyslipidemia, no prior laser treatment."
                  value={regForm.medical_history}
                  onChange={(e) => setRegForm({ ...regForm, medical_history: e.target.value })}
                ></textarea>
              </div>

              <div className="form-actions-row col-span-2">
                <button
                  type="submit"
                  className="btn-primary-action"
                  disabled={regLoading}
                >
                  {regLoading ? "Registering Patient..." : "Complete Registration & Proceed to Screening"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 3: PATIENT DIRECTORY */}
      {activeTab === "directory" && (
        <div className="patient-directory-view">
          <div className="directory-header-row">
            <div>
              <h2>Patient Registry Directory</h2>
              <p>All registered patients in the database with their latest screening records</p>
            </div>
            <div className="directory-actions">
              <div className="search-input-wrap">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Search patients..."
                  value={patientSearch}
                  onChange={handlePatientSearchChange}
                />
              </div>
              <button
                type="button"
                className="btn-primary-action"
                onClick={() => setActiveTab("register")}
              >
                <UserPlus size={16} /> New Patient
              </button>
            </div>
          </div>

          <div className="directory-table-card">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Patient ID</th>
                  <th>Patient Name</th>
                  <th>Gender / Contact</th>
                  <th>Diabetes History</th>
                  <th>Scans Count</th>
                  <th>Latest DR Stage</th>
                  <th>Priority</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => (
                  <tr key={p.patient_id}>
                    <td>
                      <span className="patient-id-badge">{p.patient_id}</span>
                    </td>
                    <td>
                      <strong>{p.name}</strong>
                    </td>
                    <td>
                      <div>{p.gender || "-"}</div>
                      <small className="text-muted">{p.phone || "No phone"}</small>
                    </td>
                    <td>{p.diabetes_type || "Type 2"}</td>
                    <td>
                      <span className="scan-count-badge">{p.screening_count || 0} scans</span>
                    </td>
                    <td>
                      {p.latest_prediction ? (
                        <span className={`dr-level-pill level-${p.latest_severity_level}`}>
                          {p.latest_prediction}
                        </span>
                      ) : (
                        <span className="text-muted">No scans yet</span>
                      )}
                    </td>
                    <td>
                      {p.latest_priority ? (
                        <span className={`priority-pill priority-${p.latest_priority?.toLowerCase()}`}>
                          {p.latest_priority}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <button
                          type="button"
                          className="btn-table-action"
                          onClick={() => {
                            setSelectedPatient(p);
                            setActiveTab("screen");
                          }}
                        >
                          New Scan <ArrowRight size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon-danger"
                          title="Delete Patient Record & History"
                          onClick={() => handleDeletePatient(p.patient_id, p.name)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
