import React, { useState, useMemo, useCallback } from 'react';
import {
  CheckCircle2, AlertTriangle, ChevronDown, ChevronUp,
  Edit3, RefreshCw, ArrowLeft, Hash, Tag, AlertCircle, Check,
  ChevronRight,
} from 'lucide-react';

const LIMITS = {
  questionText: 500,
  explanation: 1500,
  topic: 100,
  optionText: 150,
  pairSide: 150,
  assertion: 600,
  reason: 600,
  maxOptions: 8,
  minOptions: 2,
  maxPairs: 12,
};

const BADGE = {
  MCQ:              { label: 'MCQ',               bg: 'rgba(46,124,246,0.12)',  color: '#2563eb' },
  ASSERTION_REASON: { label: 'Assertion & Reason', bg: 'rgba(155,114,248,0.12)', color: '#7c3aed' },
  MATCHING:         { label: 'Match Following',    bg: 'rgba(16,196,123,0.10)', color: '#059669' },
};

function clamp(v, max) {
  if (v == null) return '';
  const s = String(v);
  return s.length > max ? s.slice(0, max) : s;
}

function richToHtml(raw) {
  if (!raw) return '';
  let s = raw
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
  s = s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  s = s.replace(/__(.+?)__/g, '<u>$1</u>');
  s = s.replace(/(?<!_)_(.+?)_(?!_)/g, '<i>$1</i>');
  s = s.replace(/\^(.+?)\^/g, '<sup>$1</sup>');
  s = s.replace(/~(.+?)~/g, '<sub>$1</sub>');
  return s;
}

function assignQuestionNumbers(rawItems, existingQs, totalQuestions) {
  const used = new Set(
    rawItems.filter(q => q._assignedNum).map(q => q._assignedNum)
  );
  const taken = new Set([
    ...Object.keys(existingQs).map(Number),
    ...used,
  ]);
  const pool = [];
  for (let i = 1; i <= totalQuestions; i++) {
    if (!taken.has(i)) pool.push(i);
  }

  let poolIdx = 0;
  return rawItems.map(q => {
    if (q._assignedNum && existingQs[q._assignedNum]) {
      const next = pool[poolIdx++] ?? null;
      return { ...q, _assignedNum: next };
    }
    if (q._assignedNum) return q;
    const next = pool[poolIdx++] ?? null;
    return { ...q, _assignedNum: next };
  });
}

function correctAnswerToLetter(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return String.fromCharCode(64 + value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim().toUpperCase();
    if (/^[A-Z]$/.test(trimmed)) return trimmed;
    const num = Number(trimmed);
    if (!Number.isNaN(num) && num > 0) return String.fromCharCode(64 + num);
  }
  return null;
}

function normaliseItem(raw, idx) {
  const q = { ...raw };

  if (Array.isArray(q.pairs)) {
    q.pairs = q.pairs.map(p => {
      if (typeof p === 'string') {
        const parts = p.split('|');
        return { a: parts[0] || '', b: parts[1] || '' };
      }
      if (p && typeof p === 'object') {
        return { a: p.a || p.left || '', b: p.b || p.right || '' };
      }
      return { a: '', b: '' };
    });
  }

  if (q.correctAnswer != null && typeof q.correctAnswer === 'number') {
    if (Array.isArray(q.options) && q.correctAnswer < q.options.length) {
      q.correctAnswer = q.correctAnswer + 1;
    }
  }

  return {
    _importIdx: idx,
    _assignedNum: q.questionNumber ? Number(q.questionNumber) : null,
    _status: 'pending',
    _error: null,
    ...q,
  };
}

