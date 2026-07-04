import React, { useState, useEffect, useCallback } from "react";
import "../../styles/TestDetailsPage.css";
import { useParams, useNavigate } from "react-router-dom";

// ─── API endpoints ────────────────────────────────────────────────────────────
const TEST_INFO_URL =
  "https://z6hfbdtza0.execute-api.ap-south-1.amazonaws.com/default/Get_test_by_testId";
const CHECK_QUESTIONS_READY_URL =
  "https://6mgkhsbr1a.execute-api.ap-south-1.amazonaws.com/default/CheckQeustionReady";
const TOGGLE_VISIBILITY_URL =
  "https://z6hfbdtza0.execute-api.ap-south-1.amazonaws.com/default/PublishTest";

// ─── Utility: parse URLs in text into anchor tags ─────────────────────────────
const parseLinksInText = (text) => {
  if (!text) return text;
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const parts = text.split(urlRegex);
  return parts.map((part, i) =>
    urlRegex.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer">
        {part}
      </a>
    ) : (
      part
    )
  );
};

// ─── Utility: parse date + time strings into a JS Date ───────────────────────
const parseTestStartDate = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return null;
  let normDate = dateStr.trim();
  const dmyMatch = normDate.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    normDate = `${dmyMatch[3]}-${dmyMatch[2].padStart(2, "0")}-${dmyMatch[1].padStart(2, "0")}`;
  }
  const d = new Date(`${normDate} ${timeStr.trim()}`);
  return isNaN(d.getTime()) ? null : d;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Spinner for loading states */
const Spinner = ({ size = 20 }) => (
  <span
    className="tdp-spinner"
    style={{ width: size, height: size }}
    aria-hidden="true"
  />
);

/** Status pill badge */
const StatusBadge = ({ status }) => {
  if (!status) return null;
  const key = status.toLowerCase();
  return (
    <span className={`tdp-badge tdp-badge--${key}`} role="status">
      {status}
    </span>
  );
};

/** Inline confirm modal */
const ConfirmDialog = ({ title, children, onConfirm, onCancel, loading }) => (
  <div
    className="tdp-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="confirm-title"
    onClick={onCancel}
  >
    <div className="tdp-dialog" onClick={(e) => e.stopPropagation()}>
      <div className="tdp-dialog__header">
        <h2 id="confirm-title" className="tdp-dialog__title">
          {title}
        </h2>
        <button
          className="tdp-icon-btn"
          onClick={onCancel}
          aria-label="Close dialog"
        >
          ✕
        </button>
      </div>
      <div className="tdp-dialog__body">{children}</div>
      <div className="tdp-dialog__footer">
        <button
          className="tdp-btn tdp-btn--primary"
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? (
            <>
              <Spinner size={14} /> Processing…
            </>
          ) : (
            "Confirm"
          )}
        </button>
        <button className="tdp-btn tdp-btn--ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  </div>
);

/** Expandable text overlay (description / instruction) */
const ExpandedOverlay = ({ title, content, onClose, onCopy, extraLinks }) => (
  <div
    className="tdp-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="expanded-title"
    onClick={onClose}
  >
    <div className="tdp-dialog tdp-dialog--wide" onClick={(e) => e.stopPropagation()}>
      <div className="tdp-dialog__header">
        <h2 id="expanded-title" className="tdp-dialog__title">
          {title}
        </h2>
        <button
          className="tdp-icon-btn"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
      </div>
      <div className="tdp-dialog__body tdp-dialog__body--scroll">
        {parseLinksInText(content)}
      </div>
      <div className="tdp-dialog__footer">
        <button className="tdp-btn tdp-btn--ghost" onClick={onCopy}>
          Copy text
        </button>
        {extraLinks && (
          <button className="tdp-btn tdp-btn--ghost" onClick={extraLinks}>
            Open links
          </button>
        )}
        <button className="tdp-btn tdp-btn--primary" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  </div>
);

/** Toast notification */
const Toast = ({ result, onDismiss }) => {
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [result, onDismiss]);

  if (!result) return null;

  return (
    <div
      className={`tdp-toast tdp-toast--${result.success ? "success" : "error"}`}
      role="alert"
      aria-live="assertive"
    >
      <span className="tdp-toast__icon">{result.success ? "✓" : "✕"}</span>
      <span className="tdp-toast__msg">{result.message}</span>
      <button
        className="tdp-icon-btn tdp-icon-btn--sm"
        onClick={onDismiss}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
};

