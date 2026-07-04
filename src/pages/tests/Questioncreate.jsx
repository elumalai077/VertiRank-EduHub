// ═══════════════════════════════════════════════
//  IMPORTS
import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback
} from 'react';

import { useParams, useNavigate } from 'react-router-dom';
import {
  Bold, Italic, Underline, Subscript, Superscript, Maximize2, Minimize2,
  AlertTriangle, CheckCircle2, RefreshCw, Plus, Edit3, BarChart3, X,
  ArrowUp, ArrowDown, BookOpen, Tag, Filter, ChevronDown, ChevronUp,
  Upload, Save, ArrowLeft,
} from 'lucide-react';
import '../../styles/App.css';

import ImportReview from './Importreview.jsx';

// ═══════════════════════════════════════════════
//  UTILITY FUNCTIONS
// ═══════════════════════════════════════════════
const getToken = () => {
  try {
    const token = localStorage.getItem("token");
    if (!token) {
      console.warn("Token not found in localStorage");
      return null;
    }
    return token;
  } catch (error) {
    console.error("Error retrieving token from localStorage:", error);
    return null;
  }
};

// ═══════════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════════
const TEST_INFO_URL    = 'https://z6hfbdtza0.execute-api.ap-south-1.amazonaws.com/default/testinformation';
const QUESTION_URL     = 'https://6mgkhsbr1a.execute-api.ap-south-1.amazonaws.com/default/question-create';
const QUESTION_GET_URL = 'https://6mgkhsbr1a.execute-api.ap-south-1.amazonaws.com/default/question-get';

const BADGE = {
  MCQ:              { label: 'MCQ',               bg: 'rgba(46,124,246,0.12)',  color: '#2563eb' },
  ASSERTION_REASON: { label: 'Assertion & Reason', bg: 'rgba(155,114,248,0.12)', color: '#7c3aed' },
  MATCHING:         { label: 'Match Following',    bg: 'rgba(16,196,123,0.10)', color: '#059669' },
};

const LIMITS = {
  questionText: 500,
  explanation:  1500,
  topic:        100,
  optionText:   150,
  pairSide:     150,
  assertion:    600,
  reason:       600,
  maxOptions:   8,
  minOptions:   2,
  maxPairs:     12,
};

const PAGE_SIZE = 25;


// ═══════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════
function richToHtml(raw) {
  if (!raw) return '';
  let s = esc(raw);
  s = s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  s = s.replace(/__(.+?)__/g,      '<u>$1</u>');
  s = s.replace(/(?<!_)_(.+?)_(?!_)/g, '<i>$1</i>');
  s = s.replace(/\^(.+?)\^/g,      '<sup>$1</sup>');
  s = s.replace(/~(.+?)~/g,        '<sub>$1</sub>');
  return s;
}

function esc(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/\n/g, '<br>')
    .replace(/ /g,  '&nbsp;');
}

function clamp(value, max) {
  if (value == null) return '';
  const str = String(value);
  return str.length > max ? str.slice(0, max) : str;
}

function similarity(a, b) {
  const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  const ta = norm(a), tb = norm(b);
  if (!ta.length || !tb.length) return 0;
  const setA = new Set(ta), setB = new Set(tb);
  let overlap = 0;
  setA.forEach(w => { if (setB.has(w)) overlap++; });
  return overlap / Math.max(setA.size, setB.size);
}

function parseDynamoValue(value) {
  if (!value || typeof value !== 'object') return value;
  if ('S'    in value) return value.S;
  if ('N'    in value) return value.N;
  if ('BOOL' in value) return value.BOOL;
  if ('L'    in value && Array.isArray(value.L))         return value.L.map(parseDynamoValue);
  if ('M'    in value && typeof value.M === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(value.M)) result[k] = parseDynamoValue(v);
    return result;
  }
  return value;
}

function parseQuestionData(rawQuestion) {
  if (!rawQuestion || typeof rawQuestion !== 'object') return rawQuestion;
  const hasDynamo = Object.values(rawQuestion).some(
    v => v && typeof v === 'object' && ('S' in v || 'N' in v || 'L' in v || 'M' in v || 'BOOL' in v)
  );
  if (!hasDynamo) return rawQuestion;

  const parsed = {};
  for (const [k, v] of Object.entries(rawQuestion)) parsed[k] = parseDynamoValue(v);

  if (parsed.pairs && Array.isArray(parsed.pairs) && parsed.pairs.length > 0 && typeof parsed.pairs[0] !== 'string') {
    parsed.pairs = parsed.pairs.map(p =>
      typeof p === 'object' ? `${p.a || p.left || ''}|${p.b || p.right || ''}` : p
    );
  }
  if (parsed.options && typeof parsed.options === 'object' && !Array.isArray(parsed.options) && parsed.options.L) {
    parsed.options = parsed.options.L.map(parseDynamoValue);
  }
  if (typeof parsed.correctAnswer === 'object' && 'N' in (parsed.correctAnswer || {}))
    parsed.correctAnswer = parseInt(parsed.correctAnswer.N);
  if (typeof parsed.questionNumber === 'object' && 'N' in (parsed.questionNumber || {}))
    parsed.questionNumber = parseInt(parsed.questionNumber.N);

  return parsed;
}

function clampQuestionFields(q) {
  const out = { ...q };
  if (out.question)    out.question    = clamp(out.question,    LIMITS.questionText);
  if (out.topic)       out.topic       = clamp(out.topic,       LIMITS.topic);
  if (out.explanation) out.explanation = clamp(out.explanation, LIMITS.explanation);
  if (out.assertion)   out.assertion   = clamp(out.assertion,   LIMITS.assertion);
  if (out.reason)      out.reason      = clamp(out.reason,      LIMITS.reason);
  if (Array.isArray(out.options))
    out.options = out.options.slice(0, LIMITS.maxOptions).map(o => clamp(o, LIMITS.optionText));
  if (Array.isArray(out.pairs))
    out.pairs = out.pairs.slice(0, LIMITS.maxPairs).map(p => {
      if (typeof p === 'string') {
        const [a, b] = p.split('|');
        return `${clamp(a, LIMITS.pairSide)}|${clamp(b, LIMITS.pairSide)}`;
      }
      return p;
    });
  return out;
}

function CharCount({ value, max }) {
  const len  = (value || '').length;
  const over = len > max;
  return (
    <div style={{ fontSize: 12, textAlign: 'right', color: over ? '#dc2626' : '#94a3b8', marginTop: 2 }}>
      {len}/{max}
    </div>
  );
}

