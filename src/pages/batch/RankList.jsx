import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./RankList.css";

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
// Column group definitions per tab
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
  const [order, setOrder] = useState("desc");
  const [limit] = useState(50);
  const [searchStudentId, setSearchStudentId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("jun_2026");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const [pageTokens, setPageTokens] = useState([null]);

  // Generate month options
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

  // Fetch a specific page
  const fetchRanks = async (pageIndex = 0) => {
    try {
      setLoading(true);
      const token = pageTokens[pageIndex] || null;

      let url, body;
      switch (leaderboardType) {
        case "monthly":
          url = MONTH_API;
          body = {
            batchId,
            monthYear: selectedMonth,
            order: order.toLowerCase(),
            limit,
          };
          break;
        case "overall":
          url = OVERALL_API;
          body = { batchId, sortOrder: order.toUpperCase(), limit };
          break;
        case "revision":
          url = REVISION_API;
          body = { batchId, sortOrder: order.toUpperCase(), limit };
          break;
        default:
          return;
      }

      if (token) body.nextToken = token;

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

      // Some endpoints may not return the cursor under "nextToken" — check
      // the common alternates too so pagination doesn't silently stop early.
      const nextPageToken =
        data.nextToken ||
        data.next_token ||
        data.lastEvaluatedKey ||
        data.LastEvaluatedKey ||
        data.cursor ||
        null;

      setStudents(list);
      setCurrentPage(pageIndex);

      if (nextPageToken) {
        setPageTokens((prev) => {
          const newTokens = [...prev];
          newTokens[pageIndex + 1] = nextPageToken;
          return newTokens.slice(0, pageIndex + 2);
        });
      } else {
        setPageTokens((prev) => prev.slice(0, pageIndex + 1));
      }
    } catch (err) {
      console.error(err);
      alert("Server Error");
    } finally {
      setLoading(false);
    }
  };

  const goToPage = (pageIndex) => {
    if (pageIndex < 0 || pageIndex >= pageTokens.length || pageIndex === currentPage) return;
    fetchRanks(pageIndex);
  };

  const goToPrev = () => { if (currentPage > 0) goToPage(currentPage - 1); };
  const goToNext = () => { if (currentPage + 1 < pageTokens.length) goToPage(currentPage + 1); };

  const resetAndFetchFirst = () => {
    setStudents([]);
    setCurrentPage(0);
    setPageTokens([null]);
    fetchRanks(0);
  };

  const refresh = () => resetAndFetchFirst();

  const handleSearch = () => {
    const trimmedId = searchStudentId.trim();
    if (!trimmedId) {
      alert("Please enter a student ID");
      return;
    }
    navigate(`/batch/${batchId}/student-performance/${trimmedId}`);
  };

  useEffect(() => {
    if (batchId) resetAndFetchFirst();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId, order, leaderboardType, selectedMonth]);

  const groups = GROUPS_BY_TYPE[leaderboardType];
  const columnCount = 2 + groups.length * 5;

  const getMetricPayload = (student, groupKey) => {
    if (leaderboardType === "monthly") {
      return student?.[groupKey] ?? {};
    }
    if (groupKey === "overall" || groupKey === "revision") {
      return student ?? {};
    }
    return student ?? {};
  };

  const getMovementMeta = (currentRank, previousRank) => {
    if (currentRank == null || previousRank == null || currentRank <= 0 || previousRank <= 0) {
      return null;
    }
    if (currentRank < previousRank) {
      return { type: "up", label: `↑ ${previousRank - currentRank}` };
    }
    if (currentRank > previousRank) {
      return { type: "down", label: `↓ ${currentRank - previousRank}` };
    }
    return { type: "same", label: "↔ 0" };
  };

  const summaryGroupKey = groups?.[0]?.key;
  const movementSummary = students.reduce(
    (acc, student) => {
      const payload = getMetricPayload(student, summaryGroupKey);
      const currentRank = payload?.rank;
      const previousRank = payload?.previousRank;
      if (currentRank == null || previousRank == null || currentRank <= 0 || previousRank <= 0) {
        return acc;
      }
      if (currentRank < previousRank) {
        acc.up += 1;
      } else if (currentRank > previousRank) {
        acc.down += 1;
      } else {
        acc.same += 1;
      }
      return acc;
    },
    { up: 0, down: 0, same: 0 }
  );

  const totalPages = pageTokens.length;
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="rl-root">
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
          onClick={() => setLeaderboardType("monthly")}
        />
        <TabButton
          icon="🏆"
          label="Overall"
          color="o"
          active={leaderboardType === "overall"}
          onClick={() => setLeaderboardType("overall")}
        />
        <TabButton
          icon="📚"
          label="Revision"
          color="r"
          active={leaderboardType === "revision"}
          onClick={() => setLeaderboardType("revision")}
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
            onChange={(e) => setSelectedMonth(e.target.value)}
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
            onClick={() => setOrder("desc")}
            type="button"
          >
            Highest ↓
          </button>
          <button
            className={`rl-order-btn${order === "asc" ? " rl-order-btn--active" : ""}`}
            disabled={loading}
            onClick={() => setOrder("asc")}
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
        <>
          <div className="rl-count">
            Showing <strong>{students.length}</strong> student{students.length === 1 ? "" : "s"} on page {currentPage + 1}
          </div>
          <div className="rl-movement-summary" aria-label="Movement summary">
            <span className="rl-move-pill rl-move-pill--up">↑ {movementSummary.up}</span>
            <span className="rl-move-pill rl-move-pill--down">↓ {movementSummary.down}</span>
            <span className="rl-move-pill rl-move-pill--same">↔ {movementSummary.same}</span>
          </div>
        </>
      )}

      {/* Table */}
      <div className="rl-table-wrap">
        <div className="rl-table-scroll">
          <table className="rl-table">
            <thead>
              <tr>
                {/* Serial / rank number column — was previously missing, causing
                    header cells to misalign with the body's two leading columns */}
                <th rowSpan={2} className="rl-sticky rl-sticky-1 rl-th-left rl-th-serial">
                  #
                </th>
                <th rowSpan={2} className="rl-sticky rl-sticky-2 rl-th-left">
                  Student ID
                </th>
                {groups.map((g) => (
                  <th
                    key={g.key}
                    colSpan={5}
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
                    <th className={`rl-center rl-subhead rl-col-${g.color}`}>Prev</th>
                    <th className={`rl-center rl-subhead rl-col-${g.color}`}>Move</th>
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
                // True sequential serial number (1, 2, 3...) based on page
                // position — NOT the API's rank value.
                const serialNumber = currentPage * limit + index + 1;

                return (
                  <tr key={student.studentId + index}>
                    <td className="rl-index rl-sticky rl-sticky-1">
                      {serialNumber}
                    </td>
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
                    {groups.map((group) => {
                      const payload = getMetricPayload(student, group.key);
                      const currentRank = payload?.rank;
                      const previousRank = payload?.previousRank;
                      const movement = getMovementMeta(currentRank, previousRank);

                      return (
                        <React.Fragment key={`${student.studentId}-${group.key}`}>
                          <td className={`rl-col-${group.color}`}>
                            <RankMedal rank={currentRank} />
                          </td>
                          <td className={`rl-col-${group.color}`}>
                            <span className="rl-prev">{previousRank ?? "—"}</span>
                          </td>
                          <td className={`rl-col-${group.color}`}>
                            {movement ? (
                              <span className={`rl-move-pill rl-move-pill--${movement.type}`}>
                                {movement.label}
                              </span>
                            ) : (
                              <span className="rl-dash">—</span>
                            )}
                          </td>
                          <td className={`rl-col-${group.color} rl-score`}>
                            {payload?.totalScore ?? "-"}
                          </td>
                          <td className={`rl-col-${group.color}`}>
                            {payload?.totalTests ?? "-"}
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 0 && (
        <div className="rl-pagination">
          <button
            className="rl-pagination-btn"
            onClick={goToPrev}
            disabled={currentPage === 0 || loading}
            type="button"
          >
            ◀ Previous
          </button>

          {pageNumbers.map((pageNum) => {
            const pageIndex = pageNum - 1;
            const isActive = pageIndex === currentPage;
            return (
              <button
                key={pageNum}
                className={`rl-pagination-number${isActive ? " rl-pagination-number--active" : ""}`}
                onClick={() => goToPage(pageIndex)}
                disabled={loading}
                type="button"
              >
                {pageNum}
              </button>
            );
          })}

          <button
            className="rl-pagination-btn"
            onClick={goToNext}
            disabled={currentPage + 1 >= pageTokens.length || loading}
            type="button"
          >
            Next ▶
          </button>
        </div>
      )}
    </div>
  );
}