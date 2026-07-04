import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Users, Star, Trophy, TrendingDown, TrendingUp, Search, Bell,
  ChevronDown, Menu, LayoutDashboard, BarChart3, GraduationCap,
  RefreshCw, FileText, Settings, ListFilter, Calendar, Award,
  ArrowUpRight, ArrowDownRight, Sparkles, X, ChevronRight,
} from "lucide-react";

/* ============================================================================
   DESIGN TOKENS
   Light, data-dense SaaS aesthetic (Stripe / Linear / Vercel register):
   near-white cool-gray canvas, a single indigo accent reserved for
   interactive/positive signal, hairline borders instead of heavy shadows,
   tabular numerals for anything that represents a score or count.
   ========================================================================= */
const TOKENS = `
  :root{
    --bg:#F8F9FB;
    --surface:#FFFFFF;
    --surface-raised:#FFFFFF;
    --border:#E7E9EE;
    --border-strong:#D8DBE2;
    --text-primary:#0F1729;
    --text-secondary:#5B6472;
    --text-tertiary:#98A1AF;
    --accent:#4F46E5;
    --accent-soft:#EEF0FE;
    --accent-strong:#3A32C7;
    --success:#0F9D64;
    --success-soft:#E7F7EF;
    --warning:#B5730B;
    --warning-soft:#FCF1DE;
    --danger:#D6432F;
    --danger-soft:#FCEBE8;
    --gold:#C99A2E;
    --silver:#8B92A0;
    --bronze:#B36A3C;
    --radius-lg:16px;
    --radius-md:12px;
    --radius-sm:8px;
    --shadow-sm:0 1px 2px rgba(15,23,41,0.04);
    --shadow-md:0 4px 16px rgba(15,23,41,0.06);
    --shadow-lg:0 12px 32px rgba(15,23,41,0.08);
  }
  .dash-root{
    background:var(--bg);
    color:var(--text-primary);
    font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
    -webkit-font-smoothing:antialiased;
    min-height:100vh;
  }
  .tnum{ font-variant-numeric:tabular-nums; font-feature-settings:"tnum" 1; }
  .mono{ font-family:"IBM Plex Mono","SFMono-Regular",Menlo,monospace; }
  .card{
    background:var(--surface);
    border:1px solid var(--border);
    border-radius:var(--radius-lg);
    box-shadow:var(--shadow-sm);
    transition:box-shadow .2s ease, border-color .2s ease, transform .2s ease;
  }
  .card:hover{ box-shadow:var(--shadow-md); border-color:var(--border-strong); }
  .scrollbar-thin::-webkit-scrollbar{ width:6px; height:6px; }
  .scrollbar-thin::-webkit-scrollbar-thumb{ background:var(--border-strong); border-radius:99px; }
  .focus-ring:focus-visible{ outline:2px solid var(--accent); outline-offset:2px; border-radius:8px; }
  @media (prefers-reduced-motion: reduce){
    *{ animation-duration:0.01ms !important; transition-duration:0.01ms !important; }
  }
`;

/* ---------------------------------- helpers ---------------------------------- */

const MONTH_NAMES = {
  jan: "January", feb: "February", mar: "March", apr: "April", may: "May",
  jun: "June", jul: "July", aug: "August", sep: "September", oct: "October",
  nov: "November", dec: "December",
};

function formatMonthYear(monthYear) {
  if (!monthYear) return "—";
  const [m, y] = monthYear.split("_");
  return `${MONTH_NAMES[m] || m} ${y}`;
}