// ═══════════════════════════════════════════════
//  COMPONENT
// ═══════════════════════════════════════════════
export default function QuestionBuilder() {
  const navigate = useNavigate();
  const { testId } = useParams();
  // ── CORE STATE ──
  const [type, setType]       = useState('MCQ');
  const [opts, setOpts]       = useState([{ n:1,t:'' },{ n:2,t:'' },{ n:3,t:'' },{ n:4,t:'' }]);
  const [pairs, setPairs]     = useState([{ a:'',b:'' },{ a:'',b:'' },{ a:'',b:'' },{ a:'',b:'' }]);
  const [sessionLog, setSessionLog] = useState([]);
  const [testInfo, setTestInfo]     = useState(null);
  const [existingQs, setExistingQs] = useState({});
  const [editingQNum, setEditingQNum] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // ── IMPORT QUEUE — when set, renders ImportReview instead of normal UI ──
  const [importQueue, setImportQueue] = useState(null);

  // ── TOAST ──
  const [toast, setToast] = useState({ message: '', type: '', visible: false });

  // ── UI STATE ──
  const [activeTab, setActiveTab]   = useState('editor');
  const [fullscreen, setFullscreen] = useState(null);
  const [validationWarnings, setValidationWarnings] = useState([]);
  const [dupWarning, setDupWarning] = useState(null);
  const [expandedQuestions, setExpandedQuestions]   = useState({});
  const [savedPage, setSavedPage] = useState(1);

  // ── LOCAL STORAGE ──
  const [localBackups, setLocalBackups]       = useState([]);
  const [showLocalBackups, setShowLocalBackups] = useState(false);

  // ── FORM STATE ──
  const [selectedQNum,   setSelectedQNum]   = useState('');
  const [selectedTopic,  setSelectedTopic]  = useState('');
  const [weightageVal,   setWeightageVal]   = useState(1);
  const [correctAnswer,  setCorrectAnswer]  = useState(null);

  // ── DIRTY TRACKING ──
  const isDirtyRef = useRef(false);

  // ── RICH TEXT REFS ──
  const qTextRef    = useRef(null);
  const stmtARef    = useRef(null);
  const stmtRRef    = useRef(null);
  const fileInputRef = useRef(null);

  // ── CONTROLLED RICH TEXT VALUES ──
  const [qTextVal, setQTextVal] = useState('');
  const [explVal,  setExplVal]  = useState('');
  const [stmtAVal, setStmtAVal] = useState('');
  const [stmtRVal, setStmtRVal] = useState('');

  const setQTextValBounded = (v) => { isDirtyRef.current = true; setQTextVal(clamp(v, LIMITS.questionText)); };
  const setExplValBounded  = (v) => { isDirtyRef.current = true; setExplVal(clamp(v,  LIMITS.explanation));  };
  const setStmtAValBounded = (v) => { isDirtyRef.current = true; setStmtAVal(clamp(v, LIMITS.assertion));    };
  const setStmtRValBounded = (v) => { isDirtyRef.current = true; setStmtRVal(clamp(v, LIMITS.reason));       };

  // ── TOAST HELPERS ──
  const showToast = (message, type, duration = 2200) => {
    setToast({ message, type, visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), duration);
  };
  const hideToast = () => setToast(prev => ({ ...prev, visible: false }));

  useEffect(() => { setSavedPage(1); }, [existingQs]);

  // ═══════════════════════════════════════════
  //  LOCAL STORAGE
  // ═══════════════════════════════════════════
  const getAllLocalBackups = () => {
    try { return JSON.parse(localStorage.getItem('question_backup_list') || '[]'); }
    catch { return []; }
  };

  const saveToLocalStorage = () => {
    try {
      const backupData = {
        questions: existingQs,
        timestamp: new Date().toISOString(),
        totalQuestions: Object.keys(existingQs).length,
        testId: testInfo?.testId || 'unknown',
      };
      const key = `question_backup_${Date.now()}`;
      localStorage.setItem(key, JSON.stringify(backupData));
      const all = getAllLocalBackups();
      all.push({ key, timestamp: backupData.timestamp, totalQuestions: backupData.totalQuestions, testId: backupData.testId });
      localStorage.setItem('question_backup_list', JSON.stringify(all));
      setLocalBackups(all);
      showToast('✓ Saved to local storage', 'ok');
    } catch (err) {
      showToast('✗ Failed to save: ' + err.message, 'err');
    }
  };

  const loadFromLocalStorage = (key) => {
    try {
      const data = JSON.parse(localStorage.getItem(key) || 'null');
      if (data?.questions && typeof data.questions === 'object') {
        setExistingQs(data.questions);
        showToast(`✓ Loaded ${Object.keys(data.questions).length} questions from backup`, 'ok');
        setActiveTab('saved');
        return true;
      }
      return false;
    } catch (err) {
      showToast('✗ Load failed: ' + err.message, 'err');
      return false;
    }
  };

  // ═══════════════════════════════════════════
  //  JSON IMPORT — parse only, open review screen
  // ═══════════════════════════════════════════
  const importFromJSON = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target.result);
        let rawItems = [];

        if (Array.isArray(jsonData)) {
          rawItems = jsonData;
        } else if (jsonData && typeof jsonData === 'object') {
          if (Array.isArray(jsonData.questions)) {
            rawItems = jsonData.questions;
          } else {
            rawItems = Object.values(jsonData);
          }
        }

        if (rawItems.length === 0) {
          showToast('No valid questions found in JSON', 'err');
          return;
        }

        // ═══════ DUPLICATE / OVERWRITE PREVENTION ON IMPORT ═══════
        // 1) Deduplicate question numbers *within* the imported file:
        //    if two items in the JSON share the same questionNumber,
        //    every item after the first one for that number gets its
        //    number cleared so it must be re-assigned to a free slot.
        // 2) If an item's questionNumber already exists on the server
        //    (existingQs), also clear it — imports are never allowed
        //    to silently overwrite a saved question.
        const seenNums = new Map();
        rawItems = rawItems.map((q) => {
          const num = q.questionNumber ?? q.QuestionNumber ?? q.id ?? null;
          const normNum = num != null ? Number(num) : null;

          if (normNum != null) {
            const conflictsWithServer = !!existingQs[normNum];
            const conflictsWithinFile = seenNums.has(normNum);

            if (conflictsWithServer || conflictsWithinFile) {
              return { ...q, questionNumber: null, _dupOrigNum: normNum };
            }
            seenNums.set(normNum, true);
          }
          return { ...q, questionNumber: normNum };
        });

        // Open the review screen — nothing is sent to the server yet
        setImportQueue(rawItems);
        showToast(`${rawItems.length} questions ready for review`, 'ok', 3000);
      } catch (err) {
        showToast('Failed to parse JSON: ' + err.message, 'err');
      }
    };
    reader.readAsText(file);
  };

  // ── FILE UPLOAD ──
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const ext = file.name.split('.').pop().toLowerCase();
      if (ext === 'json') importFromJSON(file);
      else showToast('Please upload a JSON file', 'err');
    }
    e.target.value = '';
  };

  // ── CALLBACK: ImportReview tells us a question was saved ──
  const handleImportQuestionSaved = (qnum, payload) => {
    setExistingQs(prev => ({ ...prev, [qnum]: payload }));
    setSessionLog(prev => [
      ...prev,
      { ...payload, _method: 'POST', _at: new Date().toISOString() },
    ]);
  };

  // ═══════════════════════════════════════════
  //  API
  // ═══════════════════════════════════════════
  const loadTestInfo = async () => {
    try {
      setLoading(true); setLoadError(null);
      const token = getToken();
      
      const res = await fetch(TEST_INFO_URL, {
        method: 'POST',
    headers: {
          authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ testId: testId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data?.success) throw new Error(data?.message || 'API error');
      setTestInfo(data.data);
      if (data?.data?.testId) await loadExistingQuestions(data.data.testId);
    } catch (err) {
      setLoadError(err?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const loadExistingQuestions = async (testId) => {
    try {
      const token = getToken();
      const res = await fetch(QUESTION_GET_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ testId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const qs   = {};
      if (data.success && data.data?.questions) {
        data.data.questions.forEach(raw => {
          const q = parseQuestionData(raw);
          qs[q.questionNumber] = q;
        });
      }
      setExistingQs(qs);
    } catch (err) {
      console.warn('Could not load questions:', err.message);
    }
  };

  const reloadQuestions = async () => {
    if (!testInfo) return;
    setLoading(true);
    await loadExistingQuestions(testInfo.testId);
    setLoading(false);
  };

  // ═══════════════════════════════════════════
  //  FORM HELPERS
  // ═══════════════════════════════════════════
  const getQNum        = () => parseInt(selectedQNum) || null;
  const getTopic       = () => selectedTopic;
  const getWeightage   = () => parseFloat(weightageVal) || 1;
  const getExplanation = () => explVal;
  const getCorrect     = () => correctAnswer;
  const getQText       = () => qTextVal;
  const getAssertion   = () => stmtAVal;
  const getReason      = () => stmtRVal;

  const normalizeCorrectAnswerIndex = (raw) => {
    if (raw == null || raw === '') return null;
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'string') {
      const trimmed = raw.trim().toUpperCase();
      if (/^[A-Z]$/.test(trimmed)) return trimmed.charCodeAt(0) - 65;
      const num = Number(trimmed);
      if (!Number.isNaN(num)) return num;
    }
    return null;
  };

  const toPayloadCorrectAnswer = (selected) => {
    const num = Number(selected);
    if (!Number.isFinite(num) || num <= 0) return null;
    return String.fromCharCode(64 + num);
  };

  const clearFormFields = () => {
    isDirtyRef.current = false;
    setQTextVal(''); setExplVal(''); setStmtAVal(''); setStmtRVal('');
    setSelectedTopic('');
    setWeightageVal(1);
    setCorrectAnswer(null);
    setOpts([{ n:1,t:'' },{ n:2,t:'' },{ n:3,t:'' },{ n:4,t:'' }]);
    setPairs([{ a:'',b:'' },{ a:'',b:'' },{ a:'',b:'' },{ a:'',b:'' }]);
    setValidationWarnings([]);
    setDupWarning(null);
  };

  const autoSelectNextQ = useCallback(() => {
    const total = testInfo?.totalQuestions || 100;
    for (let i = 1; i <= total; i++) {
      if (!existingQs[i]) { setSelectedQNum(String(i)); return; }
    }
    setSelectedQNum(String(total));
  }, [testInfo, existingQs]);

  const enterEditMode = (qnum) => setEditingQNum(qnum);

  const cancelEdit = (resetForm = true) => {
    setEditingQNum(null);
    if (resetForm) clearFormFields();
  };

  const loadExistingIntoForm = (q) => {
    isDirtyRef.current = false;
    setType(q.questionType || 'MCQ');
    setQTextVal(clamp(q.question    || '', LIMITS.questionText));
    setExplVal( clamp(q.explanation || '', LIMITS.explanation));
    setSelectedTopic(q.topic    || '');
    setWeightageVal(q.weightage || 1);
    const uiCorrect = normalizeCorrectAnswerIndex(q.correctAnswer);
    setCorrectAnswer(uiCorrect != null ? uiCorrect + 1 : null);

    if (Array.isArray(q.options) && q.options.length) {
      setOpts(q.options.slice(0, LIMITS.maxOptions).map((t, i) => ({ n: i+1, t: clamp(t, LIMITS.optionText) })));
    } else {
      setOpts([{ n:1,t:'' },{ n:2,t:'' },{ n:3,t:'' },{ n:4,t:'' }]);
    }

    if (Array.isArray(q.pairs) && q.pairs.length) {
      setPairs(q.pairs.slice(0, LIMITS.maxPairs).map(p => {
        if (typeof p === 'string') {
          const parts = p.split('|');
          return { a: clamp(parts[0]||'', LIMITS.pairSide), b: clamp(parts[1]||'', LIMITS.pairSide) };
        }
        return { a: clamp(p.a||p.left||'', LIMITS.pairSide), b: clamp(p.b||p.right||'', LIMITS.pairSide) };
      }));
    } else {
      setPairs([{ a:'',b:'' },{ a:'',b:'' },{ a:'',b:'' },{ a:'',b:'' }]);
    }

    if (q.questionType === 'ASSERTION_REASON') {
      setStmtAVal(clamp(q.assertion || '', LIMITS.assertion));
      setStmtRVal(clamp(q.reason    || '', LIMITS.reason));
    }
  };

  // ═══════════════════════════════════════════
  //  Q# CHANGE HANDLER WITH DUPLICATE PREVENTION
  // ═══════════════════════════════════════════
  const onQNumChange = (newVal) => {
    const qnum = parseInt(newVal) || null;
    if (!qnum) { setSelectedQNum(''); return; }

    if (isDirtyRef.current && editingQNum !== null && editingQNum !== qnum) {
      const confirmed = window.confirm(
        `You have unsaved changes to Q${editingQNum}.\nDiscard and switch to Q${qnum}?`
      );
      if (!confirmed) {
        setSelectedQNum(String(editingQNum));
        return;
      }
    }

    isDirtyRef.current = false;
    setSelectedQNum(String(qnum));
    const existing = existingQs[qnum];
    if (existing) {
      // Load existing question for editing
      loadExistingIntoForm(existing);
      enterEditMode(qnum);
      showToast(`✓ Loaded Q${qnum} for editing`, 'ok', 2000);
    } else if (editingQNum !== null) {
      cancelEdit(false);
    }
  };

  // ── OPTIONS / PAIRS ──
  const addOpt = () => {
    if (opts.length >= LIMITS.maxOptions) { showToast(`✗ Max ${LIMITS.maxOptions} options`, 'err'); return; }
    isDirtyRef.current = true;
    setOpts(prev => [...prev, { n: prev.length+1, t: '' }]);
  };

  const removeOpt = (idx) => {
    if (opts.length <= LIMITS.minOptions) return;
    isDirtyRef.current = true;
    setOpts(prev => prev.filter((_, i) => i !== idx).map((o, i) => ({ ...o, n: i+1 })));
    if (correctAnswer != null && idx + 1 === correctAnswer) setCorrectAnswer(null);
  };

  const moveOpt = (idx, dir) => {
    const a = [...opts];
    const t = idx + dir;
    if (t < 0 || t >= a.length) return;
    isDirtyRef.current = true;
    [a[idx], a[t]] = [a[t], a[idx]];
    setOpts(a.map((o, i) => ({ ...o, n: i+1 })));
  };

  const addPair = () => {
    if (pairs.length >= LIMITS.maxPairs) { showToast(`✗ Max ${LIMITS.maxPairs} pairs`, 'err'); return; }
    isDirtyRef.current = true;
    setPairs(prev => [...prev, { a: '', b: '' }]);
  };

  const removePair = (idx) => {
    if (pairs.length <= 1) return;
    isDirtyRef.current = true;
    setPairs(prev => prev.filter((_, i) => i !== idx));
  };

  // ── RICH TEXT TOOLBAR ──
  const applyMark = (ref, value, setValue, markStart, markEnd = markStart) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart, end = el.selectionEnd;
    if (start === end) {
      const next = value.slice(0, start) + markStart + markEnd + value.slice(end);
      setValue(next);
      requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = start + markStart.length; });
      return;
    }
    const sel  = value.slice(start, end);
    const next = value.slice(0, start) + markStart + sel + markEnd + value.slice(end);
    setValue(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = start + markStart.length;
      el.selectionEnd   = start + markStart.length + sel.length;
    });
  };

  const RICH_MARKS = {
    bold:      ['**', '**'],
    italic:    ['_',  '_' ],
    underline: ['__', '__'],
    sup:       ['^',  '^' ],
    sub:       ['~',  '~' ],
  };

  // ═══════════════════════════════════════════
  //  VALIDATION WITH DUPLICATE CHECKS
  // ═══════════════════════════════════════════
  const runValidation = useCallback(() => {
    const warnings    = [];
    const qText       = getQText().trim();
    const topic       = getTopic();
    const explanation = getExplanation().trim();
    const correct     = getCorrect();
    const qnum        = getQNum();

    if (!qText)                               warnings.push('Question text is empty');
    if (qText.length > LIMITS.questionText)   warnings.push(`Question text exceeds ${LIMITS.questionText} chars`);
    if (!topic)                               warnings.push('No topic selected');
    if (topic.length > LIMITS.topic)          warnings.push(`Topic exceeds ${LIMITS.topic} chars`);
    if (!explanation)                         warnings.push('Missing explanation');
    if (explanation.length > LIMITS.explanation) warnings.push(`Explanation exceeds ${LIMITS.explanation} chars`);
    
    // ═══════ STRICT OVERWRITE PREVENTION ═══════
    if (qnum && existingQs[qnum] && editingQNum === null) {
      warnings.push(`⛔ Q${qnum} already exists! Choose a different number or edit the existing question.`);
    }
    if (qnum && existingQs[qnum] && editingQNum !== null && editingQNum !== qnum) {
      warnings.push(`⛔ Q${qnum} already exists and you're editing a different question (Q${editingQNum})`);
    }
    // ═══════ END OVERWRITE PREVENTION ═══════

    if (type !== 'MATCHING') {
      const filled = opts.map(o => o.t.trim());
      filled.forEach((t, i) => {
        if (!t)                           warnings.push(`Option ${i+1} is empty`);
        if (t.length > LIMITS.optionText) warnings.push(`Option ${i+1} exceeds ${LIMITS.optionText} chars`);
      });
      const seen = new Map();
      filled.forEach((t, i) => {
        if (!t) return;
        const k = t.toLowerCase();
        if (seen.has(k)) warnings.push(`Duplicate options: ${seen.get(k)+1} and ${i+1}`);
        else seen.set(k, i);
      });
      if (correct === null)               warnings.push('No correct answer selected');
      else if (correct > opts.length)     warnings.push('Correct answer selection is out of range');
      if (opts.length > LIMITS.maxOptions) warnings.push(`Too many options (max ${LIMITS.maxOptions})`);
    } else {
      const filled = pairs.filter(p => p.a.trim() || p.b.trim());
      if (!filled.length) warnings.push('No matching pairs filled in');
      pairs.forEach((p, i) => {
        if ( p.a.trim() && !p.b.trim()) warnings.push(`Pair ${i+1}: Column B is empty`);
        if (!p.a.trim() &&  p.b.trim()) warnings.push(`Pair ${i+1}: Column A is empty`);
        if (p.a.length > LIMITS.pairSide) warnings.push(`Pair ${i+1} Col A exceeds ${LIMITS.pairSide} chars`);
        if (p.b.length > LIMITS.pairSide) warnings.push(`Pair ${i+1} Col B exceeds ${LIMITS.pairSide} chars`);
      });
      if (pairs.length > LIMITS.maxPairs) warnings.push(`Too many pairs (max ${LIMITS.maxPairs})`);
    }

    if (type === 'ASSERTION_REASON') {
      const a = getAssertion().trim(), r = getReason().trim();
      if (!a)                          warnings.push('Assertion (A) is empty');
      if (a.length > LIMITS.assertion) warnings.push(`Assertion exceeds ${LIMITS.assertion} chars`);
      if (!r)                          warnings.push('Reason (R) is empty');
      if (r.length > LIMITS.reason)    warnings.push(`Reason exceeds ${LIMITS.reason} chars`);
    }

    return warnings;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, opts, pairs, qTextVal, explVal, stmtAVal, stmtRVal, selectedTopic, correctAnswer, existingQs, editingQNum]);

  const checkDuplicate = useCallback(() => {
    const qText = getQText().trim();
    if (!qText || qText.length < 8) return null;
    const qnum = getQNum();
    let best = { num: null, score: 0 };
    Object.entries(existingQs).forEach(([num, q]) => {
      if (Number(num) === qnum) return;
      const score = similarity(qText, q.question || '');
      if (score > best.score) best = { num, score };
    });
    return best.score >= 0.6 ? best : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingQs, qTextVal]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setValidationWarnings(runValidation());
      setDupWarning(checkDuplicate());
    }, 300);
    return () => clearTimeout(timer);
  }, [runValidation, checkDuplicate]);

  useEffect(() => {
    if (testInfo && !selectedQNum) autoSelectNextQ();
  }, [testInfo, existingQs, autoSelectNextQ, selectedQNum]);

  useEffect(() => {
    loadTestInfo();
    setLocalBackups(getAllLocalBackups());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ═══════════════════════════════════════════
  //  BUILD PAYLOAD
  // ═══════════════════════════════════════════
  const buildPayload = () => {
    const qnum        = getQNum();
    const topic       = getTopic();
    const weightage   = getWeightage();
    const qText       = clamp(getQText().trim(), LIMITS.questionText);
    const explanation = clamp(getExplanation().trim(), LIMITS.explanation);
    const correct     = getCorrect();

    if (!testInfo)    return { error: 'Test info not loaded yet.' };
    if (!qnum)        return { error: 'Please select a question number.' };
    if (!topic)       return { error: 'Please select a topic.' };
    if (!qText)       return { error: 'Please enter the question text.' };
    if (!explanation) return { error: 'Please enter an explanation.' };
    
    // ═══════ OVERWRITE PREVENTION ═══════
    if (existingQs[qnum] && editingQNum === null) {
      return { error: `❌ Q${qnum} already exists. Please choose a different question number.` };
    }
    if (existingQs[qnum] && editingQNum !== qnum) {
      return { error: `❌ Q${qnum} already exists and you're not editing it. Please select a different number.` };
    }
    // ═══════ END OVERWRITE PREVENTION ═══════

    if (type !== 'MATCHING' && correct === null) {
      return { error: 'Please select the correct answer before saving.' };
    }

    const savedCount = Object.keys(existingQs).length;
    if (savedCount >= testInfo.totalQuestions && editingQNum === null) {
      return { error: `Test is full (${testInfo.totalQuestions} questions). Edit or delete an existing question.` };
    }

    const payload = {
      testId: testInfo.testId,
      questionNumber: qnum,
      questionType: type,
      question: qText,
      topic: clamp(topic, LIMITS.topic),
      weightage,
      explanation,
    };

    if (type === 'MCQ' || type === 'ASSERTION_REASON') {
      payload.options       = opts.slice(0, LIMITS.maxOptions).map(o => clamp(o.t, LIMITS.optionText));
      const letter = toPayloadCorrectAnswer(correct);
      if (letter) payload.correctAnswer = letter;
    }

    if (type === 'MATCHING') {
      payload.pairs         = pairs.slice(0, LIMITS.maxPairs).map(p => `${clamp(p.a, LIMITS.pairSide)}|${clamp(p.b, LIMITS.pairSide)}`);
      payload.options       = opts.slice(0, LIMITS.maxOptions).map(o => clamp(o.t, LIMITS.optionText));
      const letter = toPayloadCorrectAnswer(correct);
      if (letter) payload.correctAnswer = letter;
    }

    if (type === 'ASSERTION_REASON') {
      payload.assertion = clamp(getAssertion(), LIMITS.assertion);
      payload.reason    = clamp(getReason(),    LIMITS.reason);
    }

    return { payload };
  };

  // ═══════════════════════════════════════════
  //  PUSH QUESTION WITH DUPLICATE PREVENTION
  // ═══════════════════════════════════════════
  const pushQuestion = async (skipWarningGate = false) => {
    if (isSaving) return;

    // ═══════ CHECK TEST LOCK ═══════
    if (testInfo?.allowEdit === false) {
      showToast('🔒 This test is locked. Editing is not allowed.', 'err', 4000);
      return;
    }

    const qnum = getQNum();
    
    // ═══════ CRITICAL: Check for duplicate BEFORE validation ═══════
    if (qnum && existingQs[qnum] && editingQNum === null) {
      showToast(`❌ Q${qnum} already exists! Please choose a different question number or edit the existing one.`, 'err', 4000);
      return;
    }
    
    if (qnum && existingQs[qnum] && editingQNum !== null && editingQNum !== qnum) {
      showToast(`❌ Q${qnum} is already taken by another question. You cannot save Q${qnum} while editing Q${editingQNum}.`, 'err', 4000);
      return;
    }

    const warnings = runValidation();
    if (warnings.length && !skipWarningGate) {
      showToast(`⚠ ${warnings.length} issue${warnings.length > 1 ? 's' : ''} — review before saving`, 'err', 3000);
      return;
    }

    const { payload, error } = buildPayload();
    if (error) { showToast('✗ ' + error, 'err', 3500); return; }

    const isEdit = editingQNum !== null;
    setIsSaving(true);
    showToast(isEdit ? 'Updating…' : 'Saving…', 'sending', 60000);

    try {
      const token = getToken();
      const method   = isEdit ? 'PUT' : 'POST';
      const response = await fetch(QUESTION_URL, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (response.status === 403) {
        showToast('🔒 This test is locked. Editing is not allowed.', 'err', 4000);
        if (testInfo) setTestInfo(prev => ({ ...prev, allowEdit: false }));
        return;
      }

      if (response.ok && data.success) {
        setExistingQs(prev => ({ ...prev, [payload.questionNumber]: { ...payload } }));
        setSessionLog(prev => [...prev, { ...payload, _method: method, _at: new Date().toISOString() }]);
        isDirtyRef.current = false;
        showToast(isEdit ? `✓ Q${payload.questionNumber} updated` : `✓ Q${payload.questionNumber} saved`, 'ok');
        if (isEdit) cancelEdit(false);
        clearFormFields();
        autoSelectNextQ();
      } else {
        showToast('✗ ' + (data.message || 'Error from API'), 'err', 4000);
      }
    } catch (err) {
      showToast('✗ Network error: ' + err.message, 'err', 4000);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleExpandQuestion = (qnum) =>
    setExpandedQuestions(prev => ({ ...prev, [qnum]: !prev[qnum] }));

  // ═══════════════════════════════════════════
  //  ANALYTICS
  // ═══════════════════════════════════════════
  const analytics = useMemo(() => {
    const list = Object.values(existingQs);
    const byType   = { MCQ: 0, ASSERTION_REASON: 0, MATCHING: 0 };
    const byTopic  = {};
    const byStatus = { draft: 0, published: 0, archived: 0 };
    list.forEach(q => {
      byType[q.questionType]  = (byType[q.questionType]  || 0) + 1;
      byTopic[q.topic]        = (byTopic[q.topic]        || 0) + 1;
      byStatus[q.status || 'draft'] = (byStatus[q.status || 'draft'] || 0) + 1;
    });
    return { byType, byTopic, byStatus, total: list.length };
  }, [existingQs]);

  // ═══════════════════════════════════════════
  //  QUESTION DETAIL RENDERERS
  // ═══════════════════════════════════════════
  const renderMCQDetails = (q) => {
    if (!q.options?.length) return <div className="no-details">No options available</div>;
    const ci = normalizeCorrectAnswerIndex(q.correctAnswer) ?? 0;
    return (
      <div className="mcq-details">
        <div className="options-list">
          {q.options.map((opt, idx) => (
            <div key={idx} className={`option-item ${idx === ci ? 'correct-option' : ''}`}>
              <span className="option-label">{String.fromCharCode(65+idx)}.</span>
              <span className="option-text">{opt}</span>
              {idx === ci && <span className="correct-badge">✓ Correct</span>}
            </div>
          ))}
        </div>
        {q.explanation && (
          <div className="explanation-box">
            <strong>Explanation:</strong>
            <div dangerouslySetInnerHTML={{ __html: richToHtml(q.explanation) }} />
          </div>
        )}
      </div>
    );
  };

  const renderAssertionReasonDetails = (q) => {
    const ci = normalizeCorrectAnswerIndex(q.correctAnswer) ?? 0;
    return (
      <div className="assertion-details">
        <div className="assertion-item"><strong>Assertion (A):</strong> {q.assertion || 'N/A'}</div>
        <div className="assertion-item"><strong>Reason (R):</strong>    {q.reason    || 'N/A'}</div>
        {q.options?.length > 0 && (
          <div className="options-list">
            {q.options.map((opt, idx) => (
              <div key={idx} className={`option-item ${idx === ci ? 'correct-option' : ''}`}>
                <span className="option-label">{String.fromCharCode(65+idx)}.</span>
                <span className="option-text">{opt}</span>
                {idx === ci && <span className="correct-badge">✓ Correct</span>}
              </div>
            ))}
          </div>
        )}
        {q.explanation && (
          <div className="explanation-box">
            <strong>Explanation:</strong>
            <div dangerouslySetInnerHTML={{ __html: richToHtml(q.explanation) }} />
          </div>
        )}
      </div>
    );
  };

  const renderMatchingDetails = (q) => {
    const normalizedPairs = (q.pairs || []).map(p => {
      if (typeof p === 'string') { const parts = p.split('|'); return { a: parts[0]||'', b: parts[1]||'' }; }
      return { a: p.a||p.left||'', b: p.b||p.right||'' };
    });
    if (!normalizedPairs.length) return <div className="no-details">No pairs available</div>;
    const ci = normalizeCorrectAnswerIndex(q.correctAnswer) ?? 0;
    return (
      <div className="matching-details">
        <div className="matching-grid">
          <div className="matching-column">
            <strong>Column A</strong>
            {normalizedPairs.map((p, i) => <div key={i} className="matching-item">{p.a||'-'}</div>)}
          </div>
          <div className="matching-column">
            <strong>Column B</strong>
            {normalizedPairs.map((p, i) => <div key={i} className="matching-item">{p.b||'-'}</div>)}
          </div>
        </div>
        {q.options?.length > 0 && (
          <div className="matching-options">
            <strong>Matching Options:</strong>
            <div className="options-list">
              {q.options.map((opt, idx) => (
                <div key={idx} className={`option-item ${idx === ci ? 'correct-option' : ''}`}>
                  <span className="option-label">{String.fromCharCode(65+idx)}.</span>
                  <span className="option-text">{opt}</span>
                  {idx === ci && <span className="correct-badge">✓ Correct</span>}
                </div>
              ))}
            </div>
          </div>
        )}
        {q.explanation && (
          <div className="explanation-box">
            <strong>Explanation:</strong>
            <div dangerouslySetInnerHTML={{ __html: richToHtml(q.explanation) }} />
          </div>
        )}
      </div>
    );
  };

  // ═══════════════════════════════════════════
  //  LOADING / ERROR STATES
  // ═══════════════════════════════════════════
  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p className="loading-text">Loading test information…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="error-container">
        <div className="error-card">
          <AlertTriangle size={48} color="#F0524E" />
          <h3 className="error-title">Failed to load</h3>
          <p className="error-message">{loadError}</p>
          <button onClick={loadTestInfo} className="retry-btn">Retry</button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  //  IMPORT REVIEW SCREEN
  //  Shown instead of normal UI when JSON is uploaded
  // ═══════════════════════════════════════════
  if (importQueue) {
    return (
      <ImportReview
        rawImported={importQueue}
        existingQs={existingQs}
        testInfo={testInfo}
        questionUrl={QUESTION_URL}
        token={getToken()}
        onFinish={() => {
          setImportQueue(null);
          setActiveTab('saved');
        }}
        onQuestionSaved={handleImportQuestionSaved}
      />
    );
  }

  // ═══════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════
  const totalPages   = Math.ceil(Object.keys(existingQs).length / PAGE_SIZE);
  const sortedQNums  = Object.entries(existingQs).sort(([a],[b]) => Number(a)-Number(b));
  const pagedEntries = sortedQNums.slice((savedPage-1)*PAGE_SIZE, savedPage*PAGE_SIZE);

  // Check if current selection would cause overwrite
  const wouldOverwrite = selectedQNum && existingQs[Number(selectedQNum)] && editingQNum === null;

  return (
    <div className="app-container">

      {/* ── Toast ── */}
      {toast.visible && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type === 'ok'      && <CheckCircle2 size={18} />}
          {toast.type === 'err'     && <AlertTriangle size={18} />}
          {toast.type === 'sending' && <RefreshCw size={18} className="spinning" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* ── Header ── */}
      <div className="header">
        <div className="header-left">
          <button onClick={() => navigate(-1)} className="back-btn" title="Go back">
            <ArrowLeft size={24} color="#2E7CF6" />
          </button>
          <BookOpen size={28} color="#2E7CF6" />
          <div>
            <h1 className="header-title">{testInfo?.testTitle || 'Question Builder'}</h1>
            <p className="header-subtitle">
              {testInfo?.testId} · {Object.keys(existingQs).length}/{testInfo?.totalQuestions || 0} questions
            </p>
          </div>
        </div>
        <div className="header-right">
          <button onClick={reloadQuestions} className="header-btn"><RefreshCw size={14} /> Refresh</button>
          <button onClick={() => setActiveTab('saved')}     className={`header-btn ${activeTab==='saved'     ? 'active':''}`}>Saved ({Object.keys(existingQs).length})</button>
          <button onClick={() => setActiveTab('analytics')} className={`header-btn ${activeTab==='analytics' ? 'active':''}`}><BarChart3 size={14} /> Analytics</button>
          <button onClick={() => setActiveTab('editor')}    className={`header-btn ${activeTab==='editor'    ? 'active':''}`}>Editor</button>
        </div>
      </div>

      {/* ── Main Grid ── */}
      <div className={`main-grid ${activeTab==='editor' ? 'with-sidebar' : 'full-width'}`}>

        {/* ════════════════════════════
            EDITOR PANEL
            ════════════════════════════ */}
        {activeTab === 'editor' && (
          <div className="editor-panel">

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Question #</label>
                <select
                  value={selectedQNum}
                  onChange={e => onQNumChange(e.target.value)}
                  className={`form-select ${wouldOverwrite ? 'form-select-warning' : ''}`}
                  style={wouldOverwrite ? { borderColor: '#dc2626', backgroundColor: '#fef2f2' } : {}}
                >
                  <option value="">— select —</option>
                  {Array.from({ length: testInfo?.totalQuestions || 100 }, (_, i) => i+1).map(i => {
                    const exists = existingQs[i];
                    const isEditing = editingQNum === i;
                    return (
                      <option 
                        key={i} 
                        value={i}
                        style={{ 
                          color: exists && !isEditing ? '#10b981' : 'inherit',
                          fontWeight: exists ? 'bold' : 'normal'
                        }}
                      >
                        {exists 
                          ? (isEditing ? `✎ Q${i} (editing)` : `✓ Q${i} (saved - click to edit)`)
                          : `Q${i}`}
                      </option>
                    );
                  })}
                </select>
                {wouldOverwrite && (
                  <div className="warning-text" style={{ 
                    color: '#dc2626', 
                    fontSize: 13, 
                    marginTop: 6, 
                    fontWeight: 600,
                    padding: '6px 10px',
                    backgroundColor: '#fef2f2',
                    borderRadius: 4,
                    border: '1px solid #fecaca'
                  }}>
                    ⛔ Q{selectedQNum} already exists! Choose a different number or click Edit on the saved question.
                  </div>
                )}
                {editingQNum && (
                  <div className="info-text" style={{ color: '#2563eb', fontSize: 12, marginTop: 4 }}>
                    ✎ Editing Q{editingQNum} — your changes will update the existing question
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select
                  value={type}
                  onChange={e => { isDirtyRef.current = true; setType(e.target.value); setCorrectAnswer(null); }}
                  className="form-select"
                >
                  <option value="MCQ">MCQ</option>
                  <option value="ASSERTION_REASON">Assertion & Reason</option>
                  <option value="MATCHING">Match Following</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group flex-2">
                <label className="form-label">Topic</label>
                <select
                  value={selectedTopic}
                  onChange={e => { isDirtyRef.current = true; setSelectedTopic(e.target.value); }}
                  className="form-select"
                >
                  <option value="">— select topic —</option>
                  {(testInfo?.topics || []).map(t => (
                    <option key={t.topicTitle} value={t.topicTitle}>{t.topicTitle}</option>
                  ))}
                </select>
              </div>
              <div className="form-group flex-1">
                <label className="form-label">Weightage</label>
                <input
                  type="number"
                  step="0.5" min="0.5" max="100"
                  value={weightageVal}
                  onChange={e => { isDirtyRef.current = true; setWeightageVal(e.target.value); }}
                  className="form-input"
                />
              </div>
            </div>

            {/* Question Text */}
            <div className="form-group">
              <div className="editor-toolbar">
                <label className="form-label">Question Text</label>
                <div className="toolbar-buttons">
                  {Object.entries(RICH_MARKS).map(([name, [s, e]]) => (
                    <button key={name} onClick={() => applyMark(qTextRef, qTextVal, setQTextValBounded, s, e)} className="toolbar-btn">
                      {name==='bold'      && <Bold       size={14}/>}
                      {name==='italic'    && <Italic     size={14}/>}
                      {name==='underline' && <Underline  size={14}/>}
                      {name==='sup'       && <Superscript size={14}/>}
                      {name==='sub'       && <Subscript  size={14}/>}
                    </button>
                  ))}
                  <button onClick={() => setFullscreen(fullscreen==='qtext' ? null : 'qtext')} className="toolbar-btn">
                    {fullscreen==='qtext' ? <Minimize2 size={14}/> : <Maximize2 size={14}/>}
                  </button>
                </div>
              </div>
              <textarea
                ref={qTextRef}
                value={qTextVal}
                onChange={e => setQTextValBounded(e.target.value)}
                placeholder="Enter question text…"
                maxLength={LIMITS.questionText}
                className={`form-textarea ${fullscreen==='qtext' ? 'fullscreen' : ''}`}
                style={{ minHeight: fullscreen==='qtext' ? 400 : 80 }}
              />
              <CharCount value={qTextVal} max={LIMITS.questionText} />
              {qTextVal && (
                <div className="preview-box">
                  Preview: <span dangerouslySetInnerHTML={{ __html: richToHtml(qTextVal) }} />
                </div>
              )}
            </div>

            {/* Assertion & Reason */}
            {type === 'ASSERTION_REASON' && (
              <>
                <div className="form-group">
                  <label className="form-label">Assertion (A)</label>
                  <textarea
                    ref={stmtARef}
                    value={stmtAVal}
                    onChange={e => setStmtAValBounded(e.target.value)}
                    placeholder="Enter assertion…"
                    maxLength={LIMITS.assertion}
                    className="form-textarea"
                    style={{ minHeight: 60 }}
                  />
                  <CharCount value={stmtAVal} max={LIMITS.assertion} />
                </div>
                <div className="form-group">
                  <label className="form-label">Reason (R)</label>
                  <textarea
                    ref={stmtRRef}
                    value={stmtRVal}
                    onChange={e => setStmtRValBounded(e.target.value)}
                    placeholder="Enter reason…"
                    maxLength={LIMITS.reason}
                    className="form-textarea"
                    style={{ minHeight: 60 }}
                  />
                  <CharCount value={stmtRVal} max={LIMITS.reason} />
                </div>
              </>
            )}

            {/* Options */}
            {type !== 'MATCHING' && (
              <div className="form-group">
                <div className="options-header">
                  <label className="form-label">Options ({opts.length}/{LIMITS.maxOptions})</label>
                  <button onClick={addOpt} className="add-btn" disabled={opts.length >= LIMITS.maxOptions}>
                    <Plus size={14}/> Add
                  </button>
                </div>
                {opts.map((opt, idx) => (
                  <div key={idx} className="option-row">
                    <span className="option-label">{String.fromCharCode(65+idx)}</span>
                    <input
                      type="text"
                      value={opt.t}
                      maxLength={LIMITS.optionText}
                      onChange={e => {
                        isDirtyRef.current = true;
                        const n = [...opts]; n[idx].t = clamp(e.target.value, LIMITS.optionText); setOpts(n);
                      }}
                      placeholder={`Option ${idx+1}`}
                      className="form-input"
                    />
                    <button onClick={() => moveOpt(idx,-1)} className="move-btn"><ArrowUp   size={12}/></button>
                    <button onClick={() => moveOpt(idx, 1)} className="move-btn"><ArrowDown size={12}/></button>
                  </div>
                ))}
                <div className="correct-answer">
                  <label className="form-label">
                    Correct Answer
                    {correctAnswer === null && (
                      <span style={{ marginLeft: 8, fontSize: 12, color: '#d97706' }}>⚠ not set</span>
                    )}
                  </label>
                  <select
                    value={correctAnswer === null ? '' : correctAnswer}
                    onChange={e => { isDirtyRef.current = true; setCorrectAnswer(e.target.value === '' ? null : Number(e.target.value)); }}
                    className="form-select"
                  >
                    <option value="">— pick correct answer —</option>
                    {opts.map((_, i) => (
                      <option key={i+1} value={i+1}>{String.fromCharCode(65+i)}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Pairs (MATCHING) */}
            {type === 'MATCHING' && (
              <>
                <div className="form-group">
                  <div className="options-header">
                    <label className="form-label">Match Pairs ({pairs.length}/{LIMITS.maxPairs})</label>
                    <button onClick={addPair} className="add-btn" disabled={pairs.length >= LIMITS.maxPairs}>
                      <Plus size={14}/> Add Pair
                    </button>
                  </div>
                  {pairs.map((pair, idx) => (
                    <div key={idx} className="pair-row">
                      <span className="pair-label">{idx+1}.</span>
                      <input
                        type="text" value={pair.a} maxLength={LIMITS.pairSide}
                        onChange={e => {
                          isDirtyRef.current = true;
                          const n = [...pairs]; n[idx].a = clamp(e.target.value, LIMITS.pairSide); setPairs(n);
                        }}
                        placeholder="Left side" className="form-input"
                      />
                      <span className="arrow">↔</span>
                      <input
                        type="text" value={pair.b} maxLength={LIMITS.pairSide}
                        onChange={e => {
                          isDirtyRef.current = true;
                          const n = [...pairs]; n[idx].b = clamp(e.target.value, LIMITS.pairSide); setPairs(n);
                        }}
                        placeholder="Right side" className="form-input"
                      />
                    </div>
                  ))}
                </div>

                <div className="form-group">
                  <div className="options-header">
                    <label className="form-label">Matching Options ({opts.length}/{LIMITS.maxOptions})</label>
                    <button onClick={addOpt} className="add-btn" disabled={opts.length >= LIMITS.maxOptions}>
                      <Plus size={14}/> Add Option
                    </button>
                  </div>
                  <p className="helper-text">Enter the correct match order for each option (e.g. "1,3,4,2")</p>
                  {opts.map((opt, idx) => (
                    <div key={idx} className="option-row">
                      <span className="option-label">{String.fromCharCode(65+idx)}</span>
                      <input
                        type="text" value={opt.t} maxLength={LIMITS.optionText}
                        onChange={e => {
                          isDirtyRef.current = true;
                          const n = [...opts]; n[idx].t = clamp(e.target.value, LIMITS.optionText); setOpts(n);
                        }}
                        placeholder="e.g. 1,3,4,2" className="form-input"
                      />
                      <button onClick={() => moveOpt(idx,-1)} className="move-btn"><ArrowUp   size={12}/></button>
                      <button onClick={() => moveOpt(idx, 1)} className="move-btn"><ArrowDown size={12}/></button>
                    </div>
                  ))}
                  <div className="correct-answer">
                    <label className="form-label">
                      Correct Matching Option
                      {correctAnswer === null && (
                        <span style={{ marginLeft: 8, fontSize: 12, color: '#d97706' }}>⚠ not set</span>
                      )}
                    </label>
                    <select
                      value={correctAnswer === null ? '' : correctAnswer}
                      onChange={e => { isDirtyRef.current = true; setCorrectAnswer(e.target.value === '' ? null : Number(e.target.value)); }}
                      className="form-select"
                    >
                      <option value="">— pick correct option —</option>
                      {opts.map((_, i) => (
                        <option key={i+1} value={i+1}>{String.fromCharCode(65+i)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* Explanation */}
            <div className="form-group">
              <label className="form-label">Explanation</label>
              <textarea
                value={explVal}
                onChange={e => setExplValBounded(e.target.value)}
                placeholder="Enter explanation…"
                maxLength={LIMITS.explanation}
                className="form-textarea"
                style={{ minHeight: 60 }}
              />
              <CharCount value={explVal} max={LIMITS.explanation} />
            </div>

            {/* Validation warnings */}
            {validationWarnings.length > 0 && (
              <div className="warning-box">
                <div className="warning-header">
                  <AlertTriangle size={14} color="#d97706"/>
                  <span className="warning-title">Validation warnings</span>
                </div>
                <ul className="warning-list">
                  {validationWarnings.map((w, i) => (
                    <li key={i} style={{ 
                      color: w.includes('already exists') ? '#dc2626' : '#d97706',
                      fontWeight: w.includes('already exists') ? '600' : 'normal'
                    }}>
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Duplicate warning */}
            {dupWarning && (
              <div className="duplicate-warning">
                <AlertTriangle size={14} color="#dc2626"/>
                <span>⚠ High similarity with Q{dupWarning.num} ({Math.round(dupWarning.score*100)}%)</span>
              </div>
            )}

            {/* Action buttons */}
            <div className="action-buttons">
              <button
                onClick={() => pushQuestion(false)}
                className={`save-btn ${wouldOverwrite || testInfo?.allowEdit === false ? 'save-btn-disabled' : ''}`}
                disabled={isSaving || wouldOverwrite || testInfo?.allowEdit === false}
                title={testInfo?.allowEdit === false ? '🔒 Test is locked - editing not allowed' : wouldOverwrite ? `⛔ Cannot save - Q${selectedQNum} already exists!` : ''}
              >
                {isSaving
                  ? <><RefreshCw size={14} className="spinning"/> {editingQNum ? 'Updating…' : 'Saving…'}</>
                  : editingQNum ? 'Update Question' : 'Save Question'
                }
              </button>
              {editingQNum && (
                <button onClick={() => cancelEdit(true)} className="cancel-btn">Cancel Edit</button>
              )}
              <button onClick={clearFormFields} className="clear-btn">Clear</button>
            </div>

            {testInfo?.allowEdit === false && (
              <div className="test-locked-message" style={{ 
                marginTop: 8, 
                padding: 10, 
                background: '#fef3c7', 
                border: '1px solid #f59e0b', 
                borderRadius: 6,
                color: '#92400e',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                🔒 <span><strong>Test Locked:</strong> This test is locked for editing. No changes can be made.</span>
              </div>
            )}

            {wouldOverwrite && (
              <div className="overwrite-blocked-message" style={{ 
                marginTop: 8, 
                padding: 10, 
                background: '#fef2f2', 
                border: '1px solid #fecaca', 
                borderRadius: 6,
                color: '#dc2626',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <AlertTriangle size={16} />
                <span>⛔ Cannot save: Q{selectedQNum} already exists. Please choose a different number or edit the existing question.</span>
              </div>
            )}

          </div>
        )}

        {/* ════════════════════════════
            SAVED QUESTIONS PANEL
            ════════════════════════════ */}
        {activeTab === 'saved' && (
          <div className="saved-panel">
            <div className="panel-header">
              <h3 className="panel-title">Saved Questions ({Object.keys(existingQs).length})</h3>
              <div className="panel-actions">
                <button onClick={saveToLocalStorage} className="panel-btn"><Save size={14}/> Save Local</button>
                <button onClick={() => { setLocalBackups(getAllLocalBackups()); setShowLocalBackups(true); }} className="panel-btn">
                  <Upload size={14}/> Load Backup
                </button>
                <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileUpload} style={{ display:'none' }}/>
                <button onClick={() => fileInputRef.current?.click()} className="panel-btn">
                  <Upload size={14}/> Import JSON
                </button>
              </div>
            </div>

            {/* Local Backups Modal */}
            {showLocalBackups && (
              <div className="backups-modal">
                <div className="backups-modal-content">
                  <div className="backups-modal-header">
                    <h4>Local Backups</h4>
                    <button onClick={() => setShowLocalBackups(false)} className="close-btn"><X size={16}/></button>
                  </div>
                  <div className="backups-list">
                    {localBackups.length === 0
                      ? <div className="empty-state">No backups found</div>
                      : localBackups.map((b, i) => (
                          <div key={i} className="backup-item">
                            <div className="backup-info">
                              <span className="backup-date">{new Date(b.timestamp).toLocaleString()}</span>
                              <span className="backup-count">{b.totalQuestions} questions</span>
                              <span className="backup-testid">{b.testId}</span>
                            </div>
                            <div className="backup-actions">
                              <button onClick={() => loadFromLocalStorage(b.key)} className="load-backup-btn">Load</button>
                            </div>
                          </div>
                        ))
                    }
                  </div>
                </div>
              </div>
            )}

            {/* Question list */}
            <div className="questions-list">
              {pagedEntries.map(([num, q]) => (
                <div key={num} className="question-item">
                  <div className="question-content">
                    <div className="question-header">
                      <span className="question-number">Q{num}</span>
                      <span className="question-type" style={{
                        backgroundColor: BADGE[q.questionType]?.bg  || '#e5e7eb',
                        color:           BADGE[q.questionType]?.color || '#374151',
                      }}>
                        {BADGE[q.questionType]?.label || q.questionType}
                      </span>
                    </div>
                    <div className="question-text" dangerouslySetInnerHTML={{ __html: richToHtml(q.question) }} />
                    <div className="question-meta">Topic: {q.topic}</div>
                    <button onClick={() => toggleExpandQuestion(num)} className="show-all-btn">
                      {expandedQuestions[num] ? 'Hide All' : 'Show All'}
                      {expandedQuestions[num] ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                    </button>
                    {expandedQuestions[num] && (
                      <div className="question-details">
                        {q.questionType === 'MCQ'              && renderMCQDetails(q)}
                        {q.questionType === 'ASSERTION_REASON' && renderAssertionReasonDetails(q)}
                        {q.questionType === 'MATCHING'         && renderMatchingDetails(q)}
                      </div>
                    )}
                  </div>
                  <div className="question-actions">
                    <button
                      onClick={() => {
                        loadExistingIntoForm(q);
                        setEditingQNum(Number(num));
                        setSelectedQNum(String(num));
                        setActiveTab('editor');
                      }}
                      className="edit-btn"
                    >
                      <Edit3 size={12}/> Edit
                    </button>
                  </div>
                </div>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="pagination">
                  <button className="page-btn" disabled={savedPage === 1} onClick={() => setSavedPage(p => p-1)}>← Prev</button>
                  <span className="page-info">{savedPage} / {totalPages}</span>
                  <button className="page-btn" disabled={savedPage === totalPages} onClick={() => setSavedPage(p => p+1)}>Next →</button>
                </div>
              )}

              {Object.keys(existingQs).length === 0 && (
                <div className="empty-state">
                  <BookOpen size={48} className="empty-icon"/>
                  <p>No questions saved yet</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════
            ANALYTICS PANEL
            ════════════════════════════ */}
        {activeTab === 'analytics' && (
          <div className="analytics-panel">
            <h3 className="panel-title"><BarChart3 size={16}/> Analytics Dashboard</h3>
            <div className="summary-stats">
              <div className="stat-card"><div className="stat-value">{analytics.total}</div><div className="stat-label">Total</div></div>
              <div className="stat-card"><div className="stat-value" style={{color:'#2563eb'}}>{analytics.byStatus.published||0}</div><div className="stat-label">Published</div></div>
              <div className="stat-card"><div className="stat-value" style={{color:'#d97706'}}>{analytics.byStatus.draft||0}</div><div className="stat-label">Draft</div></div>
            </div>
            <div className="analytics-grid">
              <div className="analytics-card">
                <h4 className="analytics-title">By Type</h4>
                {Object.entries(analytics.byType).map(([t, c]) => c > 0 && (
                  <div key={t} className="analytics-row">
                    <span>{BADGE[t]?.label||t}</span><span className="analytics-count">{c}</span>
                  </div>
                ))}
                {analytics.total === 0 && <div className="analytics-empty">No data</div>}
              </div>
              <div className="analytics-card">
                <h4 className="analytics-title">By Status</h4>
                {Object.entries(analytics.byStatus).map(([s, c]) => c > 0 && (
                  <div key={s} className="analytics-row">
                    <span style={{textTransform:'capitalize'}}>{s}</span><span className="analytics-count">{c}</span>
                  </div>
                ))}
                {analytics.total === 0 && <div className="analytics-empty">No data</div>}
              </div>
            </div>
            <div className="analytics-card">
              <h4 className="analytics-title">By Topic</h4>
              {Object.entries(analytics.byTopic).map(([t, c]) => (
                <div key={t} className="analytics-row">
                  <span>{t}</span><span className="analytics-count">{c}</span>
                </div>
              ))}
              {analytics.total === 0 && <div className="analytics-empty">No data</div>}
            </div>
          </div>
        )}

        {/* ════════════════════════════
            SIDEBAR
            ════════════════════════════ */}
        {activeTab === 'editor' && (
          <div className="sidebar">
            <div className="sidebar-card">
              <div className="sidebar-header">
                <h4 className="sidebar-title">Session Log</h4>
                <span className="session-count">{sessionLog.length} actions</span>
              </div>
              <div className="session-log">
                {sessionLog.slice().reverse().map((entry, i) => (
                  <div key={i} className="session-entry">
                    <span className={`session-method ${entry._method==='POST' ? 'post' : 'put'}`}>
                      {entry._method==='POST' ? '✓' : '✎'} Q{entry.questionNumber}
                    </span>
                    <span className="session-type">{entry.questionType}</span>
                    <span className="session-time">{new Date(entry._at).toLocaleTimeString()}</span>
                  </div>
                ))}
                {sessionLog.length === 0 && <div className="session-empty">No activity yet</div>}
              </div>
            </div>
            <div className="sidebar-card">
              <h4 className="sidebar-title">Quick Stats</h4>
              <div className="quick-stats">
                <div className="quick-stat">
                  <div className="quick-stat-value">{Object.keys(existingQs).length}</div>
                  <div className="quick-stat-label">Questions</div>
                </div>
                <div className="quick-stat">
                  <div className="quick-stat-value">{localBackups.length}</div>
                  <div className="quick-stat-label">Local Backups</div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}