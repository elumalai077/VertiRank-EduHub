EditTestDetails.jsx
import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "../../styles/CreateTest.css";

const TEST_API_URL =
  "https://z6hfbdtza0.execute-api.ap-south-1.amazonaws.com/default/test";
const GET_TEST_API_URL =
  "https://z6hfbdtza0.execute-api.ap-south-1.amazonaws.com/default/Get_test_by_testId";
const SYLLABUS_API_URL =
  "https://j4i5uu85vb.execute-api.ap-south-1.amazonaws.com/dev/syllabus";
const TEST_TYPES = [
  { value: "unit", label: "Unit Test", icon: "📋" },
  { value: "revision", label: "Revision", icon: "🔁" },

];

const STEPS = [
  { id: "basics", label: "Basics", sub: "Name & date" },
  { id: "scoring", label: "Scoring", sub: "Marks & penalties" },
  { id: "schedule", label: "Schedule", sub: "Time & duration" },
  { id: "topics", label: "Topics", sub: "Syllabus coverage" },
  { id: "review", label: "Review", sub: "Confirm & update" },
];

const INIT = {
  testName: "",
  dateOfPublish: "",
  totalQuestions: "",
  totalMarks: "",
  positiveMarks: "",
  negativeMarks: "",
  unansweredMarks: "",
  startTime: "",
  endTime: "",
  duration: "",
  instruction: "",
  description: "",
  testType: "unit",
  selectedTopics: [],
};

