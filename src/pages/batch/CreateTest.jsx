 import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import "../../styles/CreateTest.css";

const SYLLABUS_API_URL = "https://j4i5uu85vb.execute-api.ap-south-1.amazonaws.com/dev/syllabus";
const TEST_API_URL    = "https://z6hfbdtza0.execute-api.ap-south-1.amazonaws.com/default/test-create";

/* ── Parse text and make URLs clickable with line breaks ── */
const renderTextWithLinks = (text) => {
  if (!text) return text;
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  return text.split("\n").map((line, index, lines) => (
    <React.Fragment key={index}>
      {line.split(urlRegex).map((part, partIndex) => (
        part.match(urlRegex) ? (
          <a
            key={`${index}-${partIndex}`}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-link"
          >
            {part}
          </a>
        ) : (
          <span key={`${index}-${partIndex}`}>{part}</span>
        )
      ))}
      {index < lines.length - 1 && <br />}
    </React.Fragment>
  ));
};

/* ── Expandable textarea field ── */
function ExpandableTextArea({ name, label, value, onChange, disabled, error, showExpand = true }) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(value || "");

  useEffect(() => {
    if (!expanded) {
      setDraft(value || "");
    }
  }, [value, expanded]);

  const open = () => showExpand && setExpanded(true);
  const close = () => setExpanded(false);
  const save = () => {
    onChange({ target: { name, value: draft } });
    setExpanded(false);
  };

  return (
    <div className="fg textarea-field">
      <div className="textarea-field-header">
        <label htmlFor={name}>{label}</label>
        {showExpand && (
          <button type="button" className="expand-btn" onClick={open}>
            Expand
          </button>
        )}
      </div>
      <textarea
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`textarea-input ${error ? "has-error" : ""}`}
        placeholder={label}
      />
      {error && <span className="field-error">{error}</span>}

      {showExpand && expanded && (
        <div className="modal-overlay" onClick={close}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>{label}</h3>
                <p className="modal-subtitle">Edit your content in fullscreen mode.</p>
              </div>
              <button type="button" className="modal-close" onClick={close}>×</button>
            </div>
            <textarea
              className="modal-textarea"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={label}
            />
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={close}>Close</button>
              <button type="button" className="btn-primary" onClick={save}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const TEST_TYPES = [
  { value: "unit",      label: "Unit Test", icon: "📋" },
  { value: "revision",  label: "Revision",  icon: "🔁" },
];

const STEPS = [
  { id: "basics",   label: "Basics",   sub: "Name & date"       },
  { id: "scoring",  label: "Scoring",  sub: "Marks & penalties"  },
  { id: "schedule", label: "Schedule", sub: "Time & duration"   },
  { id: "topics",   label: "Topics",   sub: "Syllabus coverage"  },
  { id: "review",   label: "Review",   sub: "Confirm & publish"  },
];

const INIT = {
  testName:"", dateOfPublish:"", totalQuestions:"", totalMarks:"",
  positiveMarks:"", negativeMarks:"", unansweredMarks:"",
  startTime:"", endTime:"", duration:"", instruction:"", description:"",
  testType:"unit", selectedTopics:[],
};

/* ── Tiny Toast ── */
function Toast({ msg, type, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  const icon = type === "success" ? "✓" : "✕";
  return <div className={`ct-toast ${type}`}><span>{icon}</span>{msg}</div>;
}

/* ── Main Component ── */
export default function CreateTest() {
  const { batchId } = useParams();
  const [step, setStep]           = useState(0);
  const [visited, setVisited]     = useState(new Set([0]));
  const [form, setForm]           = useState(INIT);
  const [errors, setErrors]       = useState({});
  const [loading, setLoading]     = useState(false);
  const [toast, setToast]         = useState(null);
  const [syllabus, setSyllabus]   = useState(null);
  const [syllLoad, setSyllLoad]   = useState(false);
  const [syllErr, setSyllErr]     = useState(null);
  const [topics, setTopics]       = useState([]);
  const [collapsed, setCollapsed] = useState({});

  const getToken = useCallback(() => localStorage.getItem("token"), []);
  const headers = useCallback(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`
  }), [getToken]);

  const fetchSyllabus = useCallback(async () => {
    if (!batchId?.trim()) return;
    setSyllLoad(true);
    setSyllErr(null);
    try {
      const response = await fetch(`${SYLLABUS_API_URL}/${batchId.trim()}`, { headers: headers() });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (!data.success) throw new Error(data.message || "Bad syllabus data");
      setSyllabus(data.syllabus);
      const flat = [];
      data.syllabus.units.forEach(u => u.topics.forEach(t => {
        flat.push({ ...t, unitName: u.unitName, unitWeightage: u.weightage });
      }));
      setTopics(flat);
      setForm(p => ({ ...p, selectedTopics: flat.map(t => t.topicName) }));
    } catch (error) {
      setSyllErr(error.message || "Failed to load syllabus");
    } finally {
      setSyllLoad(false);
    }
  }, [batchId, headers]);

  useEffect(() => { fetchSyllabus(); }, [fetchSyllabus]);

  /* ── form helpers ── */
  const set = useCallback((name, val) => {
    setForm(p => ({ ...p, [name]: val }));
    setErrors(p => p[name] ? { ...p, [name]: "" } : p);
  }, []);

  const ch = useCallback(e => set(e.target.name, e.target.value), [set]);

  const toggleTopic = useCallback((name) => {
    setForm(p => {
      const cur = p.selectedTopics;
      return { ...p, selectedTopics: cur.includes(name) ? cur.filter(x => x !== name) : [...cur, name] };
    });
  }, []);

  const unitTopics = useCallback((uName) => topics.filter(t => t.unitName === uName), [topics]);
  const unitAllSel = useCallback((uName) => unitTopics(uName).every(t => form.selectedTopics.includes(t.topicName)), [unitTopics, form.selectedTopics]);

  const toggleUnit = useCallback((uName) => {
    const uTopics = unitTopics(uName).map(t => t.topicName);
    const allSel  = unitAllSel(uName);
    setForm(p => ({
      ...p,
      selectedTopics: allSel
        ? p.selectedTopics.filter(t => !uTopics.includes(t))
        : [...new Set([...p.selectedTopics, ...uTopics])]
    }));
  }, [unitTopics, unitAllSel]);

  const toggleAll = useCallback(() => {
    setForm(p => ({
      ...p,
      selectedTopics: p.selectedTopics.length === topics.length ? [] : topics.map(t => t.topicName)
    }));
  }, [topics]);

  /* ── validation per step ── */
  const validate = useCallback((s) => {
    const e = {};
    if (s === 0) {
      if (!form.testName.trim())  e.testName      = "Test name is required";
      if (!form.dateOfPublish)    e.dateOfPublish  = "Publish date is required";
      if (!form.totalQuestions || +form.totalQuestions < 1) e.totalQuestions = "Must be ≥ 1";
      if (!form.totalMarks     || +form.totalMarks < 1)     e.totalMarks     = "Must be ≥ 1";
    }
    if (s === 2) {
      if (!form.startTime) e.startTime = "Required";
      if (!form.endTime)   e.endTime   = "Required";
      if (!form.duration || +form.duration < 1) e.duration = "Must be ≥ 1 min";
    }
    if (s === 3) {
      if (form.selectedTopics.length === 0) e.selectedTopics = "Select at least one topic";
    }
    return e;
  }, [form]);

  const goTo = useCallback((idx) => {
    setVisited(p => new Set([...p, idx]));
    setStep(idx);
  }, []);

  const next = useCallback(() => {
    const e = validate(step);
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    goTo(Math.min(step + 1, STEPS.length - 1));
  }, [step, validate, goTo]);

  const back = useCallback(() => {
    setErrors({});
    setStep(p => Math.max(p - 1, 0));
  }, []);

  const isStepDone = useCallback((i) => {
    if (!visited.has(i)) return false;
    return Object.keys(validate(i)).length === 0;
  }, [visited, validate]);

  const progress = useMemo(() => (step / (STEPS.length - 1)) * 100, [step]);

  /* ── submit ── */
  const submit = useCallback(async () => {
    const allErrors = { ...validate(0), ...validate(2), ...validate(3) };
    setErrors(allErrors);
    if (Object.keys(allErrors).length > 0) {
      setToast({ msg: "Fix the errors before publishing", type: "error" });
      return;
    }
    setLoading(true);
    try {
      const body = {
        batchId,
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
        syllabusId: syllabus?.syllabusId || "",
        selectedTopics: form.selectedTopics,
      };
      const response = await fetch(TEST_API_URL, { method: "POST", headers: headers(), body: JSON.stringify(body) });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (!data.success) throw new Error(data.message || "Failed to create test");
      setToast({ msg: "Test published successfully!", type: "success" });
      setForm({ ...INIT, selectedTopics: topics.map(t => t.topicName) });
      setStep(0);
      setVisited(new Set([0]));
    } catch(err) {
      setToast({ msg: err.message || "Something went wrong", type: "error" });
    } finally {
      setLoading(false);
    }
  }, [form, batchId, syllabus, headers, topics, validate]);

  const handleDiscard = useCallback(() => {
    if (window.confirm("Are you sure you want to discard all changes?")) {
      setForm({ ...INIT, selectedTopics: topics.map(t => t.topicName) });
      setStep(0);
      setVisited(new Set([0]));
      setErrors({});
      setToast(null);
    }
  }, [topics]);

  /* ── input helper ── */
  const inp = (name, type, label, req=false, opts={}) => (
    <div className="fg" key={name}>
      <label htmlFor={name}>{label}{req && <span className="req">*</span>}</label>
      <input
        id={name} name={name} type={type} value={form[name] || ""}
        onChange={ch} placeholder={label}
        className={errors[name] ? "has-error" : ""} disabled={loading} {...opts}
      />
      {errors[name] && <span className="field-error">{errors[name]}</span>}
    </div>
  );

  const units = syllabus?.units || [];

  const renderTopicsPane = () => {
    if (syllLoad) return (
      <div className="syllabus-empty">
        <div className="syllabus-empty-icon">⏳</div>
        <h4>Loading syllabus…</h4>
        <p>Fetching topics for batch #{batchId}</p>
      </div>
    );
    if (syllErr) return (
      <div className="syllabus-empty">
        <div className="syllabus-empty-icon">⚠️</div>
        <h4>Could not load syllabus</h4>
        <p>{syllErr}</p>
        <button type="button" className="btn-secondary" onClick={fetchSyllabus} style={{marginTop:"12px"}}>
          Retry
        </button>
      </div>
    );
    if (!syllabus) return (
      <div className="syllabus-empty">
        <div className="syllabus-empty-icon">📚</div>
        <h4>No syllabus found</h4>
        <p>Syllabus will appear here for batch #{batchId}</p>
      </div>
    );

    return (
      <div className="topics-layout">
        <div className="topics-main">
          <div className="topics-toolbar">
            <div className="topics-toolbar-left">
              <h4>Syllabus Topics</h4>
              <span className="topics-count-badge">{form.selectedTopics.length} / {topics.length} selected</span>
            </div>
            <button type="button" className="btn-ghost" onClick={toggleAll}>
              {form.selectedTopics.length === topics.length ? "Deselect all" : "Select all"}
            </button>
          </div>

          {errors.selectedTopics && <span className="field-error" style={{marginBottom:10,display:"flex"}}>{errors.selectedTopics}</span>}

          <div className="topics-scroll">
            {units.map((unit, ui) => {
              const uTopics  = unitTopics(unit.unitName);
              const selCount = uTopics.filter(t => form.selectedTopics.includes(t.topicName)).length;
              const allSel   = unitAllSel(unit.unitName);
              const open     = collapsed[unit.unitName] !== false;

              return (
                <div key={`unit-${ui}`} className="unit-block">
                  <div className="unit-head" onClick={() => setCollapsed(p => ({...p, [unit.unitName]: !open}))}>
                    <div className="unit-head-left">
                      <span className="unit-name">{unit.unitName}</span>
                      <span className="unit-meta">{unit.weightage}% weight</span>
                      <span className="unit-progress">{selCount}/{uTopics.length}</span>
                    </div>
                    <div className="unit-head-right">
                      <button
                        type="button"
                        className={`btn-unit-toggle ${allSel ? "all-selected" : ""}`}
                        onClick={e => { e.stopPropagation(); toggleUnit(unit.unitName); }}
                      >
                        {allSel ? "✓ All selected" : "Select all"}
                      </button>
                      <span className={`unit-chevron ${open ? "open" : ""}`}>▼</span>
                    </div>
                  </div>

                  {open && (
                    <div className="topic-chips">
                      {uTopics.map((t, ti) => {
                        const sel = form.selectedTopics.includes(t.topicName);
                        return (
                          <label key={`topic-${ui}-${ti}`} className={`topic-chip ${sel ? "selected" : ""}`}>
                            <input type="checkbox" checked={sel} onChange={() => toggleTopic(t.topicName)} disabled={loading} />
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

  const SummaryRow = ({ label, val }) => (
    <div className="summary-item">
      <div className="summary-item-label">{label}</div>
      <div className="summary-item-value">{val || <span style={{color:"#9CA3AF",fontSize:12}}>—</span>}</div>
    </div>
  );

  const typeMeta = TEST_TYPES.find(t => t.value === form.testType);

  return (
    <div className="create-test-container">

      {/* ── Left Navigation ── */}
      <nav className="ct-nav">
        <div className="ct-nav-header">
          <h2>Create Test</h2>
          <p>Batch #{batchId}</p>
        </div>

        <div className="ct-nav-steps">
          {STEPS.map((s, i) => {
            const done   = isStepDone(i) && i !== step;
            const active = i === step;
            return (
              <React.Fragment key={s.id}>
                <button
                  type="button"
                  className={`ct-step-btn ${active ? "active" : ""} ${done ? "done" : ""}`}
                  onClick={() => goTo(i)}
                  disabled={loading}
                >
                  <span className="step-num"><span>{i+1}</span></span>
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
        <div className="ct-topbar">
          <div className="ct-topbar-left">
            <h3>{STEPS[step].label}</h3>
            <span>Step {step+1} of {STEPS.length}</span>
          </div>
          <span style={{fontSize:12,color:"var(--ink-4)"}}>{form.testName || "Untitled test"}</span>
        </div>

        <div className="ct-progress-bar">
          <div className="ct-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        <div className="ct-body">
          <div className="ct-panel">

            {/* STEP 0 — Basics */}
            <div className={`step-pane ${step===0?"visible":""}`}>
              <p className="pane-title">Test basics</p>
              <p className="pane-subtitle">Give the test a name and set its initial configuration.</p>

              <div className="ct-card">
                <div className="ct-card-title">Identity</div>
                {inp("testName","text","Test name",true)}
                {inp("dateOfPublish","date","Publish date",true)}
              </div>

              <div className="ct-card">
                <div className="ct-card-title">Scale</div>
                <div className="grid-2">
                  {inp("totalQuestions","number","Questions",true,{min:1})}
                  {inp("totalMarks","number","Total marks",true,{min:1})}
                </div>
              </div>

              <div className="ct-card">
                <div className="ct-card-title">Test type</div>
                <div className="type-cards">
                  {TEST_TYPES.map(t => (
                    <label key={t.value} className={`type-card ${form.testType===t.value?"selected":""}`}>
                      <input type="radio" name="testType" value={t.value}
                        checked={form.testType===t.value} onChange={ch} disabled={loading} />
                      <span className="type-card-icon">{t.icon}</span>
                      <span className="type-card-label">{t.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* STEP 1 — Scoring */}
            <div className={`step-pane ${step===1?"visible":""}`}>
              <p className="pane-title">Scoring rules</p>
              <p className="pane-subtitle">Define how marks are awarded, deducted, and handled for skipped answers.</p>

              <div className="ct-card">
                <div className="ct-card-title">Marks per answer</div>
                <div className="grid-3">
                  {inp("positiveMarks","number","Correct (+)",false,{min:0,step:.5})}
                  {inp("negativeMarks","number","Wrong (−)",false,{min:0,step:.5})}
                  {inp("unansweredMarks","number","Skipped",false,{step:.5})}
                </div>
                <div style={{marginTop:12,padding:"10px 12px",background:"var(--surface-2)",borderRadius:"var(--radius-xs)",fontSize:12,color:"var(--ink-3)",border:"1px solid var(--border)"}}>
                  💡 Leave fields at 0 if not applicable. Negative marks are stored as-is (no need to add a minus sign).
                </div>
              </div>
            </div>

            {/* STEP 2 — Schedule */}
            <div className={`step-pane ${step===2?"visible":""}`}>
              <p className="pane-title">Schedule</p>
              <p className="pane-subtitle">Set when students can access and submit this test.</p>

              <div className="ct-card">
                <div className="ct-card-title">Window</div>
                <div className="grid-2">
                  <div className="fg">
                    <label htmlFor="startTime">Start time<span className="req">*</span></label>
                    <input id="startTime" type="time" name="startTime" value={form.startTime}
                      onChange={ch} className={errors.startTime?"has-error":""} disabled={loading} />
                    {errors.startTime && <span className="field-error">{errors.startTime}</span>}
                  </div>
                  <div className="fg">
                    <label htmlFor="endTime">End time<span className="req">*</span></label>
                    <input id="endTime" type="time" name="endTime" value={form.endTime}
                      onChange={ch} className={errors.endTime?"has-error":""} disabled={loading} />
                    {errors.endTime && <span className="field-error">{errors.endTime}</span>}
                  </div>
                </div>
                {inp("duration","number","Duration (minutes)",true,{min:1})}
              </div>

              <div className="ct-card">
                <div className="ct-card-title">Additional info</div>
                <ExpandableTextArea
                  name="instruction"
                  label="Instructions for students"
                  value={form.instruction}
                  onChange={ch}
                  disabled={loading}
                  error={errors.instruction}
                  showExpand={false}
                />
                <ExpandableTextArea
                  name="description"
                  label="Internal description / notes"
                  value={form.description}
                  onChange={ch}
                  disabled={loading}
                  error={errors.description}
                  showExpand={false}
                />
              </div>
            </div>

            {/* STEP 3 — Topics */}
            <div className={`step-pane ${step===3?"visible":""}`}>
              <p className="pane-title">Syllabus coverage</p>
              <p className="pane-subtitle">Choose which topics this test will assess. Click a chip to toggle it.</p>
              {renderTopicsPane()}
            </div>

            {/* STEP 4 — Review */}
            <div className={`step-pane ${step===4?"visible":""}`}>
              <p className="pane-title">Review & publish</p>
              <p className="pane-subtitle">Double-check everything before making the test live.</p>

              <div className="ct-card">
                <div className="ct-card-title">Overview</div>
                <div className="summary-grid">
                  <SummaryRow label="Test name"    val={form.testName} />
                  <SummaryRow label="Type"         val={`${typeMeta?.icon} ${typeMeta?.label}`} />
                  <SummaryRow label="Publish date" val={form.dateOfPublish} />
                  <SummaryRow label="Questions"    val={form.totalQuestions} />
                  <SummaryRow label="Total marks"  val={form.totalMarks} />
                  <SummaryRow label="Duration"     val={form.duration ? `${form.duration} min` : ""} />
                  <SummaryRow label="Window"       val={form.startTime && form.endTime ? `${form.startTime} → ${form.endTime}` : ""} />
                  <SummaryRow label="Topics"       val={`${form.selectedTopics.length} of ${topics.length}`} />
                </div>
              </div>

              <div className="ct-card">
                <div className="ct-card-title">Scoring</div>
                <div className="summary-grid">
                  <SummaryRow label="Correct"  val={form.positiveMarks  || "0"} />
                  <SummaryRow label="Wrong"    val={form.negativeMarks  || "0"} />
                  <SummaryRow label="Skipped"  val={form.unansweredMarks|| "0"} />
                </div>
              </div>

              {form.instruction && (
                <div className="ct-card">
                  <div className="ct-card-title">Instructions</div>
                  <div className="preview-box">
                    {renderTextWithLinks(form.instruction)}
                  </div>
                </div>
              )}

              {form.description && (
                <div className="ct-card">
                  <div className="ct-card-title">Description</div>
                  <div className="preview-box">
                    {renderTextWithLinks(form.description)}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* ── Footer Nav ── */}
        <div className="ct-footer">
          <div className="ct-footer-left">
            <button type="button" className="btn-danger-ghost" onClick={handleDiscard} disabled={loading}>
              Discard
            </button>
          </div>
          <div className="ct-footer-right">
            {step > 0 && (
              <button type="button" className="btn-secondary" onClick={back} disabled={loading}>
                ← Back
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button type="button" className="btn-primary" onClick={next} disabled={loading}>
                Continue →
              </button>
            ) : (
              <button type="button" className="btn-submit" onClick={submit} disabled={loading}>
                {loading ? <><span className="spinner" /> Publishing…</> : "🚀 Publish test"}
              </button>
            )}
          </div>
        </div>
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}