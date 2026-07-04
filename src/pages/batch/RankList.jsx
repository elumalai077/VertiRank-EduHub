import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

// ---------------------------------------------------------------------------
// API endpoints & auth helpers
// ---------------------------------------------------------------------------
const MONTH_API =
  "https://u5e067rz0k.execute-api.ap-south-1.amazonaws.com/default/GetBatchTopRanksByMonth";
const OVERALL_API =
  "https://u5e067rz0k.execute-api.ap-south-1.amazonaws.com/default/GetBatchTopRanks";
const REVISION_API =
  "https://u5e067rz0k.execute-api.ap-south-1.amazonaws.com/default/GetBatchreRivisonTopRanks";

const getToken = () => localStorage.getItem("token");
const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

// ---------------------------------------------------------------------------
// Column group definitions per tab (used for headers & column tinting)
// ---------------------------------------------------------------------------
const GROUPS_BY_TYPE = {
  monthly: [
    { key: "monthly", label: "This Month", color: "m" },
    { key: "overall", label: "Overall", color: "o" },
    { key: "revision", label: "Revision", color: "r" },
  ],
  overall: [{ key: "overall", label: "Overall Performance", color: "o" }],
  revision: [{ key: "revision", label: "Revision Performance", color: "r" }],
};

// ---------------------------------------------------------------------------
// Presentational helpers
// ---------------------------------------------------------------------------
function RankMedal({ rank }) {
  if (rank == null || rank <= 0) return <span className="rl-dash">—</span>;

  const tier =
    rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : "plain";
  const label =
    rank === 1 ? "1st" : rank === 2 ? "2nd" : rank === 3 ? "3rd" : rank;

  return (
    <span className={`rl-medal rl-medal--${tier}`} title={`Rank ${rank}`}>
      {label}
    </span>
  );
}

function TabButton({ active, onClick, icon, label, color }) {
  return (
    <button
      onClick={onClick}
      className={`rl-tab rl-tab--${color}${active ? " rl-tab--active" : ""}`}
      type="button"
      aria-current={active ? "page" : undefined}
    >
      <span className="rl-tab-icon" aria-hidden="true">{icon}</span>
      {label}
    </button>
  );
}