function formatNumber(n) {
  if (n === undefined || n === null) return "—";
  return new Intl.NumberFormat("en-IN").format(n);
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// Splits the raw API summaries array into the shapes the dashboard needs.
function partitionSummaries(summaries = []) {
  const months = summaries
    .filter((s) => s.type === "MONTH_SUMMARY")
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const revision = summaries.find((s) => s.type === "REVISION") || null;
  const overall = summaries.find((s) => s.type === "SUMMARY") || null;
  return { months, revision, overall };
}

// Lightweight requestAnimationFrame count-up, no extra deps.
function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf;
    const start = performance.now();
    const from = 0;
    const to = Number(target) || 0;
    function tick(now) {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(from + (to - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

/* ---------------------------------- primitives ---------------------------------- */

function SectionCard({ title, subtitle, icon: Icon, actions, children, className = "" }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={`card p-5 sm:p-6 ${className}`}
    >
      {(title || actions) && (
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-start gap-3">
            {Icon && (
              <div className="w-9 h-9 rounded-[10px] bg-[var(--accent-soft)] flex items-center justify-center shrink-0">
                <Icon size={17} strokeWidth={2} color="var(--accent)" />
              </div>
            )}
            <div>
              {title && <h3 className="text-[15px] font-semibold text-[var(--text-primary)] leading-none">{title}</h3>}
              {subtitle && <p className="text-[13px] text-[var(--text-secondary)] mt-1.5">{subtitle}</p>}
            </div>
          </div>
          {actions}
        </div>
      )}
      {children}
    </motion.section>
  );
}

function Badge({ children, tone = "neutral" }) {
  const tones = {
    neutral: { bg: "var(--accent-soft)", fg: "var(--accent)" },
    success: { bg: "var(--success-soft)", fg: "var(--success)" },
    warning: { bg: "var(--warning-soft)", fg: "var(--warning)" },
    danger: { bg: "var(--danger-soft)", fg: "var(--danger)" },
  }[tone];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium tnum"
      style={{ background: tones.bg, color: tones.fg }}
    >
      {children}
    </span>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[var(--border)] rounded-[10px] shadow-lg px-3.5 py-2.5 text-[12px]">
      <p className="font-medium text-[var(--text-primary)] mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-[var(--text-secondary)]">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span>{p.name}:</span>
          <span className="tnum font-medium text-[var(--text-primary)]">{formatNumber(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------- skeletons ---------------------------------- */

function SkeletonBlock({ className }) {
  return (
    <div className={`animate-pulse rounded-[10px] bg-[#EEF0F3] ${className}`} />
  );
}

function DashboardSkeleton() {
  return (
    <div className="p-4 sm:p-8 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonBlock key={i} className="h-[124px]" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonBlock key={i} className="h-[300px]" />)}
      </div>
      <SkeletonBlock className="h-[420px]" />
    </div>
  );
}

/* ---------------------------------- sidebar / header ---------------------------------- */

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
  { key: "leaderboard", label: "Leaderboard", icon: Trophy },
  { key: "students", label: "Students", icon: GraduationCap },
  { key: "revision", label: "Revision", icon: RefreshCw },
  { key: "reports", label: "Reports", icon: FileText },
  { key: "settings", label: "Settings", icon: Settings },
];

function Sidebar({ collapsed, onToggle, active, onSelect }) {
  return (
    <aside
      className="hidden md:flex flex-col shrink-0 border-r border-[var(--border)] bg-[var(--surface)] transition-all duration-200"
      style={{ width: collapsed ? 72 : 224 }}
    >
      <div className="h-16 flex items-center gap-2.5 px-4 border-b border-[var(--border)]">
        <div className="w-8 h-8 rounded-[9px] bg-[var(--accent)] flex items-center justify-center shrink-0">
          <Sparkles size={16} color="#fff" />
        </div>
        {!collapsed && <span className="font-semibold text-[15px] tracking-tight">Academy</span>}
      </div>
      <nav className="flex-1 py-3 px-2.5 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onSelect(item.key)}
              className={`focus-ring w-full flex items-center gap-3 px-2.5 py-2 rounded-[10px] text-[13.5px] font-medium transition-colors ${
                isActive ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg)]"
              }`}
            >
              <item.icon size={17} strokeWidth={2} />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>
      <button
        onClick={onToggle}
        className="focus-ring m-2.5 mb-3 flex items-center justify-center gap-2 py-2 rounded-[10px] text-[var(--text-tertiary)] hover:bg-[var(--bg)] text-[12px]"
      >
        <ChevronRight size={15} className={`transition-transform ${collapsed ? "" : "rotate-180"}`} />
        {!collapsed && "Collapse"}
      </button>
    </aside>
  );
}

function TopHeader({ batchId, monthLabel, onSearch, onMenuClick }) {
  const [query, setQuery] = useState("");
  return (
    <header className="sticky top-0 z-20 h-16 flex items-center justify-between gap-4 px-4 sm:px-8 border-b border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur">
      <div className="flex items-center gap-3 min-w-0">
        <button onClick={onMenuClick} className="md:hidden focus-ring p-1.5 rounded-[8px] hover:bg-[var(--bg)]">
          <Menu size={19} />
        </button>
        <div className="min-w-0">
          <h1 className="text-[16px] font-semibold leading-none truncate">Batch Performance</h1>
          <div className="flex items-center gap-1.5 mt-1.5 text-[12px] text-[var(--text-tertiary)]">
            <span className="mono truncate max-w-[160px] sm:max-w-none">{batchId || "—"}</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1"><Calendar size={11} />{monthLabel}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-sm hidden sm:block">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); onSearch?.(e.target.value); }}
            placeholder="Search student ID…"
            className="focus-ring w-full pl-9 pr-3 py-2 rounded-[10px] border border-[var(--border)] bg-[var(--bg)] text-[13px] placeholder:text-[var(--text-tertiary)] outline-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button className="focus-ring relative p-2 rounded-[10px] hover:bg-[var(--bg)]">
          <Bell size={17} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[var(--danger)]" />
        </button>
        <div className="w-px h-6 bg-[var(--border)]" />
        <div className="flex items-center gap-2 pl-1">
          <div className="w-8 h-8 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center text-[12px] font-semibold">
            AD
          </div>
          <div className="hidden lg:block leading-tight">
            <p className="text-[12.5px] font-medium">Admin</p>
            <p className="text-[11px] text-[var(--text-tertiary)]">Academy Staff</p>
          </div>
          <ChevronDown size={14} className="text-[var(--text-tertiary)] hidden lg:block" />
        </div>
      </div>
    </header>
  );
}

/* ---------------------------------- KPI cards ---------------------------------- */

function KPICard({ label, value, icon: Icon, accent, trend, suffix = "" }) {
  const animated = useCountUp(value);
  const isUp = trend !== undefined && trend >= 0;
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="card p-5 relative overflow-hidden"
    >
      <div
        className="absolute -top-8 -right-8 w-28 h-28 rounded-full opacity-[0.07]"
        style={{ background: accent }}
      />
      <div className="flex items-center justify-between mb-4">
        <div className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: `${accent}1A` }}>
          <Icon size={17} color={accent} strokeWidth={2.1} />
        </div>
        {trend !== undefined && (
          <span
            className="inline-flex items-center gap-0.5 text-[11.5px] font-medium tnum"
            style={{ color: isUp ? "var(--success)" : "var(--danger)" }}
          >
            {isUp ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-[26px] font-semibold tnum leading-none">{formatNumber(Math.round(animated))}{suffix}</p>
      <p className="text-[12.5px] text-[var(--text-secondary)] mt-2">{label}</p>
    </motion.div>
  );
}

/* ---------------------------------- charts ---------------------------------- */

function TrendLineChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--text-tertiary)" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: "var(--text-tertiary)" }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <Line type="monotone" dataKey="averageScore" name="Average score" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--accent)" }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function StudentAreaChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="studentFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--text-tertiary)" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: "var(--text-tertiary)" }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <Area type="monotone" dataKey="totalStudents" name="Students" stroke="var(--accent)" strokeWidth={2} fill="url(#studentFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function HighLowBarChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }} barGap={6}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--text-tertiary)" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: "var(--text-tertiary)" }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="highestScore" name="Highest" fill="var(--accent)" radius={[6, 6, 0, 0]} />
        <Bar dataKey="lowestScore" name="Lowest" fill="#C7CAD6" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ComparisonComposedChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="avgFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--success)" stopOpacity={0.22} />
            <stop offset="100%" stopColor="var(--success)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--text-tertiary)" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: "var(--text-tertiary)" }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <Area type="monotone" dataKey="averageScore" name="Average score" stroke="var(--success)" fill="url(#avgFill)" strokeWidth={2} />
        <Line type="monotone" dataKey="highestScore" name="Highest score" stroke="var(--accent)" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function PercentileChart({ percentileAnalysis = [] }) {
  const data = percentileAnalysis.map((p) => ({ ...p, label: p.percentile }));
  return (
    <ResponsiveContainer width="100%" height={340}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }} barSize={16}>
        <CartesianGrid stroke="var(--border)" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11.5, fill: "var(--text-tertiary)" }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="label" width={64} tick={{ fontSize: 11.5, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload;
            return (
              <div className="bg-white border border-[var(--border)] rounded-[10px] shadow-lg px-3.5 py-2.5 text-[12px] space-y-1">
                <p className="font-medium mb-1">Percentile {label}</p>
                <p className="text-[var(--text-secondary)]">Students: <span className="tnum font-medium text-[var(--text-primary)]">{formatNumber(d.students)}</span></p>
                <p className="text-[var(--text-secondary)]">Average: <span className="tnum font-medium text-[var(--text-primary)]">{d.averageScore}</span></p>
                <p className="text-[var(--text-secondary)]">Range: <span className="tnum font-medium text-[var(--text-primary)]">{d.lowestScore}–{d.highestScore}</span></p>
              </div>
            );
          }}
        />
        <Bar dataKey="averageScore" name="Average score" fill="var(--accent)" radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ---------------------------------- leaderboard ---------------------------------- */

