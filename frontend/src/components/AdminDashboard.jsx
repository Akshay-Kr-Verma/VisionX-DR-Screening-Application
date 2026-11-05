import React, { useState, useEffect } from "react";
import {
  Shield,
  Users,
  Activity,
  AlertTriangle,
  CheckCircle2,
  UserPlus,
  Trash2,
  Edit2,
  RefreshCw,
  Search,
  Server,
  Database,
  Cpu,
  UserCheck
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export default function AdminDashboard({ token }) {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("users"); // "users" or "patients"
  const [userSearch, setUserSearch] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");

  // Create User modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUserData, setNewUserData] = useState({
    name: "",
    email: "",
    password: "",
    role: "doctor"
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [actionNotice, setActionNotice] = useState("");

  const authHeaders = {
    Authorization: `Bearer ${token}`
  };

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [statsRes, usersRes, patientsRes] = await Promise.all([
        fetch(`${API_BASE}/admin/stats`, { headers: authHeaders }),
        fetch(`${API_BASE}/admin/users`, { headers: authHeaders }),
        fetch(`${API_BASE}/patients`, { headers: authHeaders })
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData);
      }
      if (patientsRes.ok) {
        const patientsData = await patientsRes.json();
        setPatients(patientsData);
      }
    } catch (e) {
      console.error("Error loading admin data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError("");
    setCreateSuccess("");

    try {
      const res = await fetch(`${API_BASE}/admin/users`, {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(newUserData)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Unable to create user");
      }

      setCreateSuccess(`User created successfully: ${data.user.email} (${data.user.role})`);
      setNewUserData({ name: "", email: "", password: "", role: "doctor" });
      await loadAdminData();
      setTimeout(() => setShowCreateModal(false), 1200);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
        method: "PUT",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ role: newRole })
      });
      if (res.ok) {
        setActionNotice("User role updated successfully");
        setTimeout(() => setActionNotice(""), 3000);
        loadAdminData();
      }
    } catch (e) {
      console.error("Failed to update user role:", e);
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`Are you sure you want to permanently delete user "${userName || userId}" and all associated screening records?`)) return;
    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
        method: "DELETE",
        headers: authHeaders
      });
      const data = await res.json();
      if (res.ok) {
        setActionNotice(`User "${userName || userId}" deleted successfully`);
        setTimeout(() => setActionNotice(""), 3500);
        await loadAdminData();
      } else {
        alert(data.detail || "Unable to delete user");
      }
    } catch (e) {
      console.error("Failed to delete user:", e);
      alert("Network error: Unable to delete user");
    }
  };

  const handleDeletePatient = async (patientId, patientName) => {
    if (!window.confirm(`Are you sure you want to permanently delete patient "${patientName || patientId}" and all their fundus scans & history?`)) return;
    try {
      const res = await fetch(`${API_BASE}/patients/${patientId}`, {
        method: "DELETE",
        headers: authHeaders
      });
      const data = await res.json();
      if (res.ok) {
        setActionNotice(`Patient "${patientName || patientId}" and all clinical history deleted successfully`);
        setTimeout(() => setActionNotice(""), 3500);
        await loadAdminData();
      } else {
        alert(data.detail || "Unable to delete patient");
      }
    } catch (e) {
      console.error("Failed to delete patient:", e);
      alert("Network error: Unable to delete patient");
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.patient_id && u.patient_id.toLowerCase().includes(userSearch.toLowerCase()));

    const matchesRole = roleFilter === "ALL" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const filteredPatients = patients.filter((p) => {
    const q = patientSearch.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.patient_id.toLowerCase().includes(q) ||
      (p.phone && p.phone.toLowerCase().includes(q)) ||
      (p.email && p.email.toLowerCase().includes(q))
    );
  });

  const severityLabels = {
    "0": "No DR (Level 0)",
    "1": "Mild DR (Level 1)",
    "2": "Moderate DR (Level 2)",
    "3": "Severe DR (Level 3)",
    "4": "Proliferative DR (Level 4)"
  };

  return (
    <div className="admin-dashboard-container">
      {/* HEADER & QUICK ACTIONS */}
      <div className="admin-header-row">
        <div>
          <h2>System Administration & Platform Governance</h2>
          <p>
            Monitor AI screening telemetry, database records, and manage medical staff & patient accounts.
          </p>
        </div>
        <div className="admin-header-actions">
          <button
            type="button"
            className="btn-primary-action"
            onClick={() => setShowCreateModal(true)}
          >
            <UserPlus size={16} /> Create User Account
          </button>
          <button type="button" className="btn-refresh" onClick={loadAdminData}>
            <RefreshCw size={14} /> Refresh Telemetry
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className="alert-box alert-success" style={{ margin: "12px 0" }}>
          <CheckCircle2 size={16} /> {actionNotice}
        </div>
      )}

      {/* KPI METRICS */}
      {stats && (
        <div className="admin-kpi-grid">
          <div className="kpi-card">
            <div className="kpi-icon-wrap icon-blue">
              <Users size={24} />
            </div>
            <div className="kpi-info">
              <span className="kpi-label">Registered Patients</span>
              <strong className="kpi-val">{stats.total_patients}</strong>
              <small>{users.length} Active System Users</small>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon-wrap icon-purple">
              <Activity size={24} />
            </div>
            <div className="kpi-info">
              <span className="kpi-label">Total AI Retinal Scans</span>
              <strong className="kpi-val">{stats.total_screenings}</strong>
              <small>EfficientNet-B0 + Grad-CAM</small>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon-wrap icon-amber">
              <AlertTriangle size={24} />
            </div>
            <div className="kpi-info">
              <span className="kpi-label">High / Urgent Triage</span>
              <strong className="kpi-val">{stats.urgent_cases}</strong>
              <small>Severe & Proliferative Cases</small>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon-wrap icon-green">
              <CheckCircle2 size={24} />
            </div>
            <div className="kpi-info">
              <span className="kpi-label">Doctor Verified Cases</span>
              <strong className="kpi-val">{stats.reviewed_screenings}</strong>
              <small>{stats.pending_screenings} Pending Review</small>
            </div>
          </div>
        </div>
      )}

      {/* TWO COLUMN: SEVERITY BREAKDOWN & SYSTEM DIAGNOSTICS */}
      <div className="admin-analytics-grid">
        {/* SEVERITY DISTRIBUTION */}
        <div className="admin-card">
          <div className="admin-card-header">
            <Activity size={18} />
            <h3>Diabetic Retinopathy Severity Distribution</h3>
          </div>
          {stats?.severity_distribution && (
            <div className="distribution-list">
              {Object.entries(stats.severity_distribution).map(([level, count]) => {
                const total = stats.total_screenings || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={level} className="dist-item">
                    <div className="dist-labels">
                      <span className={`dr-level-pill level-${level}`}>
                        {severityLabels[level]}
                      </span>
                      <strong>{count} cases ({pct}%)</strong>
                    </div>
                    <div className="dist-track">
                      <div
                        className={`dist-fill fill-level-${level}`}
                        style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SYSTEM STATUS & HEALTH */}
        <div className="admin-card">
          <div className="admin-card-header">
            <Server size={18} />
            <h3>Platform Infrastructure Health</h3>
          </div>
          <div className="infrastructure-list">
            <div className="infra-item">
              <div className="infra-left">
                <Cpu size={18} />
                <div>
                  <strong>Deep Learning Inference Engine</strong>
                  <small>PyTorch EfficientNet-B0 (5 DR Severity Classes)</small>
                </div>
              </div>
              <span className="health-badge healthy">Online & Ready</span>
            </div>

            <div className="infra-item">
              <div className="infra-left">
                <Activity size={18} />
                <div>
                  <strong>Grad-CAM Explainability Module</strong>
                  <small>Layer: model.features[-1] • JET Activation Heatmaps</small>
                </div>
              </div>
              <span className="health-badge healthy">Active</span>
            </div>

            <div className="infra-item">
              <div className="infra-left">
                <Database size={18} />
                <div>
                  <strong>Relational Database</strong>
                  <small>MySQL 8.0 • Users, Patients, Screenings</small>
                </div>
              </div>
              <span className="health-badge healthy">Connected</span>
            </div>

            <div className="infra-item">
              <div className="infra-left">
                <Shield size={18} />
                <div>
                  <strong>Role-Based Access Control (RBAC)</strong>
                  <small>Admin, Doctor, Screening Staff, Patient Portals</small>
                </div>
              </div>
              <span className="health-badge healthy">Enforced</span>
            </div>
          </div>
        </div>
      </div>

      {/* MANAGEMENT SECTION TABS: USERS vs PATIENTS */}
      <div className="admin-card users-management-card">
        <div className="admin-section-tabs-bar">
          <button
            type="button"
            className={`admin-section-tab ${activeTab === "users" ? "active" : ""}`}
            onClick={() => setActiveTab("users")}
          >
            <Users size={16} /> User Accounts & Staff ({users.length})
          </button>
          <button
            type="button"
            className={`admin-section-tab ${activeTab === "patients" ? "active" : ""}`}
            onClick={() => setActiveTab("patients")}
          >
            <UserCheck size={16} /> Registered Patients Directory ({patients.length})
          </button>
        </div>

        {/* TAB 1: USERS MANAGEMENT */}
        {activeTab === "users" && (
          <>
            <div className="admin-card-header-row">
              <div>
                <h3>User Accounts & Role Permissions</h3>
                <p>Manage access levels, roles, and authentication for doctors, staff, patients, and admins.</p>
              </div>
              <div className="users-filter-row">
                <div className="role-filter-pills">
                  {["ALL", "doctor", "staff", "patient", "admin"].map((r) => (
                    <button
                      key={r}
                      type="button"
                      className={`btn-pill ${roleFilter === r ? "active" : ""}`}
                      onClick={() => setRoleFilter(r)}
                    >
                      {r === "ALL" ? "All Roles" : r.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div className="search-input-wrap">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Search user name or email..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>User ID</th>
                    <th>Full Name</th>
                    <th>Email Address</th>
                    <th>Role & Permissions</th>
                    <th>Linked Patient ID</th>
                    <th>Change Role</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id}>
                      <td>#{u.id}</td>
                      <td><strong>{u.name}</strong></td>
                      <td>{u.email}</td>
                      <td>
                        <span className={`role-pill badge-${u.role}`}>
                          {u.role.toUpperCase()}
                        </span>
                      </td>
                      <td>{u.patient_id || "-"}</td>
                      <td>
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          className="role-select"
                        >
                          <option value="admin">Admin</option>
                          <option value="doctor">Doctor</option>
                          <option value="staff">Staff</option>
                          <option value="patient">Patient</option>
                        </select>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-icon-danger"
                          onClick={() => handleDeleteUser(u.id, u.name)}
                          title="Delete User"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* TAB 2: PATIENTS REGISTRY MANAGEMENT */}
        {activeTab === "patients" && (
          <>
            <div className="admin-card-header-row">
              <div>
                <h3>Registered Patients Directory</h3>
                <p>Manage, inspect, and delete patient records and all associated bilateral fundus screenings.</p>
              </div>
              <div className="users-filter-row">
                <div className="search-input-wrap">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Search by patient name, ID, phone..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Patient ID</th>
                    <th>Patient Name</th>
                    <th>Gender / Contact</th>
                    <th>Diabetes Type</th>
                    <th>Scans Count</th>
                    <th>Latest DR Severity</th>
                    <th>Priority</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPatients.map((p) => (
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
                        <button
                          type="button"
                          className="btn-icon-danger"
                          onClick={() => handleDeletePatient(p.patient_id, p.name)}
                          title="Delete Patient & All Scans"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* CREATE USER MODAL */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content-card">
            <div className="modal-header">
              <h3>Create New User Account</h3>
              <button
                type="button"
                className="btn-close-modal"
                onClick={() => setShowCreateModal(false)}
              >
                &times;
              </button>
            </div>

            {createError && <div className="alert-box alert-error">{createError}</div>}
            {createSuccess && <div className="alert-box alert-success">{createSuccess}</div>}

            <form onSubmit={handleCreateUser} className="modal-form">
              <div className="form-group">
                <label>Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Robert Vance, MD"
                  value={newUserData.name}
                  onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Email Address *</label>
                <input
                  type="email"
                  placeholder="e.g. user@visionx.com"
                  value={newUserData.email}
                  onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Temporary Password *</label>
                <input
                  type="password"
                  placeholder="Min 6 characters"
                  value={newUserData.password}
                  onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Role Assignment *</label>
                <select
                  value={newUserData.role}
                  onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value })}
                >
                  <option value="doctor">Doctor (Ophthalmologist / Retina Specialist)</option>
                  <option value="staff">Screening Staff (Uploads & Patient Registry)</option>
                  <option value="patient">Patient (Personal Scans & Reports)</option>
                  <option value="admin">System Administrator (Full Governance)</option>
                </select>
              </div>

              <div className="modal-actions-row">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary-action"
                  disabled={createLoading}
                >
                  {createLoading ? "Creating User..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
