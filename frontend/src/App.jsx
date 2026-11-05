import React, { useState, useEffect } from "react";
import "./App.css";
import Navbar from "./components/Navbar";
import Login from "./components/Login";
import StaffDashboard from "./components/StaffDashboard";
import DoctorDashboard from "./components/DoctorDashboard";
import PatientDashboard from "./components/PatientDashboard";
import AdminDashboard from "./components/AdminDashboard";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function App() {
  const [token, setToken] = useState(localStorage.getItem("access_token"));
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user_info");
    return saved ? JSON.parse(saved) : null;
  });
  const [loadingProfile, setLoadingProfile] = useState(false);
  // For admin or view switching
  const [currentView, setCurrentView] = useState(null);

  const fetchProfile = async (accessToken) => {
    setLoadingProfile(true);
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        localStorage.setItem("user_info", JSON.stringify(data));
        setCurrentView(data.role);
      } else {
        handleLogout();
      }
    } catch (e) {
      console.error("Profile check failed:", e);
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    if (token && !user) {
      fetchProfile(token);
    } else if (user && !currentView) {
      setCurrentView(user.role);
    }
  }, [token]);

  const handleLogin = (accessToken, userData) => {
    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("user_info", JSON.stringify(userData));
    setToken(accessToken);
    setUser(userData);
    setCurrentView(userData.role);
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_info");
    setToken(null);
    setUser(null);
    setCurrentView(null);
  };

  const handleQuickSwitchRole = async (targetRole) => {
    const creds = {
      admin: { email: "admin@visionx.com", password: "admin123" },
      doctor: { email: "doctor@visionx.com", password: "doctor123" },
      staff: { email: "staff@visionx.com", password: "staff123" },
      patient: { email: "patient@visionx.com", password: "patient123" },
    };

    const targetCred = creds[targetRole];
    if (!targetCred) return;

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(targetCred),
      });
      if (res.ok) {
        const data = await res.json();
        handleLogin(data.access_token, data.user);
      }
    } catch (e) {
      console.error("Failed to switch demo persona:", e);
    }
  };

  if (!token || !user) {
    return <Login onLogin={handleLogin} />;
  }

  const effectiveRole = currentView || user.role;

  return (
    <div className="app-shell">
      <Navbar
        user={user}
        activeRole={effectiveRole}
        onLogout={handleLogout}
        onQuickSwitchRole={handleQuickSwitchRole}
      />

      {/* ADMIN PERSONA VIEW SELECTOR */}
      {user.role === "admin" && (
        <div className="admin-persona-nav">
          <div className="persona-nav-inner">
            <span className="persona-nav-label">Admin Persona View:</span>
            <div className="persona-nav-buttons">
              <button
                type="button"
                className={`btn-persona ${effectiveRole === "admin" ? "active" : ""}`}
                onClick={() => setCurrentView("admin")}
              >
                Admin Governance
              </button>
              <button
                type="button"
                className={`btn-persona ${effectiveRole === "doctor" ? "active" : ""}`}
                onClick={() => setCurrentView("doctor")}
              >
                Doctor Triage View
              </button>
              <button
                type="button"
                className={`btn-persona ${effectiveRole === "staff" ? "active" : ""}`}
                onClick={() => setCurrentView("staff")}
              >
                Staff Screening View
              </button>
              <button
                type="button"
                className={`btn-persona ${effectiveRole === "patient" ? "active" : ""}`}
                onClick={() => setCurrentView("patient")}
              >
                Patient Portal View
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="app-main-content">
        {effectiveRole === "staff" && (
          <StaffDashboard token={token} onLogout={handleLogout} />
        )}

        {effectiveRole === "doctor" && (
          <DoctorDashboard token={token} />
        )}

        {effectiveRole === "patient" && (
          <PatientDashboard token={token} />
        )}

        {effectiveRole === "admin" && (
          <AdminDashboard token={token} />
        )}
      </main>

      <footer className="site-footer no-print">
        <div className="footer-content">
          <div className="footer-left">
            <strong>VisionX-DR Retinal Screening Platform</strong>
            <span>Multi-Tier Healthcare Workflow • Grad-CAM Explainability • PyTorch EfficientNet-B0</span>
          </div>
          <div className="footer-right">
            <span>Clinical Teleophthalmology System v2.0.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;