/** Single vitals metric tile */
const VitalTile = ({ icon, label, value, accent }) => (
  <div className={`tdp-vital ${accent ? "tdp-vital--accent" : ""}`}>
    <span className="tdp-vital__icon" aria-hidden="true">
      {icon}
    </span>
    <div className="tdp-vital__body">
      <span className="tdp-vital__value">{value}</span>
      <span className="tdp-vital__label">{label}</span>
    </div>
  </div>
);

/** Info row inside a card */
const InfoRow = ({ label, children }) => (
  <div className="tdp-info-row">
    <dt className="tdp-info-row__label">{label}</dt>
    <dd className="tdp-info-row__value">{children}</dd>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const TestDetailsPage = () => {
  const { testId } = useParams();
  const navigate = useNavigate();

  // Data
  const [testDetails, setTestDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  // UI state
  const [expandedCard, setExpandedCard] = useState(null); // 'description' | 'instruction'
  const [showCheckConfirm, setShowCheckConfirm] = useState(false);
  const [showVisibilityConfirm, setShowVisibilityConfirm] = useState(false);

  // Async operation state
  const [checkingQuestions, setCheckingQuestions] = useState(false);
  const [togglingVisibility, setTogglingVisibility] = useState(false);
  const [toastResult, setToastResult] = useState(null);

  // Countdown
  const [countdown, setCountdown] = useState("");

  // ── Derived flags ──────────────────────────────────────────────────────────
  const isFrozen =
    testDetails?.questionsReady === true || testDetails?.allowEdit === false;

  const canEdit = testDetails && !isFrozen;

  const visibilityDisabled =
    togglingVisibility ||
    (testDetails?.visibility !== "public" && !testDetails?.questionsReady);

  const visibilityHint =
    testDetails?.visibility !== "public" && !testDetails?.questionsReady
      ? "Questions must be ready before making this test public"
      : undefined;

  // ── Load test info ─────────────────────────────────────────────────────────
  const loadTestInfo = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError("");
      const token = localStorage.getItem("token");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(TEST_INFO_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ testId }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.success) {
        setTestDetails(data.data);
        setToastResult(null);
      } else {
        throw new Error(data.message || "Failed to fetch test details");
      }
    } catch (err) {
      setLoadError(
        err.name === "AbortError"
          ? "Request timed out — please try again"
          : err.message || "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  }, [testId]);

  useEffect(() => {
    if (testId) loadTestInfo();
    else setLoadError("No test ID provided in the URL");
  }, [testId, loadTestInfo]);

  // ── Countdown timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!testDetails?.dateOfPublish || !testDetails?.startTime) return;
    const target = parseTestStartDate(
      testDetails.dateOfPublish,
      testDetails.startTime
    );
    if (!target) {
      setCountdown("Invalid date/time");
      return;
    }

    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        setCountdown("—");
        return;
      }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      const parts = [];
      if (d > 0) parts.push(`${d}d`);
      parts.push(`${String(h).padStart(2, "0")}h`);
      parts.push(`${String(m).padStart(2, "0")}m`);
      parts.push(`${String(s).padStart(2, "0")}s`);
      setCountdown(parts.join(" "));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [testDetails?.dateOfPublish, testDetails?.startTime]);

  // ── Check questions ready ──────────────────────────────────────────────────
  const checkQuestionsReady = async () => {
    if (testDetails?.questionsReady) return;
    try {
      setCheckingQuestions(true);
      setToastResult(null);
      const token = localStorage.getItem("token");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(CHECK_QUESTIONS_READY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ testId }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status}: ${txt}`);
      }
      const data = await res.json();
      const ok = data.success || data.status === "success";

      if (ok) {
        await loadTestInfo();
        setToastResult({ success: true, message: "Questions verified — test is now frozen." });
      } else {
        setToastResult({
          success: false,
          message: data.message || data.msg || "Questions are not ready yet.",
        });
      }
    } catch (err) {
      setToastResult({
        success: false,
        message:
          err.name === "AbortError"
            ? "Request timed out"
            : err.message || "Failed to verify questions",
      });
    } finally {
      setCheckingQuestions(false);
    }
  };

  // ── Toggle visibility ──────────────────────────────────────────────────────
  const toggleVisibility = async () => {
    try {
      setTogglingVisibility(true);
      const token = localStorage.getItem("token");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      // Determine the action based on current visibility
      const action = testDetails?.visibility === "public" ? "private" : "public";

      const res = await fetch(TOGGLE_VISIBILITY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ 
          testId, 
          action 
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status}: ${txt}`);
      }
      const data = await res.json();

      if (data.success) {
        await loadTestInfo();
        setToastResult({
          success: true,
          message: `Test is now ${data.visibility || action}.`,
        });
      } else {
        setToastResult({
          success: false,
          message: data.message || "Failed to change visibility",
        });
      }
    } catch (err) {
      setToastResult({
        success: false,
        message:
          err.name === "AbortError"
            ? "Request timed out"
            : err.message || "Network error",
      });
    } finally {
      setTogglingVisibility(false);
      setShowVisibilityConfirm(false);
    }
  };

  // ── Render: loading ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="tdp-screen-center">
        <Spinner size={36} />
        <p className="tdp-loading-label">Loading test details…</p>
      </div>
    );
  }

  // ── Render: error ──────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="tdp-screen-center">
        <span className="tdp-error-icon" aria-hidden="true">⚠</span>
        <h2 className="tdp-screen-heading">Unable to load test</h2>
        <p className="tdp-screen-sub">{loadError}</p>
        <button className="tdp-btn tdp-btn--primary" onClick={loadTestInfo}>
          Retry
        </button>
      </div>
    );
  }

  // ── Render: empty ──────────────────────────────────────────────────────────
  if (!testDetails) {
    return (
      <div className="tdp-screen-center">
        <span className="tdp-error-icon" aria-hidden="true">📭</span>
        <h2 className="tdp-screen-heading">No test found</h2>
        <p className="tdp-screen-sub">We couldn't find a test with this ID.</p>
        <button className="tdp-btn tdp-btn--ghost" onClick={() => navigate(-1)}>
          Go back
        </button>
      </div>
    );
  }

  const isPublic = testDetails.visibility === "public";

  // ── Render: main ───────────────────────────────────────────────────────────
  return (
    <main className="tdp-root">

      {/* ── Toast ────────────────────────────────────────────────────────────── */}
      <Toast result={toastResult} onDismiss={() => setToastResult(null)} />

      {/* ── Check-questions confirm dialog ────────────────────────────────────── */}
      {showCheckConfirm && (
        <ConfirmDialog
          title="Freeze test?"
          onConfirm={() => {
            setShowCheckConfirm(false);
            checkQuestionsReady();
          }}
          onCancel={() => setShowCheckConfirm(false)}
          loading={checkingQuestions}
        >
          <p>
            This will verify that all questions are loaded and{" "}
            <strong>permanently freeze the test</strong> — no further edits
            will be possible after this point.
          </p>
        </ConfirmDialog>
      )}

      {/* ── Visibility confirm dialog ─────────────────────────────────────────── */}
      {showVisibilityConfirm && (
        <ConfirmDialog
          title={isPublic ? "Make test private?" : "Publish test?"}
          onConfirm={toggleVisibility}
          onCancel={() => setShowVisibilityConfirm(false)}
          loading={togglingVisibility}
        >
          {isPublic ? (
            <p>Students will no longer be able to see or access this test.</p>
          ) : (
            <p>
              This test will become visible to all enrolled students immediately.
              Questions are verified, so this is safe to publish.
            </p>
          )}
        </ConfirmDialog>
      )}

      {/* ── Expanded text dialog ──────────────────────────────────────────────── */}
      {expandedCard && (
        <ExpandedOverlay
          title={expandedCard === "description" ? "Description" : "Instructions"}
          content={
            expandedCard === "description"
              ? testDetails.description
              : testDetails.instruction
          }
          onClose={() => setExpandedCard(null)}
          onCopy={() => {
            const text =
              expandedCard === "description"
                ? testDetails.description
                : testDetails.instruction;
            navigator.clipboard?.writeText(text);
          }}
          extraLinks={
            expandedCard === "description" &&
            testDetails.description?.includes("http")
              ? () => {
                  const urls =
                    testDetails.description.match(/https?:\/\/[^\s]+/gi) || [];
                  urls.forEach((u) => window.open(u, "_blank"));
                }
              : undefined
          }
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* PAGE HEADER                                                          */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <header className="tdp-header">
        <div className="tdp-header__left">
          <button
            type="button"
            className="tdp-btn tdp-btn--ghost tdp-btn--sm"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            ← Back
          </button>
          <div className="tdp-header__title-group">
            <h1 className="tdp-header__title">{testDetails.testName}</h1>
            <div className="tdp-header__meta">
              <code className="tdp-header__id">{testDetails.testId}</code>
            </div>
          </div>
        </div>

        <nav className="tdp-header__actions" aria-label="Test actions">
          {/* View questions — always available */}
          <button
            className="tdp-btn tdp-btn--ghost"
            onClick={() => navigate(`/test/question/${testId}`)}
          >
            View Questions
          </button>

          {/* Question Analytics — always available */}
          <button
            className="tdp-btn tdp-btn--ghost"
            onClick={() => navigate(`/test/analytics/${testId}`)}
          >
            Analytics
          </button>

          {/* Create/Edit questions — only when not frozen */}
          {!isFrozen && (
            <button
              className="tdp-btn tdp-btn--secondary"
              onClick={() => {
                if (!canEdit) {
                  setToastResult({
                    success: false,
                    message: "Editing is disabled — questions are already ready.",
                  });
                  return;
                }
                navigate(`/Questioncreate/${testDetails.testId}`);
              }}
              disabled={!canEdit}
              title={!canEdit ? "Editing disabled" : undefined}
            >
              Edit Questions
            </button>
          )}

          {/* Freeze test — only when not frozen */}
          {!isFrozen && (
            <button
              className="tdp-btn tdp-btn--warning"
              onClick={() => !checkingQuestions && !testDetails.questionsReady && setShowCheckConfirm(true)}
              disabled={checkingQuestions || testDetails.questionsReady === true}
              title={testDetails.questionsReady ? "Already frozen" : undefined}
            >
              {checkingQuestions ? (
                <>
                  <Spinner size={13} /> Verifying…
                </>
              ) : testDetails.questionsReady ? (
                "Questions Ready"
              ) : (
                "Freeze Test"
              )}
            </button>
          )}

          {/* Publish / Unpublish — always rendered */}
          <button
            className={`tdp-btn ${isPublic ? "tdp-btn--secondary" : "tdp-btn--primary"}`}
            onClick={() => !visibilityDisabled && setShowVisibilityConfirm(true)}
            disabled={visibilityDisabled}
            title={visibilityHint}
          >
            {togglingVisibility ? (
              <>
                <Spinner size={13} /> Saving…
              </>
            ) : isPublic ? (
              "Unpublish"
            ) : (
              "Publish"
            )}
          </button>
        </nav>
      </header>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* VITALS STRIP                                                         */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <section className="tdp-vitals" aria-label="Test overview">
        <VitalTile
          icon="📝"
          label="Questions"
          value={testDetails.totalQuestions ?? testDetails.questionCount ?? "—"}
        />
        <VitalTile icon="⭐" label="Total Marks" value={testDetails.totalMarks ?? "—"} />
        <VitalTile
          icon="⏱"
          label="Duration"
          value={
            testDetails.duration
              ? `${Number(testDetails.duration).toFixed(0)} min`
              : "—"
          }
        />
        <div className="tdp-vitals__divider" aria-hidden="true" />
        <div className="tdp-vitals__countdown">
          <span className="tdp-vitals__countdown-value">
            {countdown || "—"}
          </span>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* CONTENT GRID                                                         */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <div className="tdp-grid">

        {/* ── Card: Basic Information ────────────────────────────────────── */}
        <section className="tdp-card" aria-labelledby="card-basic">
          <h2 id="card-basic" className="tdp-card__heading">
            Basic Information
          </h2>
          <dl className="tdp-info-list">
            <InfoRow label="Test Type">{testDetails.testType || "—"}</InfoRow>
            <InfoRow label="Batch ID">{testDetails.batchId || "—"}</InfoRow>
            <InfoRow label="Visibility">
              <span className="tdp-info-row__inline">
                <span
                  className={`tdp-badge ${
                    isPublic ? "tdp-badge--active" : "tdp-badge--inactive"
                  }`}
                >
                  {isPublic ? "Public" : "Private"}
                </span>
                <button
                  className="tdp-btn tdp-btn--ghost tdp-btn--xs"
                  onClick={() =>
                    !visibilityDisabled && setShowVisibilityConfirm(true)
                  }
                  disabled={visibilityDisabled}
                  title={visibilityHint}
                >
                  {togglingVisibility
                    ? "Saving…"
                    : isPublic
                    ? "Make Private"
                    : "Make Public"}
                </button>
              </span>
              {visibilityHint && (
                <span className="tdp-info-row__hint">{visibilityHint}</span>
              )}
            </InfoRow>
          </dl>
        </section>

        {/* ── Card: Timing ──────────────────────────────────────────────── */}
        <section className="tdp-card" aria-labelledby="card-timing">
          <h2 id="card-timing" className="tdp-card__heading">
            Schedule
          </h2>
          <dl className="tdp-info-list">
            <InfoRow label="Publish Date">
              {testDetails.dateOfPublish || "—"}
            </InfoRow>
            <InfoRow label="Start Time">{testDetails.startTime || "—"}</InfoRow>
            <InfoRow label="End Time">{testDetails.endTime || "—"}</InfoRow>
          </dl>
        </section>

        {/* ── Card: Marks ───────────────────────────────────────────────── */}
        <section className="tdp-card" aria-labelledby="card-marks">
          <h2 id="card-marks" className="tdp-card__heading">
            Marks
          </h2>
          <div className="tdp-marks-grid" role="list">
            <div className="tdp-mark tdp-mark--positive" role="listitem">
              <span className="tdp-mark__label">Correct</span>
              <span className="tdp-mark__value">
                +{testDetails.positiveMarks}
              </span>
            </div>
            <div className="tdp-mark tdp-mark--negative" role="listitem">
              <span className="tdp-mark__label">Incorrect</span>
              <span className="tdp-mark__value">
                −{testDetails.negativeMarks}
              </span>
            </div>
            <div className="tdp-mark tdp-mark--neutral" role="listitem">
              <span className="tdp-mark__label">Skipped</span>
              <span className="tdp-mark__value">
                {testDetails.unansweredMarks}
              </span>
            </div>
          </div>
        </section>

        {/* ── Card: Questions ───────────────────────────────────────────── */}
        <section className="tdp-card" aria-labelledby="card-questions">
          <h2 id="card-questions" className="tdp-card__heading">
            Questions
          </h2>
          <dl className="tdp-info-list">
            <InfoRow label="Total Count">
              {testDetails.questionCount ?? testDetails.totalQuestions ?? "—"}
            </InfoRow>
            <InfoRow label="Edit Lock">
              {isFrozen ? (
                <span className="tdp-badge tdp-badge--frozen">Frozen</span>
              ) : (
                <span className="tdp-badge tdp-badge--inactive">Unlocked</span>
              )}
            </InfoRow>
          </dl>
        </section>

        {/* ── Card: Description (full-width) ────────────────────────────── */}
        <section className="tdp-card tdp-card--full" aria-labelledby="card-desc">
          <h2 id="card-desc" className="tdp-card__heading">
            Description
          </h2>
          <button
            type="button"
            className="tdp-expandable"
            onClick={() => setExpandedCard("description")}
            aria-label="Expand description"
          >
            <span className="tdp-expandable__text">
              {parseLinksInText(testDetails.description) || (
                <em className="tdp-muted">No description provided</em>
              )}
            </span>
            <span className="tdp-expandable__cta" aria-hidden="true">
              Expand ↗
            </span>
          </button>
        </section>

        {/* ── Card: Instructions (full-width) ───────────────────────────── */}
        <section className="tdp-card tdp-card--full" aria-labelledby="card-inst">
          <h2 id="card-inst" className="tdp-card__heading">
            Instructions
          </h2>
          <button
            type="button"
            className="tdp-expandable"
            onClick={() => setExpandedCard("instruction")}
            aria-label="Expand instructions"
          >
            <span className="tdp-expandable__text">
              {parseLinksInText(testDetails.instruction) || (
                <em className="tdp-muted">No instructions provided</em>
              )}
            </span>
            <span className="tdp-expandable__cta" aria-hidden="true">
              Expand ↗
            </span>
          </button>
        </section>

        {/* ── Card: Topics (full-width) ──────────────────────────────────── */}
        <section className="tdp-card tdp-card--full" aria-labelledby="card-topics">
          <h2 id="card-topics" className="tdp-card__heading">
            Topics
          </h2>
          {testDetails.selectedTopics?.length > 0 ? (
            <ul className="tdp-topics" aria-label="Selected topics">
              {testDetails.selectedTopics.map((topic, i) => (
                <li key={i} className="tdp-topic-tag">
                  {topic}
                </li>
              ))}
            </ul>
          ) : (
            <p className="tdp-muted">No topics selected for this test.</p>
          )}
        </section>
      </div>
    </main>
  );
};

export default TestDetailsPage;