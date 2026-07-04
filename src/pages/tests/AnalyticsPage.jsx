import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Users,
  Trophy,
  Star,
  TrendingDown,
  Award,
  Clock,
  ChevronLeft,
  Download,
  RefreshCw,
  Filter,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Target,
  PieChart,
  GraduationCap,
  Medal,
  Crown,
  Sparkles,
} from "lucide-react";

const AnalyticsPage = () => {
  const { testId } = useParams();
  const navigate = useNavigate();
  const token = () => localStorage.getItem("token");

  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [timeframe, setTimeframe] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, [testId]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const API_URL = "https://5bza006ihg.execute-api.ap-south-1.amazonaws.com/default/returnallsummaryoftest";

      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({ testId }),
      });

      const json = await res.json();
      console.log("Fetched analytics summary:", json);

      if (!json.success) {
        throw new Error("Failed to load analytics");
      }

      setAnalyticsData(json);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAnalytics();
    setRefreshing(false);
  };

  const handleExport = () => {
    // Export functionality
    console.log("Exporting data...");
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingSpinner}>
          <div style={styles.spinner}></div>
          <p style={styles.loadingText}>Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorContainer}>
          <div style={styles.errorIcon}>⚠️</div>
          <p style={styles.errorText}>{error}</p>
          <button style={styles.retryButton} onClick={fetchAnalytics}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!analyticsData || !analyticsData.summary) {
    return (
      <div style={styles.container}>
        <div style={styles.errorContainer}>
          <div style={styles.errorIcon}>📊</div>
          <p style={styles.errorText}>No analytics data available</p>
        </div>
      </div>
    );
  }

  const summary = analyticsData.summary;
  const topper = summary.topper;
  const percentileGroups = summary.percentileGroups || {};
  const top20Students = analyticsData.top20Students || [];

  // Helper function to get color based on score
  const getScoreColor = (score) => {
    if (score >= 90) return "#10b981";
    if (score >= 70) return "#3b82f6";
    if (score >= 50) return "#f59e0b";
    return "#ef4444";
  };

  // Helper function to get percentile emoji
  const getPercentileEmoji = (label) => {
    if (label.includes("90-100")) return "👑";
    if (label.includes("75-90")) return "⭐";
    if (label.includes("50-75")) return "📈";
    if (label.includes("25-50")) return "📊";
    return "📉";
  };

  return (
    <div style={styles.container}>
      {/* Header with Breadcrumb and Actions */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <button style={styles.backButton} onClick={() => navigate(-1)}>
            <ChevronLeft size={20} />
            Back
          </button>
          <div style={styles.headerInfo}>
            <h1 style={styles.mainTitle}>📊 Analytics Dashboard</h1>
            <p style={styles.subtitle}>
              {analyticsData.testName || analyticsData.testId} • 
              <span style={styles.badge}>{analyticsData.totalAttempts} total attempts</span>
            </p>
          </div>
        </div>
        <div style={styles.headerActions}>
          <div style={styles.timeframeSelector}>
          </div>
          <button style={styles.iconButton} onClick={handleRefresh}>
            <RefreshCw size={18} className={refreshing ? "spin" : ""} />
          </button>
          <button
            style={styles.detailsBtn}
            onClick={() => navigate(`/test/question-details/${testId}`)}
          >
            View Details
          </button>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div style={styles.metricsGrid}>
        <div style={styles.metricCard}>
          <div style={styles.metricIconWrapper} className="blue">
            <Users size={22} />
          </div>
          <div style={styles.metricContent}>
            <p style={styles.metricLabel}>Total Students</p>
            <p style={styles.metricValue}>{summary.totalStudents}</p>

          </div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricIconWrapper} className="green">
            <Star size={22} />
          </div>
          <div style={styles.metricContent}>
            <p style={styles.metricLabel}>Average Score</p>
            <p style={styles.metricValue}>{summary.averageScore}</p>

          </div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricIconWrapper} className="gold">
            <Trophy size={22} />
          </div>
          <div style={styles.metricContent}>
            <p style={styles.metricLabel}>Highest Score</p>
            <p style={styles.metricValue}>{summary.highestScore}</p>
            <p style={styles.metricTrend}>
              <Medal size={14} color="#f59e0b" />
              <span style={{color: "#f59e0b"}}>Top performer</span>
            </p>
          </div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricIconWrapper} className="purple">
            <BarChart3 size={22} />
          </div>
          <div style={styles.metricContent}>
            <p style={styles.metricLabel}>Median Score</p>
            <p style={styles.metricValue}>{summary.medianScore}</p>
            <p style={styles.metricTrend}>
              <TrendingDown size={14} color="#8b5cf6" />
              <span style={{color: "#8b5cf6"}}>Distribution</span>
            </p>
          </div>
        </div>
      </div>

      {/* Topper Section */}
      {topper && (
        <div style={styles.topperSection}>
          <div style={styles.topperHeader}>
            <h3 style={styles.sectionTitle}>
              <Crown size={20} style={{color: "#f59e0b"}} />
              Top Performer
            </h3>
            <span style={styles.topperBadge}>🏆 #1 Rank</span>
          </div>
          <div style={styles.topperCard}>
            <div style={styles.topperAvatar}>
              <span style={styles.topperInitial}>
                {topper.studentId?.[0]?.toUpperCase() || "S"}
              </span>
              <div style={styles.topperRankBadge}>#1</div>
            </div>
            <div style={styles.topperInfo}>
              <h4 style={styles.topperName}>{topper.studentId}</h4>
              <div style={styles.topperStats}>
                <span style={styles.topperStat}>
                  <Zap size={16} color="#f59e0b" />
                  Score: <strong>{topper.score}</strong>
                </span>
                <span style={styles.topperStat}>
                  <Clock size={16} color="#6b7280" />
                  Time: <strong>{topper.totalTimeSpent}s</strong>
                </span>
                <span style={styles.topperStat}>
                  <Target size={16} color="#3b82f6" />
                  Accuracy: <strong>92%</strong>
                </span>
              </div>
            </div>
            <div style={styles.topperScore}>
              <span style={styles.topperScoreValue}>{topper.score}</span>
              <span style={styles.topperScoreLabel}>points</span>
            </div>
          </div>
        </div>
      )}

      {/* Two Column Layout */}
      <div style={styles.twoColumn}>
        {/* Percentile Distribution */}
        {Object.keys(percentileGroups).length > 0 && (
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>
                <PieChart size={20} />
                Performance Distribution
              </h3>
              <span style={styles.cardBadge}>Percentile</span>
            </div>
            <div style={styles.percentileList}>
              {Object.values(percentileGroups)
                .sort((a, b) => {
                  const aNum = parseInt(a.label.match(/\d+/)[0]);
                  const bNum = parseInt(b.label.match(/\d+/)[0]);
                  return aNum - bNum;
                })
                .map((group, idx) => (
                  <div key={idx} style={styles.percentileItem}>
                    <div style={styles.percentileHeader}>
                      <span style={styles.percentileEmoji}>
                        {getPercentileEmoji(group.label)}
                      </span>
                      <span style={styles.percentileLabel}>{group.label}</span>
                      <span style={styles.percentileCount}>{group.count} students</span>
                    </div>
                    <div style={styles.percentileBar}>
                      <div 
                        style={{
                          ...styles.percentileFill,
                          width: `${(group.count / summary.totalStudents) * 100}%`,
                          background: `hsl(${210 + (group.count / summary.totalStudents) * 50}, 70%, 50%)`
                        }}
                      />
                    </div>
                    <div style={styles.percentileDetails}>
                      <span>Avg: {group.averageScore}</span>
                      <span>Range: {group.lowestScore} - {group.highestScore}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>
              <GraduationCap size={20} />
              Quick Insights
            </h3>
            <span style={styles.cardBadge}>Stats</span>
          </div>
          <div style={styles.quickStats}>
            <div style={styles.quickStatItem}>
              <div style={styles.quickStatIcon} className="blue">
                <Users size={18} />
              </div>
              <div>
                <p style={styles.quickStatLabel}>Total Attempts</p>
                <p style={styles.quickStatValue}>{analyticsData.totalAttempts}</p>
              </div>
            </div>
            <div style={styles.quickStatItem}>
              <div style={styles.quickStatIcon} className="green">
                <Award size={18} />
              </div>
              <div>
                <p style={styles.quickStatLabel}>Passing Rate</p>
                <p style={styles.quickStatValue}>76%</p>
              </div>
            </div>
            <div style={styles.quickStatItem}>
              <div style={styles.quickStatIcon} className="purple">
                <Star size={18} />
              </div>
              <div>
                <p style={styles.quickStatLabel}>Average Score</p>
                <p style={styles.quickStatValue}>{summary.averageScore}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top 20 Students Table */}
      {top20Students.length > 0 && (
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>
              <Medal size={20} />
              Leaderboard
            </h3>
            <span style={styles.cardBadge}>Top 20</span>
          </div>
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeader}>
                  <th style={{...styles.tableCell, width: "80px"}}>Rank</th>
                  <th style={styles.tableCell}>Student ID</th>
                  <th style={styles.tableCell}>Score</th>
                  <th style={styles.tableCell}>Time Spent</th>
                  <th style={styles.tableCell}>Performance</th>
                </tr>
              </thead>
              <tbody>
                {top20Students.map((student, idx) => {
                  const rank = student.rank || idx + 1;
                  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
                  const scoreColor = getScoreColor(student.score);
                  
                  return (
                    <tr key={idx} style={styles.tableRow}>
                      <td style={styles.tableCell}>
                        <span style={styles.rankBadge}>{medal}</span>
                      </td>
                      <td style={styles.tableCell}>
                        <span style={styles.studentId}>{student.studentId}</span>
                      </td>
                      <td style={styles.tableCell}>
                        <span style={{...styles.scoreBadge, background: scoreColor + "20", color: scoreColor}}>
                          {student.score}
                        </span>
                      </td>
                      <td style={styles.tableCell}>
                        <span style={styles.timeBadge}>
                          <Clock size={14} />
                          {student.totalTimeSpent}s
                        </span>
                      </td>
                      <td style={styles.tableCell}>
                        <div style={styles.performanceBar}>
                          <div 
                            style={{
                              ...styles.performanceFill,
                              width: `${(student.score / summary.highestScore) * 100}%`,
                              background: scoreColor
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsPage;

const styles = {
  container: {
    padding: "32px 40px",
    background: "#f8fafc",
    minHeight: "100vh",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },

  loadingContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    background: "#f8fafc",
  },

  loadingSpinner: {
    textAlign: "center",
  },

  spinner: {
    width: "48px",
    height: "48px",
    border: "4px solid #e2e8f0",
    borderTop: "4px solid #3b82f6",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    margin: "0 auto 16px",
  },

  loadingText: {
    color: "#64748b",
    fontSize: "16px",
    fontWeight: 500,
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "32px",
    flexWrap: "wrap",
    gap: "16px",
  },

  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },

  backButton: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 16px",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    color: "#475569",
    fontWeight: 500,
    cursor: "pointer",
    fontSize: "14px",
    transition: "all 0.2s",
  },

  headerInfo: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },

  mainTitle: {
    fontSize: "28px",
    fontWeight: 700,
    color: "#0f172a",
    margin: 0,
  },

  subtitle: {
    fontSize: "14px",
    color: "#64748b",
    margin: 0,
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },

  badge: {
    background: "#dbeafe",
    color: "#1e40af",
    padding: "2px 10px",
    borderRadius: "12px",
    fontSize: "12px",
    fontWeight: 600,
  },

  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },

  timeframeSelector: {
    display: "flex",
    gap: "4px",
    background: "#ffffff",
    padding: "4px",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
  },

  timeframeBtn: {
    padding: "6px 14px",
    borderRadius: "6px",
    border: "none",
    background: "transparent",
    color: "#64748b",
    fontWeight: 500,
    fontSize: "13px",
    cursor: "pointer",
    transition: "all 0.2s",
  },

  timeframeActive: {
    background: "#3b82f6",
    color: "#ffffff",
  },

  iconButton: {
    padding: "8px",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    color: "#475569",
    cursor: "pointer",
    transition: "all 0.2s",
    display: "flex",
    alignItems: "center",
  },

  exportButton: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 16px",
    borderRadius: "8px",
    border: "none",
    background: "#0f172a",
    color: "#ffffff",
    fontWeight: 500,
    fontSize: "14px",
    cursor: "pointer",
    transition: "all 0.2s",
  },

  detailsBtn: {
    padding: "8px 16px",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    color: "#3b82f6",
    fontWeight: 600,
    fontSize: "14px",
    cursor: "pointer",
    transition: "all 0.2s",
  },

  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "20px",
    marginBottom: "32px",
  },

  metricCard: {
    background: "#ffffff",
    borderRadius: "16px",
    padding: "20px 24px",
    display: "flex",
    alignItems: "center",
    gap: "16px",
    border: "1px solid #e2e8f0",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    transition: "all 0.3s ease",
  },

  metricIconWrapper: {
    width: "48px",
    height: "48px",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  metricContent: {
    flex: 1,
  },

  metricLabel: {
    fontSize: "13px",
    fontWeight: 500,
    color: "#64748b",
    margin: 0,
    marginBottom: "4px",
  },

  metricValue: {
    fontSize: "28px",
    fontWeight: 700,
    color: "#0f172a",
    margin: 0,
  },

  metricTrend: {
    fontSize: "12px",
    display: "flex",
    alignItems: "center",
    gap: "4px",
    marginTop: "4px",
  },

  topperSection: {
    marginBottom: "32px",
  },

  topperHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },

  topperBadge: {
    background: "#fef3c7",
    color: "#92400e",
    padding: "4px 12px",
    borderRadius: "20px",
    fontSize: "13px",
    fontWeight: 600,
  },

  topperCard: {
    background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
    borderRadius: "16px",
    padding: "24px",
    display: "flex",
    alignItems: "center",
    gap: "24px",
    flexWrap: "wrap",
    border: "1px solid #f59e0b",
    position: "relative",
    overflow: "hidden",
  },

  topperAvatar: {
    width: "72px",
    height: "72px",
    borderRadius: "50%",
    background: "rgba(245, 158, 11, 0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    flexShrink: 0,
  },

  topperInitial: {
    fontSize: "28px",
    fontWeight: 700,
    color: "#92400e",
  },

  topperRankBadge: {
    position: "absolute",
    bottom: "-4px",
    right: "-4px",
    background: "#92400e",
    color: "#ffffff",
    fontSize: "10px",
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: "12px",
  },

  topperInfo: {
    flex: 1,
  },

  topperName: {
    fontSize: "20px",
    fontWeight: 700,
    color: "#78350f",
    margin: 0,
    marginBottom: "8px",
  },

  topperStats: {
    display: "flex",
    gap: "20px",
    flexWrap: "wrap",
  },

  topperStat: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "14px",
    color: "#78350f",
  },

  topperScore: {
    textAlign: "center",
    padding: "12px 24px",
    background: "rgba(255,255,255,0.4)",
    borderRadius: "12px",
    backdropFilter: "blur(4px)",
  },

  topperScoreValue: {
    fontSize: "36px",
    fontWeight: 800,
    color: "#78350f",
    display: "block",
    lineHeight: 1,
  },

  topperScoreLabel: {
    fontSize: "12px",
    color: "#78350f",
    fontWeight: 500,
  },

  twoColumn: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "24px",
    marginBottom: "32px",
  },

  card: {
    background: "#ffffff",
    borderRadius: "16px",
    padding: "24px",
    border: "1px solid #e2e8f0",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },

  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
  },

  cardTitle: {
    fontSize: "18px",
    fontWeight: 600,
    color: "#0f172a",
    margin: 0,
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },

  cardBadge: {
    background: "#f1f5f9",
    color: "#475569",
    padding: "2px 10px",
    borderRadius: "12px",
    fontSize: "12px",
    fontWeight: 500,
  },

  percentileList: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },

  percentileItem: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },

  percentileHeader: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },

  percentileEmoji: {
    fontSize: "18px",
  },

  percentileLabel: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#0f172a",
    flex: 1,
  },

  percentileCount: {
    fontSize: "13px",
    color: "#64748b",
  },

  percentileBar: {
    height: "6px",
    background: "#f1f5f9",
    borderRadius: "3px",
    overflow: "hidden",
  },

  percentileFill: {
    height: "100%",
    borderRadius: "3px",
    transition: "width 0.6s ease",
  },

  percentileDetails: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "12px",
    color: "#64748b",
  },

  quickStats: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
  },

  quickStatItem: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px",
    background: "#f8fafc",
    borderRadius: "10px",
  },

  quickStatIcon: {
    width: "40px",
    height: "40px",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  quickStatLabel: {
    fontSize: "12px",
    color: "#64748b",
    margin: 0,
  },

  quickStatValue: {
    fontSize: "18px",
    fontWeight: 700,
    color: "#0f172a",
    margin: 0,
  },

  tableWrapper: {
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
  },

  tableHeader: {
    borderBottom: "2px solid #e2e8f0",
  },

  tableRow: {
    borderBottom: "1px solid #f1f5f9",
    transition: "background 0.2s",
  },

  tableCell: {
    padding: "12px 16px",
    textAlign: "left",
    fontSize: "14px",
    color: "#0f172a",
  },

  rankBadge: {
    fontSize: "16px",
  },

  studentId: {
    fontWeight: 500,
    color: "#0f172a",
  },

  scoreBadge: {
    padding: "4px 12px",
    borderRadius: "6px",
    fontWeight: 600,
    fontSize: "14px",
  },

  timeBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    color: "#64748b",
    fontSize: "13px",
  },

  performanceBar: {
    width: "120px",
    height: "6px",
    background: "#f1f5f9",
    borderRadius: "3px",
    overflow: "hidden",
  },

  performanceFill: {
    height: "100%",
    borderRadius: "3px",
    transition: "width 0.6s ease",
  },

  errorContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "60vh",
    gap: "16px",
  },

  errorIcon: {
    fontSize: "48px",
  },

  errorText: {
    fontSize: "18px",
    color: "#ef4444",
    fontWeight: 500,
  },

  retryButton: {
    padding: "8px 24px",
    borderRadius: "8px",
    border: "none",
    background: "#3b82f6",
    color: "#ffffff",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: "14px",
  },
};