function validateItem(q, existingQs, allAssignedElsewhere) {
  const issues = [];
  if (!q.question?.trim())       issues.push('Question text is empty');
  if (!q.topic?.trim())          issues.push('Topic is missing');
  if (!q.explanation?.trim())    issues.push('Explanation is missing');
  if (!q._assignedNum)           issues.push('No question number assigned');

  if (q._assignedNum && existingQs && existingQs[q._assignedNum]) {
    issues.push(`Q${q._assignedNum} already exists on server — choose a different number`);
  }

  if (q._assignedNum && allAssignedElsewhere && allAssignedElsewhere.has(q._assignedNum)) {
    issues.push(`Q${q._assignedNum} is used by another question in this import — choose a different number`);
  }

  const t = q.questionType;
  if (t !== 'MATCHING') {
    if (!Array.isArray(q.options) || q.options.length < 2)
      issues.push('Needs at least 2 options');
    if (q.correctAnswer == null)
      issues.push('Correct answer not set');
  }
  if (t === 'MATCHING') {
    const filled = (q.pairs || []).filter(p => p.a?.trim() || p.b?.trim());
    if (!filled.length) issues.push('No matching pairs');
  }
  if (t === 'ASSERTION_REASON') {
    if (!q.assertion?.trim()) issues.push('Assertion (A) is empty');
    if (!q.reason?.trim())    issues.push('Reason (R) is empty');
  }
  return issues;
}