const MEDAL = { 1: { color: "var(--gold)", label: "🥇" }, 2: { color: "var(--silver)", label: "🥈" }, 3: { color: "var(--bronze)", label: "🥉" } };

function Leaderboard({ students = [], searchQuery }) {
  const [sortDir, setSortDir] = useState("desc");

  const filtered = useMemo(() => {
    let list = [...students];
    if (searchQuery) list = list.filter((s) => s.studentId.toLowerCase().includes(searchQuery.toLowerCase()));
    list.sort((a, b) => (sortDir === "desc" ? b.totalScore - a.totalScore : a.totalScore - b.totalScore));
    return list;
  }, [students, searchQuery, sortDir]);

  return (
    <div className="overflow-x-auto scrollbar-thin -mx-1">
      <table className="w-full text-[13.5px] min-w-[420px]">
        <thead>
          <tr className="text-left text-[11.5px] uppercase tracking-wide text-[var(--text-tertiary)] border-b border-[var(--border)]">
            <th className="py-2.5 px-3 font-medium">Rank</th>
            <th className="py-2.5 px-3 font-medium">Student</th>
            <th
              className="py-2.5 px-3 font-medium cursor-pointer select-none"
              onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
            >
              <span className="inline-flex items-center gap-1">
                Score <ChevronDown size={12} className={`transition-transform ${sortDir === "asc" ? "rotate-180" : ""}`} />
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          <AnimatePresence>
            {filtered.map((s, i) => {
              const medal = MEDAL[s.rank];
              return (
                <motion.tr
                  key={s.studentId}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg)] transition-colors"
                >
                  <td className="py-2.5 px-3">
                    <span className="inline-flex items-center gap-1.5 font-medium tnum" style={{ color: medal?.color || "var(--text-secondary)" }}>
                      {medal ? medal.label : `#${s.rank}`}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 mono text-[12.5px] text-[var(--text-secondary)]">{s.studentId}</td>
                  <td className="py-2.5 px-3 font-semibold tnum">{formatNumber(s.totalScore)}</td>
                </motion.tr>
              );
            })}
          </AnimatePresence>
          {filtered.length === 0 && (
            <tr><td colSpan={3} className="py-8 text-center text-[var(--text-tertiary)] text-[13px]">No students match your search.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------------------------- monthly cards ---------------------------------- */

function MonthlySummaryCards({ months }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {months.map((m) => {
        const pct = m.highestScore ? Math.round((m.averageScore / m.highestScore) * 100) : 0;
        return (
          <div key={m.monthYear} className="card p-4.5 p-[18px]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[13.5px] font-semibold">{formatMonthYear(m.monthYear)}</span>
              <Badge>{formatNumber(m.totalStudents)} students</Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center mb-3.5">
              <div>
                <p className="text-[15px] font-semibold tnum">{m.averageScore}</p>
                <p className="text-[10.5px] text-[var(--text-tertiary)] mt-0.5">Average</p>
              </div>
              <div>
                <p className="text-[15px] font-semibold tnum text-[var(--success)]">{m.highestScore}</p>
                <p className="text-[10.5px] text-[var(--text-tertiary)] mt-0.5">Highest</p>
              </div>
              <div>
                <p className="text-[15px] font-semibold tnum text-[var(--danger)]">{m.lowestScore}</p>
                <p className="text-[10.5px] text-[var(--text-tertiary)] mt-0.5">Lowest</p>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--bg)] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className="h-full rounded-full bg-[var(--accent)]"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------- circular / radial gauges ---------------------------------- */

function CircularStat({ value, max, label, color = "var(--accent)", size = 108 }) {
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max ? Math.min(1, value / max) : 0;
  return (
    <div className="flex flex-col items-center gap-2.5">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--bg)" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
          strokeLinecap="round" strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - pct * c }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" transform={`rotate(90 ${size / 2} ${size / 2})`} className="tnum" fontSize="18" fontWeight="600" fill="var(--text-primary)">
          {formatNumber(value)}
        </text>
      </svg>
      <span className="text-[12px] text-[var(--text-secondary)]">{label}</span>
    </div>
  );
}

function RevisionPerformance({ revision }) {
  if (!revision) return <EmptyState label="No revision test recorded yet." />;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <CircularStat value={revision.totalStudents} max={revision.totalStudents} label="Total students" color="var(--accent)" />
      <CircularStat value={revision.averageScore} max={revision.highestScore} label="Average score" color="var(--success)" />
      <CircularStat value={revision.highestScore} max={revision.highestScore} label="Highest score" color="var(--gold)" />
      <CircularStat value={revision.lowestScore} max={revision.highestScore} label="Lowest score" color="var(--danger)" />
    </div>
  );
}

function OverallPerformance({ overall }) {
  if (!overall) return <EmptyState label="No overall summary available yet." />;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <CircularStat value={overall.averageScore} max={overall.highestScore} label="Average score" color="var(--accent)" />
      <CircularStat value={overall.highestScore} max={overall.highestScore} label="Highest score" color="var(--gold)" />
      <CircularStat value={overall.lowestScore} max={overall.highestScore} label="Lowest score" color="var(--danger)" />
      <CircularStat value={overall.totalStudents} max={overall.totalStudents} label="Student count" color="var(--success)" />
    </div>
  );
}

function EmptyState({ label }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-10 h-10 rounded-full bg-[var(--bg)] flex items-center justify-center mb-3">
        <FileText size={16} className="text-[var(--text-tertiary)]" />
      </div>
      <p className="text-[13px] text-[var(--text-tertiary)]">{label}</p>
    </div>
  );
}

