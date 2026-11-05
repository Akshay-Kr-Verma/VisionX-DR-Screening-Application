import React, { useState } from "react";
import { Eye, Stethoscope, ClipboardList, User, Shield, ArrowRight, Lock, Mail, RefreshCw } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export default function Login({ onLogin }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const demoAccounts = [
    {
      role: "doctor",
      name: "Dr. Sarah Chen, MD",
      email: "doctor@visionx.com",
      password: "doctor123",
      title: "Doctor Dashboard",
      desc: "Priority Triage Queue, Grad-CAM, & Diagnosis",
      icon: Stethoscope,
      badgeColor: "demo-badge-doctor"
    },
    {
      role: "staff",
      name: "Alex Miller",
      email: "staff@visionx.com",
      password: "staff123",
      title: "Screening Staff",
      desc: "Register Patients & Upload Retinal Scans",
      icon: ClipboardList,
      badgeColor: "demo-badge-staff"
    },
    {
      role: "patient",
      name: "John Doe",
      email: "patient@visionx.com",
      password: "patient123",
      title: "Patient Portal",
      desc: "View Visits, Prescriptions & Download PDF Reports",
      icon: User,
      badgeColor: "demo-badge-patient"
    },
    {
      role: "admin",
      name: "System Admin",
      email: "admin@visionx.com",
      password: "admin123",
      title: "Admin Dashboard",
      desc: "User Management, Roles & System Analytics",
      icon: Shield,
      badgeColor: "demo-badge-admin"
    }
  ];

  const handleQuickDemoLogin = async (demo) => {
    setEmail(demo.email);
    setPassword(demo.password);
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: demo.email, password: demo.password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Demo login failed");
      }
      onLogin(data.access_token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Authentication failed.");
      }
      onLogin(data.access_token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!registerName.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (registerPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (registerPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: registerName.trim(),
          email: registerEmail.trim(),
          password: registerPassword
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Registration failed.");
      }
      setSuccess("Account created successfully! You may now sign in.");
      setEmail(registerEmail.trim());
      setIsRegistering(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen-wrapper">
      <div className="login-screen-container">
        {/* LEFT / TOP: FORM */}
        <div className="login-form-card">
          <div className="brand-header">
            <div className="login-brand-icon">
              <Eye size={28} />
            </div>
            <div>
              <h2>VisionX-DR</h2>
              <p>AI Retinal Screening & Teleophthalmology Platform</p>
            </div>
          </div>

          <div className="auth-mode-toggle">
            <button
              type="button"
              className={`btn-auth-toggle ${!isRegistering ? "active" : ""}`}
              onClick={() => {
                setIsRegistering(false);
                setError("");
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`btn-auth-toggle ${isRegistering ? "active" : ""}`}
              onClick={() => {
                setIsRegistering(true);
                setError("");
              }}
            >
              Create Patient Account
            </button>
          </div>

          {error && <div className="alert-box alert-error">{error}</div>}
          {success && <div className="alert-box alert-success">{success}</div>}

          {!isRegistering ? (
            <form onSubmit={handleLoginSubmit} className="auth-form">
              <div className="form-group">
                <label>Email Address</label>
                <div className="input-with-icon">
                  <input
                    type="email"
                    placeholder="name@visionx.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <Mail size={16} className={email ? "icon-hidden" : ""} />
                </div>
              </div>

              <div className="form-group">
                <label>Password</label>
                <div className="input-with-icon">
                  <input
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <Lock size={16} className={password ? "icon-hidden" : ""} />
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary-action btn-full"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign In to Portal"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="auth-form">
              <div className="form-group">
                <label>Full Patient Name</label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  placeholder="patient@example.com"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Create Password</label>
                <input
                  type="password"
                  placeholder="Min 6 characters"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Confirm Password</label>
                <input
                  type="password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn-primary-action btn-full"
                disabled={loading}
              >
                {loading ? "Creating Account..." : "Create Account & Get Patient ID"}
              </button>
            </form>
          )}

          <div className="auth-footer-note">
            <span>Enterprise Healthcare Grade • HIPAA & GDPR Aligned Architecture</span>
          </div>
        </div>

        {/* RIGHT / BOTTOM: 1-CLICK DEMO ACCESS CARDS */}
        <div className="login-demo-personas-card">
          <div className="demo-personas-header">
            <span className="demo-eyebrow">Interactive Pair Testing</span>
            <h3>Instant Demo Roles (1-Click Access)</h3>
            <p>
              Click any role persona below to instantly authenticate and evaluate that dashboard's specialized clinical workflows:
            </p>
          </div>

          <div className="demo-cards-grid">
            {demoAccounts.map((d) => {
              const IconComp = d.icon;
              return (
                <div
                  key={d.role}
                  className="demo-persona-item"
                  onClick={() => handleQuickDemoLogin(d)}
                >
                  <div className="demo-item-header">
                    <div className={`demo-avatar ${d.badgeColor}`}>
                      <IconComp size={20} />
                    </div>
                    <span className="demo-persona-title">{d.title}</span>
                  </div>
                  <strong className="demo-person-name">{d.name}</strong>
                  <p className="demo-person-desc">{d.desc}</p>
                  <div className="demo-action-link">
                    <span>Sign in as {d.role.toUpperCase()}</span>
                    <ArrowRight size={14} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
