import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { useParams } from "react-router-dom";

// ------------------------------------------------
// API ENDPOINTS
// ------------------------------------------------
const API_CRUD = "https://e7vprwqyfi.execute-api.ap-south-1.amazonaws.com/default/Announcement_Create";
const API_GET  = "https://e7vprwqyfi.execute-api.ap-south-1.amazonaws.com/default/Announcement_Get";

// ------------------------------------------------
// HELPERS
// ------------------------------------------------
const isTextEmpty = (text) => !text || text.trim() === "";

const formatTime = (isoString) => {
  if (!isoString) return "";
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const formatDateLabel = (isoString) => {
  if (!isoString) return "";
  const date = new Date(isoString);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  if (isToday) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { month: "long", day: "numeric", year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined });
};

const formatDateShort = (isoString) => {
  if (!isoString) return "";
  const date = new Date(isoString);
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
};

// ------------------------------------------------
// REACTIONS (display only)
// ------------------------------------------------
export const REACTIONS = [
  { name: "like", emoji: "👍" }, { name: "clap", emoji: "👏" }, { name: "celebrate", emoji: "🙌" },
  { name: "hundred", emoji: "💯" }, { name: "agree", emoji: "🤝" }, { name: "check", emoji: "✔️" },
  { name: "love", emoji: "❤️" }, { name: "double_love", emoji: "💕" }, { name: "heart_eyes", emoji: "😍" },
  { name: "sweet", emoji: "🥰" }, { name: "kiss", emoji: "😘" }, { name: "sparkling_heart", emoji: "💖" },
  { name: "laugh", emoji: "😂" }, { name: "rolling_laugh", emoji: "🤣" }, { name: "grin", emoji: "😆" },
  { name: "cat_laugh", emoji: "😹" }, { name: "silly", emoji: "😜" }, { name: "fire", emoji: "🔥" },
  { name: "explosion", emoji: "💥" }, { name: "lightning", emoji: "⚡" }, { name: "rocket", emoji: "🚀" },
  { name: "star", emoji: "🌟" }, { name: "sparkle", emoji: "✨" }, { name: "wow", emoji: "😮" },
  { name: "astonished", emoji: "😲" }, { name: "mind_blown", emoji: "🤯" }, { name: "shocked", emoji: "😱" },
  { name: "silent_shock", emoji: "🫢" }, { name: "cry", emoji: "😢" }, { name: "loud_cry", emoji: "😭" },
  { name: "broken_heart", emoji: "💔" }, { name: "sad", emoji: "😔" }, { name: "pleading", emoji: "🥺" },
  { name: "angry", emoji: "😡" }, { name: "rage", emoji: "🤬" }, { name: "frustrated", emoji: "😤" },
  { name: "dislike", emoji: "👎" }, { name: "thinking", emoji: "🤔" }, { name: "curious", emoji: "🧐" },
  { name: "neutral", emoji: "😐" }, { name: "eye_roll", emoji: "🙄" }, { name: "party", emoji: "🎉" },
  { name: "celebrate_face", emoji: "🥳" }, { name: "trophy", emoji: "🏆" }, { name: "confetti", emoji: "🎊" },
  { name: "cheers", emoji: "🍾" },
];

const REACTION_EMOJI = Object.fromEntries(REACTIONS.map((r) => [r.name, r.emoji]));

// ==================================================================
// SCOPED STYLESHEET — desktop-only "control desk" ledger design
// ==================================================================
// Design tokens:
//   Paper feed (--paper/--card) vs a dark control rail (--rail-*) —
//   the two surfaces read as "operator desk" (dark) + "logbook" (warm paper).
//   Display face: Fraunces (characterful serif for dates/titles).
//   Body: Inter. Data/meta: JetBrains Mono, used for every timestamp,
//   count, and id — the vocabulary of a log, not a chat app.
const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap');

