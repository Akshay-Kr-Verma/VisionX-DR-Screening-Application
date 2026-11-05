import React, { useState, useEffect, useMemo } from "react";
import {
  Stethoscope,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  Eye,
  FileText,
  Pill,
  Syringe,
  X,
  Printer,
  ChevronRight,
  Sparkles,
  RefreshCw
} from "lucide-react";
import GradCamViewer from "./GradCamViewer";
import ClinicalReportModal from "./ClinicalReportModal";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export default function DoctorDashboard({ token }) {
  const [triageQueue, setTriageQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Examination Modal state (Patient Group containing both eyes)
  const [activePatient, setActivePatient] = useState(null);
  const [activeEyeTab, setActiveEyeTab] = useState("BOTH"); // "BOTH", "OD", "OS"
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSuccessMsg, setReviewSuccessMsg] = useState("");
  const [reviewErrorMsg, setReviewErrorMsg] = useState("");

  // Review Form state - separate diagnosis for each eye!
  const [rightEyeNotes, setRightEyeNotes] = useState("");
  const [leftEyeNotes, setLeftEyeNotes] = useState("");
  const [prescribedMedication, setPrescribedMedication] = useState("");
  const [treatmentPlan, setTreatmentPlan] = useState("");

  // PDF Report Modal state
  const [reportModalScreening, setReportModalScreening] = useState(null);

  const authHeaders = {
    Authorization: `Bearer ${token}`
  };

  const fetchTriageQueue = async () => {
    setLoading(true);
    try {
      let url = `${API_BASE}/screenings/doctor-triage?status=${statusFilter}&priority=${priorityFilter}`;
      if (searchQuery.trim()) {
        url += `&search=${encodeURIComponent(searchQuery.trim())}`;
      }
      const res = await fetch(url, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setTriageQueue(data);
      }
    } catch (e) {
      console.error("Error loading doctor triage queue:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTriageQueue();
  }, [statusFilter, priorityFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchTriageQueue();
  };

  // Group flat screenings by patient_id so each patient appears ONLY ONCE
  const groupedPatients = useMemo(() => {
    const patientMap = {};

    triageQueue.forEach((s) => {
      const pid = s.patient_id;
      if (!patientMap[pid]) {
        patientMap[pid] = {
          patient_id: s.patient_id,
          patient_name: s.patient_name,
          patient_gender: s.patient_gender,
          patient_phone: s.patient_phone,
          patient_dob: s.patient_dob,
          diabetes_type: s.diabetes_type,
          medical_history: s.medical_history,
          screenings: [],
          right_eye: null,
          left_eye: null,
          latest_screened_at: s.screened_at,
          overall_priority: "ROUTINE",
          overall_status: "REVIEWED",
          max_severity_level: 0,
        };
      }

      const group = patientMap[pid];
      group.screenings.push(s);

      const side = (s.eye_side || "").toLowerCase();
      if (side.includes("left")) {
        if (!group.left_eye) group.left_eye = s;
      } else {
        if (!group.right_eye) group.right_eye = s;
      }

      if (new Date(s.screened_at) > new Date(group.latest_screened_at)) {
        group.latest_screened_at = s.screened_at;
      }

      const priorityWeights = { URGENT: 4, HIGH: 3, MEDIUM: 2, ROUTINE: 1 };
      const curWeight = priorityWeights[group.overall_priority] || 1;
      const sWeight = priorityWeights[s.priority] || 1;
      if (sWeight > curWeight) {
        group.overall_priority = s.priority;
        group.max_severity_level = s.severity_level;
      }

      if (s.status === "PENDING_REVIEW") {
        group.overall_status = "PENDING_REVIEW";
      }
    });

    // If patient has multiple scans and only one eye side was assigned, map the second to the other eye
    Object.values(patientMap).forEach((group) => {
      if (group.screenings.length >= 2) {
        if (!group.left_eye && group.right_eye) {
          const other = group.screenings.find((sc) => sc.id !== group.right_eye.id);
          if (other) {
            group.left_eye = { ...other, eye_side: "Left Eye" };
          }
        } else if (!group.right_eye && group.left_eye) {
          const other = group.screenings.find((sc) => sc.id !== group.left_eye.id);
          if (other) {
            group.right_eye = { ...other, eye_side: "Right Eye" };
          }
        }
      }
    });

    const priorityRank = { URGENT: 1, HIGH: 2, MEDIUM: 3, ROUTINE: 4 };
    return Object.values(patientMap).sort((a, b) => {
      const rankDiff = (priorityRank[a.overall_priority] || 4) - (priorityRank[b.overall_priority] || 4);
      if (rankDiff !== 0) return rankDiff;
      return new Date(b.latest_screened_at) - new Date(a.latest_screened_at);
    });
  }, [triageQueue]);

  // Open examine modal for this patient
  const openExamineModal = (patientGroup) => {
    setActivePatient(patientGroup);
    setActiveEyeTab("BOTH");

    // Populate separate notes for Right Eye (OD) and Left Eye (OS)
    setRightEyeNotes(patientGroup.right_eye?.doctor_notes || "");
    setLeftEyeNotes(patientGroup.left_eye?.doctor_notes || "");

    // Pre-populate medication and treatment plan
    const med =
      patientGroup.right_eye?.prescribed_medication ||
      patientGroup.left_eye?.prescribed_medication ||
      "";
    const plan =
      patientGroup.right_eye?.treatment_plan ||
      patientGroup.left_eye?.treatment_plan ||
      "";
    setPrescribedMedication(med);
    setTreatmentPlan(plan);

    setReviewSuccessMsg("");
    setReviewErrorMsg("");
  };

  const closeExamineModal = () => {
    setActivePatient(null);
  };

  // Quick protocol helper
  const handlePresetTreatment = (planText, medText, targetEye = "BOTH") => {
    if (planText) setTreatmentPlan(planText);
    if (medText) setPrescribedMedication(medText);

    if (targetEye === "OD" || targetEye === "BOTH") {
      if (!rightEyeNotes) {
        setRightEyeNotes(`Right Eye (OD): Findings consistent with ${activePatient?.right_eye?.prediction || "retinopathy"}. Recommend targeted intervention.`);
      }
    }
    if (targetEye === "OS" || targetEye === "BOTH") {
      if (!leftEyeNotes) {
        setLeftEyeNotes(`Left Eye (OS): Findings consistent with ${activePatient?.left_eye?.prediction || "retinopathy"}. Recommend close monitoring.`);
      }
    }
  };

  // Submit doctor review for both eyes
  const handleSubmitDoctorReview = async (e) => {
    e.preventDefault();
    if (!rightEyeNotes.trim() && !leftEyeNotes.trim()) {
      setReviewErrorMsg("Please enter clinical notes/diagnosis for at least one eye.");
      return;
    }

    setSubmittingReview(true);
    setReviewErrorMsg("");
    setReviewSuccessMsg("");

    try {
      const payload = {
        right_eye_screening_id: activePatient.right_eye?.id || null,
        right_eye_notes: rightEyeNotes.trim() || null,
        left_eye_screening_id: activePatient.left_eye?.id || null,
        left_eye_notes: leftEyeNotes.trim() || null,
        prescribed_medication: prescribedMedication.trim() || null,
        treatment_plan: treatmentPlan.trim() || null,
        status: "REVIEWED"
      };

      const res = await fetch(`${API_BASE}/screenings/patient/${activePatient.patient_id}/doctor-review-dual`, {
        method: "PUT",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Unable to save review.");
      }

      setReviewSuccessMsg("Dual-eye diagnosis and clinical care plan saved! Marked as Reviewed.");
      await fetchTriageQueue();
    } catch (err) {
      setReviewErrorMsg(err.message);
    } finally {
      setSubmittingReview(false);
    }
  };

  // KPI Metrics based on unique patient cases
  const urgentCount = groupedPatients.filter((p) => p.overall_priority === "URGENT" || p.overall_priority === "HIGH").length;
  const pendingCount = groupedPatients.filter((p) => p.overall_status === "PENDING_REVIEW").length;
  const reviewedCount = groupedPatients.filter((p) => p.overall_status === "REVIEWED").length;

  return (
    <div className="doctor-dashboard-container">
      {/* METRICS ROW */}
      <div className="stats-kpi-grid">
        <div className="kpi-card kpi-urgent">
          <div className="kpi-icon-wrap">
            <AlertTriangle size={24} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Urgent & High Triage</span>
            <strong className="kpi-val">{urgentCount} Patients</strong>
            <small>Priority 3 (Severe) & 4 (Proliferative)</small>
          </div>
        </div>

        <div className="kpi-card kpi-pending">
          <div className="kpi-icon-wrap">
            <Clock size={24} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Awaiting Verification</span>
            <strong className="kpi-val">{pendingCount} Patients</strong>
            <small>Requires Ophthalmologist Review</small>
          </div>
        </div>

        <div className="kpi-card kpi-reviewed">
          <div className="kpi-icon-wrap">
            <CheckCircle2 size={24} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Clinically Reviewed</span>
            <strong className="kpi-val">{reviewedCount} Patients</strong>
            <small>Prescriptions & Treatments Finalized</small>
          </div>
        </div>

        <div className="kpi-card kpi-total">
          <div className="kpi-icon-wrap">
            <Stethoscope size={24} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Total Patients</span>
            <strong className="kpi-val">{groupedPatients.length} Unique Patients</strong>
            <small>Consolidated Dual-Eye Triage</small>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH TOOLBAR */}
      <div className="doctor-toolbar-card">
        <div className="toolbar-left">
          <div className="filter-group">
            <span className="filter-label"><Filter size={14} /> Status:</span>
            <div className="filter-pills">
              {["ALL", "PENDING_REVIEW", "REVIEWED"].map((st) => (
                <button
                  key={st}
                  type="button"
                  className={`btn-pill ${statusFilter === st ? "active" : ""}`}
                  onClick={() => setStatusFilter(st)}
                >
                  {st === "ALL" ? "All Cases" : st === "PENDING_REVIEW" ? "Pending Review" : "Reviewed"}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <span className="filter-label">Priority:</span>
            <div className="filter-pills">
              {["ALL", "URGENT", "HIGH", "MEDIUM", "ROUTINE"].map((pr) => (
                <button
                  key={pr}
                  type="button"
                  className={`btn-pill pill-${pr.toLowerCase()} ${priorityFilter === pr ? "active" : ""}`}
                  onClick={() => setPriorityFilter(pr)}
                >
                  {pr}
                </button>
              ))}
            </div>
          </div>
        </div>

        <form onSubmit={handleSearchSubmit} className="search-form-wrap">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search patient name, ID, or severity..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit" className="btn-search-submit">Search</button>
        </form>
      </div>

      {/* PRIORITY TRIAGE QUEUE LIST (GROUPED BY PATIENT) */}
      <div className="triage-table-card">
        <div className="table-card-header">
          <div>
            <h3>Priority-Based Retinopathy Triage Stream (Patient-Centric Dual-Eye View)</h3>
            <p>Each patient appears once with both eye scans consolidated for holistic clinical evaluation.</p>
          </div>
          <button type="button" className="btn-refresh" onClick={fetchTriageQueue}>
            <RefreshCw size={14} /> Refresh Queue
          </button>
        </div>

        {loading ? (
          <div className="loading-state-box">
            <RefreshCw size={24} className="animate-spin" />
            <p>Loading clinical triage stream...</p>
          </div>
        ) : groupedPatients.length === 0 ? (
          <div className="empty-state-box">
            <CheckCircle2 size={36} className="empty-icon" />
            <h4>No patient screenings match this filter</h4>
            <p>All cases have been processed or no screenings found.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="custom-table triage-table">
              <thead>
                <tr>
                  <th>Priority</th>
                  <th>Patient</th>
                  <th>Retinal Scans (OD / OS)</th>
                  <th>AI Predicted DR Level (OD / OS)</th>
                  <th>Confidence</th>
                  <th>Screening Date</th>
                  <th>Review Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {groupedPatients.map((p) => {
                  const hasRight = !!p.right_eye;
                  const hasLeft = !!p.left_eye;

                  return (
                    <tr
                      key={p.patient_id}
                      className={`triage-row ${p.overall_priority === "URGENT" ? "row-urgent" : ""} ${p.overall_status === "PENDING_REVIEW" ? "row-pending" : ""}`}
                    >
                      {/* PRIORITY */}
                      <td>
                        <span className={`priority-badge priority-${p.overall_priority?.toLowerCase()}`}>
                          {p.overall_priority}
                        </span>
                      </td>

                      {/* PATIENT INFO */}
                      <td>
                        <div className="patient-col">
                          <strong>{p.patient_name}</strong>
                          <span className="patient-id-tag">{p.patient_id}</span>
                          <small className="patient-sub">{p.diabetes_type || "Type 2"}</small>
                        </div>
                      </td>

                      {/* DUAL EYE THUMBNAILS (OD & OS) */}
                      <td>
                        <div className="dual-eye-thumbs-container">
                          {hasRight && (
                            <div className="eye-thumb-block">
                              <span className="eye-badge eye-badge-od">OD (Right)</span>
                              <div className="dual-thumbnail-pair">
                                {p.right_eye.image_path && (
                                  <img
                                    src={`${API_BASE}${p.right_eye.image_path}`}
                                    alt="OD Fundus"
                                    className="thumb-img"
                                    title="OD Raw Fundus"
                                  />
                                )}
                                {p.right_eye.gradcam_path && (
                                  <img
                                    src={`${API_BASE}${p.right_eye.gradcam_path}`}
                                    alt="OD Grad-CAM"
                                    className="thumb-img thumb-gradcam"
                                    title="OD Grad-CAM Heatmap"
                                  />
                                )}
                              </div>
                            </div>
                          )}

                          {hasLeft && (
                            <div className="eye-thumb-block">
                              <span className="eye-badge eye-badge-os">OS (Left)</span>
                              <div className="dual-thumbnail-pair">
                                {p.left_eye.image_path && (
                                  <img
                                    src={`${API_BASE}${p.left_eye.image_path}`}
                                    alt="OS Fundus"
                                    className="thumb-img"
                                    title="OS Raw Fundus"
                                  />
                                )}
                                {p.left_eye.gradcam_path && (
                                  <img
                                    src={`${API_BASE}${p.left_eye.gradcam_path}`}
                                    alt="OS Grad-CAM"
                                    className="thumb-img thumb-gradcam"
                                    title="OS Grad-CAM Heatmap"
                                  />
                                )}
                              </div>
                            </div>
                          )}

                          {!hasRight && !hasLeft && (
                            <span className="text-muted">No scan images</span>
                          )}
                        </div>
                      </td>

                      {/* AI DR LEVEL FOR BOTH EYES */}
                      <td>
                        <div className="dual-dr-level-stack">
                          {hasRight && (
                            <div className="eye-level-entry">
                              <span className="eye-label-inline od-color">OD:</span>
                              <div className={`dr-level-indicator level-${p.right_eye.severity_level}`}>
                                <span className="lvl-badge">L{p.right_eye.severity_level}</span>
                                <strong>{p.right_eye.prediction}</strong>
                              </div>
                            </div>
                          )}
                          {hasLeft && (
                            <div className="eye-level-entry">
                              <span className="eye-label-inline os-color">OS:</span>
                              <div className={`dr-level-indicator level-${p.left_eye.severity_level}`}>
                                <span className="lvl-badge">L{p.left_eye.severity_level}</span>
                                <strong>{p.left_eye.prediction}</strong>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* CONFIDENCE */}
                      <td>
                        <div className="dual-conf-stack">
                          {hasRight && (
                            <small className="conf-line">
                              <strong>OD:</strong> {p.right_eye.confidence}%
                            </small>
                          )}
                          {hasLeft && (
                            <small className="conf-line">
                              <strong>OS:</strong> {p.left_eye.confidence}%
                            </small>
                          )}
                        </div>
                      </td>

                      {/* SCREENING DATE */}
                      <td>
                        <span className="date-text">
                          {p.latest_screened_at ? new Date(p.latest_screened_at).toLocaleDateString() : "-"}
                        </span>
                      </td>

                      {/* STATUS */}
                      <td>
                        <span className={`status-pill ${p.overall_status === "REVIEWED" ? "status-reviewed" : "status-pending"}`}>
                          {p.overall_status === "REVIEWED" ? "Reviewed" : "Pending Review"}
                        </span>
                      </td>

                      {/* ACTION */}
                      <td>
                        <button
                          type="button"
                          className="btn-examine-action"
                          onClick={() => openExamineModal(p)}
                        >
                          Examine Both Eyes <ChevronRight size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DETAILED DUAL-EYE EXAMINATION & DIAGNOSIS MODAL */}
      {activePatient && (
        <div className="examine-modal-overlay">
          <div className="examine-modal-box examine-dual-modal-box">
            {/* MODAL HEADER */}
            <div className="examine-modal-header">
              <div className="modal-title-group">
                <span className={`priority-tag priority-${activePatient.overall_priority?.toLowerCase()}`}>
                  {activePatient.overall_priority} PRIORITY
                </span>
                <h2>Comprehensive Retinal Examination: {activePatient.patient_name}</h2>
                <span className="modal-patient-id">{activePatient.patient_id} • Consolidated Bilateral Review</span>
              </div>
              <div className="modal-actions-right">
                <button
                  type="button"
                  className="btn-print-report"
                  onClick={() => setReportModalScreening(activePatient.right_eye || activePatient.left_eye)}
                >
                  <FileText size={16} /> Clinical Report
                </button>
                <button type="button" className="btn-close-modal" onClick={closeExamineModal}>
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="examine-modal-body examine-dual-modal-body">
              {/* LEFT COLUMN: BOTH RETINAL SCANS & GRAD-CAM VISUALIZERS */}
              <div className="examine-left-pane">
                {/* PATIENT INFO BANNER */}
                <div className="patient-context-card">
                  <h4>Patient Clinical Profile</h4>
                  <div className="patient-context-grid">
                    <div>
                      <span>Name:</span> <strong>{activePatient.patient_name}</strong>
                    </div>
                    <div>
                      <span>ID:</span> <strong>{activePatient.patient_id}</strong>
                    </div>
                    <div>
                      <span>Gender:</span> <strong>{activePatient.patient_gender || "Unspecified"}</strong>
                    </div>
                    <div>
                      <span>Contact:</span> <strong>{activePatient.patient_phone || "N/A"}</strong>
                    </div>
                    <div>
                      <span>Diabetes:</span> <strong>{activePatient.diabetes_type || "Type 2 Diabetic"}</strong>
                    </div>
                    <div>
                      <span>Medical History:</span> <span>{activePatient.medical_history || "No prior history"}</span>
                    </div>
                  </div>
                </div>

                {/* EYE VIEW MODE TABS */}
                <div className="eye-view-tabs">
                  <button
                    type="button"
                    className={`tab-btn-mini ${activeEyeTab === "BOTH" ? "active" : ""}`}
                    onClick={() => setActiveEyeTab("BOTH")}
                  >
                    👁👁 Both Eyes (Side-by-Side)
                  </button>
                  {activePatient.right_eye && (
                    <button
                      type="button"
                      className={`tab-btn-mini ${activeEyeTab === "OD" ? "active" : ""}`}
                      onClick={() => setActiveEyeTab("OD")}
                    >
                      👁 Right Eye (OD) Only
                    </button>
                  )}
                  {activePatient.left_eye && (
                    <button
                      type="button"
                      className={`tab-btn-mini ${activeEyeTab === "OS" ? "active" : ""}`}
                      onClick={() => setActiveEyeTab("OS")}
                    >
                      👁 Left Eye (OS) Only
                    </button>
                  )}
                </div>

                {/* DUAL EYE VISUALIZER CARDS */}
                <div className={`dual-visualizer-grid ${activeEyeTab === "BOTH" ? "grid-two-cols" : "grid-one-col"}`}>
                  {/* RIGHT EYE (OD) CARD */}
                  {(activeEyeTab === "BOTH" || activeEyeTab === "OD") && (
                    <div className="visualizer-card eye-card-od">
                      <div className="card-sub-header">
                        <div className="header-badge-pair">
                          <span className="eye-badge eye-badge-od">OD — Right Eye</span>
                          <span className="screening-num-tag">#{activePatient.right_eye?.id || "N/A"}</span>
                        </div>
                        {activePatient.right_eye ? (
                          <span className={`dr-level-pill level-${activePatient.right_eye.severity_level}`}>
                            Level {activePatient.right_eye.severity_level} • {activePatient.right_eye.prediction} ({activePatient.right_eye.confidence}%)
                          </span>
                        ) : (
                          <span className="text-muted">Not Scanned</span>
                        )}
                      </div>

                      {activePatient.right_eye ? (
                        <GradCamViewer
                          fundusUrl={`${API_BASE}${activePatient.right_eye.image_path}`}
                          gradcamUrl={`${API_BASE}${activePatient.right_eye.gradcam_path}`}
                          severityLevel={activePatient.right_eye.severity_level}
                          prediction={activePatient.right_eye.prediction}
                          confidence={activePatient.right_eye.confidence}
                        />
                      ) : (
                        <div className="eye-placeholder-box">
                          <Eye size={36} />
                          <p>Right Eye (OD) scan not recorded for this patient.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* LEFT EYE (OS) CARD */}
                  {(activeEyeTab === "BOTH" || activeEyeTab === "OS") && (
                    <div className="visualizer-card eye-card-os">
                      <div className="card-sub-header">
                        <div className="header-badge-pair">
                          <span className="eye-badge eye-badge-os">OS — Left Eye</span>
                          <span className="screening-num-tag">#{activePatient.left_eye?.id || "N/A"}</span>
                        </div>
                        {activePatient.left_eye ? (
                          <span className={`dr-level-pill level-${activePatient.left_eye.severity_level}`}>
                            Level {activePatient.left_eye.severity_level} • {activePatient.left_eye.prediction} ({activePatient.left_eye.confidence}%)
                          </span>
                        ) : (
                          <span className="text-muted">Not Scanned</span>
                        )}
                      </div>

                      {activePatient.left_eye ? (
                        <GradCamViewer
                          fundusUrl={`${API_BASE}${activePatient.left_eye.image_path}`}
                          gradcamUrl={`${API_BASE}${activePatient.left_eye.gradcam_path}`}
                          severityLevel={activePatient.left_eye.severity_level}
                          prediction={activePatient.left_eye.prediction}
                          confidence={activePatient.left_eye.confidence}
                        />
                      ) : (
                        <div className="eye-placeholder-box">
                          <Eye size={36} />
                          <p>Left Eye (OS) scan not recorded for this patient.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: DOCTOR CLINICAL DECISION WITH SEPARATE OD & OS TEXTBOXES */}
              <div className="examine-right-pane">
                {/* QUICK PRESET BUTTONS */}
                <div className="presets-card">
                  <span className="preset-label"><Sparkles size={14} /> Quick-Fill Clinical Protocols:</span>
                  <div className="preset-buttons">
                    <button
                      type="button"
                      className="btn-preset"
                      onClick={() =>
                        handlePresetTreatment(
                          "OD: Panretinal Laser Photocoagulation (PRP) within 1-2 weeks; OS: Observe & Repeat OCT in 3 months",
                          "OD Intravitreal Anti-VEGF (Ranibizumab 0.5mg); Strict BP & HbA1c control; Carboxymethylcellulose drops PRN"
                        )
                      }
                    >
                      OD Laser + OS Observation
                    </button>
                    <button
                      type="button"
                      className="btn-preset"
                      onClick={() =>
                        handlePresetTreatment(
                          "Bilateral Macular OCT evaluation; Focal laser if center-involving DME confirmed",
                          "Fenofibrate 145mg daily; Intensive glycemic, lipid and blood pressure control; Lubricating tears TID"
                        )
                      }
                    >
                      Bilateral OCT & Focal Laser
                    </button>
                    <button
                      type="button"
                      className="btn-preset"
                      onClick={() =>
                        handlePresetTreatment(
                          "Annual preventive retinal digital photography screening; Continue standard medical therapy",
                          "Maintain standard oral antidiabetic / insulin therapy; Target HbA1c < 7.0%"
                        )
                      }
                    >
                      Bilateral Routine Monitoring
                    </button>
                  </div>
                </div>

                {/* DOCTOR DUAL-EYE CLINICAL DECISION FORM */}
                <form onSubmit={handleSubmitDoctorReview} className="doctor-decision-form">
                  {/* SEPARATE TEXT BOX 1: RIGHT EYE (OD) DIAGNOSIS */}
                  <div className="form-group eye-decision-group">
                    <label className="eye-decision-label od-color">
                      <Eye size={16} /> Right Eye (OD) Diagnosis & Clinical Findings *
                    </label>
                    <textarea
                      rows="3"
                      placeholder="Enter Right Eye specific findings (e.g. Dilated exam confirms multiple dot-blot hemorrhages in temporal quadrant, fovea uninvolved)..."
                      value={rightEyeNotes}
                      onChange={(e) => setRightEyeNotes(e.target.value)}
                    ></textarea>
                  </div>

                  {/* SEPARATE TEXT BOX 2: LEFT EYE (OS) DIAGNOSIS */}
                  <div className="form-group eye-decision-group">
                    <label className="eye-decision-label os-color">
                      <Eye size={16} /> Left Eye (OS) Diagnosis & Clinical Findings *
                    </label>
                    <textarea
                      rows="3"
                      placeholder="Enter Left Eye specific findings (e.g. Mild microaneurysms detected in nasal periphery, macula flat and clear, no neovascularization)..."
                      value={leftEyeNotes}
                      onChange={(e) => setLeftEyeNotes(e.target.value)}
                    ></textarea>
                  </div>

                  {/* PRESCRIBED MEDICATION (BILATERAL / SYSTEMIC) */}
                  <div className="form-group">
                    <label>
                      <Pill size={16} /> Prescribed Pharmacotherapy & Eye Drops
                    </label>
                    <textarea
                      rows="2"
                      placeholder="e.g. Anti-VEGF injection for OD; Nepafenac 0.1% drops TID; Carboxymethylcellulose 0.5% drops; optimize oral glycemic control..."
                      value={prescribedMedication}
                      onChange={(e) => setPrescribedMedication(e.target.value)}
                    ></textarea>
                  </div>

                  {/* TREATMENT / SURGICAL PLAN */}
                  <div className="form-group">
                    <label>
                      <Syringe size={16} /> Recommended Treatment & Surgical Intervention
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. OD: Panretinal Photocoagulation (PRP); OS: 6-month repeat fundus screening"
                      value={treatmentPlan}
                      onChange={(e) => setTreatmentPlan(e.target.value)}
                    />
                  </div>

                  {reviewErrorMsg && <div className="alert-box alert-error">{reviewErrorMsg}</div>}
                  {reviewSuccessMsg && <div className="alert-box alert-success">{reviewSuccessMsg}</div>}

                  <div className="form-submit-row">
                    <button
                      type="submit"
                      className="btn-submit-review"
                      disabled={submittingReview}
                    >
                      {submittingReview ? "Saving Dual-Eye Record..." : "Confirm Dual-Eye Diagnosis & Finalize Care Plan"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRINTABLE CLINICAL REPORT MODAL */}
      {reportModalScreening && (
        <ClinicalReportModal
          screening={reportModalScreening}
          onClose={() => setReportModalScreening(null)}
        />
      )}
    </div>
  );
}