/* ── Tiny Toast ─────────────────────────────── */
function Toast({ msg, type, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  const icon = type === "success" ? "✓" : "✕";

  return React.createElement(
    "div",
    { className: `ct-toast ${type}` },
    React.createElement("span", null, icon),
    msg,
  );
}

/* ── Main Component ─────────────────────────── */
export default function EditTestDetails() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [visited, setVisited] = useState(new Set([0]));
  const [form, setForm] = useState(INIT);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [toast, setToast] = useState(null);
  const [syllabus, setSyllabus] = useState(null);
  const [syllLoad, setSyllLoad] = useState(false);
  const [syllErr, setSyllErr] = useState(null);
  const [topics, setTopics] = useState([]);
  const [collapsed, setCollapsed] = useState({});
  const [originalData, setOriginalData] = useState(null);

  const token = () => localStorage.getItem("token");
  const headers = () => ({
    "Content-Type": "application/json",
    token: token(),
  });

  /* ── Fetch test data ── */
  useEffect(() => {
    if (!testId?.trim()) {
      setFetching(false);
      setToast({ msg: "No test ID provided", type: "error" });
      return;
    }

    setFetching(true);
 
    const TEST_API_URL =
      "https://z6hfbdtza0.execute-api.ap-south-1.amazonaws.com/default/Get_test_by_testId";
    fetch(TEST_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token()}`,
       
      },
      body: JSON.stringify({ testId: testId.trim() }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.success)
          throw new Error(data.message || "Failed to fetch test");

        const test = data.data;
        setOriginalData(test);
        console.log("Fetched test data:", test);
        console.log("Mapping test data to form:");
        setForm({
          testName: test.testName || "",
          dateOfPublish: test.dateOfPublish || "",
          totalQuestions: test.totalQuestions?.toString() || "",
          totalMarks: test.totalMarks?.toString() || "",
          positiveMarks: test.positiveMarks?.toString() || "",
          negativeMarks: test.negativeMarks?.toString() || "",
          unansweredMarks: test.unansweredMarks?.toString() || "",
          startTime: test.startTime || "",
          endTime: test.endTime || "",
          duration: test.duration?.toString() || "",
          instruction: test.instruction || "",
          description: test.description || "",
          testType: test.testType || "unit",
          selectedTopics: test.selectedTopics || [],
        });
      })
      .catch((err) => {
        setToast({ msg: err.message || "Error loading test", type: "error" });
      })
      .finally(() => setFetching(false));
  }, [testId]);

  /* ── Fetch syllabus ── */
  useEffect(() => {
    if (originalData?.batchId) {
      loadSyllabus(originalData.batchId);
    }
  }, [originalData]);

  const loadSyllabus = (batchId) => {
    setSyllLoad(true);
    setSyllErr(null);
    fetch(`${SYLLABUS_API_URL}/${batchId.trim()}`, {
      headers: { token: token() },
    })
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) throw new Error(d.message || "Bad syllabus data");
        setSyllabus(d.syllabus);
        const flat = [];
        d.syllabus.units.forEach((u) =>
          u.topics.forEach((t) =>
            flat.push({
              ...t,
              unitName: u.unitName,
              unitWeightage: u.weightage,
            }),
          ),
        );
        setTopics(flat);
      })
      .catch((e) => setSyllErr(e.message))
      .finally(() => setSyllLoad(false));
  };

  /* ── form helpers ── */
  const set = (name, val) => {
    setForm((p) => ({ ...p, [name]: val }));
    if (errors[name]) setErrors((p) => ({ ...p, [name]: "" }));
  };

  const ch = (e) => set(e.target.name, e.target.value);

  const toggleTopic = useCallback((name) => {
    setForm((p) => {
      const cur = p.selectedTopics;
      return {
        ...p,
        selectedTopics: cur.includes(name)
          ? cur.filter((x) => x !== name)
          : [...cur, name],
      };
    });
  }, []);

  const unitTopics = (uName) => topics.filter((t) => t.unitName === uName);
  const unitAllSel = (uName) =>
    unitTopics(uName).every((t) => form.selectedTopics.includes(t.topicName));

  const toggleUnit = (uName) => {
    const uTopics = unitTopics(uName).map((t) => t.topicName);
    const allSel = unitAllSel(uName);
    setForm((p) => ({
      ...p,
      selectedTopics: allSel
        ? p.selectedTopics.filter((t) => !uTopics.includes(t))
        : [...new Set([...p.selectedTopics, ...uTopics])],
    }));
  };

  const toggleAll = () => {
    setForm((p) => ({
      ...p,
      selectedTopics:
        p.selectedTopics.length === topics.length
          ? []
          : topics.map((t) => t.topicName),
    }));
  };

  /* ── validation per step ── */
  const validate = (s) => {
    const e = {};
    if (s === 0) {
      if (!form.testName.trim()) e.testName = "Test name is required";
      if (form.testName.length > 100) e.testName = "Maximum 100 characters";
      if (!form.dateOfPublish) e.dateOfPublish = "Publish date is required";
      if (!form.totalQuestions || +form.totalQuestions < 1)
        e.totalQuestions = "Must be ≥ 1";
      if (!form.totalMarks || +form.totalMarks < 1)
        e.totalMarks = "Must be ≥ 1";
    }
    if (s === 2) {
      if (!form.startTime) e.startTime = "Required";
      if (!form.endTime) e.endTime = "Required";
      if (!form.duration || +form.duration < 1) e.duration = "Must be ≥ 1 min";
    }
    if (s === 3) {
      if (form.selectedTopics.length === 0)
        e.selectedTopics = "Select at least one topic";
    }
    return e;
  };

  const goTo = (idx) => {
    setVisited((p) => new Set([...p, idx]));
    setStep(idx);
  };

  const next = () => {
    const e = validate(step);
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    const nx = Math.min(step + 1, STEPS.length - 1);
    goTo(nx);
  };

  const back = () => {
    setErrors({});
    setStep((p) => Math.max(p - 1, 0));
  };

  const isStepDone = (i) => {
    if (!visited.has(i)) return false;
    return Object.keys(validate(i)).length === 0;
  };

  const progress = (step / (STEPS.length - 1)) * 100;

  /* ── Check if form has changes ── */
  const hasChanges = () => {
    if (!originalData) return false;
    const current = {
      testName: form.testName,
      dateOfPublish: form.dateOfPublish,
      totalQuestions: parseInt(form.totalQuestions) || 0,
      totalMarks: parseInt(form.totalMarks) || 0,
      positiveMarks: parseFloat(form.positiveMarks) || 0,
      negativeMarks: parseFloat(form.negativeMarks) || 0,
      unansweredMarks: parseFloat(form.unansweredMarks) || 0,
      startTime: form.startTime,
      endTime: form.endTime,
      duration: parseInt(form.duration) || 0,
      instruction: form.instruction,
      description: form.description,
      testType: form.testType,
      selectedTopics: [...form.selectedTopics].sort(),
    };
    const original = {
      testName: originalData.testName || "",
      dateOfPublish: originalData.dateOfPublish || "",
      totalQuestions: originalData.totalQuestions || 0,
      totalMarks: originalData.totalMarks || 0,
      positiveMarks: originalData.positiveMarks || 0,
      negativeMarks: originalData.negativeMarks || 0,
      unansweredMarks: originalData.unansweredMarks || 0,
      startTime: originalData.startTime || "",
      endTime: originalData.endTime || "",
      duration: originalData.duration || 0,
      instruction: originalData.instruction || "",
      description: originalData.description || "",
      testType: originalData.testType || "unit",
      selectedTopics: [...(originalData.selectedTopics || [])].sort(),
    };
    return JSON.stringify(current) !== JSON.stringify(original);
  };

  /* ── submit update ── */
  const submit = async () => {
    const allErrors = { ...validate(0), ...validate(2), ...validate(3) };
    setErrors(allErrors);
    if (Object.keys(allErrors).length > 0) {
      setToast({ msg: "Fix the errors before updating", type: "error" });
      return;
    }

    if (!hasChanges()) {
      setToast({ msg: "No changes to update", type: "info" });
      return;
    }

    setLoading(true);
    try {
      const payload = {};

      const fieldMap = {
        testName: form.testName.trim(),
        dateOfPublish: form.dateOfPublish,
        totalQuestions: +form.totalQuestions,
        totalMarks: +form.totalMarks,
        positiveMarks: +form.positiveMarks || 0,
        negativeMarks: +form.negativeMarks || 0,
        unansweredMarks: +form.unansweredMarks || 0,
        startTime: form.startTime,
        endTime: form.endTime,
        duration: +form.duration,
        instruction: form.instruction.trim(),
        description: form.description.trim(),
        testType: form.testType,
        selectedTopics: form.selectedTopics,
        syllabusId: syllabus?.syllabusId || originalData.syllabusId || "",
      };

      Object.keys(fieldMap).forEach((key) => {
        if (fieldMap[key] !== undefined) {
          const originalValue = originalData[key];
          let currentVal = fieldMap[key];
          let origVal = originalValue;

          if (Array.isArray(currentVal)) {
            currentVal = [...currentVal].sort();
            origVal = origVal ? [...origVal].sort() : [];
          }

          if (JSON.stringify(currentVal) !== JSON.stringify(origVal)) {
            payload[key] = fieldMap[key];
          }
        }
      });

      if (Object.keys(payload).length === 0) {
        setToast({ msg: "No changes to update", type: "info" });
        setLoading(false);
        return;
      }

      const r = await fetch(`${TEST_API_URL}/${testId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token(),
        },
        body: JSON.stringify(payload),
      });

      const d = await r.json();

      if (!r.ok || !d.success) {
        throw new Error(d.message || "Failed to update test");
      }

      setToast({ msg: "Test updated successfully!", type: "success" });

      setOriginalData({
        ...originalData,
        ...payload,
      });

      setTimeout(() => navigate(`/tests/${originalData.batchId}`), 2000);
    } catch (err) {
      setToast({ msg: err.message || "Something went wrong", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  /* ── helpers ── */
  const inp = (name, type, label, req = false, opts = {}) => (
    <div className="fg" key={name}>
      <label htmlFor={name}>
        {label}
        {req && <span className="req">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={form[name]}
        onChange={ch}
        placeholder={label}
        className={errors[name] ? "has-error" : ""}
        disabled={loading || fetching}
        {...opts}
      />
      {errors[name] && <span className="field-error">{errors[name]}</span>}
    </div>
  );

  const ta = (name, label, req = false) => (
    <div className="fg" key={name}>
      <label htmlFor={name}>
        {label}
        {req && <span className="req">*</span>}
      </label>
      <textarea
        id={name}
        name={name}
        value={form[name]}
        onChange={ch}
        placeholder={label}
        className={errors[name] ? "has-error" : ""}
        disabled={loading || fetching}
      />
      {errors[name] && <span className="field-error">{errors[name]}</span>}
    </div>
  );

  /* ── Units (for syllabus) ── */
  const units = syllabus?.units || [];

  const renderTopicsPane = () => {
    if (syllLoad)
      return (
        <div className="syllabus-empty">
          <div className="syllabus-empty-icon">⏳</div>
          <h4>Loading syllabus…</h4>
          <p>Fetching topics for this test</p>
        </div>
      );
    if (syllErr)
      return (
        <div className="syllabus-empty">
          <div className="syllabus-empty-icon">⚠️</div>
          <h4>Could not load syllabus</h4>
          <p>{syllErr}</p>
        </div>
      );
    if (!syllabus)
      return (
        <div className="syllabus-empty">
          <div className="syllabus-empty-icon">📚</div>
          <h4>No syllabus found</h4>
          <p>Syllabus will appear here for this test</p>
        </div>
      );

    return (
      <div className="topics-layout">
        <div className="topics-main">
          <div className="topics-toolbar">
            <div className="topics-toolbar-left">
              <h4>Syllabus Topics</h4>
              <span className="topics-count-badge">
                {form.selectedTopics.length} / {topics.length} selected
              </span>
            </div>
            <button type="button" className="btn-ghost" onClick={toggleAll}>
              {form.selectedTopics.length === topics.length
                ? "Deselect all"
                : "Select all"}
            </button>
          </div>

          {errors.selectedTopics && (
            <span
              className="field-error"
              style={{ marginBottom: 10, display: "flex" }}
            >
              {errors.selectedTopics}
            </span>
          )}

          <div className="topics-scroll">
            {units.map((unit, ui) => {
              const uTopics = unitTopics(unit.unitName);
              const selCount = uTopics.filter((t) =>
                form.selectedTopics.includes(t.topicName),
              ).length;
              const allSel = unitAllSel(unit.unitName);
              const open = collapsed[unit.unitName] !== false;

              return (
                <div key={ui} className="unit-block">
                  <div
                    className="unit-head"
                    onClick={() =>
                      setCollapsed((p) => ({ ...p, [unit.unitName]: !open }))
                    }
                  >
                    <div className="unit-head-left">
                      <span className="unit-name">{unit.unitName}</span>
                      <span className="unit-meta">
                        {unit.weightage}% weight
                      </span>
                      <span className="unit-progress">
                        {selCount}/{uTopics.length}
                      </span>
                    </div>
                    <div className="unit-head-right">
                      <button
                        type="button"
                        className={`btn-unit-toggle ${allSel ? "all-selected" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleUnit(unit.unitName);
                        }}
                      >
                        {allSel ? "✓ All selected" : "Select all"}
                      </button>
                      <span className={`unit-chevron ${open ? "open" : ""}`}>
                        ▼
                      </span>
                    </div>
                  </div>

                  {open && (
                    <div className="topic-chips">
                      {uTopics.map((t, ti) => {
                        const sel = form.selectedTopics.includes(t.topicName);
                        return (
                          <label
                            key={ti}
                            className={`topic-chip ${sel ? "selected" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={sel}
                              onChange={() => toggleTopic(t.topicName)}
                              disabled={loading || fetching}
                            />
                            <span className="chip-dot" />
                            {t.topicName}
                            <span className="chip-weight">{t.weightage}%</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  /* ── Summary ── */
  const SummaryRow = ({ label, val }) => (
    <div className="summary-item">
      <div className="summary-item-label">{label}</div>
      <div className="summary-item-value">
        {val || <span style={{ color: "#9CA3AF", fontSize: 12 }}>—</span>}
      </div>
    </div>
  );

  const typeMeta = TEST_TYPES.find((t) => t.value === form.testType);

  /* ── Loading State ── */
  if (fetching) {
    return (
      <div
        className="create-test-container"
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "60vh",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            className="spinner"
            style={{ width: 40, height: 40, margin: "0 auto 20px" }}
          />
          <h3>Loading test...</h3>
          <p style={{ color: "var(--ink-3)" }}>
            Fetching test data for ID: {testId}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="create-test-container">
      {/* ── Left Navigation ── */}
      <nav className="ct-nav">
        <div className="ct-nav-header">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => navigate(-1)}
            aria-label="Go back"
            style={{ marginBottom: 8 }}
          >
            ← Back
          </button>
          <h2>Edit Test</h2>
        </div>

        <div className="ct-nav-steps">
          {STEPS.map((s, i) => {
            const done = isStepDone(i) && i !== step;
            const active = i === step;
            return (
              <React.Fragment key={s.id}>
                <button
                  type="button"
                  className={`ct-step-btn ${active ? "active" : ""} ${done ? "done" : ""}`}
                  onClick={() => goTo(i)}
                >
                  <span className="step-num">
                    <span>{i + 1}</span>
                  </span>
                  <span>
                    <div className="step-label">{s.label}</div>
                    <div className="step-sublabel">{s.sub}</div>
                  </span>
                </button>
                {i < STEPS.length - 1 && <div className="ct-step-connector" />}
              </React.Fragment>
            );
          })}
        </div>
      </nav>

      {/* ── Main Canvas ── */}
      <div className="ct-main">
        {/* top bar */}
        <div className="ct-topbar">
          <div className="ct-topbar-left">
            <h3>{STEPS[step].label}</h3>
            <span>
              Step {step + 1} of {STEPS.length}
            </span>
          </div>
          <span style={{ fontSize: 12, color: "var(--ink-4)" }}>
            {form.testName || "Untitled test"}
            {hasChanges() && (
              <span style={{ color: "var(--warning)", marginLeft: 8 }}>
                • unsaved changes
              </span>
            )}
          </span>
        </div>

        {/* progress */}
        <div className="ct-progress-bar">
          <div className="ct-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        {/* body */}
        <div className="ct-body">
          <div className="ct-panel">
            {/* STEP 0 — Basics */}
            <div className={`step-pane ${step === 0 ? "visible" : ""}`}>
              <p className="pane-title">Test basics</p>
              <p className="pane-subtitle">
                Edit the test name and its initial configuration.
              </p>

              <div className="ct-card">
                <div className="ct-card-title">Identity</div>
                {inp("testName", "text", "Test name", true, { maxLength: 100 })}
                {inp("dateOfPublish", "date", "Publish date", true)}
              </div>

              <div className="ct-card">
                <div className="ct-card-title">Scale</div>
                <div className="grid-2">
                  {inp("totalQuestions", "number", "Questions", true, {
                    min: 1,
                  })}
                  {inp("totalMarks", "number", "Total marks", true, { min: 1 })}
                </div>
              </div>

              <div className="ct-card">
                <div className="ct-card-title">Test type</div>
                <div className="type-cards">
                  {TEST_TYPES.map((t) => (
                    <label
                      key={t.value}
                      className={`type-card ${form.testType === t.value ? "selected" : ""}`}
                    >
                      <input
                        type="radio"
                        name="testType"
                        value={t.value}
                        checked={form.testType === t.value}
                        onChange={ch}
                      />
                      <span className="type-card-icon">{t.icon}</span>
                      <span className="type-card-label">{t.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* STEP 1 — Scoring */}
            <div className={`step-pane ${step === 1 ? "visible" : ""}`}>
              <p className="pane-title">Scoring rules</p>
              <p className="pane-subtitle">
                Define how marks are awarded, deducted, and handled for skipped
                answers.
              </p>

              <div className="ct-card">
                <div className="ct-card-title">Marks per answer</div>
                <div className="grid-3">
                  {inp("positiveMarks", "number", "Correct (+)", false, {
                    min: 0,
                    step: 0.5,
                  })}
                  {inp("negativeMarks", "number", "Wrong (−)", false, {
                    min: 0,
                    step: 0.5,
                  })}
                  {inp("unansweredMarks", "number", "Skipped", false, {
                    step: 0.5,
                  })}
                </div>
                <div
                  style={{
                    marginTop: 12,
                    padding: "10px 12px",
                    background: "var(--surface-2)",
                    borderRadius: "var(--radius-xs)",
                    fontSize: 12,
                    color: "var(--ink-3)",
                    border: "1px solid var(--border)",
                  }}
                >
                  💡 Leave fields at 0 if not applicable. Negative marks are
                  stored as-is (no need to add a minus sign).
                </div>
              </div>
            </div>

            {/* STEP 2 — Schedule */}
            <div className={`step-pane ${step === 2 ? "visible" : ""}`}>
              <p className="pane-title">Schedule</p>
              <p className="pane-subtitle">
                Set when students can access and submit this test.
              </p>

              <div className="ct-card">
                <div className="ct-card-title">Window</div>
                <div className="grid-2">
                  <div className="fg">
                    <label htmlFor="startTime">
                      Start time<span className="req">*</span>
                    </label>
                    <input
                      id="startTime"
                      type="time"
                      name="startTime"
                      value={form.startTime}
                      onChange={ch}
                      className={errors.startTime ? "has-error" : ""}
                      disabled={loading || fetching}
                    />
                    {errors.startTime && (
                      <span className="field-error">{errors.startTime}</span>
                    )}
                  </div>
                  <div className="fg">
                    <label htmlFor="endTime">
                      End time<span className="req">*</span>
                    </label>
                    <input
                      id="endTime"
                      type="time"
                      name="endTime"
                      value={form.endTime}
                      onChange={ch}
                      className={errors.endTime ? "has-error" : ""}
                      disabled={loading || fetching}
                    />
                    {errors.endTime && (
                      <span className="field-error">{errors.endTime}</span>
                    )}
                  </div>
                </div>
                {inp("duration", "number", "Duration (minutes)", true, {
                  min: 1,
                })}
              </div>

              <div className="ct-card">
                <div className="ct-card-title">Additional info</div>
                {ta("instruction", "Instructions for students")}
                {ta("description", "Internal description / notes")}
              </div>
            </div>

            {/* STEP 3 — Topics */}
            <div className={`step-pane ${step === 3 ? "visible" : ""}`}>
              <p className="pane-title">Syllabus coverage</p>
              <p className="pane-subtitle">
                Choose which topics this test will assess. Click a chip to
                toggle it.
              </p>
              {renderTopicsPane()}
            </div>

            {/* STEP 4 — Review */}
            <div className={`step-pane ${step === 4 ? "visible" : ""}`}>
              <p className="pane-title">Review & update</p>
              <p className="pane-subtitle">
                Double-check everything before updating the test.
              </p>

              <div className="ct-card">
                <div className="ct-card-title">Overview</div>
                <div className="summary-grid">
                  <SummaryRow label="Test name" val={form.testName} />
                  <SummaryRow
                    label="Type"
                    val={`${typeMeta?.icon} ${typeMeta?.label}`}
                  />
                  <SummaryRow label="Publish date" val={form.dateOfPublish} />
                  <SummaryRow label="Questions" val={form.totalQuestions} />
                  <SummaryRow label="Total marks" val={form.totalMarks} />
                  <SummaryRow
                    label="Duration"
                    val={form.duration ? `${form.duration} min` : ""}
                  />
                  <SummaryRow
                    label="Window"
                    val={
                      form.startTime && form.endTime
                        ? `${form.startTime} → ${form.endTime}`
                        : ""
                    }
                  />
                  <SummaryRow
                    label="Topics"
                    val={`${form.selectedTopics.length} of ${topics.length}`}
                  />
                </div>
              </div>

              <div className="ct-card">
                <div className="ct-card-title">Scoring</div>
                <div className="summary-grid">
                  <SummaryRow label="Correct" val={form.positiveMarks || "0"} />
                  <SummaryRow label="Wrong" val={form.negativeMarks || "0"} />
                  <SummaryRow
                    label="Skipped"
                    val={form.unansweredMarks || "0"}
                  />
                </div>
              </div>

              {form.instruction && (
                <div className="ct-card">
                  <div className="ct-card-title">Instructions</div>
                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--ink-2)",
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {form.instruction}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Footer Nav ── */}
        <div className="ct-footer">
          <div className="ct-footer-left">
            <button
              type="button"
              className="btn-danger-ghost"
              onClick={() => navigate(`/tests/${originalData?.batchId}`)}
            >
              Cancel
            </button>
            {originalData && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setForm({
                    testName: originalData.testName || "",
                    dateOfPublish: originalData.dateOfPublish || "",
                    totalQuestions:
                      originalData.totalQuestions?.toString() || "",
                    totalMarks: originalData.totalMarks?.toString() || "",
                    positiveMarks: originalData.positiveMarks?.toString() || "",
                    negativeMarks: originalData.negativeMarks?.toString() || "",
                    unansweredMarks:
                      originalData.unansweredMarks?.toString() || "",
                    startTime: originalData.startTime || "",
                    endTime: originalData.endTime || "",
                    duration: originalData.duration?.toString() || "",
                    instruction: originalData.instruction || "",
                    description: originalData.description || "",
                    testType: originalData.testType || "unit",
                    selectedTopics: originalData.selectedTopics || [],
                  });
                  setErrors({});
                  setToast({ msg: "Changes reverted", type: "info" });
                }}
                disabled={!hasChanges()}
              >
                Reset
              </button>
            )}
          </div>
          <div className="ct-footer-right">
            {step > 0 && (
              <button
                type="button"
                className="btn-secondary"
                onClick={back}
                disabled={loading}
              >
                ← Back
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                className="btn-primary"
                onClick={next}
                disabled={loading}
              >
                Continue →
              </button>
            ) : (
              <button
                type="button"
                className="btn-submit"
                onClick={submit}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner" /> Updating…
                  </>
                ) : (
                  "💾 Update test"
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <Toast
          msg={toast.msg}
          type={toast.type}
          onDone={() => setToast(null)}
        />
      )}
    </div>
  );
}