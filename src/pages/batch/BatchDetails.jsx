// AnalyticsDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import '../../styles/dashboard.css'; // Optional: import the CSS file

const AnalyticsDashboard = () => {
  const { batchId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSummaryIndex, setSelectedSummaryIndex] = useState(0);

  const getToken = () => localStorage.getItem("token");

  const getPreferredSummaryIndex = (summaries = []) => {
    const summaryIndex = summaries.findIndex((summary) => summary?.type === 'SUMMARY');
    return summaryIndex >= 0 ? summaryIndex : 0;
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const response = await fetch('https://u5e067rz0k.execute-api.ap-south-1.amazonaws.com/default/dashboard', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`
          },
          body: JSON.stringify({ batchId })
        });

        if (!response.ok) {
          throw new Error('Failed to fetch dashboard metrics.');
        }

        const json = await response.json();
        if (json.success) {
          setData(json);
          setSelectedSummaryIndex(getPreferredSummaryIndex(json.summaries));
        } else {
          throw new Error('API reported unsuccessful metrics aggregation.');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (batchId) {
      fetchDashboardData();
    }
  }, [batchId]);

  if (loading) {
    return (
      <div className="dashboard-page dashboard-loading-screen">
        <div className="dashboard-loading-card">
          <div className="dashboard-spinner"></div>
          <p className="dashboard-loading-text">Loading operational analytics...</p>
        </div>
      </div>
    );
  }

  if (error || !data || !data.summaries || data.summaries.length === 0) {
    return (
      <div className="dashboard-page dashboard-empty-screen">
        <div className="dashboard-empty-state">
          <div className="dashboard-empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="dashboard-empty-title">Data Pipeline Error</h3>
          <p className="dashboard-empty-text">{error || 'No dashboard summaries compiled for this batch ID.'}</p>
        </div>
      </div>
    );
  }

  const activeSummary = data.summaries[selectedSummaryIndex];

  const formatType = (type) => {
    switch (type) {
      case 'MONTH_SUMMARY':
        return 'Monthly Summary';
      case 'REVISION':
        return 'Revision Summary';
      case 'SUMMARY':
        return 'Overall Summary';
      default:
        return type?.replace(/_/g, ' ') || 'Summary';
    }
  };

  const formatSummaryLabel = (summary) => {
    if (!summary) return 'Summary';
    if (summary.type === 'MONTH_SUMMARY') {
      return summary.monthYear
        ? summary.monthYear.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
        : 'Monthly Summary';
    }
    if (summary.type === 'REVISION') return 'Revision Summary';
    if (summary.type === 'SUMMARY') return 'Overall Summary';
    return summary.summaryKey || 'Summary';
  };

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-header-content">
          <div className="dashboard-brand">
            <div className="dashboard-brand-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h1 className="dashboard-title">Batch Performance Dashboard</h1>
              <p className="dashboard-subtitle">Batch ID: <span className="dashboard-batch-id">{batchId}</span></p>
            </div>
          </div>
          <div className="dashboard-status-pill">
            <span className="dashboard-status-dot"></span>
            <span>Live Aggregates · {data.count} Available</span>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        <section className="dashboard-selector-card">
          <label className="dashboard-selector-title">Select Dataset Scope</label>
          <div className="dashboard-summary-list">
            {data.summaries.map((summary, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedSummaryIndex(idx)}
                className={`dashboard-summary-btn ${selectedSummaryIndex === idx ? 'active' : ''}`}
              >
                <div className="dashboard-summary-type">{formatType(summary.type)}</div>
                <div className="dashboard-summary-label">{formatSummaryLabel(summary)}</div>
              </button>
            ))}
          </div>
        </section>

        <section className="dashboard-metrics-grid">
          <article className="dashboard-card">
            <div className="dashboard-card-header">
              <span className="dashboard-card-label">Total Students</span>
              <div className="dashboard-card-icon dashboard-card-icon-blue">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
            <div className="dashboard-card-value">{activeSummary.totalStudents?.toLocaleString()}</div>
            <p className="dashboard-card-caption">Students included in this summary</p>
          </article>

          <article className="dashboard-card">
            <div className="dashboard-card-header">
              <span className="dashboard-card-label">Average Score</span>
              <div className="dashboard-card-icon dashboard-card-icon-indigo">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="dashboard-card-value">{activeSummary.averageScore?.toFixed(2)}</div>
            <p className="dashboard-card-caption">Average score across students</p>
          </article>

          <article className="dashboard-card">
            <div className="dashboard-card-header">
              <span className="dashboard-card-label">Highest Score</span>
              <div className="dashboard-card-icon dashboard-card-icon-emerald">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
            <div className="dashboard-card-value">{activeSummary.highestScore}</div>
            <p className="dashboard-card-caption">Highest score in this summary</p>
          </article>

          <article className="dashboard-card">
            <div className="dashboard-card-header">
              <span className="dashboard-card-label">Lowest Score</span>
              <div className="dashboard-card-icon dashboard-card-icon-amber">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" />
                </svg>
              </div>
            </div>
            <div className="dashboard-card-value">{activeSummary.lowestScore}</div>
            <p className="dashboard-card-caption">Lowest score in this summary</p>
          </article>
        </section>

        <section className="dashboard-content-grid">
          <div className="dashboard-panel dashboard-panel-large">
            <div className="dashboard-panel-header">
              <h3 className="dashboard-panel-title">Percentile Analysis</h3>
              <p className="dashboard-panel-subtitle">Student distribution across score percentiles.</p>
            </div>
            <div className="dashboard-progress-list">
              {activeSummary.percentileAnalysis?.map((tier, index) => {
                const percentageWidth = Math.min(100, (tier.averageScore / activeSummary.highestScore) * 100);

                return (
                  <div key={index} className="dashboard-progress-row">
                    <div className="dashboard-progress-label">{tier.percentile}</div>
                    <div className="dashboard-progress-track">
                      <div className="dashboard-progress-fill" style={{ width: `${percentageWidth}%` }}></div>
                    </div>
                    <div className="dashboard-progress-meta">
                      <span className="dashboard-progress-value">{tier.averageScore}</span>
                      <span className="dashboard-progress-caption">{tier.students} Users</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="dashboard-panel dashboard-panel-side">
            <div className="dashboard-panel-header">
              <h3 className="dashboard-panel-title">Top 10 Students</h3>
              <p className="dashboard-panel-subtitle">Highest-scoring students in this scope.</p>
            </div>
            <div className="dashboard-table-wrapper">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Student ID</th>
                    <th className="dashboard-table-right">Total Score</th>
                  </tr>
                </thead>
                <tbody>
                  {activeSummary.top10Students?.map((student, rankIdx) => (
                    <tr key={rankIdx}>
                      <td>
                        <span className={`dashboard-rank-badge ${student.rank === 1 ? 'gold' : ''}`}>
                          #{student.rank}
                        </span>
                      </td>
                      <td className="dashboard-student-id">{student.studentId}</td>
                      <td className="dashboard-table-right dashboard-score-value">{student.totalScore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
};

export default AnalyticsDashboard;