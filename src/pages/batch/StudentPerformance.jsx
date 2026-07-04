import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

const API_URL =
  "https://u5e067rz0k.execute-api.ap-south-1.amazonaws.com/default/GetStudentPerformance";

const getToken = () => localStorage.getItem("token");

export default function StudentPerformance() {
  const { batchId, studentId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [showAllMonths, setShowAllMonths] = useState(false);
  const [showAllTests, setShowAllTests] = useState(false);
  // Track which test card is currently expanded; opening another closes the previous one.
  const [expandedTestId, setExpandedTestId] = useState(null);

  const TESTS_PAGE_SIZE = 100;
  const MONTHS_PAGE_SIZE = 20;

  const requestBody = useMemo(
    () => ({
      batchId,
      batchid: batchId,
      studentId,
      studeid: studentId,
      token: getToken(),
    }),
    [batchId, studentId]
  );

  useEffect(() => {
    const fetchPerformance = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify(requestBody),
        });

        const result = await response.json();

        if (!result?.success) {
          throw new Error(result?.message || "Unable to load student performance");
        }

        setData(result);
      } catch (err) {
        console.error(err);
        setError(err.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    };

    if (batchId && studentId) {
      fetchPerformance();
    }
  }, [batchId, studentId, requestBody]);

  const overall = data?.overall;
  const revision = data?.revision;
  const monthlyResults = data?.monthlyResults || [];
  const tests = data?.tests || [];

  const sortedTests = useMemo(
    () =>
      [...tests].sort((a, b) => {
        const dateA = a?.dateOfPublish || "";
        const dateB = b?.dateOfPublish || "";
        return dateB.localeCompare(dateA);
      }),
    [tests]
  );

  const visibleMonthlyResults = showAllMonths
    ? monthlyResults
    : monthlyResults.slice(0, MONTHS_PAGE_SIZE);

  // Always works correctly regardless of how many tests there are (100, 500, 1000+)
  const visibleTests = showAllTests
    ? sortedTests
    : sortedTests.slice(0, TESTS_PAGE_SIZE);

  const formatBatchMonth = (batchMonth) => {
    if (!batchMonth) return "-";
    const parts = batchMonth.split("#");
    return parts[parts.length - 1] || batchMonth;
  };

  const formatDate = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const isMissingValue = (value) => value === null || value === undefined || value === "";
  const renderValue = (value, fallback = "Absent") => {
    if (isMissingValue(value)) {
      return <span style={{ color: "#dc2626", fontWeight: 700 }}>{fallback}</span>;
    }
    return value;
  };

  // A test counts as "absent" when the student has no score recorded for it
  const isAbsentTest = (test) => isMissingValue(test?.score);

  const toggleTestExpanded = (testId) => {
    setExpandedTestId((prev) => (prev === testId ? null : testId));
  };

  return (
    <div style={{ padding: 30, background: "#f8fafc", minHeight: "100vh" }}>
      <button
        onClick={() => navigate(`/batch/${batchId}/rank-list`)}
        style={{
          marginBottom: 20,
          padding: "10px 16px",
          border: "1px solid #dbeafe",
          borderRadius: 10,
          background: "#fff",
          color: "#2563eb",
          cursor: "pointer",
          fontWeight: 600,
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        ← Back to Rank List
      </button>

      <div
        style={{
          background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
          color: "#fff",
          padding: "24px 28px",
          borderRadius: 20,
          boxShadow: "0 14px 35px rgba(37, 99, 235, 0.2)",
          marginBottom: 24,
        }}
      >
        <h2 style={{ margin: "0 0 8px", fontSize: 28 }}>📊 Student Performance</h2>
        <p style={{ margin: 0, opacity: 0.95 }}>
          Batch: <strong>{batchId}</strong> • Student: <strong>{studentId}</strong>
        </p>
      </div>

      {loading && (
        <div style={{ ...cardStyle, textAlign: "center", color: "#4b5563" }}>
          Loading performance data...
        </div>
      )}
      {error && (
        <div style={{ ...cardStyle, color: "#b91c1c", border: "1px solid #fecaca" }}>
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
              marginBottom: 24,
            }}
          >
            <div style={{ ...cardStyle, borderTop: "4px solid #2563eb" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <h4 style={{ margin: 0 }}>Overall</h4>
                <span style={{ background: "#eff6ff", color: "#2563eb", padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>Live</span>
              </div>
              <p style={{ margin: "4px 0" }}>Rank: <strong>{overall?.rank ?? "-"}</strong></p>
              <p style={{ margin: "4px 0" }}>Score: <strong>{overall?.totalScore ?? "-"}</strong></p>
              <p style={{ margin: "4px 0" }}>Tests: <strong>{overall?.totalTests ?? "-"}</strong></p>
            </div>

            <div style={{ ...cardStyle, borderTop: "4px solid #10b981" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <h4 style={{ margin: 0 }}>Revision</h4>
                <span style={{ background: "#ecfdf5", color: "#059669", padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>Review</span>
              </div>
              <p style={{ margin: "4px 0" }}>Rank: <strong>{revision?.rank ?? "-"}</strong></p>
              <p style={{ margin: "4px 0" }}>Score: <strong>{revision?.totalScore ?? "-"}</strong></p>
              <p style={{ margin: "4px 0" }}>Tests: <strong>{revision?.totalTests ?? "-"}</strong></p>
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <h3 style={{ marginBottom: 12 }}>Monthly Results</h3>
            {monthlyResults.length === 0 ? (
              <div style={cardStyle}>No monthly data found.</div>
            ) : (
              <>
                <div style={{ overflowX: "auto" }}>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Month</th>
                        <th style={thStyle}>Rank</th>
                        <th style={thStyle}>Score</th>
                        <th style={thStyle}>Tests</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleMonthlyResults.map((item, index) => (
                        <tr key={`${item.batchMonth || index}`}>
                          <td style={tdStyle}>{formatBatchMonth(item.batchMonth)}</td>
                          <td style={tdStyle}>{item.rank ?? "-"}</td>
                          <td style={tdStyle}>{item.totalScore ?? "-"}</td>
                          <td style={tdStyle}>{item.totalTests ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {monthlyResults.length > MONTHS_PAGE_SIZE && (
                  <div style={{ marginTop: 12, textAlign: "right" }}>
                    <button
                      onClick={() => setShowAllMonths((prev) => !prev)}
                      style={pillButtonStyle}
                    >
                      {showAllMonths
                        ? "Show Less"
                        : `Show More (${monthlyResults.length - MONTHS_PAGE_SIZE} more)`}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Tests</h3>
              <span style={{ fontSize: 13, color: "#6b7280" }}>
                {sortedTests.length} total • showing {visibleTests.length}
              </span>
            </div>
            {sortedTests.length === 0 ? (
              <div style={cardStyle}>No test history found.</div>
            ) : (
              <>
                <div style={{ display: "grid", gap: 10, maxWidth: 900, margin: "0 auto" }}>
                  {visibleTests.map((test) => {
                    const absent = isAbsentTest(test);
                    const expanded = expandedTestId === test.testId;

                    return (
                      <div
                        key={test.testId}
                        style={{
                          ...cardStyle,
                          borderLeft: absent ? "4px solid #dc2626" : "4px solid #3b82f6",
                          background: absent ? "#fef2f2" : "#fff",
                          padding: 14,
                        }}
                      >
                        {/* Header row - always visible, click to expand/collapse */}
                        <div
                          onClick={() => toggleTestExpanded(test.testId)}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 12,
                            cursor: "pointer",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                            <span
                              style={{
                                display: "inline-block",
                                transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
                                transition: "transform 0.15s ease",
                                color: "#9ca3af",
                                fontSize: 12,
                              }}
                            >
                              ▶
                            </span>
                            <h4 style={{ margin: 0, fontSize: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {test.testName || test.testId}
                            </h4>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                            {absent && (
                              <span
                                style={{
                                  background: "#fee2e2",
                                  color: "#b91c1c",
                                  padding: "4px 10px",
                                  borderRadius: 999,
                                  fontSize: 12,
                                  fontWeight: 700,
                                  border: "1px solid #fca5a5",
                                }}
                              >
                                ⚠ Absent
                              </span>
                            )}
                            <span style={{ background: "#f3f4f6", color: "#374151", padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
                              {test.testType || "-"}
                            </span>
                            <span style={{ fontSize: 13, color: "#6b7280", minWidth: 70, textAlign: "right" }}>
                              {formatDate(test.dateOfPublish)}
                            </span>
                          </div>
                        </div>

                        {/* Collapsed summary line, always visible */}
                        {!expanded && (
                          <p style={{ margin: "8px 0 0", fontSize: 13, color: "#6b7280" }}>
                            <strong>Score:</strong> {renderValue(test.score, "Absent")}
                            {test.totalMarks ? ` / ${test.totalMarks}` : ""}
                          </p>
                        )}

                        {/* Full details, only rendered when expanded — keeps the list compact */}
                        {expanded && (
                          <div style={{ marginTop: 10 }}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
                              <div style={{ background: "#f8fafc", padding: 8, borderRadius: 8, fontSize: 13 }}>
                                <strong>Score:</strong> {renderValue(test.score, "Absent")}
                                {test.totalMarks ? ` / ${test.totalMarks}` : ""}
                              </div>
                              <div style={{ background: "#f8fafc", padding: 8, borderRadius: 8, fontSize: 13 }}>
                                <strong>Correct:</strong> {renderValue(test.correctCount, "Absent")}
                              </div>
                              <div style={{ background: "#f8fafc", padding: 8, borderRadius: 8, fontSize: 13 }}>
                                <strong>Wrong:</strong> {renderValue(test.wrongCount, "Absent")}
                              </div>
                              <div style={{ background: "#f8fafc", padding: 8, borderRadius: 8, fontSize: 13 }}>
                                <strong>Unattempted:</strong> {renderValue(test.unattemptedQuestions, "Absent")}
                              </div>
                            </div>

                            <p style={{ margin: "8px 0 4px", fontSize: 13 }}>
                              <strong>Time Spent:</strong> {renderValue(test.totalTimeSpent, "Absent")}
                            </p>
                            {test.duration != null && (
                              <p style={{ margin: "4px 0", fontSize: 13 }}>
                                <strong>Duration:</strong> {test.duration} min
                              </p>
                            )}

                            {test.topicAnalysis?.length > 0 && (
                              <div style={{ marginTop: 10 }}>
                                <strong style={{ fontSize: 14 }}>Topic Analysis</strong>
                                <ul style={{ margin: "6px 0 0 16px", paddingLeft: 16 }}>
                                  {test.topicAnalysis.map((topic, index) => (
                                    <li key={`${test.testId}-${topic.topicTitle || index}`} style={{ marginBottom: 4, fontSize: 13 }}>
                                      <div>
                                        {topic.topicTitle || "Topic"}: Score {topic.score ?? 0} / Questions {topic.totalQuestions ?? 0}
                                      </div>
                                      <div style={{ fontSize: 12, color: "#4b5563", marginTop: 2 }}>
                                        Wrong: {renderValue(topic.wrong, "Absent")} | Unattempted: {renderValue(topic.unattempted, "Absent")}
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {sortedTests.length > TESTS_PAGE_SIZE && (
                  <div style={{ marginTop: 12, textAlign: "right" }}>
                    <button
                      onClick={() => setShowAllTests((prev) => !prev)}
                      style={pillButtonStyle}
                    >
                      {showAllTests
                        ? "Show Less"
                        : `Show More (${sortedTests.length - TESTS_PAGE_SIZE} more)`}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const cardStyle = {
  background: "#fff",
  padding: 16,
  borderRadius: 12,
  boxShadow: "0 4px 12px rgba(15, 23, 42, 0.05)",
  border: "1px solid #e5e7eb",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  background: "#fff",
  borderRadius: 12,
  overflow: "hidden",
};

const thStyle = {
  border: "1px solid #e5e7eb",
  padding: "12px 14px",
  textAlign: "left",
  background: "#f8fafc",
  color: "#334155",
  fontWeight: 700,
};

const tdStyle = {
  border: "1px solid #e5e7eb",
  padding: "12px 14px",
};

const pillButtonStyle = {
  border: "1px solid #dbeafe",
  background: "#f8fbff",
  color: "#2563eb",
  cursor: "pointer",
  fontWeight: 600,
  borderRadius: 999,
  padding: "6px 12px",
};