/* ---------------------------------- insights ---------------------------------- */

function buildInsights({ months, overall, revision }) {
  const insights = [];
  if (months.length >= 2) {
    const [prev, latest] = months.slice(-2);
    const diff = latest.averageScore - prev.averageScore;
    insights.push({
      icon: diff >= 0 ? TrendingUp : TrendingDown,
      tone: diff >= 0 ? "success" : "danger",
      text: `Average score ${diff >= 0 ? "increased" : "decreased"} by ${Math.abs(diff).toFixed(1)} points versus ${formatMonthYear(prev.monthYear)}.`,
    });
    if (latest.highestScore !== prev.highestScore) {
      insights.push({
        icon: latest.highestScore > prev.highestScore ? TrendingUp : TrendingDown,
        tone: latest.highestScore > prev.highestScore ? "success" : "warning",
        text: `Highest score ${latest.highestScore > prev.highestScore ? "improved" : "dropped"} to ${latest.highestScore} in ${formatMonthYear(latest.monthYear)}.`,
      });
    }
  }
  if (overall?.percentileAnalysis?.length) {
    const mid = overall.percentileAnalysis[Math.floor(overall.percentileAnalysis.length / 2)];
    insights.push({
      icon: BarChart3,
      tone: "neutral",
      text: `The middle percentile band (${mid.percentile}) holds an average score of ${mid.averageScore}, the densest concentration of students.`,
    });
  }
  const top = overall?.top10Students?.[0];
  if (top) {
    insights.push({
      icon: Trophy,
      tone: "success",
      text: `Top performer ${top.studentId} leads with a score of ${formatNumber(top.totalScore)}.`,
    });
  }
  if (revision) {
    insights.push({
      icon: RefreshCw,
      tone: "neutral",
      text: `Revision round drew ${formatNumber(revision.totalStudents)} students with an average of ${revision.averageScore}.`,
    });
  }
  return insights;
}