.dl-root {
  /* Cool paper palette with an ink-blue accent — not the cream/terracotta default */
  --paper: #FAFAF8;            /* main background — soft, slightly cool white */
  --card: #FFFFFF;             /* entry cards — pure white, lifted by shadow */
  --raised: #F1F1EE;           /* hover / raised surfaces */
  --rule: #E4E3DE;             /* hairline borders */
  --ink: #17181C;              /* primary text — near-black, not pure black */
  --ink-soft: #5B5D63;         /* secondary text */
  --ink-faint: #9A9C98;        /* tertiary / placeholder */
  --signal: #2F4B7C;           /* accent — ink blue, fountain-pen feel */
  --signal-soft: rgba(47, 75, 124, 0.10);
  --verified: #1F7A5C;
  --alert: #B23A2E;

  /* Rail — cool light gray, distinct from warm-white main area */
  --rail-bg: #F4F4F1;
  --rail-bg-raised: #E9E9E5;
  --rail-text: #17181C;
  --rail-text-dim: #6B6D71;
  --rail-hair: #DFDEDA;
  --rail-accent: #2F4B7C;

  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  color: var(--ink);
  max-width: 1180px;
  margin: 28px auto;
  border-radius: 18px;
  border: 1px solid var(--rule);
  overflow: hidden;
  display: grid;
  grid-template-columns: 262px 1fr;
  height: 88vh;
  max-height: 860px;
  background: var(--paper);
  box-shadow: 0 32px 64px -28px rgba(23, 24, 28, 0.14);
}

/* ---------------------------------------------------------- */
/* RAIL                                                        */
/* ---------------------------------------------------------- */
.dl-rail {
  background: var(--rail-bg);
  color: var(--rail-text);
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-right: 1px solid var(--rail-hair);
}
.dl-rail-top {
  padding: 24px 22px 18px;
  border-bottom: 1px solid var(--rail-hair);
}
.dl-kicker {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10.5px;
  letter-spacing: 0.18em;
  color: var(--rail-accent);
  margin-bottom: 8px;
}
.dl-batch {
  font-family: 'Fraunces', serif;
  font-size: 21px;
  font-weight: 600;
  line-height: 1.25;
  color: var(--rail-text);
  word-break: break-word;
}

.dl-nav {
  padding: 14px 12px;
  border-bottom: 1px solid var(--rail-hair);
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.dl-nav-btn {
  appearance: none;
  background: transparent;
  border: none;
  color: var(--rail-text-dim);
  font-family: 'Inter', sans-serif;
  font-weight: 500;
  font-size: 13.5px;
  text-align: left;
  padding: 10px 12px;
  border-radius: 9px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  transition: background 0.15s ease, color 0.15s ease;
}
.dl-nav-btn:hover { background: var(--rail-bg-raised); color: var(--rail-text); }
.dl-nav-btn.active {
  background: #FFFFFF;
  color: var(--rail-text);
  box-shadow: 0 1px 2px rgba(23, 24, 28, 0.06), inset 0 0 0 1px var(--rail-hair);
}
.dl-nav-btn.active .dl-nav-glyph { color: var(--rail-accent); }
.dl-nav-glyph { color: var(--rail-text-dim); font-size: 13px; }
.dl-nav-count {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10.5px;
  color: var(--rail-text-dim);
  background: rgba(47, 75, 124, 0.08);
  border-radius: 999px;
  padding: 1px 7px;
}
.dl-nav-btn.active .dl-nav-count {
  color: #F3F6FB;
  background: var(--rail-accent);
}

.dl-manifest {
  flex: 1;
  overflow-y: auto;
  padding: 16px 14px 20px;
  min-height: 0;
}
.dl-manifest::-webkit-scrollbar { width: 6px; }
.dl-manifest::-webkit-scrollbar-thumb { background: var(--rail-hair); border-radius: 8px; }
.dl-manifest-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--rail-text-dim);
  padding: 0 8px 10px;
}
.dl-manifest-empty {
  font-size: 12.5px;
  color: var(--rail-text-dim);
  padding: 4px 8px;
  line-height: 1.5;
}
.dl-manifest-item {
  display: flex;
  gap: 9px;
  align-items: flex-start;
  width: 100%;
  background: transparent;
  border: none;
  text-align: left;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  color: inherit;
}
.dl-manifest-item:hover { background: var(--rail-bg-raised); }
.dl-manifest-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--rail-accent);
  margin-top: 6px;
  flex-shrink: 0;
}
.dl-manifest-text {
  font-size: 12.5px;
  line-height: 1.4;
  color: var(--rail-text-dim);
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}
.dl-manifest-item:hover .dl-manifest-text { color: var(--rail-text); }