function ItemEditor({ item, existingQs, totalQuestions, allAssigned, onUpdate, onDiscard }) {
  const [local, setLocal] = useState(() => ({
    question:     item.question     || '',
    explanation:  item.explanation  || '',
    topic:        item.topic        || '',
    questionType: item.questionType || 'MCQ',
    weightage:    item.weightage    || 1,
    correctAnswer: item.correctAnswer ?? null,
    options:      item.options || ['', '', '', ''],
    pairs:        item.pairs   || [{ a:'', b:'' }, { a:'', b:'' }],
    assertion:    item.assertion || '',
    reason:       item.reason   || '',
    _assignedNum: item._assignedNum,
  }));

  const takenByOthers = useMemo(() => {
    return new Set([
      ...Object.keys(existingQs).map(Number),
      ...allAssigned.filter(n => n !== item._assignedNum),
    ]);
  }, [existingQs, allAssigned, item._assignedNum]);

  const availableNums = useMemo(() => {
    const nums = [];
    for (let i = 1; i <= totalQuestions; i++) {
      const isServerTaken = !!existingQs[i];
      if (isServerTaken) continue;
      if (!takenByOthers.has(i) || i === item._assignedNum) nums.push(i);
    }
    return nums;
  }, [takenByOthers, totalQuestions, item._assignedNum, existingQs]);

  const isDuplicateNumber =
    !!(local._assignedNum && existingQs[local._assignedNum]) ||
    !!(local._assignedNum && takenByOthers.has(local._assignedNum));

  const save = () => {
    if (local._assignedNum && existingQs[local._assignedNum]) {
      alert(`Q${local._assignedNum} already exists on the server. Please choose a different question number.`);
      return;
    }
    if (local._assignedNum && takenByOthers.has(local._assignedNum)) {
      alert(`Q${local._assignedNum} is already used by another question in this import. Please choose a different number.`);
      return;
    }
    onUpdate({ ...item, ...local });
  };

  return (
    <div style={{ marginBottom: '16px', padding: '16px', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>Question #</label>
          <select
            value={local._assignedNum || ''}
            onChange={e => setLocal(p => ({ ...p, _assignedNum: e.target.value ? Number(e.target.value) : null }))}
            style={{ width: '100%', padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: '4px' }}
          >
            <option value="">— unassigned —</option>
            {availableNums.map(n => (
              <option key={n} value={n}>Q{n}</option>
            ))}
          </select>
          {isDuplicateNumber && (
            <div style={{ marginTop: '4px', color: '#ef4444', fontSize: '13px' }}>
              Q{local._assignedNum} is already taken. Please choose a different number.
            </div>
          )}
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>Type</label>
          <select
            value={local.questionType}
            onChange={e => setLocal(p => ({ ...p, questionType: e.target.value, correctAnswer: null }))}
            style={{ width: '100%', padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: '4px' }}
          >
            <option value="MCQ">MCQ</option>
            <option value="ASSERTION_REASON">Assertion & Reason</option>
            <option value="MATCHING">Match Following</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>Topic</label>
          <input
            value={local.topic}
            maxLength={LIMITS.topic}
            onChange={e => setLocal(p => ({ ...p, topic: e.target.value }))}
            placeholder="Topic"
            style={{ width: '100%', padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: '4px' }}
          />
        </div>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>Question Text</label>
        <textarea
          value={local.question}
          maxLength={LIMITS.questionText}
          rows={3}
          onChange={e => setLocal(p => ({ ...p, question: clamp(e.target.value, LIMITS.questionText) }))}
          style={{ width: '100%', padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: '4px', fontFamily: 'inherit' }}
        />
      </div>

      {local.questionType === 'ASSERTION_REASON' && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>Assertion (A)</label>
            <textarea rows={2} value={local.assertion}
              onChange={e => setLocal(p => ({ ...p, assertion: e.target.value }))}
              style={{ width: '100%', padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: '4px', fontFamily: 'inherit' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>Reason (R)</label>
            <textarea rows={2} value={local.reason}
              onChange={e => setLocal(p => ({ ...p, reason: e.target.value }))}
              style={{ width: '100%', padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: '4px', fontFamily: 'inherit' }} />
          </div>
        </div>
      )}

      {local.questionType !== 'MATCHING' && (
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>Options</label>
          {(local.options || []).map((opt, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{ fontWeight: '500' }}>{String.fromCharCode(65 + i)}.</span>
              <input value={opt} maxLength={LIMITS.optionText}
                onChange={e => {
                  const o = [...local.options]; o[i] = e.target.value;
                  setLocal(p => ({ ...p, options: o }));
                }}
                style={{ flex: 1, padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: '4px' }} />
              <button
                onClick={() => setLocal(p => ({ ...p, correctAnswer: i + 1 }))}
                title="Mark as correct"
                style={{ padding: '4px 12px', backgroundColor: local.correctAnswer === i + 1 ? '#10B981' : '#e5e7eb', color: local.correctAnswer === i + 1 ? 'white' : 'black', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >✓</button>
            </div>
          ))}
          {local.correctAnswer == null && (
            <div style={{ color: '#f59e0b', fontSize: '13px', marginTop: '4px' }}>Select the correct answer above</div>
          )}
        </div>
      )}

      {local.questionType === 'MATCHING' && (
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>Pairs</label>
          {(local.pairs || []).map((pair, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <input value={pair.a} placeholder="Left"
                onChange={e => {
                  const p = local.pairs.map((x, j) => j === i ? { ...x, a: e.target.value } : x);
                  setLocal(prev => ({ ...prev, pairs: p }));
                }}
                style={{ flex: 1, padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: '4px' }} />
              <span style={{ fontWeight: '500' }}>↔</span>
              <input value={pair.b} placeholder="Right"
                onChange={e => {
                  const p = local.pairs.map((x, j) => j === i ? { ...x, b: e.target.value } : x);
                  setLocal(prev => ({ ...prev, pairs: p }));
                }}
                style={{ flex: 1, padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: '4px' }} />
            </div>
          ))}
        </div>
      )}

      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>Explanation</label>
        <textarea rows={2} value={local.explanation} maxLength={LIMITS.explanation}
          onChange={e => setLocal(p => ({ ...p, explanation: clamp(e.target.value, LIMITS.explanation) }))}
          style={{ width: '100%', padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: '4px', fontFamily: 'inherit' }} />
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={save}
          disabled={isDuplicateNumber}
          style={{ padding: '6px 16px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <Check size={13}/> Apply Changes
        </button>
        <button onClick={onDiscard} style={{ padding: '6px 16px', backgroundColor: '#e5e7eb', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
      </div>
    </div>
  );
}

function ReviewCard({
  item, existingQs, totalQuestions, allAssigned,
  onUpdate, onSave, isSaving,
}) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const allAssignedElsewhere = useMemo(
    () => new Set(allAssigned.filter(n => n !== item._assignedNum)),
    [allAssigned, item._assignedNum]
  );

  const issues = validateItem(item, existingQs, allAssignedElsewhere);
  const isConflict =
    !!(item._assignedNum && existingQs[item._assignedNum]) ||
    !!(item._assignedNum && allAssignedElsewhere.has(item._assignedNum));

  const statusIcon = {
    saved:   <CheckCircle2 size={14} color="#10C47B" />,
    error:   <AlertTriangle size={14} color="#ef4444" />,
    pending: issues.length
      ? <AlertCircle size={14} color="#f59e0b" />
      : <Hash size={14} color="#2E7CF6" />,
  }[item._status] || null;

  return (
    <div style={{ marginBottom: '16px', padding: '16px', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {statusIcon}
          <span style={{ fontWeight: '600' }}>
            {item._assignedNum ? `Q${item._assignedNum}` : <span style={{ color: '#6b7280' }}>No # assigned</span>}
          </span>
          <span style={{ 
            padding: '2px 8px', 
            borderRadius: '4px', 
            fontSize: '12px',
            backgroundColor: BADGE[item.questionType]?.bg || '#e5e7eb',
            color: BADGE[item.questionType]?.color || '#374151'
          }}>
            {BADGE[item.questionType]?.label || item.questionType}
          </span>
          {isConflict && item._status !== 'saved' && (
            <span style={{ color: '#ef4444', fontSize: '13px' }}>
              Q{item._assignedNum} already taken
            </span>
          )}
          {item._status === 'saved' && (
            <span style={{ color: '#10B981', fontSize: '13px' }}>✓ Saved to server</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {item._status !== 'saved' && (
            <>
              <button onClick={() => setEditing(e => !e)} style={{ padding: '4px 8px', backgroundColor: '#e5e7eb', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
                <Edit3 size={12}/> {editing ? 'Close' : 'Edit'}
              </button>
              <button
                disabled={issues.length > 0 || isSaving || isConflict}
                onClick={() => onSave(item)}
                title={isConflict ? `Q${item._assignedNum} already taken — choose a different number` : issues.join('\n')}
                style={{ padding: '4px 8px', backgroundColor: isSaving || issues.length > 0 || isConflict ? '#d1d5db' : '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: isSaving || issues.length > 0 || isConflict ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}
              >
                {isSaving
                  ? <><RefreshCw size={12}/> Saving…</>
                  : <><Check size={12}/> Save</>
                }
              </button>
            </>
          )}
          <button onClick={() => setExpanded(e => !e)} style={{ padding: '4px 8px', backgroundColor: 'transparent', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }}>
            {expanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
          </button>
        </div>
      </div>

      <div
        dangerouslySetInnerHTML={{ __html: richToHtml(item.question || '(no question text)') }}
        style={{ marginBottom: '6px', padding: '8px', backgroundColor: '#f9fafb', borderRadius: '4px' }}
      />

      {item.topic && <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '6px' }}><Tag size={11}/> {item.topic}</div>}

      {issues.length > 0 && item._status !== 'saved' && (
        <div style={{ marginBottom: '6px' }}>
          {issues.map((iss, i) => (
            <span key={i} style={{ display: 'inline-block', backgroundColor: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', marginRight: '4px', marginBottom: '2px' }}>
              {iss}
            </span>
          ))}
        </div>
      )}

      {item._status === 'error' && item._error && (
        <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '6px' }}>Server error: {item._error}</div>
      )}

      {expanded && (
        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e5e7eb' }}>
          {item.questionType === 'ASSERTION_REASON' && (
            <>
              <div style={{ marginBottom: '4px' }}><strong>A:</strong> {item.assertion}</div>
              <div><strong>R:</strong> {item.reason}</div>
            </>
          )}
          {item.questionType === 'MATCHING' && (
            <div>
              {(item.pairs || []).map((p, i) => (
                <div key={i} style={{ marginBottom: '2px' }}>
                  <span>{p.a}</span><span style={{ margin: '0 8px' }}>↔</span><span>{p.b}</span>
                </div>
              ))}
            </div>
          )}
          {Array.isArray(item.options) && item.options.length > 0 && (
            <div>
              {item.options.map((o, i) => (
                <div key={i} style={{ marginBottom: '2px' }}>
                  <span style={{ fontWeight: '500' }}>{String.fromCharCode(65 + i)}.</span> {o}
                  {item.correctAnswer === i + 1 && <span style={{ color: '#10B981', marginLeft: '4px' }}>✓</span>}
                </div>
              ))}
            </div>
          )}
          {item.explanation && (
            <div style={{ marginTop: '6px' }}>
              <strong>Explanation:</strong>
              <div dangerouslySetInnerHTML={{ __html: richToHtml(item.explanation) }} style={{ marginTop: '2px', padding: '8px', backgroundColor: '#f9fafb', borderRadius: '4px' }} />
            </div>
          )}
        </div>
      )}

      {editing && item._status !== 'saved' && (
        <ItemEditor
          item={item}
          existingQs={existingQs}
          totalQuestions={totalQuestions}
          allAssigned={allAssigned}
          onUpdate={(updated) => { onUpdate(updated); setEditing(false); }}
          onDiscard={() => setEditing(false)}
        />
      )}
    </div>
  );
}

export default function ImportReview({
  rawImported,
  existingQs,
  testInfo,
  questionUrl,
  token,
  onFinish,
  onQuestionSaved,
}) {
  const [items, setItems] = useState(() => {
    const normalised = rawImported.map(normaliseItem);
    return assignQuestionNumbers(normalised, existingQs, testInfo.totalQuestions || 100);
  });

  const [savingIdx, setSavingIdx] = useState(null);
  const [savingAll, setSavingAll] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [toast, setToast] = useState({ msg: '', type: '' });

  const showToast = (msg, type, dur = 2500) => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: '' }), dur);
  };

  const allAssigned = useMemo(
    () => items.map(i => i._assignedNum).filter(Boolean),
    [items]
  );

  const isItemReady = useCallback((item) => {
    if (item._status !== 'pending') return false;
    const elsewhere = new Set(allAssigned.filter(n => n !== item._assignedNum));
    return validateItem(item, existingQs, elsewhere).length === 0;
  }, [allAssigned, existingQs]);

  const stats = useMemo(() => ({
    total:   items.length,
    pending: items.filter(i => i._status === 'pending').length,
    saved:   items.filter(i => i._status === 'saved').length,
    error:   items.filter(i => i._status === 'error').length,
    ready:   items.filter(isItemReady).length,
  }), [items, isItemReady]);

  const filtered = useMemo(() => {
    if (filterStatus === 'all')    return items;
    if (filterStatus === 'ready')  return items.filter(isItemReady);
    if (filterStatus === 'issues') return items.filter(i => i._status === 'pending' && !isItemReady(i));
    if (filterStatus === 'saved')  return items.filter(i => i._status === 'saved');
    return items;
  }, [items, filterStatus, isItemReady]);

  const updateItem = (updated) => {
    setItems(prev => {
      const others = prev.filter(i => i._importIdx !== updated._importIdx);
      const numTakenByOthers = updated._assignedNum != null &&
        others.some(i => i._assignedNum === updated._assignedNum);
      const numTakenByServer = updated._assignedNum != null && !!existingQs[updated._assignedNum];

      if (numTakenByOthers || numTakenByServer) {
        showToast(`Q${updated._assignedNum} is already taken — number cleared, please pick another`, 'err', 4000);
        return prev.map(i =>
          i._importIdx === updated._importIdx ? { ...updated, _assignedNum: null, _status: 'pending' } : i
        );
      }

      return prev.map(i =>
        i._importIdx === updated._importIdx ? { ...updated, _status: 'pending' } : i
      );
    });
  };

  const buildPayload = (item) => {
    const payload = {
      testId:         testInfo.testId,
      questionNumber: item._assignedNum,
      questionType:   item.questionType,
      question:       clamp(item.question?.trim(), LIMITS.questionText),
      topic:          clamp(item.topic?.trim(),    LIMITS.topic),
      weightage:      item.weightage || 1,
      explanation:    clamp(item.explanation?.trim(), LIMITS.explanation),
    };

    if (item.questionType !== 'MATCHING') {
      payload.options       = (item.options || []).slice(0, LIMITS.maxOptions).map(o => clamp(o, LIMITS.optionText));
      const letter = correctAnswerToLetter(item.correctAnswer);
      if (letter) payload.correctAnswer = letter;
    }

    if (item.questionType === 'MATCHING') {
      payload.pairs   = (item.pairs || []).slice(0, LIMITS.maxPairs).map(p =>
        `${clamp(p.a, LIMITS.pairSide)}|${clamp(p.b, LIMITS.pairSide)}`
      );
      payload.options = (item.options || []).slice(0, LIMITS.maxOptions).map(o => clamp(o, LIMITS.optionText));
      const letter = correctAnswerToLetter(item.correctAnswer);
      if (letter) payload.correctAnswer = letter;
    }

    if (item.questionType === 'ASSERTION_REASON') {
      payload.assertion = clamp(item.assertion, LIMITS.assertion);
      payload.reason    = clamp(item.reason,    LIMITS.reason);
    }

    return payload;
  };

  const saveItem = useCallback(async (item) => {
    if (item._assignedNum && existingQs[item._assignedNum]) {
      showToast(`Q${item._assignedNum} already exists on server — choose a different number`, 'err', 4000);
      return;
    }

    const conflictsInBatch = items.some(
      i => i._importIdx !== item._importIdx && i._assignedNum === item._assignedNum
    );
    if (conflictsInBatch) {
      showToast(`Q${item._assignedNum} is used by another question in this import — choose a different number`, 'err', 4000);
      return;
    }

    const elsewhere = new Set(allAssigned.filter(n => n !== item._assignedNum));
    const issues = validateItem(item, existingQs, elsewhere);
    if (issues.length) { showToast(`Fix issues first: ${issues[0]}`, 'err'); return; }

    setSavingIdx(item._importIdx);

    try {
      const payload  = buildPayload(item);
      const response = await fetch(questionUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (response.ok && data.success) {
        setItems(prev => prev.map(i =>
          i._importIdx === item._importIdx ? { ...i, _status: 'saved', _error: null } : i
        ));
        onQuestionSaved(item._assignedNum, payload);
        showToast(`Q${item._assignedNum} saved`, 'ok');
      } else {
        setItems(prev => prev.map(i =>
          i._importIdx === item._importIdx
            ? { ...i, _status: 'error', _error: data.message || 'API error' } : i
        ));
        showToast(`Q${item._assignedNum}: ${data.message || 'Error'}`, 'err');
      }
    } catch (err) {
      setItems(prev => prev.map(i =>
        i._importIdx === item._importIdx
          ? { ...i, _status: 'error', _error: err.message } : i
      ));
      showToast(`Network error: ${err.message}`, 'err');
    } finally {
      setSavingIdx(null);
    }
  }, [existingQs, questionUrl, testInfo, items, allAssigned]);

  const saveAll = async () => {
    const ready = items.filter(isItemReady);
    if (!ready.length) { showToast('No valid questions to save', 'err'); return; }

    setSavingAll(true);
    let savedCount = 0, errorCount = 0;
    const claimedThisRun = new Set();

    for (const item of ready) {
      if (
        !item._assignedNum ||
        existingQs[item._assignedNum] ||
        claimedThisRun.has(item._assignedNum)
      ) {
        setItems(prev => prev.map(i =>
          i._importIdx === item._importIdx
            ? { ...i, _status: 'error', _error: `Q${item._assignedNum} is already taken` } : i
        ));
        errorCount++;
        continue;
      }

      const elsewhere = new Set(allAssigned.filter(n => n !== item._assignedNum));
      const issues = validateItem(item, existingQs, elsewhere);
      if (issues.length) { errorCount++; continue; }

      claimedThisRun.add(item._assignedNum);

      try {
        const payload  = buildPayload(item);
        const response = await fetch(questionUrl, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        const data = await response.json();

        if (response.ok && data.success) {
          console.log(`Q${item._assignedNum} saved`);
          setItems(prev => prev.map(i =>
            i._importIdx === item._importIdx ? { ...i, _status: 'saved', _error: null } : i
          ));
          onQuestionSaved(item._assignedNum, payload);
          savedCount++;
        } else {
          console.log(`Failed Q${item._assignedNum}`);
          setItems(prev => prev.map(i =>
            i._importIdx === item._importIdx
              ? { ...i, _status: 'error', _error: data.message || 'API error' } : i
          ));
          errorCount++;
        }
      } catch (err) {
        console.error(err);
        setItems(prev => prev.map(i =>
          i._importIdx === item._importIdx
            ? { ...i, _status: 'error', _error: err.message } : i
        ));
        errorCount++;
      }

      // optional delay
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    setSavingAll(false);
    showToast(
      errorCount === 0
        ? `All ${savedCount} questions saved`
        : `${savedCount} saved, ${errorCount} failed`,
      errorCount === 0 ? 'ok' : 'err',
      4000
    );
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      {toast.msg && (
        <div style={{ 
          position: 'fixed', 
          top: '20px', 
          right: '20px', 
          backgroundColor: toast.type === 'ok' ? '#10B981' : '#ef4444', 
          color: 'white', 
          padding: '12px 20px', 
          borderRadius: '8px', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          zIndex: 50
        }}>
          {toast.type === 'ok'  ? <CheckCircle2 size={15}/> : <AlertTriangle size={15}/>}
          {toast.msg}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={onFinish} style={{ padding: '8px 16px', backgroundColor: '#e5e7eb', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ArrowLeft size={15}/> Back
          </button>
          <div>
            <h2 style={{ margin: '0', fontSize: '20px', fontWeight: '600' }}>Review Imported Questions</h2>
            <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#6b7280' }}>
              {stats.saved}/{stats.total} saved · {stats.ready} ready · {stats.pending - stats.ready} need fixes
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={saveAll}
            disabled={savingAll || stats.ready === 0}
            style={{ 
              padding: '8px 16px', 
              backgroundColor: savingAll || stats.ready === 0 ? '#d1d5db' : '#2563eb', 
              color: 'white', 
              border: 'none', 
              borderRadius: '6px', 
              cursor: savingAll || stats.ready === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            {savingAll
              ? <><RefreshCw size={14}/> Saving {stats.ready}…</>
              : <>Save All Ready ({stats.ready})</>
            }
          </button>
          <button onClick={onFinish} style={{ padding: '8px 16px', backgroundColor: '#10B981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
            Done <ChevronRight size={14}/>
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #e5e7eb', paddingBottom: '12px' }}>
        {[
          { key: 'all',    label: `All (${stats.total})` },
          { key: 'ready',  label: `Ready (${stats.ready})` },
          { key: 'issues', label: `Needs Fix (${stats.pending - stats.ready})` },
          { key: 'saved',  label: `Saved (${stats.saved})` },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilterStatus(f.key)}
            style={{ 
              padding: '6px 12px', 
              backgroundColor: filterStatus === f.key ? '#2563eb' : 'transparent',
              color: filterStatus === f.key ? 'white' : '#374151',
              border: filterStatus === f.key ? 'none' : '1px solid #d1d5db',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ height: '6px', backgroundColor: '#e5e7eb', borderRadius: '3px', marginBottom: '16px', overflow: 'hidden' }}>
        <div
          style={{ 
            width: stats.total ? `${(stats.saved / stats.total) * 100}%` : '0%',
            height: '100%',
            backgroundColor: '#10B981',
            transition: 'width 0.3s ease'
          }}
        />
      </div>

      <div>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#6b7280' }}>No questions in this filter</div>
        )}
        {filtered.map(item => (
          <ReviewCard
            key={item._importIdx}
            item={item}
            existingQs={existingQs}
            totalQuestions={testInfo.totalQuestions || 100}
            allAssigned={allAssigned}
            onUpdate={updateItem}
            onSave={saveItem}
            isSaving={savingIdx === item._importIdx}
          />
        ))}
      </div>
    </div>
  );
}