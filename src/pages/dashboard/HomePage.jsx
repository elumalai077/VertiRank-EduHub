import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../../components/TopBar';
import '../../styles/homepage.css'; // Import the CSS file

// API Configuration
const BASE = "https://dwfjhagcg1.execute-api.ap-south-1.amazonaws.com/default";
const IMAGE_BASE = "https://mergd23fhc.execute-api.ap-south-1.amazonaws.com/default";
const API = {
  createBatch: `${BASE}/batch-create`,
  getAllBatches: `${BASE}/batch-get-all`,
  getBatch: (id) => `${BASE}/batch/${id}`,
  updateBatch: (id) => `${BASE}/batch/${id}`,
  deleteBatch: (id) => `${BASE}/batch/${id}`,
};
const IMAGE_API = {
  generateUploadUrl: `${IMAGE_BASE}/generateUploadUrl`,
  generatedGetUrl: `${IMAGE_BASE}/generatedGetUrl`,
};

// Constants
const MAX_BATCHES = 10;
const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_INSTRUCTION_LENGTH = 2000;
const MAX_STUDENTS_PER_BATCH = 10000;
const MAX_JOIN_CODE_LENGTH = 50;
const MAX_IMAGE_SIZE_BYTES = 100 * 1024;
const IMAGE_WIDTH = 1280;
const IMAGE_HEIGHT = 720;
const IMAGE_ASPECT_RATIO = IMAGE_WIDTH / IMAGE_HEIGHT;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// ---------------------------------------------------------------------------
// Editorial design tokens
// Warm paper background, ink-charcoal text, single burnt-sienna accent.
// Serif display face for headings/numerals, sans for UI, mono for IDs.
// ---------------------------------------------------------------------------
const T = {
  bg: '#F7F4EE',
  surface: '#FFFFFF',
  ink: '#2B2824',
  inkSoft: '#5B5650',
  muted: '#9C958A',
  line: '#E1DCD2',
  lineStrong: '#CFC8BC',
  accent: '#B5562B',
  accentSoft: '#F1E2D7',
  danger: '#A23B2E',
  success: '#4F7359',
  info: '#4A6FA5',
  serif: "'Source Serif 4', 'Iowan Old Style', Georgia, serif",
  sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  mono: "'IBM Plex Mono', 'SF Mono', Menlo, monospace",
};

// Utility Functions
const getToken = () => {
  const token = localStorage.getItem("token");
  return token || "";
};

const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

const normalizeImageKey = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') {
    return (
      value.imageKey ||
      value.key ||
      value.fileKey ||
      value.image_key ||
      value.s3Key ||
      ''
    );
  }
  return '';
};