/* ---------------------------------------------------------- */
/* MAIN                                                         */
/* ---------------------------------------------------------- */
.dl-main {
  background: var(--paper);
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.dl-feed {
  flex: 1;
  overflow-y: auto;
  padding: 22px 30px 12px 26px;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.dl-feed::-webkit-scrollbar { width: 8px; }
.dl-feed::-webkit-scrollbar-thumb { background: var(--rule); border-radius: 8px; }
.dl-feed::-webkit-scrollbar-track { background: transparent; }

.dl-empty {
  margin: auto 0;
  text-align: center;
  color: var(--ink-faint);
  padding: 40px 20px;
}
.dl-empty-glyph {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  letter-spacing: 0.14em;
  color: var(--signal);
  display: block;
  margin-bottom: 10px;
}
.dl-empty-title {
  font-family: 'Fraunces', serif;
  font-size: 17px;
  color: var(--ink-soft);
  font-weight: 500;
}

/* date divider */
.dl-day {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 22px 0 14px;
}
.dl-day:first-child { margin-top: 2px; }
.dl-day-tab {
  font-family: 'Fraunces', serif;
  font-weight: 600;
  font-size: 13.5px;
  color: var(--ink);
  background: var(--raised);
  border: 1px solid var(--rule);
  border-radius: 7px 7px 2px 2px;
  padding: 4px 12px 5px;
}
.dl-day-rule {
  flex: 1;
  height: 1px;
  background: var(--rule);
}

.dl-entry {
  display: flex;
  gap: 14px;
  padding: 10px 0;
  animation: dl-rise 0.24s ease both;
}
@media (prefers-reduced-motion: reduce) { .dl-entry { animation: none; } }
@keyframes dl-rise {
  from { opacity: 0; transform: translateY(5px); }
  to   { opacity: 1; transform: translateY(0); }
}

.dl-rail-mark {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 12px;
  flex-shrink: 0;
  padding-top: 20px;
}
.dl-tick { width: 1px; flex: 1; background: var(--rule); }

.dl-card {
  flex: 1;
  background: var(--card);
  border: 1px solid var(--rule);
  border-radius: 12px;
  padding: 14px 18px;
  min-width: 0;
  box-shadow: 0 1px 2px rgba(23, 24, 28, 0.04), 0 6px 16px -12px rgba(23, 24, 28, 0.10);
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
}
.dl-card:hover {
  box-shadow: 0 2px 4px rgba(23, 24, 28, 0.05), 0 10px 24px -14px rgba(23, 24, 28, 0.14);
}
.dl-card.pinned {
  border-color: var(--signal);
  box-shadow: 0 0 0 1px var(--signal-soft), 0 6px 16px -12px rgba(23, 24, 28, 0.12);
}
.dl-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}
.dl-meta {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--ink-faint);
  flex-wrap: wrap;
}
.dl-pin-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: var(--signal-soft);
  color: var(--signal);
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 999px;
}
.dl-entry-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.dl-card:hover .dl-entry-actions,
.dl-card:focus-within .dl-entry-actions,
.dl-card.pinned .dl-entry-actions {
  opacity: 1;
}
.dl-icon-btn {
  background: transparent;
  border: 1px solid transparent;
  color: var(--ink-soft);
  width: 27px;
  height: 27px;
  border-radius: 7px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  transition: all 0.15s ease;
}
.dl-icon-btn:hover { background: var(--raised); color: var(--ink); }
.dl-icon-btn.danger:hover { color: var(--alert); border-color: rgba(178, 58, 46, 0.3); }
.dl-icon-btn.pin-active { color: var(--signal); background: var(--signal-soft); }
.dl-icon-btn.pin-active:hover { color: var(--signal); background: var(--signal-soft); }
.dl-icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.dl-icon-btn:focus-visible { outline: 2px solid var(--signal); outline-offset: 1px; }