function SkeletonRows({ columns }) {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="rl-skeleton-row">
          {Array.from({ length: columns }).map((__, j) => (
            <td key={j}>
              <div className="rl-skeleton-bar" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function RankList() {
  const { batchId } = useParams();
  const navigate = useNavigate();

  const [leaderboardType, setLeaderboardType] = useState("monthly");
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [nextToken, setNextToken] = useState(null);
  const [order, setOrder] = useState("desc");
  const [limit] = useState(20);
  const [searchStudentId, setSearchStudentId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("jun_2026");

  // Generate month options from June 2026 to current month
  const getMonthOptions = () => {
    const start = new Date(2026, 5, 1);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const options = [];
    const current = new Date(start);
    const monthNames = [
      "jan", "feb", "mar", "apr", "may", "jun",
      "jul", "aug", "sep", "oct", "nov", "dec",
    ];
    while (
      current.getFullYear() < currentYear ||
      (current.getFullYear() === currentYear && current.getMonth() <= currentMonth)
    ) {
      const year = current.getFullYear();
      const month = current.getMonth();
      const monthStr = monthNames[month];
      const label = `${monthStr.charAt(0).toUpperCase() + monthStr.slice(1)} ${year}`;
      const value = `${monthStr}_${year}`;
      options.push({ label, value });
      current.setMonth(current.getMonth() + 1);
    }
    return options;
  };
  const monthOptions = getMonthOptions();

  // Fetch data
  const fetchRanks = async (loadMore = false, currentOrder = order, token = null) => {
    try {
      setLoading(true);
      let url, body;

      switch (leaderboardType) {
        case "monthly":
          url = MONTH_API;
          body = {
            batchId,
            monthYear: selectedMonth,
            order: currentOrder.toLowerCase(),
            limit,
          };
          break;
        case "overall":
          url = OVERALL_API;
          body = { batchId, sortOrder: currentOrder.toUpperCase(), limit };
          break;
        case "revision":
          url = REVISION_API;
          body = { batchId, sortOrder: currentOrder.toUpperCase(), limit };
          break;
        default:
          return;
      }

      if (loadMore && token) body.nextToken = token;

      const response = await fetch(url, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!data.success) {
        alert(data.message || "Failed to load data");
        return;
      }

      const list = leaderboardType === "monthly" ? data.students || [] : data.leaderboard || [];

      if (loadMore) {
        setStudents((prev) => [...prev, ...list]);
      } else {
        setStudents(list);
      }

      setNextToken(data.nextToken || null);
    } catch (err) {
      console.error(err);
      alert("Server Error");
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => {
    setStudents([]);
    setNextToken(null);
    fetchRanks(false, order);
  };

  const handleSearch = () => {
    const trimmedId = searchStudentId.trim();
    if (!trimmedId) {
      alert("Please enter a student ID");
      return;
    }
    navigate(`/batch/${batchId}/student-performance/${trimmedId}`);
  };

  useEffect(() => {
    if (batchId) fetchRanks(false, order);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId, order, leaderboardType, selectedMonth]);

  const groups = GROUPS_BY_TYPE[leaderboardType];
  const columnCount = 2 + groups.length * 3;

  return (
    <div className="rl-root">
      <style>{`
        /* ---------- Fonts & reset ---------- */
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap');

        .rl-root {
          --bg: #F8FAFC;
          --surface: #FFFFFF;
          --surface-alt: #F1F5F9;
          --ink: #0F172A;
          --ink-soft: #475569;
          --ink-faint: #94A3B8;
          --border: #E2E8F0;
          --shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 10px 15px -3px rgba(0,0,0,0.04);

          /* primary (indigo) */
          --primary: #4F46E5;
          --primary-light: #818CF8;
          --primary-bg: #EEF2FF;

          /* accent colors for the three tabs */
          --m: #4F46E5;     /* monthly */
          --m-bg: #EEF2FF;
          --m-bg-strong: #DBEAFE;
          --o: #059669;     /* overall (emerald) */
          --o-bg: #ECFDF5;
          --o-bg-strong: #D1FAE5;
          --r: #7C3AED;     /* revision (violet) */
          --r-bg: #F5F3FF;
          --r-bg-strong: #EDE9FE;

          /* medallion colours */
          --gold: #B45309;
          --gold-bg: #FEF3C7;
          --silver: #6B7280;
          --silver-bg: #F3F4F6;
          --bronze: #92400E;
          --bronze-bg: #FDE68A;

          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          background: var(--bg);
          color: var(--ink);
          min-height: 100vh;
          padding: 32px 40px 64px;
          box-sizing: border-box;
        }
        .rl-root * { box-sizing: border-box; }

        /* ---------- Header ---------- */
        .rl-header {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 28px;
        }
        .rl-heading {
          display: flex;
          align-items: baseline;
          gap: 14px;
          flex-wrap: wrap;
        }
        .rl-title {
          font-family: 'Sora', sans-serif;
          font-weight: 800;
          font-size: 28px;
          letter-spacing: -0.02em;
          margin: 0;
          color: var(--primary);
        }
        .rl-batch-chip {
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          font-weight: 600;
          color: var(--ink-soft);
          background: var(--surface);
          border: 1px solid var(--border);
          padding: 4px 14px;
          border-radius: 999px;
        }

        /* ---------- Tabs ---------- */
        .rl-tabs {
          display: flex;
          gap: 4px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 4px;
          width: fit-content;
          margin-bottom: 24px;
          box-shadow: var(--shadow);
        }
        .rl-tab {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          font-size: 14px;
          color: var(--ink-soft);
          background: transparent;
          border: none;
          padding: 10px 20px;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .rl-tab:hover { background: var(--surface-alt); color: var(--ink); }
        .rl-tab--m.rl-tab--active {
          background: var(--m);
          color: #fff;
          box-shadow: 0 4px 8px -2px rgba(79, 70, 229, 0.3);
        }
        .rl-tab--m.rl-tab--active:hover { background: var(--m); }
        .rl-tab--o.rl-tab--active {
          background: var(--o);
          color: #fff;
          box-shadow: 0 4px 8px -2px rgba(5, 150, 105, 0.3);
        }
        .rl-tab--o.rl-tab--active:hover { background: var(--o); }
        .rl-tab--r.rl-tab--active {
          background: var(--r);
          color: #fff;
          box-shadow: 0 4px 8px -2px rgba(124, 58, 237, 0.3);
        }
        .rl-tab--r.rl-tab--active:hover { background: var(--r); }
        .rl-tab-icon { font-size: 16px; }

        /* ---------- Month selector ---------- */
        .rl-month-row {
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .rl-month-label {
          font-size: 13px;
          font-weight: 600;
          color: var(--ink-soft);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .rl-select {
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          font-weight: 500;
          padding: 8px 16px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--ink);
          cursor: pointer;
        }
        .rl-select:focus-visible { outline: 2px solid var(--primary-light); outline-offset: 1px; }

        /* ---------- Toolbar ---------- */
        .rl-toolbar {
          display: flex;
          gap: 16px;
          align-items: center;
          flex-wrap: wrap;
          margin-bottom: 24px;
        }
        .rl-search {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .rl-search input {
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          padding: 10px 16px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--surface);
          min-width: 220px;
          color: var(--ink);
          transition: border-color 0.2s;
        }
        .rl-search input:focus-visible {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
        }
        .rl-search input::placeholder { color: var(--ink-faint); }

        .rl-btn-primary {
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          font-size: 14px;
          padding: 10px 20px;
          border: none;
          border-radius: 10px;
          background: var(--primary);
          color: #fff;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.1s ease;
        }
        .rl-btn-primary:hover { background: var(--primary-light); }
        .rl-btn-primary:active { transform: scale(0.97); }

        .rl-order-group {
          display: flex;
          gap: 4px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 4px;
        }
        .rl-order-btn {
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          font-size: 13px;
          padding: 8px 16px;
          border: none;
          border-radius: 7px;
          background: transparent;
          color: var(--ink-soft);
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
        }
        .rl-order-btn:hover:not(:disabled) { background: var(--surface-alt); color: var(--ink); }
        .rl-order-btn--active {
          background: var(--primary);
          color: #fff;
        }
        .rl-order-btn--active:hover { background: var(--primary); }
        .rl-order-btn:disabled { cursor: not-allowed; opacity: 0.5; }

        .rl-refresh {
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          font-size: 14px;
          padding: 10px 20px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--ink-soft);
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .rl-refresh:hover:not(:disabled) {
          background: var(--surface-alt);
          color: var(--ink);
          border-color: var(--ink-soft);
        }
        .rl-refresh:disabled { cursor: not-allowed; opacity: 0.5; }

        /* ---------- Count ---------- */
        .rl-count {
          font-size: 14px;
          color: var(--ink-soft);
          margin: -6px 0 16px 4px;
        }
        .rl-count strong { color: var(--ink); font-weight: 700; }

        /* ---------- Table ---------- */
        .rl-table-wrap {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: var(--shadow);
        }
        .rl-table-scroll { overflow-x: auto; }
        .rl-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 720px;
        }
        .rl-table thead th {
          position: sticky;
          top: 0;
          background: var(--primary);
          color: #fff;
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          text-align: left;
          padding: 12px 16px;
          white-space: nowrap;
          z-index: 3;
        }
        .rl-table thead th.rl-center { text-align: center; }

        /* Group header (first row) */
        .rl-group-th {
          text-align: center;
          font-size: 11.5px;
          letter-spacing: 0.06em;
        }
        .rl-group-th--m { background: var(--m); }
        .rl-group-th--o { background: var(--o); }
        .rl-group-th--r { background: var(--r); }

        /* Sub-header (second row) */
        .rl-subhead {
          top: 38px;
          font-weight: 600;
          font-size: 10.5px;
          padding: 8px 16px;
        }
        .rl-col-m.rl-subhead {
          background: var(--m-bg-strong);
          color: var(--m);
        }
        .rl-col-o.rl-subhead {
          background: var(--o-bg-strong);
          color: var(--o);
        }
        .rl-col-r.rl-subhead {
          background: var(--r-bg-strong);
          color: var(--r);
        }

        .rl-table tbody tr {
          border-bottom: 1px solid var(--border);
          transition: background 0.15s ease;
        }
        .rl-table tbody tr:last-child { border-bottom: none; }
        .rl-table tbody tr:hover { background: var(--surface-alt); }
        .rl-table tbody tr:hover td.rl-sticky { background: var(--surface-alt); }
        .rl-table td {
          padding: 14px 16px;
          font-size: 14px;
          color: var(--ink);
          text-align: center;
          vertical-align: middle;
        }
        .rl-table td.rl-cell-left { text-align: left; }

        /* Tinted body columns */
        .rl-table td.rl-col-m { background: var(--m-bg); }
        .rl-table td.rl-col-o { background: var(--o-bg); }
        .rl-table td.rl-col-r { background: var(--r-bg); }
        .rl-table tbody tr:hover td.rl-col-m { background: var(--m-bg-strong); }
        .rl-table tbody tr:hover td.rl-col-o { background: var(--o-bg-strong); }
        .rl-table tbody tr:hover td.rl-col-r { background: var(--r-bg-strong); }

        /* Sticky columns */
        .rl-sticky {
          position: sticky;
          background: var(--surface);
          z-index: 2;
        }
        .rl-sticky-1 { left: 0; min-width: 44px; width: 44px; }
        .rl-sticky-2 {
          left: 44px;
          min-width: 140px;
          box-shadow: 2px 0 6px rgba(0,0,0,0.04);
        }
        thead .rl-sticky { z-index: 4; }
        .rl-th-left { text-align: left; }

        .rl-index {
          font-family: 'JetBrains Mono', monospace;
          color: var(--ink-faint);
          font-size: 13px;
          font-weight: 600;
        }

        .rl-student-link {
          background: none;
          border: none;
          color: var(--primary);
          font-weight: 700;
          font-family: 'JetBrains Mono', monospace;
          font-size: 14px;
          cursor: pointer;
          padding: 0;
          transition: color 0.15s;
        }
        .rl-student-link:hover { color: var(--primary-light); text-decoration: underline; }

        .rl-score {
          font-family: 'JetBrains Mono', monospace;
          font-weight: 700;
          color: var(--ink);
        }

        .rl-dash { color: var(--ink-faint); }

        /* Rank medallions */
        .rl-medal {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 999px;
          font-family: 'JetBrains Mono', monospace;
          font-weight: 700;
          font-size: 14px;
          background: var(--surface-alt);
          color: var(--ink-soft);
          border: 1.5px solid var(--border);
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .rl-medal--gold {
          background: var(--gold-bg);
          color: var(--gold);
          border-color: #FCD34D;
          box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2);
        }
        .rl-medal--silver {
          background: var(--silver-bg);
          color: var(--silver);
          border-color: #D1D5DB;
          box-shadow: 0 0 0 2px rgba(107, 114, 128, 0.15);
        }
        .rl-medal--bronze {
          background: var(--bronze-bg);
          color: var(--bronze);
          border-color: #F59E0B;
          box-shadow: 0 0 0 2px rgba(180, 83, 9, 0.15);
        }
        .rl-medal--plain {
          background: var(--surface-alt);
          color: var(--ink-soft);
          border-color: var(--border);
        }
        .rl-medal:hover { transform: scale(1.05); }

        /* ---------- Empty / loading ---------- */
        .rl-empty {
          padding: 64px 20px;
          text-align: center;
          color: var(--ink-soft);
          font-size: 16px;
        }
        .rl-empty-emoji { font-size: 36px; display: block; margin-bottom: 12px; }

        .rl-skeleton-bar {
          height: 14px;
          border-radius: 6px;
          background: linear-gradient(90deg, var(--surface-alt) 25%, #E2E8F0 37%, var(--surface-alt) 63%);
          background-size: 400% 100%;
          animation: rl-shimmer 1.6s ease infinite;
        }
        @keyframes rl-shimmer {
          0% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .rl-skeleton-row td { padding: 12px 16px; }

        /* ---------- Load more ---------- */
        .rl-load-more-wrap {
          text-align: center;
          margin-top: 28px;
        }
        .rl-load-more {
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          font-size: 14px;
          padding: 12px 32px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--primary);
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: var(--shadow);
        }
        .rl-load-more:hover:not(:disabled) {
          background: var(--primary);
          color: #fff;
          border-color: var(--primary);
          transform: translateY(-1px);
        }
        .rl-load-more:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        /* ---------- Responsive ---------- */
        @media (max-width: 768px) {
          .rl-root { padding: 20px 16px 48px; }
          .rl-title { font-size: 22px; }
          .rl-tabs { width: 100%; overflow-x: auto; flex-wrap: nowrap; }
          .rl-tab { padding: 8px 14px; font-size: 13px; }
          .rl-toolbar { flex-direction: column; align-items: stretch; }
          .rl-search input { min-width: unset; width: 100%; }
          .rl-order-group { justify-content: center; }
          .rl-table td, .rl-table th { padding: 10px 12px; font-size: 13px; }
          .rl-sticky-2 { left: 36px; min-width: 100px; }
        }
        @media (max-width: 480px) {
          .rl-root { padding: 12px 8px 32px; }
          .rl-title { font-size: 20px; }
          .rl-tab { padding: 6px 12px; font-size: 12px; gap: 4px; }
          .rl-table td, .rl-table th { padding: 8px 6px; font-size: 12px; }
          .rl-sticky-1 { min-width: 32px; width: 32px; }
          .rl-sticky-2 { left: 32px; min-width: 70px; }
          .rl-medal { width: 26px; height: 26px; font-size: 12px; }
        }
      `}</style>

      {/* Header */}
      <div className="rl-header">
        <div className="rl-heading">
          <h2 className="rl-title">Rank List</h2>
          <span className="rl-batch-chip">{batchId}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="rl-tabs" role="tablist">
        <TabButton
          icon="📅"
          label="Monthly"
          color="m"
          active={leaderboardType === "monthly"}
          onClick={() => {
            setStudents([]);
            setNextToken(null);
            setLeaderboardType("monthly");
          }}
        />
        <TabButton
          icon="🏆"
          label="Overall"
          color="o"
          active={leaderboardType === "overall"}
          onClick={() => {
            setStudents([]);
            setNextToken(null);
            setLeaderboardType("overall");
          }}
        />
        <TabButton
          icon="📚"
          label="Revision"
          color="r"
          active={leaderboardType === "revision"}
          onClick={() => {
            setStudents([]);
            setNextToken(null);
            setLeaderboardType("revision");
          }}
        />
      </div>

      {/* Month selector */}
      {leaderboardType === "monthly" && (
        <div className="rl-month-row">
          <label className="rl-month-label" htmlFor="rl-month-select">
            Month
          </label>
          <select
            id="rl-month-select"
            className="rl-select"
            value={selectedMonth}
            onChange={(e) => {
              setSelectedMonth(e.target.value);
              setStudents([]);
              setNextToken(null);
            }}
          >
            {monthOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Toolbar */}
      <div className="rl-toolbar">
        <div className="rl-search">
          <input
            type="text"
            value={searchStudentId}
            onChange={(e) => setSearchStudentId(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
            placeholder="Search student ID"
            aria-label="Search student ID"
          />
          <button className="rl-btn-primary" onClick={handleSearch} type="button">
            Search
          </button>
        </div>

        <div className="rl-order-group" role="group" aria-label="Sort order">
          <button
            className={`rl-order-btn${order === "desc" ? " rl-order-btn--active" : ""}`}
            disabled={loading}
            onClick={() => { setStudents([]); setNextToken(null); setOrder("desc"); }}
            type="button"
          >
            Highest ↓
          </button>
          <button
            className={`rl-order-btn${order === "asc" ? " rl-order-btn--active" : ""}`}
            disabled={loading}
            onClick={() => { setStudents([]); setNextToken(null); setOrder("asc"); }}
            type="button"
          >
            Lowest ↑
          </button>
        </div>

        <button className="rl-refresh" disabled={loading} onClick={refresh} type="button">
          ↻ Refresh
        </button>
      </div>

      {/* Result count */}
      {!loading && students.length > 0 && (
        <div className="rl-count">
          Showing <strong>{students.length}</strong> student{students.length === 1 ? "" : "s"}
        </div>
      )}

      {/* Table */}
      <div className="rl-table-wrap">
        <div className="rl-table-scroll">
          <table className="rl-table">
            <thead>
              <tr>
                <th rowSpan={2} className="rl-sticky rl-sticky-1" style={{ width: 44 }}>
                  #
                </th>
                <th rowSpan={2} className="rl-sticky rl-sticky-2 rl-th-left">
                  Student ID
                </th>
                {groups.map((g) => (
                  <th
                    key={g.key}
                    colSpan={3}
                    className={`rl-group-th rl-group-th--${g.color}`}
                  >
                    {g.label}
                  </th>
                ))}
              </tr>
              <tr>
                {groups.map((g) => (
                  <React.Fragment key={g.key}>
                    <th className={`rl-center rl-subhead rl-col-${g.color}`}>Rank</th>
                    <th className={`rl-center rl-subhead rl-col-${g.color}`}>Score</th>
                    <th className={`rl-center rl-subhead rl-col-${g.color}`}>Tests</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && students.length === 0 && <SkeletonRows columns={columnCount} />}

              {!loading && students.length === 0 && (
                <tr>
                  <td colSpan={columnCount}>
                    <div className="rl-empty">
                      <span className="rl-empty-emoji">📭</span>
                      No rankings yet for this view.
                    </div>
                  </td>
                </tr>
              )}

              {students.map((student, index) => {
                if (leaderboardType === "monthly") {
                  return (
                    <tr key={student.studentId + index}>
                      <td className="rl-index rl-sticky rl-sticky-1">{index + 1}</td>
                      <td className="rl-cell-left rl-sticky rl-sticky-2">
                        <button
                          className="rl-student-link"
                          onClick={() =>
                            navigate(`/batch/${batchId}/student-performance/${student.studentId}`)
                          }
                        >
                          {student.studentId}
                        </button>
                      </td>
                      <td className="rl-col-m"><RankMedal rank={student.monthly?.rank} /></td>
                      <td className="rl-col-m rl-score">{student.monthly?.totalScore ?? "-"}</td>
                      <td className="rl-col-m">{student.monthly?.totalTests ?? "-"}</td>
                      <td className="rl-col-o"><RankMedal rank={student.overall?.rank} /></td>
                      <td className="rl-col-o rl-score">{student.overall?.totalScore ?? "-"}</td>
                      <td className="rl-col-o">{student.overall?.totalTests ?? "-"}</td>
                      <td className="rl-col-r"><RankMedal rank={student.revision?.rank} /></td>
                      <td className="rl-col-r rl-score">{student.revision?.totalScore ?? "-"}</td>
                      <td className="rl-col-r">{student.revision?.totalTests ?? "-"}</td>
                    </tr>
                  );
                }

                const groupColor = leaderboardType === "overall" ? "o" : "r";
                return (
                  <tr key={student.studentId + index}>
                    <td className="rl-index rl-sticky rl-sticky-1">{index + 1}</td>
                    <td className="rl-cell-left rl-sticky rl-sticky-2">
                      <button
                        className="rl-student-link"
                        onClick={() =>
                          navigate(`/batch/${batchId}/student-performance/${student.studentId}`)
                        }
                      >
                        {student.studentId}
                      </button>
                    </td>
                    <td className={`rl-col-${groupColor}`}>
                      <RankMedal rank={student.rank} />
                    </td>
                    <td className={`rl-col-${groupColor} rl-score`}>
                      {student.totalScore ?? "-"}
                    </td>
                    <td className={`rl-col-${groupColor}`}>
                      {student.totalTests ?? "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Load more */}
      {nextToken && (
        <div className="rl-load-more-wrap">
          <button
            className="rl-load-more"
            disabled={loading}
            onClick={() => fetchRanks(true, order, nextToken)}
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}