const uploadBannerImage = async (file) => {
  const contentType = file.type || 'image/jpeg';
  const fileName = file.name || `banner-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const uploadResponse = await fetch(IMAGE_API.generateUploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName, contentType }),
  });

  const uploadData = await uploadResponse.json().catch(() => ({}));

  if (!uploadResponse.ok) {
    throw new Error(uploadData.message || 'Unable to get an upload URL.');
  }

  const uploadUrl = uploadData.uploadUrl || uploadData.url || uploadData.presignedUrl;
  const imageKey = normalizeImageKey(uploadData.imageKey || uploadData.key || uploadData.fileKey);

  if (!uploadUrl || !imageKey) {
    throw new Error('The upload response was incomplete.');
  }

  const putResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  });

  if (!putResponse.ok) {
    throw new Error('Image upload failed.');
  }

  return imageKey;
};

const getSignedImageUrl = async (imageKey) => {
  const key = normalizeImageKey(imageKey);
  if (!key) return '';

  const response = await fetch(IMAGE_API.generatedGetUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageKey: key }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Unable to fetch a temporary image URL.');
  }

  return data.url || data.signedUrl || data.presignedUrl || data.imageUrl || data.downloadUrl || '';
};

const validateBatchData = (data) => {
  const errors = {};

  if (!data.batchName || data.batchName.trim() === "") {
    errors.batchName = "Batch name is required";
  } else if (data.batchName.length > MAX_NAME_LENGTH) {
    errors.batchName = `Batch name cannot exceed ${MAX_NAME_LENGTH} characters`;
  }

  if (data.description && data.description.length > MAX_DESCRIPTION_LENGTH) {
    errors.description = `Description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters`;
  }

  if (data.instruction && data.instruction.length > MAX_INSTRUCTION_LENGTH) {
    errors.instruction = `Instructions cannot exceed ${MAX_INSTRUCTION_LENGTH} characters`;
  }

  if (!data.joinOption) {
    errors.joinOption = "Join option is required";
  } else if (!['public', 'manual', 'code'].includes(data.joinOption)) {
    errors.joinOption = "Invalid join option";
  }

  if (data.joinOption === 'code') {
    if (!data.joinCode || data.joinCode.trim() === "") {
      errors.joinCode = "Join code is required for code-based joining";
    } else if (data.joinCode.length > MAX_JOIN_CODE_LENGTH) {
      errors.joinCode = `Join code cannot exceed ${MAX_JOIN_CODE_LENGTH} characters`;
    }
  }

  if (data.maxStudents) {
    const maxStudents = parseInt(data.maxStudents);
    if (isNaN(maxStudents) || maxStudents < 1) {
      errors.maxStudents = "Maximum students must be a positive number";
    } else if (maxStudents > MAX_STUDENTS_PER_BATCH) {
      errors.maxStudents = `Maximum students cannot exceed ${MAX_STUDENTS_PER_BATCH}`;
    }
  }

  return errors;
};

const sanitizeInput = (text) => {
  if (!text) return '';
  return text.replace(/[<>]/g, '').trim();
};

const formatDate = (date, locale = 'en-IN', options = {}) => {
  if (!date) return '—';
  const defaultOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  return new Date(date).toLocaleDateString(locale, { ...defaultOptions, ...options });
};

const formatDateTime = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};

// Component: Text with inline links and line breaks
const LinkedText = ({ text, className = '' }) => {
  if (!text) return null;
  const parts = text.split(/(https?:\/\/[^\s<]+)/g);
  return (
    <div className={`linked-text ${className}`} style={{ whiteSpace: 'pre-line', color: T.inkSoft }}>
      {parts.map((part, index) => {
        if (part.match(/^https?:\/\//)) {
          return (
            <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="inline-link"
              style={{ color: T.accent, textDecoration: 'underline' }} onClick={(e) => e.stopPropagation()}>
              {part}
            </a>
          );
        }
        const lines = part.split('\n');
        return lines.map((line, lineIndex) => (
          <React.Fragment key={`${index}-${lineIndex}`}>
            {line}
            {lineIndex < lines.length - 1 && <br />}
          </React.Fragment>
        ));
      })}
    </div>
  );
};

// Component: For displaying formatted text in modals
const FormattedText = ({ text, className = '' }) => {
  if (!text) return null;
  const parts = text.split(/(https?:\/\/[^\s<]+)/g);
  return (
    <div className={`formatted-text ${className}`} style={{ whiteSpace: 'pre-wrap', lineHeight: '1.7', color: T.ink, fontFamily: T.serif, fontSize: '16px' }}>
      {parts.map((part, index) => {
        if (part.match(/^https?:\/\//)) {
          return (
            <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="inline-link"
              style={{ color: T.accent, textDecoration: 'underline' }}>
              {part}
            </a>
          );
        }
        const lines = part.split('\n');
        return lines.map((line, lineIndex) => (
          <React.Fragment key={`${index}-${lineIndex}`}>
            {line}
            {lineIndex < lines.length - 1 && <br />}
          </React.Fragment>
        ));
      })}
    </div>
  );
};

// Toast Component
const Toast = ({ message, type, onClose, position = 'bottom-right', animation = 'slide' }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
  }, [onClose]);

  const toastAccent = { success: T.success, error: T.danger, warning: T.accent, info: T.inkSoft };
  const icon = { success: '✓', warning: '!', error: '×', info: 'i' }[type] || 'i';

  return (
    <div className={`toast toast-${type} toast-${position} toast-animation-${animation}`}
      style={{
        background: T.surface, color: T.ink, border: `1px solid ${T.line}`,
        borderLeft: `3px solid ${toastAccent[type] || toastAccent.info}`, borderRadius: '2px',
        boxShadow: '0 4px 16px rgba(43,40,36,0.08)', fontFamily: T.sans,
        display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px',
      }}>
      <span style={{ color: toastAccent[type] || toastAccent.info, fontFamily: T.serif, fontStyle: 'italic', fontSize: '16px', fontWeight: 600 }}>
        {icon}
      </span>
      <span style={{ fontSize: '14px', flex: 1 }}>{message}</span>
      <button onClick={onClose} aria-label="Dismiss"
        style={{ color: T.muted, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}>
        ×
      </button>
    </div>
  );
};

// Spinner Component
const Spinner = ({ size = 20, color = T.accent, variant = 'default' }) => (
  <span className={`spinner spinner-${variant}`}
    style={{
      width: size, height: size, borderTopColor: color, borderColor: T.line,
      display: 'inline-block', borderWidth: '2px', borderStyle: 'solid',
      borderRadius: '50%', animation: 'spin 0.7s linear infinite',
    }} />
);

// Skeleton Card — shown while the batch list is loading
const SkeletonCard = () => {
  const shimmer = {
    background: `linear-gradient(90deg, ${T.line} 25%, ${T.bg} 37%, ${T.line} 63%)`,
    backgroundSize: '400% 100%',
    animation: 'shimmer 1.4s ease infinite',
    borderRadius: '2px',
  };
  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: '4px', overflow: 'hidden', background: T.surface }}>
      <div style={{ height: '140px', ...shimmer }} />
      <div style={{ padding: '16px' }}>
        <div style={{ height: '18px', width: '70%', marginBottom: '10px', ...shimmer }} />
        <div style={{ height: '12px', width: '100%', marginBottom: '6px', ...shimmer }} />
        <div style={{ height: '12px', width: '85%', marginBottom: '14px', ...shimmer }} />
        <div style={{ height: '6px', width: '100%', ...shimmer }} />
      </div>
    </div>
  );
};

// Modal Component
const Modal = ({ title, children, onClose, onSubmit, submitLabel, isSubmitting, submitVariant = 'primary', size = 'medium' }) => {
  useEffect(() => {
    const handleEscape = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [onClose]);

  return (
    <div role="presentation"
      style={{ backgroundColor: 'rgba(43,40,36,0.45)', position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }}
      onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title}
        style={{
          backgroundColor: T.surface, color: T.ink, border: `1px solid ${T.line}`, borderRadius: '2px',
          width: size === 'small' ? '420px' : size === 'large' ? '720px' : '520px',
          maxWidth: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 12px 40px rgba(43,40,36,0.18)', fontFamily: T.sans,
        }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ borderBottom: `1px solid ${T.line}`, padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: T.ink, fontFamily: T.serif, fontSize: '22px', fontWeight: 600, letterSpacing: '-0.01em' }}>
            {title}
          </span>
          <button onClick={onClose} aria-label="Close"
            style={{ color: T.muted, background: 'transparent', border: 'none', fontSize: '22px', cursor: 'pointer', lineHeight: 1 }}>
            ×
          </button>
        </div>
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>{children}</div>
        <div style={{ borderTop: `1px solid ${T.line}`, padding: '16px 24px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button onClick={onClose} disabled={isSubmitting}
            style={{ color: T.inkSoft, border: `1px solid ${T.lineStrong}`, background: 'transparent', borderRadius: '2px', padding: '9px 18px', fontFamily: T.sans, fontSize: '14px', cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={onSubmit} disabled={isSubmitting}
            style={{
              backgroundColor: submitVariant === 'danger' ? T.danger : T.accent, color: '#FFF', border: 'none',
              borderRadius: '2px', padding: '9px 20px', fontFamily: T.sans, fontSize: '14px', fontWeight: 500,
              cursor: 'pointer', minWidth: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
            {isSubmitting ? <Spinner size={16} color="#fff" /> : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// Copy Button Component
const CopyButton = ({ text, onCopy }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (onCopy) onCopy();
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };
  return (
    <button onClick={handleCopy} title="Copy to clipboard"
      style={{
        background: 'transparent', border: `1px solid ${T.lineStrong}`, borderRadius: '2px', padding: '4px 12px',
        fontFamily: T.sans, fontSize: '12px', color: copied ? T.success : T.inkSoft, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s ease',
      }}>
      {copied ? (<><span style={{ fontSize: '14px' }}>✓</span> Copied!</>) : (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Copy
        </>
      )}
    </button>
  );
};

// Join-option visual config (icon + color), used by both the badge and the form
const JOIN_OPTION_META = {
  public: {
    label: 'Public', color: T.success,
    icon: (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>),
  },
  manual: {
    label: 'Manual', color: T.accent,
    icon: (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8h1a4 4 0 0 1 0 8h-1" /><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" /><line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" /></svg>),
  },
  code: {
    label: 'Code Required', color: T.info,
    icon: (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>),
  },
};

// Capacity progress bar
const CapacityBar = ({ current = 0, max = MAX_STUDENTS_PER_BATCH }) => {
  const pct = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0;
  const barColor = pct >= 90 ? T.danger : pct >= 70 ? T.accent : T.success;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontFamily: T.sans, fontSize: '11px', color: T.inkSoft }}>{current}/{max} students</span>
        <span style={{ fontFamily: T.mono, fontSize: '11px', color: T.muted }}>{pct}%</span>
      </div>
      <div style={{ height: '5px', background: T.line, borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: barColor, transition: 'width 0.3s ease' }} />
      </div>
    </div>
  );
};

// Batch Card Component — grid card replacing the previous full-width row
const BatchCard = ({ batch, onView, onEdit, onDelete, onUserClick }) => {
  const date = formatDate(batch.createdAt);
  const [imageUrl, setImageUrl] = useState('');
  const [hovered, setHovered] = useState(false);
  const imageKey = normalizeImageKey(batch?.imageKey);
  const joinMeta = JOIN_OPTION_META[batch.joinOption] || JOIN_OPTION_META.public;

  const getTruncatedText = (text, maxLength = 110) => {
    if (!text) return 'No description provided.';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '…';
  };

  const handleImageError = async () => {
    if (!imageKey) return;
    try {
      setImageUrl((await getSignedImageUrl(imageKey)) || '');
    } catch {
      setImageUrl('');
    }
  };

  useEffect(() => {
    let active = true;
    const loadImageUrl = async () => {
      if (!imageKey) { if (active) setImageUrl(''); return; }
      try {
        const signedUrl = await getSignedImageUrl(imageKey);
        if (active) setImageUrl(signedUrl || '');
      } catch {
        if (active) setImageUrl('');
      }
    };
    loadImageUrl();
    return () => { active = false; };
  }, [imageKey]);

  return (
    <div
      onClick={() => onView(batch)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', flexDirection: 'column', background: T.surface,
        border: `1px solid ${T.line}`, borderRadius: '4px', overflow: 'hidden',
        cursor: 'pointer', transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
        boxShadow: hovered ? '0 6px 20px rgba(43,40,36,0.10)' : 'none',
        borderColor: hovered ? T.lineStrong : T.line,
      }}
    >
      {/* Banner */}
      <div style={{ position: 'relative', height: '140px', background: T.bg, borderBottom: `1px solid ${T.line}` }}>
        {imageUrl ? (
          <img src={imageUrl} alt={`${batch.batchName} banner`} onError={handleImageError}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: T.serif, fontStyle: 'italic', fontSize: '32px', color: T.muted }}>
              {(batch.batchName || '?').charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        {/* Hover-reveal actions */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '4px',
            opacity: hovered ? 1 : 0, transform: hovered ? 'translateY(0)' : 'translateY(-4px)',
            transition: 'opacity 0.15s ease, transform 0.15s ease',
          }}
        >
          <button onClick={() => onUserClick(batch)} title="View students" style={cardIconBtnStyle}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </button>
          <button onClick={() => onEdit(batch)} title="Edit" style={cardIconBtnStyle}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button onClick={() => onDelete(batch)} title="Delete" style={{ ...cardIconBtnStyle, color: T.danger }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" /><path d="M14 11v6" />
            </svg>
          </button>
        </div>

        {/* Join-option badge */}
        <div
          style={{
            position: 'absolute', bottom: '8px', left: '8px', display: 'flex', alignItems: 'center', gap: '5px',
            background: 'rgba(255,255,255,0.92)', color: joinMeta.color, border: `1px solid ${T.line}`,
            borderRadius: '2px', padding: '3px 8px', fontFamily: T.sans, fontSize: '10px', fontWeight: 600,
            letterSpacing: '0.03em', textTransform: 'uppercase',
          }}
        >
          {joinMeta.icon}
          {joinMeta.label}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ color: T.ink, fontFamily: T.serif, fontSize: '18px', fontWeight: 600, marginBottom: '6px', letterSpacing: '-0.01em' }}>
          {batch.batchName}
        </div>
        <div style={{ fontSize: '13px', lineHeight: '1.55', marginBottom: '14px', flex: 1 }}>
          <LinkedText text={getTruncatedText(batch.description)} />
        </div>

        <CapacityBar current={batch.studentCount || 0} max={batch.maxStudents || MAX_STUDENTS_PER_BATCH} />

        <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: T.muted, fontFamily: T.mono, fontSize: '10px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Opened {date}
          </span>
          {batch.joinOption === 'code' && batch.joinCode && (
            <span
              onClick={(e) => e.stopPropagation()}
              style={{
                color: T.muted, fontFamily: T.mono, fontSize: '11px', background: T.bg, padding: '2px 8px',
                borderRadius: '2px', border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >
              {batch.joinCode}
              <CopyButton text={batch.joinCode} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

const cardIconBtnStyle = {
  color: T.inkSoft, background: T.surface, border: `1px solid ${T.line}`, borderRadius: '2px',
  width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  boxShadow: '0 1px 4px rgba(43,40,36,0.12)',
};

// Form Field Component
const Field = ({ label, hint, children, count, max, required = false, error }) => (
  <div style={{ marginBottom: '22px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
      <label style={{ color: T.ink, fontFamily: T.sans, fontSize: '13px', fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
        {label}
        {required && <span style={{ color: T.accent, marginLeft: '4px' }}>*</span>}
      </label>
      {max && <span style={{ color: T.muted, fontFamily: T.mono, fontSize: '11px' }}>{count}/{max}</span>}
    </div>
    {hint && <p style={{ color: T.muted, fontSize: '12px', marginTop: 0, marginBottom: '8px' }}>{hint}</p>}
    <div>{children}</div>
    {error && <p style={{ color: T.danger, fontSize: '12px', marginTop: '4px' }}>{error}</p>}
  </div>
);

const inputBaseStyle = {
  fontFamily: T.serif, fontSize: '16px', color: T.ink, background: T.bg, border: `1px solid ${T.lineStrong}`,
  borderRadius: '2px', padding: '10px 12px', width: '100%', outline: 'none', boxSizing: 'border-box',
};

// Batch Form Component
const BatchForm = ({ formData, onChange, errors = {}, autoFocus = false }) => {
  const [uploadingImage, setUploadingImage] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleFieldChange = (field, e) => onChange(field, e.target.value);

  const handleJoinOptionChange = (option) => {
    onChange('joinOption', option);
    onChange('joinCode', '');
    if (errors.joinCode) onChange('clearError', 'joinCode');
  };

  const generateJoinCode = () => {
    const base = (formData.batchName || 'BATCH').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
    const suffix = Math.floor(1000 + Math.random() * 9000);
    onChange('joinCode', `${base || 'BATCH'}${suffix}`);
    if (errors.joinCode) onChange('clearError', 'joinCode');
  };

  const processImageFile = (file) => {
    if (!file) return;

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      onChange('imageError', 'Only JPG, PNG, or WEBP images are allowed.');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      onChange('imageError', 'Image size must be 100 KB or less.');
      return;
    }

    const imageUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      const ratio = img.width / img.height;
      const isValidRatio = Math.abs(ratio - IMAGE_ASPECT_RATIO) <= 0.02;
      const hasExactDimensions = img.width === IMAGE_WIDTH && img.height === IMAGE_HEIGHT;
      URL.revokeObjectURL(imageUrl);

      if (!isValidRatio || !hasExactDimensions) {
        onChange('imageError', 'Image must be exactly 1280 × 720 px (16:9).');
        return;
      }

      setUploadingImage(true);
      try {
        const imageKey = await uploadBannerImage(file);
        const signedUrl = await getSignedImageUrl(imageKey);
        onChange('imageKey', imageKey);
        onChange('imageUrl', signedUrl || '');
        onChange('imageError', '');
      } catch (error) {
        onChange('imageError', error.message || 'Image upload failed.');
      } finally {
        setUploadingImage(false);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      onChange('imageError', 'Unable to read the selected image.');
    };
    img.src = imageUrl;
  };

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];
    processImageFile(file);
    event.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    processImageFile(file);
  };

  const handlePreviewError = async () => {
    if (!formData.imageKey) return;
    try {
      onChange('imageUrl', (await getSignedImageUrl(formData.imageKey)) || '');
    } catch {
      onChange('imageUrl', '');
    }
  };

  return (
    <>
      <Field label="Batch name" max={MAX_NAME_LENGTH} count={formData.batchName?.length || 0} required error={errors.batchName}>
        <input type="text" placeholder="e.g. Morning Batch 2026" value={formData.batchName || ''}
          onChange={(e) => handleFieldChange('batchName', e)} maxLength={MAX_NAME_LENGTH} autoFocus={autoFocus}
          style={{ ...inputBaseStyle, borderColor: errors.batchName ? T.danger : T.lineStrong }} />
      </Field>

      <Field label="Description" hint="A brief overview shown on the batch listing. Supports URLs and line breaks."
        max={MAX_DESCRIPTION_LENGTH} count={formData.description?.length || 0} error={errors.description}>
        <textarea rows={4} placeholder={"What is this batch about?\nUse Enter for line breaks."}
          value={formData.description || ''} onChange={(e) => handleFieldChange('description', e)}
          maxLength={MAX_DESCRIPTION_LENGTH}
          style={{ ...inputBaseStyle, borderColor: errors.description ? T.danger : T.lineStrong, resize: 'vertical', lineHeight: '1.6' }} />
      </Field>

      <Field label="Instructions" hint="Specific guidance or requirements for students. Supports URLs and line breaks."
        max={MAX_INSTRUCTION_LENGTH} count={formData.instruction?.length || 0} error={errors.instruction}>
        <textarea rows={4} placeholder={"Any special instructions for students…"}
          value={formData.instruction || ''} onChange={(e) => handleFieldChange('instruction', e)}
          maxLength={MAX_INSTRUCTION_LENGTH}
          style={{ ...inputBaseStyle, borderColor: errors.instruction ? T.danger : T.lineStrong, resize: 'vertical', lineHeight: '1.6' }} />
      </Field>

      <Field label="Banner Image" hint="Exactly 1280 × 720 px, up to 100 KB. Drag a file in or browse.">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `1.5px dashed ${dragActive ? T.accent : T.lineStrong}`,
            background: dragActive ? T.accentSoft : T.bg,
            borderRadius: '4px', padding: '20px', textAlign: 'center', cursor: uploadingImage ? 'wait' : 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          {formData.imageUrl ? (
            <img src={formData.imageUrl} alt="Banner preview" onError={handlePreviewError}
              onClick={(e) => e.stopPropagation()}
              style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', border: `1px solid ${T.line}`, borderRadius: '4px', marginBottom: '10px' }} />
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="1.5" style={{ marginBottom: '8px' }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          )}
          <div style={{ fontFamily: T.sans, fontSize: '13px', color: T.inkSoft }}>
            {uploadingImage ? 'Uploading…' : formData.imageKey ? 'Image attached — click or drop to replace' : 'Drop an image here, or click to browse'}
          </div>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageUpload} style={{ display: 'none' }} />
        </div>
        {formData.imageError ? <div style={{ color: T.danger, fontSize: '12px', marginTop: '6px' }}>{formData.imageError}</div> : null}
      </Field>

      <Field label="Join Option" hint="How students can join this batch" required error={errors.joinOption}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {Object.entries(JOIN_OPTION_META).map(([key, meta]) => {
            const active = formData.joinOption === key;
            return (
              <button key={key} type="button" onClick={() => handleJoinOptionChange(key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', cursor: 'pointer',
                  fontFamily: T.sans, fontSize: '13px', fontWeight: 600, borderRadius: '2px',
                  border: `1px solid ${active ? meta.color : T.lineStrong}`,
                  background: active ? T.accentSoft : T.surface, color: active ? meta.color : T.inkSoft,
                }}>
                {meta.icon}
                {meta.label}
              </button>
            );
          })}
        </div>
      </Field>

      {formData.joinOption === 'code' && (
        <Field label="Join Code" hint="A unique code that students must enter to join this batch"
          max={MAX_JOIN_CODE_LENGTH} count={formData.joinCode?.length || 0} required error={errors.joinCode}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input type="text" placeholder="Enter a unique code (e.g., MATH2026)" value={formData.joinCode || ''}
              onChange={(e) => handleFieldChange('joinCode', e)} maxLength={MAX_JOIN_CODE_LENGTH}
              style={{ ...inputBaseStyle, borderColor: errors.joinCode ? T.danger : T.lineStrong, fontFamily: T.mono, flex: 1 }} />
            <button type="button" onClick={generateJoinCode}
              style={{ background: T.surface, border: `1px solid ${T.lineStrong}`, borderRadius: '2px', padding: '0 14px', fontFamily: T.sans, fontSize: '13px', color: T.accent, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Generate
            </button>
          </div>
        </Field>
      )}

      <Field label="Maximum Students" hint={`Set a limit for this batch (max ${MAX_STUDENTS_PER_BATCH})`} error={errors.maxStudents}>
        <input type="number" placeholder={`e.g., ${MAX_STUDENTS_PER_BATCH}`} value={formData.maxStudents || ''}
          onChange={(e) => handleFieldChange('maxStudents', e)} min="1" max={MAX_STUDENTS_PER_BATCH}
          style={{ ...inputBaseStyle, borderColor: errors.maxStudents ? T.danger : T.lineStrong }} />
        <div style={{ color: T.muted, fontSize: '12px', marginTop: '4px' }}>
          {formData.maxStudents ? `${formData.maxStudents} students allowed` : 'Leave empty for default (10,000)'}
        </div>
      </Field>
    </>
  );
};

// Stat Card Component
const StatCard = ({ icon, value, label, subText }) => (
  <div style={{ backgroundColor: T.surface, border: `1px solid ${T.line}`, borderRadius: '2px', padding: '20px 22px', display: 'flex', alignItems: 'center', gap: '16px' }}>
    <div style={{ color: T.accent, flexShrink: 0 }}>{icon}</div>
    <div>
      <div style={{ fontFamily: T.serif, fontSize: '34px', fontWeight: 600, color: T.ink, lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: T.sans, fontSize: '13px', fontWeight: 600, color: T.ink, marginTop: '4px' }}>{label}</div>
      <div style={{ fontFamily: T.sans, fontSize: '12px', color: T.muted, marginTop: '2px' }}>{subText}</div>
    </div>
  </div>
);

// Toolbar: search + sort, sits above the card grid
const Toolbar = ({ query, onQueryChange, sortBy, onSortChange }) => (
  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '20px' }}>
    <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '200px' }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2"
        style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}>
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input type="text" placeholder="Search batches…" value={query} onChange={(e) => onQueryChange(e.target.value)}
        style={{ ...inputBaseStyle, fontFamily: T.sans, fontSize: '14px', padding: '9px 12px 9px 36px' }} />
    </div>
    <select value={sortBy} onChange={(e) => onSortChange(e.target.value)}
      style={{ ...inputBaseStyle, fontFamily: T.sans, fontSize: '13px', width: 'auto', padding: '9px 12px', cursor: 'pointer' }}>
      <option value="newest">Newest first</option>
      <option value="oldest">Oldest first</option>
      <option value="name">Name (A–Z)</option>
      <option value="students">Most students</option>
    </select>
  </div>
);

// Main App Component
function BatchManagement() {
  const navigate = useNavigate();
  const [batches, setBatches] = useState([]);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      navigate('/login');
    }
  }, [navigate]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [form, setForm] = useState({
    batchName: '', description: '', instruction: '', joinOption: 'public', joinCode: '',
    maxStudents: '', imageKey: '', imageUrl: '', imageError: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [summary, setSummary] = useState({
    totalStudents: 0, totalCapacity: 0, availableSlots: 0, activeBatches: 0, deletedBatches: 0, totalBatches: 0
  });
  const [pagination, setPagination] = useState({ limit: 100, hasMore: false, nextToken: null });

  const showToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
  };
  const removeToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const fetchBatches = useCallback(async (nextToken = null) => {
    const token = getToken();
    if (!token) {
      navigate('/login');
      return;
    }

    setLoading(true);
    try {
      let url = API.getAllBatches;
      const params = new URLSearchParams();
      if (nextToken) params.append('nextToken', nextToken);
      params.append('limit', '100');
      params.append('sortBy', 'createdAt');
      params.append('sortOrder', 'desc');
      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url, { headers: authHeaders() });
      const data = await response.json();

      if (!response.ok) throw new Error(data.message || 'Failed to load batches');

      if (data.success) {
        setBatches(prev => nextToken ? [...prev, ...(data.batches || [])] : (data.batches || []));
        if (data.summary) setSummary(data.summary);
        if (data.pagination) {
          setPagination({
            limit: data.pagination.limit || 100,
            hasMore: data.pagination.hasMore || false,
            nextToken: data.pagination.nextToken || null
          });
        }
      } else {
        throw new Error(data.message || 'Failed to load batches');
      }
    } catch (error) {
      console.error('Fetch batches error:', error);
      showToast(error.message || 'Network error — could not load batches', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBatchDetails = async (batchId) => {
    try {
      const response = await fetch(API.getBatch(batchId), { headers: authHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch details');

      if (data.success && data.batch) {
        const batch = data.batch;
        if (batch.imageKey) {
          batch.imageKey = normalizeImageKey(batch.imageKey);
          try {
            batch.imageUrl = await getSignedImageUrl(batch.imageKey);
          } catch (error) {
            console.error('Failed to resolve image URL:', error);
          }
        }
        return batch;
      }
      throw new Error(data.message || 'Failed to fetch details');
    } catch (error) {
      console.error('Fetch batch details error:', error);
      showToast(error.message, 'error');
      return null;
    }
  };

  // Fixed: was checking pagination.hasNext (never set) instead of pagination.hasMore
  const loadMoreBatches = () => {
    if (pagination.hasMore && pagination.nextToken) {
      fetchBatches(pagination.nextToken);
    }
  };

  const validateForm = (formData) => {
    const errors = validateBatchData(formData);
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFormChange = (field, value) => {
    if (field === 'clearError') {
      setFormErrors(prev => {
        const next = { ...prev };
        delete next[value];
        return next;
      });
    } else {
      const normalizedValue = field === 'imageKey' ? normalizeImageKey(value) : value;
      setForm(prev => ({ ...prev, [field]: normalizedValue }));
      setFormErrors(prev => {
        if (prev[field]) {
          const next = { ...prev };
          delete next[field];
          return next;
        }
        return prev;
      });
    }
  };

  const handleCreate = async () => {
    const formData = {
      batchName: sanitizeInput(form.batchName),
      description: sanitizeInput(form.description),
      instruction: sanitizeInput(form.instruction),
      joinOption: form.joinOption,
      maxStudents: form.maxStudents ? parseInt(form.maxStudents) : MAX_STUDENTS_PER_BATCH,
      imageKey: normalizeImageKey(form.imageKey) || ''
    };
    if (form.joinOption === 'code') formData.joinCode = sanitizeInput(form.joinCode);

    if (!validateForm(formData)) {
      showToast('Please fix the errors in the form', 'error');
      return;
    }
    if (batches.length >= MAX_BATCHES) {
      showToast(`Maximum ${MAX_BATCHES} batches allowed`, 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(API.createBatch, { method: 'POST', headers: authHeaders(), body: JSON.stringify(formData) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to create batch');

      if (data.success) {
        const joinOptionMessages = {
          public: 'Public batch created. Anyone can join.',
          manual: 'Batch created. Students must be added manually.',
          code: `Batch created with join code: ${data.joinCode || formData.joinCode}`
        };
        showToast(joinOptionMessages[formData.joinOption] || 'Batch created successfully', 'success');
        closeModal();
        await fetchBatches();
      } else {
        throw new Error(data.message || 'Failed to create batch');
      }
    } catch (error) {
      console.error('Create batch error:', error);
      showToast(error.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async () => {
    const formData = {
      batchId: selectedBatch.batchId,
      batchName: sanitizeInput(form.batchName),
      description: sanitizeInput(form.description),
      instruction: sanitizeInput(form.instruction),
      joinOption: form.joinOption,
      maxStudents: form.maxStudents ? parseInt(form.maxStudents) : MAX_STUDENTS_PER_BATCH,
      imageKey: normalizeImageKey(form.imageKey) || ''
    };
    if (form.joinOption === 'code') formData.joinCode = sanitizeInput(form.joinCode);

    if (!validateForm(formData)) {
      showToast('Please fix the errors in the form', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(API.updateBatch(selectedBatch.batchId), { method: 'PUT', headers: authHeaders(), body: JSON.stringify(formData) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to update batch');

      if (data.success) {
        showToast('Batch updated successfully', 'success');
        closeModal();
        await fetchBatches();
      } else {
        throw new Error(data.message || 'Failed to update batch');
      }
    } catch (error) {
      console.error('Update batch error:', error);
      showToast(error.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch(API.deleteBatch(selectedBatch.batchId), { method: 'DELETE', headers: authHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to delete batch');

      if (data.success) {
        showToast('Batch deleted successfully', 'warning');
        closeModal();
        await fetchBatches();
      } else {
        throw new Error(data.message || 'Failed to delete batch');
      }
    } catch (error) {
      console.error('Delete batch error:', error);
      showToast(error.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUserClick = (batch) => navigate(`/batch/${batch.batchId}`);

  const openCreateModal = () => {
    setForm({ batchName: '', description: '', instruction: '', joinOption: 'public', joinCode: '', maxStudents: '', imageKey: '', imageUrl: '', imageError: '' });
    setFormErrors({});
    setSelectedBatch(null);
    setModal('create');
  };

  const openEditModal = async (batch) => {
    const details = await fetchBatchDetails(batch.batchId);
    if (details) {
      setForm({
        batchName: details.batchName || '', description: details.description || '', instruction: details.instruction || '',
        joinOption: details.joinOption || 'public', joinCode: details.joinCode || '', maxStudents: details.maxStudents || '',
        imageKey: normalizeImageKey(details.imageKey) || '', imageUrl: details.imageUrl || '', imageError: ''
      });
      setSelectedBatch(details);
      setModal('edit');
    }
  };

  const openViewModal = async (batch) => {
    const details = await fetchBatchDetails(batch.batchId);
    if (details) {
      setSelectedBatch(details);
      setModal('view');
    }
  };

  const openDeleteModal = (batch) => {
    setSelectedBatch(batch);
    setModal('delete');
  };

  const closeModal = () => {
    setModal(null);
    setSelectedBatch(null);
    setForm({ batchName: '', description: '', instruction: '', joinOption: 'public', joinCode: '', maxStudents: '', imageKey: '', imageUrl: '', imageError: '' });
    setFormErrors({});
  };

  useEffect(() => { fetchBatches(); }, [fetchBatches]);

  // Client-side search + sort over the loaded batches
  const visibleBatches = React.useMemo(() => {
    let list = [...batches];
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(b => (b.batchName || '').toLowerCase().includes(q) || (b.description || '').toLowerCase().includes(q));
    }
    switch (sortBy) {
      case 'oldest': list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); break;
      case 'name': list.sort((a, b) => (a.batchName || '').localeCompare(b.batchName || '')); break;
      case 'students': list.sort((a, b) => (b.studentCount || 0) - (a.studentCount || 0)); break;
      default: list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    return list;
  }, [batches, query, sortBy]);

  const totalBatches = summary.activeBatches || batches.length;
  const remainingSlots = MAX_BATCHES - totalBatches;
  const totalStudents = summary.totalStudents || 0;

  return (
    <div className="app-container">
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }
      `}</style>
      <TopBar />
      <div className="main-content">
        <div className="section-header">
          <h1 className="section-title">Batch Management</h1>
          <p className="section-subtitle">Create and manage your academic batches</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '40px' }}>
          <StatCard
            icon={<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>}
            value={totalBatches} label="Active Batches" subText={`${remainingSlots} slots remaining`}
          />
          <StatCard
            icon={<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>}
            value={totalStudents} label="Total Students" subText={`${summary.availableSlots || 0} slots available`}
          />
          <StatCard
            icon={<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>}
            value={summary.totalBatches || totalBatches} label="Total Batches" subText={`${summary.deletedBatches || 0} deleted`}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
          <button onClick={openCreateModal} disabled={batches.length >= MAX_BATCHES}
            style={{
              backgroundColor: T.accent, color: '#FFF', border: 'none', borderRadius: '2px', padding: '12px 24px',
              fontFamily: T.sans, fontSize: '14px', fontWeight: 500,
              cursor: batches.length >= MAX_BATCHES ? 'not-allowed' : 'pointer',
              opacity: batches.length >= MAX_BATCHES ? 0.6 : 1,
            }}>
            + Create New Batch
          </button>
        </div>

        {!loading && batches.length > 0 && (
          <Toolbar query={query} onQueryChange={setQuery} sortBy={sortBy} onSortChange={setSortBy} />
        )}

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : batches.length === 0 ? (
          <div className="empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M22 12h-4l-3 9-4-18-3 9H2" />
            </svg>
            <p>No batches created yet</p>
            <p style={{ fontSize: '14px', marginTop: '8px' }}>Click "Create New Batch" to get started</p>
          </div>
        ) : visibleBatches.length === 0 ? (
          <div className="empty-state">
            <p>No batches match "{query}"</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
              {visibleBatches.map((batch) => (
                <BatchCard key={batch.batchId} batch={batch} onView={openViewModal} onEdit={openEditModal}
                  onDelete={openDeleteModal} onUserClick={handleUserClick} />
              ))}
            </div>

            {pagination.hasMore && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
                <button onClick={loadMoreBatches}
                  style={{
                    backgroundColor: T.surface, color: T.accent, border: `1px solid ${T.lineStrong}`, borderRadius: '2px',
                    padding: '10px 24px', fontFamily: T.sans, fontSize: '14px', cursor: 'pointer', transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.target.style.backgroundColor = T.bg; }}
                  onMouseLeave={(e) => { e.target.style.backgroundColor = T.surface; }}>
                  Load More Batches
                </button>
              </div>
            )}
          </>
        )}

        {modal === 'create' && (
          <Modal title="Create New Batch" onSubmit={handleCreate} onClose={closeModal} submitLabel="Create Batch" isSubmitting={isSubmitting} size="large">
            <BatchForm formData={form} onChange={handleFormChange} errors={formErrors} autoFocus />
          </Modal>
        )}

        {modal === 'edit' && (
          <Modal title="Edit Batch" onSubmit={handleEdit} onClose={closeModal} submitLabel="Save Changes" isSubmitting={isSubmitting} size="large">
            <BatchForm formData={form} onChange={handleFormChange} errors={formErrors} />
          </Modal>
        )}

        {modal === 'view' && selectedBatch && (
          <Modal title={selectedBatch.batchName} onClose={closeModal} submitLabel="Close" onSubmit={closeModal} isSubmitting={false} size="large">
            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: `1px solid ${T.line}` }}>
                <p style={{ fontFamily: T.mono, fontSize: '12px', color: T.muted, marginBottom: '4px' }}>Batch ID: {selectedBatch.batchId}</p>
                <p style={{ fontFamily: T.mono, fontSize: '12px', color: T.muted, marginBottom: '4px' }}>
                  Join Option: <span style={{ textTransform: 'capitalize' }}>{selectedBatch.joinOption || 'public'}</span>
                </p>
                {selectedBatch.joinOption === 'code' && selectedBatch.joinCode && (
                  <p style={{ fontFamily: T.mono, fontSize: '12px', color: T.muted, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Join Code: <span style={{ fontWeight: 600 }}>{selectedBatch.joinCode}</span>
                    <CopyButton text={selectedBatch.joinCode} />
                  </p>
                )}
                <div style={{ marginTop: '10px', marginBottom: '4px', maxWidth: '280px' }}>
                  <CapacityBar current={selectedBatch.studentCount || 0} max={selectedBatch.maxStudents || MAX_STUDENTS_PER_BATCH} />
                </div>
                <p style={{ fontFamily: T.mono, fontSize: '12px', color: T.muted, marginBottom: '4px', marginTop: '10px' }}>
                  Created: {formatDateTime(selectedBatch.createdAt)}
                </p>
                {selectedBatch.updatedAt && selectedBatch.updatedAt !== selectedBatch.createdAt && (
                  <p style={{ fontFamily: T.mono, fontSize: '12px', color: T.muted, marginTop: '4px' }}>
                    Last updated: {formatDateTime(selectedBatch.updatedAt)}
                  </p>
                )}
              </div>

              {selectedBatch.description && (
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontFamily: T.sans, fontSize: '14px', fontWeight: 600, color: T.ink, marginBottom: '12px', letterSpacing: '0.02em', textTransform: 'uppercase' }}>Description</h3>
                  <FormattedText text={selectedBatch.description} />
                </div>
              )}

              {selectedBatch.instruction && (
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontFamily: T.sans, fontSize: '14px', fontWeight: 600, color: T.ink, marginBottom: '12px', letterSpacing: '0.02em', textTransform: 'uppercase' }}>Instructions</h3>
                  <FormattedText text={selectedBatch.instruction} />
                </div>
              )}
            </div>
          </Modal>
        )}

        {modal === 'delete' && selectedBatch && (
          <Modal title="Delete Batch" onSubmit={handleDelete} onClose={closeModal} submitLabel="Delete" submitVariant="danger" isSubmitting={isSubmitting} size="small">
            <p style={{ fontFamily: T.serif, fontSize: '16px', color: T.ink, marginBottom: '16px' }}>
              Are you sure you want to delete "{selectedBatch.batchName}"?
            </p>
            <p style={{ fontFamily: T.sans, fontSize: '14px', color: T.inkSoft }}>
              This action cannot be undone. All student data associated with this batch will also be deleted.
            </p>
          </Modal>
        )}

        {toasts.map((toast) => (
          <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </div>
  );
}

export default BatchManagement;