.dl-body {
  font-size: 14.5px;
  line-height: 1.6;
  color: var(--ink);
  word-break: break-word;
  white-space: pre-wrap;
}
.dl-body-clamp {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
  overflow: hidden;
}
.dl-showmore-btn {
  display: inline-block;
  margin-top: 8px;
  background: transparent;
  border: none;
  color: var(--signal);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11.5px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
  padding: 2px 0;
}
.dl-showmore-btn:hover { text-decoration: underline; }
.dl-showmore-btn:focus-visible { outline: 2px solid var(--signal); outline-offset: 2px; }

/* reactions */
.dl-reactions-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
}
.dl-reaction-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: var(--raised);
  border: 1px solid var(--rule);
  border-radius: 999px;
  padding: 3px 9px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--ink-soft);
  user-select: none;
}

/* composer */
.dl-composer {
  border-top: 1px solid var(--rule);
  background: var(--card);
  padding: 14px 26px 18px;
  flex-shrink: 0;
}
.dl-composer-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-faint);
  margin: 0 2px 8px;
}
.dl-editor-shell {
  border: 1px solid var(--rule);
  border-radius: 12px;
  background: var(--paper);
  overflow: hidden;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.dl-editor-shell:focus-within {
  border-color: var(--signal);
  box-shadow: 0 0 0 3px var(--signal-soft);
}
.dl-editable {
  display: block;
  box-sizing: border-box;
  width: 100%;
  padding: 11px 15px;
  font-size: 14.5px;
  line-height: 1.5;
  color: var(--ink);
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  overflow-y: auto;
  font-family: inherit;
  white-space: pre-wrap;
  transition: height 0.08s ease;
}
.dl-editable::placeholder { color: var(--ink-faint); }

.dl-composer-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}
.dl-composer-hint {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10.5px;
  color: var(--ink-faint);
}
.dl-send-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--signal);
  color: #F3F6FB;
  border: none;
  font-family: 'Fraunces', serif;
  font-weight: 600;
  font-size: 14px;
  padding: 10px 20px;
  border-radius: 10px;
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease, opacity 0.12s ease;
  box-shadow: 0 8px 18px -8px rgba(47, 75, 124, 0.5);
}
.dl-send-btn:hover:not(:disabled) { transform: translateY(-1px); }
.dl-send-btn:disabled { opacity: 0.35; cursor: not-allowed; box-shadow: none; }
.dl-send-btn:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }

.dl-edit-actions { display: flex; gap: 8px; margin-top: 10px; }
.dl-btn {
  font-family: 'Inter', sans-serif;
  font-weight: 600;
  font-size: 12.5px;
  padding: 6px 14px;
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease;
}
.dl-btn-save { background: var(--verified); color: #F2FBF8; }
.dl-btn-save:hover { filter: brightness(1.06); }
.dl-btn-cancel { background: transparent; color: var(--ink-soft); border-color: var(--rule); }
.dl-btn-cancel:hover { color: var(--ink); }
.dl-edit-hint {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10.5px;
  color: var(--ink-faint);
  margin-top: 8px;
}

.dl-load-more-top { display: flex; justify-content: center; padding: 2px 0 18px; }
.dl-load-btn {
  background: var(--card);
  border: 1px solid var(--rule);
  border-radius: 999px;
  padding: 8px 20px;
  font-family: 'Inter', sans-serif;
  font-weight: 500;
  font-size: 13px;
  color: var(--ink-soft);
  cursor: pointer;
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.dl-load-btn:hover:not(:disabled) { background: var(--raised); color: var(--ink); }
.dl-load-btn:disabled { opacity: 0.5; cursor: not-allowed; }
`;
let styleInjected = false;
function useInjectStyle() {
  useEffect(() => {
    if (styleInjected) return;
    const tag = document.createElement("style");
    tag.setAttribute("data-dl-styles", "true");
    tag.innerHTML = STYLE;
    document.head.appendChild(tag);
    styleInjected = true;
  }, []);
}

// ==================================================================
// PLAIN TEXT EDITOR
// ==================================================================
function PlainTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = 46,
  maxHeight = 280,
  onEscape,
  textareaRef,
  ariaLabel,
}) {
  const innerRef = useRef(null);
  const ref = textareaRef || innerRef;

  const autoResize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(Math.max(el.scrollHeight, minHeight), maxHeight);
    el.style.height = `${next}px`;
  };

  useEffect(() => {
    autoResize();
  }, [value]);

  return (
    <div className="dl-editor-shell">
      <textarea
        ref={ref}
        className="dl-editable"
        style={{ minHeight, maxHeight }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onKeyDown={(e) => {
          if (e.key === "Escape" && onEscape) {
            e.preventDefault();
            onEscape();
          }
        }}
      />
    </div>
  );
}

// ==================================================================
// INLINE EDIT EDITOR
// ==================================================================
function EditAnnouncementEditor({ initialText, onSave, onCancel }) {
  const [value, setValue] = useState(initialText);
  const textareaRef = useRef(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSave = () => {
    if (!isTextEmpty(value) && value !== initialText) {
      onSave(value);
    } else {
      onCancel();
    }
  };

  return (
    <div>
      <PlainTextEditor
        value={value}
        onChange={setValue}
        textareaRef={textareaRef}
        onEscape={onCancel}
        minHeight={52}
        maxHeight={440}
        ariaLabel="Edit dispatch"
      />
      <div className="dl-edit-actions">
        <button className="dl-btn dl-btn-save" onClick={handleSave}>
          Save changes
        </button>
        <button className="dl-btn dl-btn-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <div className="dl-edit-hint">
        Enter for a new line · Esc to cancel · click Save changes to save
      </div>
    </div>
  );
}

// ==================================================================
// EXPANDABLE BODY
// ==================================================================
function ExpandableBody({ text }) {
  const [expanded, setExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);
  const ref = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    setIsTruncated(el.scrollHeight - el.clientHeight > 1);
  }, [text, expanded]);

  return (
    <div className="dl-body-wrap">
      <div ref={ref} className={`dl-body${!expanded ? " dl-body-clamp" : ""}`}>
        {text}
      </div>
      {(isTruncated || expanded) && (
        <button
          type="button"
          className="dl-showmore-btn"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

// ==================================================================
// MAIN COMPONENT
// ==================================================================
export default function AnnouncementPage() {
  const { batchId } = useParams();
  useInjectStyle();

  const [announcements, setAnnouncements] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [pinningId, setPinningId] = useState(null);
  const [view, setView] = useState("all");
  const [pinnedList, setPinnedList] = useState([]);
  const [myReactions] = useState(() => new Set());

  const [nextToken, setNextToken] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const feedRef = useRef(null);
  const feedEndRef = useRef(null);
  const isFirstLoad = useRef(true);
  const pendingScrollAdjust = useRef(null);
  const shouldScrollToBottom = useRef(false);
  const entryRefs = useRef({});

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    }),
    []
  );

  // ------------------------------------------------
  // FETCH
  // ------------------------------------------------
  const fetchAnnouncements = async (token = null) => {
    const isInitial = token === null;
    if (isInitial) {
      setLoading(true);
    } else {
      setLoadingMore(true);
      if (feedRef.current) {
        pendingScrollAdjust.current = { prevHeight: feedRef.current.scrollHeight };
      }
    }

    try {
      const response = await fetch(API_GET, {
        method: "POST",
        headers,
        body: JSON.stringify({ batchId, nextToken: token }),
      });
      const data = await response.json();

      if (data.success) {
        const latest = data.latestAnnouncements || [];

        setAnnouncements(prev => {
          const combined = isInitial ? latest : [...latest, ...prev];
          const unique = Array.from(
            new Map(combined.map(item => [item.announcementId, item])).values()
          );
          return unique;
        });

        setPinnedList(data.pinnedAnnouncements || []);

        if (isInitial) shouldScrollToBottom.current = true;

        setNextToken(data.nextToken || null);
        setHasMore(data.hasMore || false);
      } else {
        console.warn("Failed to fetch:", data.message);
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    setAnnouncements([]);
    setPinnedList([]);
    setNextToken(null);
    setHasMore(false);
    setView("all");
    isFirstLoad.current = true;
    fetchAnnouncements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  useLayoutEffect(() => {
    if (pendingScrollAdjust.current && feedRef.current) {
      const { prevHeight } = pendingScrollAdjust.current;
      const newHeight = feedRef.current.scrollHeight;
      feedRef.current.scrollTop = newHeight - prevHeight;
      pendingScrollAdjust.current = null;
    }
  }, [announcements]);

  useEffect(() => {
    if (shouldScrollToBottom.current) {
      feedEndRef.current?.scrollIntoView({ behavior: isFirstLoad.current ? "auto" : "smooth" });
      shouldScrollToBottom.current = false;
      isFirstLoad.current = false;
    }
  }, [announcements]);

  // ------------------------------------------------
  // SORT / GROUP
  // ------------------------------------------------
  const pinnedIds = useMemo(
    () => new Set(pinnedList.map((p) => p.announcementId)),
    [pinnedList]
  );

  const sortAsc = (arr) => [...arr].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const sortedAll = useMemo(
    () => sortAsc(announcements).map((a) => ({ ...a, isPinned: pinnedIds.has(a.announcementId) })),
    [announcements, pinnedIds]
  );

  const sortedPinned = useMemo(
    () => sortAsc(pinnedList).map((a) => ({ ...a, isPinned: true })),
    [pinnedList]
  );

  const listForView = view === "pinned" ? sortedPinned : sortedAll;

  const groupedByDay = useMemo(() => {
    const groups = [];
    let currentLabel = null;
    let currentGroup = null;
    for (const item of listForView) {
      const label = formatDateLabel(item.createdAt);
      if (label !== currentLabel) {
        currentLabel = label;
        currentGroup = { label, items: [] };
        groups.push(currentGroup);
      }
      currentGroup.items.push(item);
    }
    return groups;
  }, [listForView]);

  // ------------------------------------------------
  // CREATE
  // ------------------------------------------------
  const createAnnouncement = async () => {
    if (isTextEmpty(text)) return;

    setLoading(true);
    try {
      const response = await fetch(API_CRUD, {
        method: "POST",
        headers,
        body: JSON.stringify({ batchId, text }),
      });
      const data = await response.json();

      if (data.success) {
        const newAnnouncement = {
          announcementId: data.announcementId,
          text,
          createdAt: new Date().toISOString(),
          reactions: {},
        };
        setAnnouncements((prev) => [...prev, newAnnouncement]);
        setText("");
        setView("all");
        shouldScrollToBottom.current = true;
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error(err);
      alert("Server Error");
    }
    setLoading(false);
  };

  // ------------------------------------------------
  // EDIT
  // ------------------------------------------------
  const editAnnouncement = async (id, newText) => {
    if (isTextEmpty(newText)) return;

    setLoading(true);
    try {
      const response = await fetch(API_CRUD, {
        method: "PUT",
        headers,
        body: JSON.stringify({ batchId, announcementId: id, text: newText }),
      });
      const data = await response.json();

      if (data.success) {
        setAnnouncements((prev) =>
          prev.map((a) => (a.announcementId === id ? { ...a, text: newText } : a))
        );
        setPinnedList((prev) =>
          prev.map((a) => (a.announcementId === id ? { ...a, text: newText } : a))
        );
        setEditingId(null);
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error(err);
      alert("Server Error");
    }
    setLoading(false);
  };

  // ------------------------------------------------
  // TOGGLE PIN
  // ------------------------------------------------
  const togglePin = async (id, currentlyPinned) => {
    const nextPin = !currentlyPinned;
    setPinningId(id);
    try {
      const response = await fetch(API_CRUD, {
        method: "PUT",
        headers,
        body: JSON.stringify({ batchId, announcementId: id, pin: nextPin }),
      });
      const data = await response.json();

      if (data.success) {
        setPinnedList((prev) => {
          if (nextPin) {
            if (prev.some((a) => a.announcementId === id)) return prev;
            const source = announcements.find((a) => a.announcementId === id);
            return source ? [...prev, source] : prev;
          }
          return prev.filter((a) => a.announcementId !== id);
        });
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error(err);
      alert("Server Error");
    }
    setPinningId(null);
  };

  // ------------------------------------------------
  // DELETE
  // ------------------------------------------------
  const deleteAnnouncement = async (id) => {
    if (!window.confirm("Delete this dispatch? This can't be undone.")) return;

    setLoading(true);
    try {
      const response = await fetch(API_CRUD, {
        method: "DELETE",
        headers,
        body: JSON.stringify({ batchId, announcementId: id }),
      });
      const data = await response.json();

      if (data.success) {
        setAnnouncements((prev) => prev.filter((a) => a.announcementId !== id));
        setPinnedList((prev) => prev.filter((a) => a.announcementId !== id));
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error(err);
      alert("Server Error");
    }
    setLoading(false);
  };

  // ------------------------------------------------
  // JUMP TO ENTRY (from the pinned manifest in the rail)
  // ------------------------------------------------
  const jumpToEntry = (id) => {
    setView("all");
    requestAnimationFrame(() => {
      entryRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  // ------------------------------------------------
  // RENDER
  // ------------------------------------------------
  return (
    <div className="dl-root">
      {/* -------- RAIL -------- */}
      <aside className="dl-rail">
        <div className="dl-rail-top">
         
        </div>

        <nav className="dl-nav" aria-label="Dispatch views">
          <button
            className={`dl-nav-btn${view === "all" ? " active" : ""}`}
            onClick={() => setView("all")}
          >
            <span><span className="dl-nav-glyph">▤</span>&nbsp; All Announcements</span>
            <span className="dl-nav-count">{announcements.length}</span>
          </button>
          <button
            className={`dl-nav-btn${view === "pinned" ? " active" : ""}`}
            onClick={() => setView("pinned")}
          >
            <span><span className="dl-nav-glyph">📌</span>&nbsp; Pinned</span>
            <span className="dl-nav-count">{pinnedList.length}</span>
          </button>
        </nav>

        <div className="dl-manifest">
          <div className="dl-manifest-label">Pinned manifest</div>
          {pinnedList.length === 0 ? (
            <div className="dl-manifest-empty">Nothing pinned yet. Pin a dispatch to keep it here.</div>
          ) : (
            sortAsc(pinnedList).slice().reverse().map((p) => (
              <button
                key={p.announcementId}
                className="dl-manifest-item"
                onClick={() => jumpToEntry(p.announcementId)}
                title="Jump to dispatch"
              >
                <span className="dl-manifest-dot" />
                <span className="dl-manifest-text">{p.text}</span>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* -------- MAIN -------- */}
      <main className="dl-main">
        <div className="dl-feed" ref={feedRef}>
          {listForView.length === 0 && !loading && (
            <div className="dl-empty">
              <span className="dl-empty-glyph">— NO SIGNAL —</span>
              <div className="dl-empty-title">
                {view === "pinned"
                  ? "Nothing pinned yet. Pin a dispatch to keep it here."
                  : "Nothing sent to this batch yet. Write the first dispatch below."}
              </div>
            </div>
          )}

          {view === "all" && hasMore && (
            <div className="dl-load-more-top">
              <button
                className="dl-load-btn"
                onClick={() => fetchAnnouncements(nextToken)}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading…" : "↑ Load earlier dispatches"}
              </button>
            </div>
          )}

          {groupedByDay.map((group) => (
            <React.Fragment key={group.label}>
              <div className="dl-day">
                <span className="dl-day-tab">{group.label}</span>
                <span className="dl-day-rule" />
              </div>
              {group.items.map((ann) => (
                <AnnouncementEntry
                  key={ann.announcementId}
                  announcement={ann}
                  editingId={editingId}
                  setEditingId={setEditingId}
                  togglePin={togglePin}
                  deleteAnnouncement={deleteAnnouncement}
                  editAnnouncement={editAnnouncement}
                  pinningId={pinningId}
                  loading={loading}
                  entryRef={(el) => (entryRefs.current[ann.announcementId] = el)}
                />
              ))}
            </React.Fragment>
          ))}

          <div ref={feedEndRef} />
        </div>

        <div className="dl-composer">
          <div className="dl-composer-label">New Announcement</div>
          <PlainTextEditor
            value={text}
            onChange={setText}
            placeholder="Write an update for this batch…"
            minHeight={46}
            maxHeight={440}
            ariaLabel="Compose new announcement"
          />
          <div className="dl-composer-footer">
            <span className="dl-composer-hint">Enter for a new line</span>
            <button
              className="dl-send-btn"
              onClick={createAnnouncement}
              disabled={loading || isTextEmpty(text)}
            >
              {loading ? "Sending…" : "Send Announcement"}
              {!loading && <span aria-hidden="true">→</span>}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

// ==================================================================
// SUB-COMPONENT: Announcement Entry
// ==================================================================
function AnnouncementEntry({
  announcement,
  editingId,
  setEditingId,
  togglePin,
  deleteAnnouncement,
  editAnnouncement,
  pinningId,
  loading,
  entryRef,
}) {
  const isPinned = announcement.isPinned;

  return (
    <div className="dl-entry" ref={entryRef}>
      <div className="dl-rail-mark">
        <div className="dl-tick" />
      </div>
      <div className={`dl-card${isPinned ? " pinned" : ""}`}>
        <div className="dl-card-head">
          <div className="dl-meta">
            <span>{formatDateShort(announcement.createdAt)} · {formatTime(announcement.createdAt)}</span>
            {isPinned && <span className="dl-pin-badge">📌 Pinned</span>}
          </div>
          {editingId !== announcement.announcementId && (
            <div className="dl-entry-actions">
              <button
                className={`dl-icon-btn${isPinned ? " pin-active" : ""}`}
                onClick={() => togglePin(announcement.announcementId, isPinned)}
                disabled={pinningId === announcement.announcementId || loading}
                aria-label={isPinned ? "Unpin dispatch" : "Pin dispatch"}
                aria-pressed={isPinned}
                title={isPinned ? "Unpin" : "Pin"}
              >
                📌
              </button>
              <button
                className="dl-icon-btn"
                onClick={() => setEditingId(announcement.announcementId)}
                disabled={loading}
                aria-label="Edit dispatch"
                title="Edit"
              >
                ✎
              </button>
              <button
                className="dl-icon-btn danger"
                onClick={() => deleteAnnouncement(announcement.announcementId)}
                disabled={loading}
                aria-label="Delete dispatch"
                title="Delete"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {editingId === announcement.announcementId ? (
          <EditAnnouncementEditor
            initialText={announcement.text}
            onSave={(newText) => editAnnouncement(announcement.announcementId, newText)}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <>
            <ExpandableBody text={announcement.text} />
            <ReactionBar reactions={announcement.reactions} />
          </>
        )}
      </div>
    </div>
  );
}

// ==================================================================
// SUB-COMPONENT: Reaction Bar (display only)
// ==================================================================
function ReactionBar({ reactions }) {
  const entries = Object.entries(reactions || {})
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) return null;

  return (
    <div className="dl-reactions-row">
      {entries.map(([name, count]) => (
        <span key={name} className="dl-reaction-pill">
          <span aria-hidden="true">{REACTION_EMOJI[name] || "•"}</span>
          <span>{count}</span>
        </span>
      ))}
    </div>
  );
}