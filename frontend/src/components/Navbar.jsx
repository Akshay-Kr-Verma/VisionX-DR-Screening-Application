import React, { useState } from "react";
import { Eye, LogOut, User, Shield, Stethoscope, ClipboardList, ChevronDown, Check } from "lucide-react";

export default function Navbar({
  user,
  onLogout,
  onQuickSwitchRole,
  activeRole
}) {
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  const roleBadges = {
    admin: { label: "System Admin", color: "badge-admin", icon: Shield },
    doctor: { label: "Doctor / Retina Specialist", color: "badge-doctor", icon: Stethoscope },
    staff: { label: "Screening Staff", color: "badge-staff", icon: ClipboardList },
    patient: { label: "Patient Portal", color: "badge-patient", icon: User },
  };

  const currentRoleConfig = roleBadges[user?.role] || roleBadges.patient;
  const RoleIcon = currentRoleConfig.icon;

  const demoAccounts = [
    { role: "doctor", title: "Dr. Sarah Chen, MD", sub: "Doctor Triage & Clinical Notes" },
    { role: "staff", title: "Alex Miller", sub: "Patient Registration & Fundus Upload" },
    { role: "patient", title: "John Doe", sub: "Patient History & Report Download" },
    { role: "admin", title: "System Administrator", sub: "User Management & System Analytics" },
  ];

  const handleSelectRole = (role) => {
    setShowRoleMenu(false);
    if (onQuickSwitchRole) {
      onQuickSwitchRole(role);
    }
  };

  return (
    <header className="site-header">
      <div className="header-inner">
        {/* BRAND */}
        <div className="brand-group">
          <div className="brand-logo-icon">
            <Eye size={22} className="logo-svg" />
          </div>
          <div className="brand-titles">
            <span className="brand-name">VisionX-DR</span>
            <span className="brand-tagline">Retinal Screening & Teleophthalmology</span>
          </div>
        </div>

        {/* ACTIONS & USER BAR */}
        <div className="header-user-controls">
          {/* QUICK DEMO SWITCHER */}
          <div className="quick-switch-dropdown-container">
            <button
              type="button"
              className="btn-quick-switch"
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              title="Switch demo account to preview different roles"
            >
              <RoleIcon size={16} />
              <span className="switch-label">Switch Role Demo</span>
              <ChevronDown size={14} />
            </button>

            {showRoleMenu && (
              <div className="role-dropdown-menu">
                <div className="dropdown-header">
                  <span>Switch Role Persona</span>
                </div>
                {demoAccounts.map((acc) => (
                  <button
                    key={acc.role}
                    type="button"
                    className={`dropdown-item ${user?.role === acc.role ? "active-role" : ""}`}
                    onClick={() => handleSelectRole(acc.role)}
                  >
                    <div className="item-left">
                      <span className={`role-dot dot-${acc.role}`}></span>
                      <div>
                        <strong>{acc.title}</strong>
                        <small>{acc.sub}</small>
                      </div>
                    </div>
                    {user?.role === acc.role && <Check size={16} className="item-check" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ACTIVE USER BADGE */}
          <div className="user-profile-badge">
            <div className="user-avatar-circle">
              {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="user-text-info">
              <span className="user-display-name">{user?.name}</span>
              <span className={`role-pill ${currentRoleConfig.color}`}>
                <RoleIcon size={12} /> {currentRoleConfig.label}
              </span>
            </div>
          </div>

          {/* LOGOUT */}
          <button
            type="button"
            className="btn-logout"
            onClick={onLogout}
            title="Log out"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
