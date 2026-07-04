import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  useNavigate,
  useParams,
  NavLink,
} from "react-router-dom";
import "../../styles/BatchSidebar.css";

const BASE = "https://dwfjhagcg1.execute-api.ap-south-1.amazonaws.com/default";

const RING_RADIUS = 20;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS; // ≈ 125.66

const getToken = () => localStorage.getItem("token");

const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

// Map raw API/HTTP errors to friendly, non-leaky messages
const friendlyError = (err) => {
  if (err?.message?.includes("404")) return "Batch not found.";
  if (err?.message?.includes("401") || err?.message?.includes("403")) {
    return "You don't have access to this batch.";
  }
  if (err?.message?.includes("500")) return "Server error. Please try again.";
  return "Failed to load batch data. Please try again.";
};

export default function BatchSidebar() {
  const navigate = useNavigate();
  const { batchId } = useParams();

  const [batch, setBatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [studentCount, setStudentCount] = useState(0);
  const [testCount, setTestCount] = useState(0);

  const abortControllerRef = useRef(null);

  const fetchBatch = useCallback(async () => {
    if (!batchId) {
      setError("No batch ID provided");
      setLoading(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${BASE}/batch/${batchId}`, {
        headers: authHeaders(),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setBatch(data.batch);
        setStudentCount(data.batch?.studentCount || 0);
        setTestCount(data.batch?.testCount || 0);
      } else {
        throw new Error(data.message || "Failed to fetch batch data");
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Error fetching batch:", err);
        setError(friendlyError(err));
      }
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    fetchBatch();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchBatch]);

  const toggleSidebar = () => setCollapsed((prev) => !prev);

  const menuItems = useMemo(
    () => [
      {
        title: "Batch Details",
        icon: "▶",
        path: `/batch/${batchId}`,
        description: "View batch information",
      },
      {
        title: "Rank List",
        icon: "▲",
        path: `/batch/${batchId}/rank-list`,
        description: "Student rankings",
      },
      {
        title: "Create Test",
        icon: "◆",
        path: `/batch/${batchId}/create-test`,
        description: "Design new assessment",
      },
      {
        title: "Test List",
        icon: "≡",
        path: `/batch/${batchId}/tests`,
        description: "All batch tests",
        badge: testCount > 0 ? testCount.toString() : null,
      },
      {
        title: "Syllabus",
        icon: "✎",
        path: `/batch/${batchId}/syllabus`,
        description: "View syllabus",
      },
      {
        title: "Students",
        icon: "⊙",
        path: `/batch/${batchId}/students`,
        description: "Enrolled students",
        badge: studentCount > 0 ? studentCount.toString() : null,
      },
      {
        title: "Analytics",
        icon: "⧫",
        path: `/batch/${batchId}/analytics`,
        description: "Performance insights",
      },
    ],
    [batchId, testCount, studentCount]
  );

  const completionPercent = batch?.completionRate != null
    ? Math.max(0, Math.min(batch.completionRate, 100))
    : null;
  const ringFillLength = completionPercent != null
    ? (completionPercent / 100) * RING_CIRCUMFERENCE
    : 0;

  const statusLabel = batch?.status || "Active";
  const statusModifier = statusLabel.toLowerCase();

  if (loading) {
    return (
      <aside className="vr-sidebar loading">
        <div className="vr-loading-spinner">
          <span className="vr-spinner"></span>
          <p>Loading...</p>
        </div>
      </aside>
    );
  }

  if (error) {
    return (
      <aside className="vr-sidebar error">
        <div className="vr-error-message">
          <span className="vr-error-icon">⚠️</span>
          <p>{error}</p>
          <button onClick={fetchBatch} className="vr-retry-btn">
            Retry
          </button>
        </div>
      </aside>
    );
  }

  return (
    <>
      {/* Mobile Toggle Button - positioned on left */}
      <button
        className="vr-mobile-toggle"
        onClick={toggleSidebar}
        aria-label={collapsed ? "Open sidebar" : "Close sidebar"}
        aria-expanded={!collapsed}
      >
        {collapsed ? "☰" : "✕"}
      </button>

      {/* Overlay for mobile */}
      <div
        className={`vr-overlay ${!collapsed ? "visible" : ""}`}
        onClick={toggleSidebar}
        role="button"
        tabIndex={collapsed ? -1 : 0}
        aria-label="Close sidebar overlay"
        aria-hidden={collapsed}
      />

      {/* Sidebar */}
      <aside
        className={`vr-sidebar ${collapsed ? "collapsed" : "expanded"}`}
        aria-label="Batch navigation sidebar"
      >
        {/* Header Section */}
        <div className="vr-header">
          <div className="vr-brand">
            {!collapsed ? (
              <div className="vr-brand-content">
                <span className="vr-brand-icon">⚡</span>
                <h2 className="vr-brand-title">VeriRank</h2>
              </div>
            ) : (
              <span className="vr-brand-icon-small">⚡</span>
            )}
          </div>

          {/* Collapse/Expand button - only show when expanded */}
          {!collapsed && (
            <button
              className="vr-collapse-btn"
              onClick={toggleSidebar}
              aria-label="Collapse sidebar"
            >
              ←
            </button>
          )}
        </div>

        {/* Batch Info Card - only when expanded */}
        {!collapsed && batch && (
          <div className="vr-batch-card" aria-label="Batch information">
            <div className="vr-batch-header">
              <span className="vr-batch-icon" aria-hidden="true">📚</span>
              <span className={`vr-batch-status vr-batch-status--${statusModifier}`}>
                {statusLabel}
              </span>
            </div>
            <div className="vr-batch-info">
              <h3 className="vr-batch-name">{batch.batchName || "Unnamed Batch"}</h3>
              <div className="vr-batch-meta">
                <span className="vr-meta-item">
                  <span className="vr-meta-icon" aria-hidden="true">👥</span>
                  {studentCount} Students
                </span>
                <span className="vr-meta-item">
                  <span className="vr-meta-icon" aria-hidden="true">📅</span>
                  {batch.createdAt?.split("T")[0] || "N/A"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Progress Ring - only when expanded */}
        {!collapsed && completionPercent != null && (
          <div className="vr-progress-section" role="status" aria-label={`Course progress: ${completionPercent}%`}>
            <div className="vr-progress-ring">
              <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
                <circle
                  cx="24"
                  cy="24"
                  r={RING_RADIUS}
                  fill="none"
                  className="vr-ring-bg"
                  strokeWidth="4"
                />
                <circle
                  cx="24"
                  cy="24"
                  r={RING_RADIUS}
                  fill="none"
                  className="vr-ring-fg"
                  strokeWidth="4"
                  strokeDasharray={`${ringFillLength} ${RING_CIRCUMFERENCE}`}
                  strokeLinecap="round"
                  transform="rotate(-90 24 24)"
                />
              </svg>
              <span className="vr-progress-text">{completionPercent}%</span>
            </div>
            <div className="vr-progress-label">Progress</div>
          </div>
        )}

        {/* Navigation Menu */}
        <nav className="vr-menu" aria-label="Batch sections">
          <ul>
            {menuItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end
                  className={({ isActive }) =>
                    `vr-menu-item ${isActive ? "active" : ""} ${collapsed ? "collapsed" : ""}`
                  }
                >
                  <span className="vr-menu-icon" aria-hidden="true">{item.icon}</span>

                  {!collapsed && (
                    <>
                      <div className="vr-menu-content">
                        <span className="vr-menu-title">{item.title}</span>
                        <span className="vr-menu-desc">{item.description}</span>
                      </div>
                      {item.badge && (
                        <span className="vr-badge" aria-label={`${item.badge} items`}>
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}

                  {/* Tooltip for collapsed state */}
                  {collapsed && (
                    <div className="vr-tooltip" role="tooltip">
                      {item.title}
                    </div>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer Section */}
        <div className="vr-footer">
          {!collapsed ? (
            <button
              className="vr-back-btn"
              onClick={() => navigate("/home")}
              aria-label="Go back to Home"
            >
              <span className="vr-back-icon" aria-hidden="true">←</span>
              Back to Home
            </button>
          ) : (
            <div className="vr-footer-collapsed">
              <button
                className="vr-back-btn-icon"
                onClick={() => navigate("/home")}
                aria-label="Go back to Home"
              >
                🏠
              </button>
              {/* Add expand button when collapsed */}
              <button
                className="vr-expand-btn"
                onClick={toggleSidebar}
                aria-label="Expand sidebar"
              >
                →
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}