function InsightsPanel({ insights }) {
  const toneColor = { success: "var(--success)", warning: "var(--warning)", danger: "var(--danger)", neutral: "var(--accent)" };
  const toneSoft = { success: "var(--success-soft)", warning: "var(--warning-soft)", danger: "var(--danger-soft)", neutral: "var(--accent-soft)" };
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
      {insights.map((ins, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
          className="flex items-start gap-3 p-4 rounded-[12px] border border-[var(--border)]"
        >
          <div className="w-8 h-8 rounded-[9px] flex items-center justify-center shrink-0" style={{ background: toneSoft[ins.tone] }}>
            <ins.icon size={15} color={toneColor[ins.tone]} />
          </div>
          <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">{ins.text}</p>
        </motion.div>
      ))}
      {insights.length === 0 && <EmptyState label="Not enough data yet to generate insights." />}
    </div>
  );
}

/* ---------------------------------- filters ---------------------------------- */

function FiltersBar({ months, selectedKey, onSelect }) {
  const options = [
    { key: "overall", label: "Overall" },
    { key: "revision", label: "Revision" },
    ...months.map((m) => ({ key: m.monthYear, label: formatMonthYear(m.monthYear) })),
  ];
  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin pb-1">
      <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-tertiary)] shrink-0 mr-1">
        <ListFilter size={13} /> View:
      </span>
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onSelect(o.key)}
          className={`focus-ring shrink-0 px-3 py-1.5 rounded-full text-[12.5px] font-medium border transition-colors ${
            selectedKey === o.key
              ? "bg-[var(--accent)] text-white border-[var(--accent)]"
              : "bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--border-strong)]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ============================================================================
   MAIN DASHBOARD PAGE
   ========================================================================= */

const API_URL = "https://u5e067rz0k.execute-api.ap-south-1.amazonaws.com/default/dashboard";

export default function DashboardPage() {
  const { batchId } = useParams();
  const [summaries, setSummaries] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeNav, setActiveNav] = useState("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedView, setSelectedView] = useState("overall");

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ batchId }),
      });
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Failed to load dashboard data");
      setSummaries(data.summaries || []);
    } catch (err) {
      setError(err.message || "Something went wrong while loading the dashboard.");
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    if (batchId) fetchDashboard();
  }, [batchId, fetchDashboard]);

  const { months, revision, overall } = useMemo(() => partitionSummaries(summaries || []), [summaries]);

  const chartData = useMemo(
    () => months.map((m) => ({
      label: formatMonthYear(m.monthYear).split(" ")[0].slice(0, 3),
      averageScore: m.averageScore,
      totalStudents: m.totalStudents,
      highestScore: m.highestScore,
      lowestScore: m.lowestScore,
    })),
    [months]
  );

  const latestMonth = months[months.length - 1];
  const prevMonth = months[months.length - 2];
  const trendFor = (key) => {
    if (!latestMonth || !prevMonth || !prevMonth[key]) return undefined;
    return ((latestMonth[key] - prevMonth[key]) / prevMonth[key]) * 100;
  };

  const kpi = overall || latestMonth || {};

  const selectedSummary = useMemo(() => {
    if (selectedView === "overall") return overall;
    if (selectedView === "revision") return revision;
    return months.find((m) => m.monthYear === selectedView) || overall;
  }, [selectedView, overall, revision, months]);

  const insights = useMemo(() => buildInsights({ months, overall, revision }), [months, overall, revision]);

  return (
    <div className="dash-root flex">
      <style>{TOKENS}</style>

      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
        active={activeNav}
        onSelect={setActiveNav}
      />

      {/* mobile nav drawer */}
      <AnimatePresence>
        {mobileNavOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-30 md:hidden"
              onClick={() => setMobileNavOpen(false)}
            />
            <motion.div
              initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }} transition={{ type: "tween" }}
              className="fixed left-0 top-0 bottom-0 w-64 bg-[var(--surface)] z-40 md:hidden border-r border-[var(--border)] p-3"
            >
              <div className="flex items-center justify-between mb-4 px-1">
                <span className="font-semibold text-[15px]">Academy</span>
                <button onClick={() => setMobileNavOpen(false)} className="focus-ring p-1.5 rounded-[8px] hover:bg-[var(--bg)]"><X size={18} /></button>
              </div>
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.key}
                  onClick={() => { setActiveNav(item.key); setMobileNavOpen(false); }}
                  className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-[10px] text-[13.5px] font-medium mb-0.5 ${
                    activeNav === item.key ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text-secondary)]"
                  }`}
                >
                  <item.icon size={17} /> {item.label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 min-w-0">
        <TopHeader
          batchId={batchId}
          monthLabel={formatMonthYear(latestMonth?.monthYear)}
          onSearch={setSearchQuery}
          onMenuClick={() => setMobileNavOpen(true)}
        />

        {loading && <DashboardSkeleton />}

        {!loading && error && (
          <div className="p-8">
            <div className="card p-8 flex flex-col items-center text-center max-w-md mx-auto">
              <div className="w-11 h-11 rounded-full bg-[var(--danger-soft)] flex items-center justify-center mb-3">
                <X size={18} color="var(--danger)" />
              </div>
              <p className="font-semibold mb-1">Couldn't load the dashboard</p>
              <p className="text-[13px] text-[var(--text-secondary)] mb-4">{error}</p>
              <button onClick={fetchDashboard} className="focus-ring inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] bg-[var(--accent)] text-white text-[13px] font-medium hover:bg-[var(--accent-strong)]">
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          </div>
        )}

        {!loading && !error && summaries && (
          <main className="p-4 sm:p-8 space-y-6 max-w-[1400px] mx-auto">

            {/* KPI CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <KPICard label="Total students" value={kpi.totalStudents} icon={Users} accent="var(--accent)" trend={trendFor("totalStudents")} />
              <KPICard label="Average score" value={kpi.averageScore} icon={Star} accent="var(--success)" trend={trendFor("averageScore")} />
              <KPICard label="Highest score" value={kpi.highestScore} icon={Trophy} accent="var(--gold)" trend={trendFor("highestScore")} />
              <KPICard label="Lowest score" value={kpi.lowestScore} icon={TrendingDown} accent="var(--danger)" trend={trendFor("lowestScore")} />
            </div>

            {/* CHARTS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SectionCard title="Monthly average score trend" subtitle="Average score across recorded months" icon={BarChart3}>
                <TrendLineChart data={chartData} />
              </SectionCard>
              <SectionCard title="Monthly student count" subtitle="Participation volume by month" icon={Users}>
                <StudentAreaChart data={chartData} />
              </SectionCard>
              <SectionCard title="Highest vs lowest score" subtitle="Score spread per month" icon={BarChart3}>
                <HighLowBarChart data={chartData} />
              </SectionCard>
              <SectionCard title="Average score comparison" subtitle="Average against the ceiling score" icon={TrendingUp}>
                <ComparisonComposedChart data={chartData} />
              </SectionCard>
            </div>

            {/* FILTERS */}
            <FiltersBar months={months} selectedKey={selectedView} onSelect={setSelectedView} />

            {/* PERCENTILE + LEADERBOARD */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <SectionCard
                title="Percentile analysis"
                subtitle={`Score distribution — ${selectedView === "overall" ? "overall" : selectedView === "revision" ? "revision" : formatMonthYear(selectedView)}`}
                icon={BarChart3}
                className="lg:col-span-3"
              >
                {selectedSummary?.percentileAnalysis
                  ? <PercentileChart percentileAnalysis={selectedSummary.percentileAnalysis} />
                  : <EmptyState label="No percentile data for this view." />}
              </SectionCard>

              <SectionCard title="Top students" subtitle="Leaderboard" icon={Award} className="lg:col-span-2">
                <Leaderboard students={selectedSummary?.top10Students || []} searchQuery={searchQuery} />
              </SectionCard>
            </div>

            {/* MONTHLY SUMMARY */}
            <SectionCard title="Monthly summary" subtitle="Snapshot of every recorded month" icon={Calendar}>
              {months.length ? <MonthlySummaryCards months={months} /> : <EmptyState label="No monthly summaries yet." />}
            </SectionCard>

            {/* REVISION + OVERALL */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SectionCard title="Revision performance" subtitle="Latest revision round" icon={RefreshCw}>
                <RevisionPerformance revision={revision} />
              </SectionCard>
              <SectionCard title="Overall performance" subtitle="All-time aggregate" icon={Trophy}>
                <OverallPerformance overall={overall} />
              </SectionCard>
            </div>

            {/* INSIGHTS */}
            <SectionCard title="Insights" subtitle="Automatically generated from current data" icon={Sparkles}>
              <InsightsPanel insights={insights} />
            </SectionCard>

            <p className="text-center text-[11.5px] text-[var(--text-tertiary)] pb-4">
              Last synced {formatDate(overall?.updatedAt || latestMonth?.updatedAt)}
            </p>
          </main>
        )}
      </div>
    </div>
  );
}