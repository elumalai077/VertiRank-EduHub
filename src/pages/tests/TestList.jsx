import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";

const API_BASE = "https://53m2m6nrt0.execute-api.ap-south-1.amazonaws.com/default";

// ---------- Theme Context ----------
const ThemeContext = React.createContext({ theme: 'light', toggleTheme: () => {} });

// ---------- Timeline grouping ----------
const isLiveStatus = (status) => {
  const s = (status || "").toLowerCase();
  return s === "live" || s === "running";
};

const groupByTimeline = (tests) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let current = null;
  const dated = [];
  const undated = [];

  tests.forEach((test) => {
    if (isLiveStatus(test.status) && !current) {
      current = test;
      return;
    }
    if (test.dateOfPublish) {
      dated.push({ test, date: new Date(test.dateOfPublish + "T00:00:00") });
    } else {
      undated.push(test);
    }
  });

  const past = dated
    .filter((t) => t.date < today)
    .sort((a, b) => b.date - a.date)
    .map((t) => t.test);

  const future = dated
    .filter((t) => t.date >= today)
    .sort((a, b) => a.date - b.date)
    .map((t) => t.test)
    .concat(undated);

  return { past, current, future };
};

// ---------- Countdown ----------
const parseTimeToday = (timeStr) => {
  if (!timeStr) return null;
  const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const d = new Date();
  d.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return d;
};

const formatCountdown = (ms) => {
  if (ms <= 0) return "Wrapping up…";
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
};

const useCountdown = (test) => {
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (!test) return undefined;

    const target = parseTimeToday(test.endTime) || parseTimeToday(test.startTime);
    if (!target) {
      setLabel("No schedule set");
      return undefined;
    }

    const tick = () => {
      const diff = target - new Date();
      const prefix = test.endTime ? "Ends in" : "Starts in";
      setLabel(diff > 0 ? `${prefix} ${formatCountdown(diff)}` : "Wrapping up…");
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [test]);

  return label;
};

// ---------- Theme Provider Component ----------
const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState('light');

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

const TestListPage = () => {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const { theme, toggleTheme } = React.useContext(ThemeContext);

  const token = () => localStorage.getItem("token");

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showScrollToTop, setShowScrollToTop] = useState(false);

  const [expandedCardId, setExpandedCardId] = useState(null);
  const [generatingSteps, setGeneratingSteps] = useState({});
  const [stepErrors, setStepErrors] = useState({});

  const liveRef = useRef(null);
  const containerRef = useRef(null);
  const futureListRef = useRef(null);
  const [showScrollHint, setShowScrollHint] = useState(false);

  const API_URL = `https://z6hfbdtza0.execute-api.ap-south-1.amazonaws.com/default/test/${batchId}`;

  useEffect(() => {
    fetchTests();
  }, [batchId]);

  const fetchTests = async () => {
    try {
      setLoading(true);

      const res = await fetch(API_URL, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
      });

      const json = await res.json();

      if (!json.success) {
        throw new Error("Failed to load tests");
      }

      setData(json.tests || []);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const { past, current, future } = useMemo(() => groupByTimeline(data), [data]);
  const countdownLabel = useCountdown(current);

  const normalizeStatus = (status) => (status || "").toLowerCase();
  const isFinishedStatus = (status) => ["finished", "completed", "ended"].includes(normalizeStatus(status));

  const statusSummary = useMemo(() => {
    return data.reduce((acc, test) => {
      const key = normalizeStatus(test.status) || "unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [data]);

  const totalTests = data.length;
  const readyCount = data.filter((test) => ["ready", "scheduled"].includes(normalizeStatus(test.status))).length;
  const finishedCount = data.filter((test) => ["finished", "completed", "ended"].includes(normalizeStatus(test.status))).length;
  const publicCount = data.filter((test) => normalizeStatus(test.visibility) === "public").length;
  const privateCount = data.filter((test) => normalizeStatus(test.visibility) === "private").length;
  const statusEntries = Object.entries(statusSummary).sort(([a], [b]) => a.localeCompare(b));

  // Scroll to Live section when component mounts or current changes
  useEffect(() => {
    if (current && liveRef.current) {
      setTimeout(() => {
        liveRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 300);
    }
  }, [current]);

  // Handle scroll to show/hide "Jump to Today" button
  useEffect(() => {
    const handleScroll = () => {
      if (liveRef.current) {
        const rect = liveRef.current.getBoundingClientRect();
        const isLiveInView = rect.top >= 0 && rect.bottom <= window.innerHeight;
        setShowScrollToTop(!isLiveInView);
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const el = futureListRef.current;
    if (!el) {
      setShowScrollHint(false);
      return undefined;
    }
    const check = () => setShowScrollHint(el.scrollHeight - el.clientHeight > 8);
    check();
    el.addEventListener("scroll", check);
    window.addEventListener("resize", check);
    return () => {
      el.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [future]);

  const getStatusConfig = (status) => {
    const normalizedStatus = normalizeStatus(status);

    switch (normalizedStatus) {
      case "live":
      case "running":
        return { color: "#0A0A0A", bg: "#0A0A0A", fg: "#FFFFFF", dot: "#22C55E" };
      case "draft":
      case "pending":
        return { color: "#92400E", bg: "#FFFBEB", fg: "#92400E", dot: "#D97706" };
      case "ready":
      case "scheduled":
        return { color: "#1D4ED8", bg: "#EFF6FF", fg: "#1D4ED8", dot: "#2563EB" };
      case "finished":
      case "ended":
      case "completed":
        return { color: "#374151", bg: "#F3F4F6", fg: "#374151", dot: "#6B7280" };
      default:
        return { color: "#6B7280", bg: "#F9FAFB", fg: "#6B7280", dot: "#9CA3AF" };
    }
  };

  const getTestTypeConfig = (testType) => {
    const type = (testType || "").toLowerCase();

    switch (type) {
      case "unit":
        return {
          gradient: "linear-gradient(135deg, #667EEA 0%, #764BA2 100%)",
          lightColor: "#7C3AED",
          darkColor: "#8B5CF6",
          bg: "bg-purple-50",
          label: "Unit",
          borderColor: "#7C3AED"
        };
      case "revision":
        return {
          gradient: "linear-gradient(135deg, #F093FB 0%, #F5576C 100%)",
          lightColor: "#EC4899",
          darkColor: "#F472B6",
          bg: "bg-pink-50",
          label: "Revision",
          borderColor: "#EC4899"
        };
      default:
        return {
          gradient: "linear-gradient(135deg, #4FACFE 0%, #00F2FE 100%)",
          lightColor: "#3B82F6",
          darkColor: "#60A5FA",
          bg: "bg-blue-50",
          label: "Test",
          borderColor: "#3B82F6"
        };
    }
  };

  const getRanklistValue = (test) => {
    const ranklistFlags = Object.keys(test).filter(
      (key) => key.startsWith("ranklistgenerated") && typeof test[key] === "boolean"
    );
    if (ranklistFlags.length === 0) return "No";
    const hasRanklist = ranklistFlags.some((key) => test[key] === true);
    return hasRanklist ? "Yes" : "No";
  };

  const getRanklistDetails = (test) => {
    const ranklistFlags = Object.keys(test).filter(
      (key) => key.startsWith("ranklistgenerated") && test[key] === true
    );
    if (ranklistFlags.length === 0) return "Not generated";
    return ranklistFlags
      .map((flag) =>
        flag
          .replace("ranklistgenerated", "")
          .replace(/([A-Z])/g, " $1")
          .trim() || "Ranklist Generated"
      )
      .join(", ");
  };

  const isUnit = (test) => test.testType === "unit";

  const canShowAnalytics = (test) => {
    if (!isFinishedStatus(test.status)) return false;

    if (isUnit(test)) {
      return Boolean(
        test.ranklistgenerated &&
        test.ranklistgeneratedbyBatch &&
        test.ranklistgeneratedbyMonth &&
        test.testAnalysis
      );
    }

    return Boolean(test.ranklistgenerated && test.ranklistgeneratedRevision && test.testAnalysis);
  };

  const getMissingSteps = (test) => {
    const missing = [];

    if (!test.ranklistgenerated) missing.push("Rank list");

    if (isUnit(test)) {
      if (!test.ranklistgeneratedbyBatch) missing.push("Batch ranklist");
      if (!test.ranklistgeneratedbyMonth) missing.push("Month ranklist");
    } else if (!test.ranklistgeneratedRevision) {
      missing.push("Revision ranklist");
    }

    if (!test.testAnalysis) missing.push("Question analysis");

    return missing;
  };

  const incompleteFinishedTests = useMemo(() => {
    return data
      .filter((test) => isFinishedStatus(test.status) && !canShowAnalytics(test))
      .map((test) => ({ ...test, missingSteps: getMissingSteps(test) }));
  }, [data]);

  const showGenerateRanklist = (test) => isFinishedStatus(test.status) && !canShowAnalytics(test);
  const postJson = async (path, body) => {
    const res = await fetch(`${API_BASE}/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token()}`,
      },
      body: JSON.stringify(body),
    });

    let json = null;
    try {
      json = await res.json();
    } catch (_) {}

    if (!res.ok) {
      const message = (json && (json.message || json.error)) || `Request to ${path} failed`;
      throw new Error(message);
    }

    return json;
  };

  const getSteps = useCallback((test) => {
    const common = [
      {
        key: "rank-list",
        label: "Rank List",
        path: "rank-list",
        flag: "ranklistgenerated",
        body: { testId: test.testId },
      },
    ];

    if (isUnit(test)) {
      return [
        ...common,
        {
          key: "batch",
          label: "Batch Ranklist",
          path: "batch_table_result",
          flag: "ranklistgeneratedbyBatch",
          body: { testId: test.testId, batchId },
        },
        {
          key: "month",
          label: "Month Ranklist",
          path: "batch_table_result_month",
          flag: "ranklistgeneratedbyMonth",
          body: { testId: test.testId, batchId },
        },
        {
          key: "analysis",
          label: "Question Analysis",
          path: "questionanaysis",
          flag: "testAnalysis",
          body: { testId: test.testId },
        },
      ];
    }

    return [
      ...common,
      {
        key: "batch",
        label: "Batch Ranklist",
        path: "batch_table_result_revision",
        flag: "ranklistgeneratedbyBatch",
        body: { testId: test.testId, batchId },
      },
      {
        key: "analysis",
        label: "Question Analysis",
        path: "questionanaysis",
        flag: "testAnalysis",
        body: { testId: test.testId },
      },
    ];
  }, [batchId]);

  const runStep = async (test, step) => {
    const stepId = `${test.testId}:${step.key}`;
    setGeneratingSteps((prev) => ({ ...prev, [stepId]: true }));
    setStepErrors((prev) => ({ ...prev, [stepId]: "" }));

    let body = step.body ? { ...step.body } : {};
    if (step.key === "month") {
      const publish = test.dateOfPublish;
      if (!publish) {
        setGeneratingSteps((prev) => ({ ...prev, [stepId]: false }));
        setStepErrors((prev) => ({
          ...prev,
          [stepId]: "monthYear required: test has no publish date",
        }));
        return;
      }

      try {
        const d = new Date(publish + "T00:00:00");
        const month = d.toLocaleString("en-US", { month: "short" }).toLowerCase();
        const year = d.getFullYear();
        const monthYear = `${month}_${year}`;
        if (!/^[a-z]{3}_[0-9]{4}$/.test(monthYear)) {
          throw new Error("Invalid monthYear generated");
        }
        body = { ...body, monthYear };
      } catch (e) {
        setGeneratingSteps((prev) => ({ ...prev, [stepId]: false }));
        setStepErrors((prev) => ({
          ...prev,
          [stepId]: "Failed to calculate monthYear from publish date",
        }));
        return;
      }
    }

    try {
      await postJson(step.path, body);
      await fetchTests();
    } catch (err) {
      setStepErrors((prev) => ({
        ...prev,
        [stepId]: err.message || `Failed: ${step.label}`,
      }));
    } finally {
      setGeneratingSteps((prev) => ({ ...prev, [stepId]: false }));
    }
  };

  const formatDateLabel = (dateStr) => {
    if (!dateStr) return "No publish date";

    const date = new Date(dateStr + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffDays = Math.round((date - today) / 86400000);

    if (diffDays === 0) return `Today · ${dateStr}`;
    if (diffDays === -1) return `Yesterday · ${dateStr}`;
    if (diffDays === 1) return `Tomorrow · ${dateStr}`;
    if (diffDays < 0) return `${Math.abs(diffDays)} days ago · ${dateStr}`;
    return `In ${diffDays} days · ${dateStr}`;
  };

  const toggleCardExpansion = (testId) => {
    setExpandedCardId((prev) => {
      const next = prev === testId ? null : testId;
      if (next && next !== prev) {
        setTimeout(() => {
          const cardElement = document.getElementById(`card-${testId}`);
          if (cardElement) {
            cardElement.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
            });
          }
        }, 100);
      }
      return next;
    });
  };

  const scrollToLive = () => {
    if (liveRef.current) {
      liveRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  };

  const renderCardBody = (test, isLive = false) => {
    const isExpanded = expandedCardId === test.testId;
    const ranklistValue = getRanklistValue(test);
    const ranklistDetails = getRanklistDetails(test);
    const analyticsReady = canShowAnalytics(test);
    const needsGenerate = showGenerateRanklist(test);
    const steps = needsGenerate ? getSteps(test) : [];
    const statusCfg = getStatusConfig(test.status);
    const typeCfg = getTestTypeConfig(test.testType);

    const isDark = theme === 'dark';
    const cardBg = isDark ? '#1a1a2e' : '#FFFFFF';
    const cardBorder = isDark ? '#2d2d44' : '#E9E9EC';
    const textColor = isDark ? '#E5E5E5' : '#111111';
    const subtextColor = isDark ? '#9CA3AF' : '#7A7A80';

    return (
      <div
        key={test.testId}
        id={`card-${test.testId}`}
        className="card"
        style={{
          ...styles.card,
          background: cardBg,
          borderColor: isLive ? '#22C55E' : (isExpanded ? typeCfg.borderColor : cardBorder),
          ...(isLive ? styles.liveCard : {}),
          ...(isExpanded && !isLive ? {
            borderWidth: '1.5px',
            boxShadow: `0 0 16px ${typeCfg.borderColor}26`,
          } : {}),
        }}
        ref={isLive ? liveRef : null}
      >
        <div style={styles.header}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={styles.titleRow}>
              <h3 style={{
                ...styles.testName,
                color: textColor,
              }}>
                {test.testName}
              </h3>
              <span
                style={{
                  ...styles.typeTag,
                  color: typeCfg.borderColor,
                  background: isDark ? `${typeCfg.borderColor}1F` : `${typeCfg.borderColor}12`,
                }}
              >
                {typeCfg.label}
              </span>
            </div>
            <p style={{
              ...styles.testId,
              color: subtextColor,
            }}>
              {formatDateLabel(test.dateOfPublish)}
            </p>
          </div>

          <span
            style={{
              ...styles.badge,
              background: statusCfg.bg,
              color: statusCfg.fg,
            }}
          >
            <span style={{ ...styles.badgeDot, backgroundColor: statusCfg.dot }} />
            {test.status}
          </span>
        </div>

        <div style={styles.info}>
          <InfoRow label="Type" value={test.testType} textColor={textColor} subtextColor={subtextColor} />
          <InfoRow label="Questions" value={test.totalQuestions} textColor={textColor} subtextColor={subtextColor} />
          <InfoRow label="Duration" value={`${test.duration} min`} textColor={textColor} subtextColor={subtextColor} />
          <InfoRow label="Visibility" value={test.visibility} textColor={textColor} subtextColor={subtextColor} isLast />
        </div>

        <button
          style={{
            ...styles.showMoreBtn,
            color: subtextColor,
          }}
          onClick={() => toggleCardExpansion(test.testId)}
        >
          {isExpanded ? "Show less" : "Show more"}
          <span style={{
            display: 'inline-block',
            transition: 'transform 0.2s ease',
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            fontSize: 9,
          }}>▼</span>
        </button>

        {isExpanded && (
          <>
            <div style={styles.expandedInfo}>
              <InfoRow label="Start time" value={test.startTime || "Not set"} textColor={textColor} subtextColor={subtextColor} />
              <InfoRow label="End time" value={test.endTime || "Not set"} textColor={textColor} subtextColor={subtextColor} />
              <InfoRow
                label="Questions ready"
                value={test.questionsReady ? "Yes" : "No"}
                good={test.questionsReady}
                textColor={textColor}
                subtextColor={subtextColor}
              />
              <InfoRow
                label="Analysis enabled"
                value={test.testAnalysis ? "Yes" : "No"}
                good={test.testAnalysis}
                textColor={textColor}
                subtextColor={subtextColor}
              />
              <InfoRow
                label="Ranklist"
                value={ranklistValue}
                good={ranklistValue === "Yes"}
                textColor={textColor}
                subtextColor={subtextColor}
              />
              {ranklistValue === "Yes" && (
                <InfoRow label="Ranklist type" value={ranklistDetails} good={true} textColor={textColor} subtextColor={subtextColor} />
              )}
              <InfoRow label="Editable" value={test.allowEdit ? "Yes" : "No"} good={test.allowEdit} textColor={textColor} subtextColor={subtextColor} isLast />
            </div>

            {steps.some((s) => stepErrors[`${test.testId}:${s.key}`]) && (
              <p style={styles.generateError}>
                {steps.map((s) => stepErrors[`${test.testId}:${s.key}`]).find(Boolean)}
              </p>
            )}

            <div style={styles.actions}>
              <button
                className="btn-primary"
                style={{
                  ...styles.btnPrimary,
                  background: isDark ? '#2d2d44' : '#0A0A0A',
                  borderColor: isDark ? '#2d2d44' : '#0A0A0A',
                  color: isDark ? '#E5E5E5' : '#FFFFFF',
                }}
                onClick={() => navigate(`/test/details/${test.testId}`)}
              >
                View
              </button>

              <button
                className="btn-secondary"
                style={{
                  ...styles.btnSecondary,
                  background: isDark ? '#1a1a2e' : '#FFFFFF',
                  borderColor: isDark ? '#2d2d44' : '#D9D9DE',
                  color: textColor,
                  opacity: test.allowEdit ? 1 : 0.4,
                  cursor: test.allowEdit ? "pointer" : "not-allowed",
                }}
                disabled={!test.allowEdit}
                onClick={() => navigate(`/test/edit/${test.testId}`)}
              >
                Edit
              </button>

              {analyticsReady && (
                <button
                  className="btn-ghost"
                  style={{
                    ...styles.btnAnalytics,
                    background: isDark ? '#1a1a2e' : '#FFFFFF',
                    borderColor: isDark ? '#2d2d44' : '#D9D9DE',
                    color: textColor,
                  }}
                  onClick={() => navigate(`/test/analytics/${test.testId}`)}
                >
                  Analytics
                </button>
              )}
            </div>

            {needsGenerate && (
              <div style={styles.stepsRow}>
                {steps.map((step) => {
                  const stepId = `${test.testId}:${step.key}`;
                  const isDone = Boolean(test[step.flag]);
                  const isRunning = Boolean(generatingSteps[stepId]);

                  return (
                    <button
                      key={step.key}
                      className="btn-step"
                      style={{
                        ...styles.btnStep,
                        background: isDark ? '#1a1a2e' : '#FFFFFF',
                        borderColor: isDark ? '#2d2d44' : '#D9D9DE',
                        color: textColor,
                        ...(isDone ? {
                          ...styles.btnStepDone,
                          borderColor: '#BBF7D0',
                          background: isDark ? '#1a3a2e' : '#F0FDF4',
                          color: '#15803D',
                        } : {}),
                        opacity: isRunning ? 0.6 : 1,
                        cursor: isDone || isRunning ? "not-allowed" : "pointer",
                      }}
                      disabled={isDone || isRunning}
                      onClick={() => runStep(test, step)}
                    >
                      {isRunning ? "Working…" : isDone ? `✓ ${step.label}` : step.label}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{
        ...styles.page,
        background: theme === 'dark' ? '#0a0a1a' : '#FFFFFF',
      }}>
        <style>{globalCss}</style>
        <div style={styles.center}>
          <div style={styles.spinner} />
          <p style={{
            ...styles.centerText,
            color: theme === 'dark' ? '#9CA3AF' : '#737373',
          }}>Loading tests…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        ...styles.page,
        background: theme === 'dark' ? '#0a0a1a' : '#FFFFFF',
      }}>
        <style>{globalCss}</style>
        <div style={styles.center}>
          <div style={{
            ...styles.errorBox,
            background: theme === 'dark' ? '#1a1a2e' : '#FFFFFF',
            borderColor: theme === 'dark' ? '#4a1a1a' : '#FCA5A5',
          }}>
            <span style={styles.errorIcon}>!</span>
            <div>
              <p style={{
                ...styles.errorTitle,
                color: theme === 'dark' ? '#E5E5E5' : '#0A0A0A',
              }}>Couldn't load tests</p>
              <p style={{
                ...styles.errorText,
                color: theme === 'dark' ? '#9CA3AF' : '#737373',
              }}>{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isEmpty = data.length === 0;
  const isDark = theme === 'dark';

  return (
    <div style={{
      ...styles.page,
      background: isDark ? '#0a0a1a' : '#FFFFFF',
    }} ref={containerRef}>
      <style>{globalCss}</style>

      <div style={styles.container}>
        {isEmpty && (
          <div style={{
            ...styles.emptyState,
            background: isDark ? '#1a1a2e' : '#FAFAFA',
            borderColor: isDark ? '#2d2d44' : '#D4D4D4',
          }}>
            <p style={{
              ...styles.emptyTitle,
              color: isDark ? '#E5E5E5' : '#0A0A0A',
            }}>No tests in this batch yet</p>
            <p style={{
              ...styles.emptySubtitle,
              color: isDark ? '#9CA3AF' : '#737373',
            }}>Create your first test to get started</p>
          </div>
        )}

        {!isEmpty && (
          <>
            {incompleteFinishedTests.length > 0 && (
              <div style={styles.noticeBanner} role="alert">
                <div style={styles.noticeTitle}>
                  ⚠️ {incompleteFinishedTests.length} finished test{incompleteFinishedTests.length > 1 ? "s" : ""} still need setup
                </div>
                <div style={styles.noticeList}>
                  {incompleteFinishedTests.map((test) => (
                    <div key={test.testId} style={styles.noticeItem}>
                      <strong>{test.testName || test.testId}</strong>
                      <span>{test.missingSteps.join(" • ")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{
              ...styles.summaryCard,
              background: isDark ? '#1a1a2e' : '#FAFAFA',
              borderColor: isDark ? '#2d2d44' : '#E5E7EB',
            }}>
              <div style={styles.summaryHeader}>
                <div>
                  <p style={{ ...styles.summaryTitle, color: isDark ? '#E5E5E5' : '#0A0A0A' }}>Test overview</p>
                  <p style={{ ...styles.summarySubtitle, color: isDark ? '#9CA3AF' : '#737373' }}>Counts by current status</p>
                </div>
              </div>

              <div style={styles.summaryGrid}>
                <div style={{ ...styles.summaryTile, background: isDark ? '#11111f' : '#FFFFFF' }}>
                  <span style={{ ...styles.summaryLabel, color: isDark ? '#9CA3AF' : '#6B7280' }}>Total tests</span>
                  <strong style={{ ...styles.summaryValue, color: isDark ? '#E5E5E5' : '#111111' }}>{totalTests}</strong>
                </div>
                <div style={{ ...styles.summaryTile, background: isDark ? '#11111f' : '#FFFFFF' }}>
                  <span style={{ ...styles.summaryLabel, color: isDark ? '#9CA3AF' : '#6B7280' }}>Ready</span>
                  <strong style={{ ...styles.summaryValue, color: isDark ? '#E5E5E5' : '#111111' }}>{readyCount}</strong>
                </div>
                <div style={{ ...styles.summaryTile, background: isDark ? '#11111f' : '#FFFFFF' }}>
                  <span style={{ ...styles.summaryLabel, color: isDark ? '#9CA3AF' : '#6B7280' }}>Finished</span>
                  <strong style={{ ...styles.summaryValue, color: isDark ? '#E5E5E5' : '#111111' }}>{finishedCount}</strong>
                </div>
                <div style={{ ...styles.summaryTile, background: isDark ? '#11111f' : '#FFFFFF' }}>
                  <span style={{ ...styles.summaryLabel, color: isDark ? '#9CA3AF' : '#6B7280' }}>Public</span>
                  <strong style={{ ...styles.summaryValue, color: isDark ? '#E5E5E5' : '#111111' }}>{publicCount}</strong>
                </div>
                <div style={{ ...styles.summaryTile, background: isDark ? '#11111f' : '#FFFFFF' }}>
                  <span style={{ ...styles.summaryLabel, color: isDark ? '#9CA3AF' : '#6B7280' }}>Private</span>
                  <strong style={{ ...styles.summaryValue, color: isDark ? '#E5E5E5' : '#111111' }}>{privateCount}</strong>
                </div>
              </div>

              <div style={styles.statusList}>
                {statusEntries.map(([status, count]) => (
                  <div key={status} style={{ ...styles.statusChip, background: isDark ? '#11111f' : '#FFFFFF', borderColor: isDark ? '#2d2d44' : '#E5E7EB' }}>
                    <span style={{ ...styles.statusChipLabel, color: isDark ? '#9CA3AF' : '#6B7280' }}>{status}</span>
                    <strong style={{ color: isDark ? '#E5E5E5' : '#111111' }}>{count}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div style={styles.timeline}>
            {/* ---- PAST section - ABOVE LIVE ---- */}
            {past.length > 0 && (
              <>
                <div style={{
                  ...styles.pastDivider,
                  borderColor: isDark ? '#2d2d44' : '#D4D4D4',
                }}>
                  <span style={{
                    ...styles.pastLine,
                    background: isDark ? '#2d2d44' : '#D4D4D4',
                  }} />
                  <span style={{
                    ...styles.pastLabel,
                    color: isDark ? '#9CA3AF' : '#737373',
                    borderColor: isDark ? '#2d2d44' : '#D4D4D4',
                  }}>PAST</span>
                  <span style={{
                    ...styles.pastLine,
                    background: isDark ? '#2d2d44' : '#D4D4D4',
                  }} />
                </div>
                <div style={styles.timelineTrack}>
                  {past.map((test) => (
                    <div key={test.testId} style={styles.timelineRow}>
                      <div style={styles.timelineRail}>
                        <span style={{
                          ...styles.dotPast,
                          background: isDark ? '#4a4a5a' : '#A3A3A3',
                        }} />
                        <span style={{
                          ...styles.railLine,
                          background: isDark ? '#2d2d44' : '#E5E5E5',
                        }} />
                      </div>
                      <div style={styles.timelineContent}>{renderCardBody(test, false)}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ---- LIVE NOW section - CENTER ---- */}
            {current && (
              <>
                <div style={styles.nowDivider}>
                  <span style={styles.nowLine} />
                  <span style={styles.nowLabel}>LIVE NOW</span>
                  <span style={styles.nowLine} />
                </div>
                <div style={styles.timelineRowLive}>
                  <div style={styles.timelineRailLive}>
                    <span className="dot-pulse" style={styles.dotCurrentOuter}>
                      <span style={styles.dotCurrentInner} />
                    </span>
                    <span style={{
                      ...styles.railLine,
                      background: isDark ? '#2d2d44' : '#E5E5E5',
                    }} />
                  </div>
                  <div style={styles.timelineContentLive}>
                    {renderCardBody(current, true)}
                    <div style={styles.countdownChip}>{countdownLabel}</div>
                  </div>
                </div>
              </>
            )}

            {/* ---- FUTURE section - BELOW LIVE ---- */}
            {future.length > 0 && (
              <>
                <div style={{
                  ...styles.futureDivider,
                  borderColor: isDark ? '#2d2d44' : '#D4D4D4',
                }}>
                  <span style={{
                    ...styles.futureLine,
                    background: isDark ? '#2d2d44' : '#D4D4D4',
                  }} />
                  <span style={{
                    ...styles.futureLabel,
                    color: isDark ? '#9CA3AF' : '#737373',
                    borderColor: isDark ? '#2d2d44' : '#D4D4D4',
                  }}>UPCOMING</span>
                  <span style={{
                    ...styles.futureLine,
                    background: isDark ? '#2d2d44' : '#D4D4D4',
                  }} />
                </div>
                <div
                  ref={futureListRef}
                  style={{
                    ...styles.timelineTrack,
                    ...styles.futureScroll,
                  }}
                >
                  {future.map((test, idx) => (
                    <div key={test.testId} style={styles.timelineRow}>
                      <div style={styles.timelineRail}>
                        <span style={{
                          ...styles.dotFuture,
                          background: isDark ? '#1a1a2e' : '#FFFFFF',
                          borderColor: isDark ? '#2d2d44' : '#D4D4D4',
                        }} />
                        {idx !== future.length - 1 && <span style={{
                          ...styles.railLineDashed,
                          borderColor: isDark ? '#2d2d44' : '#D4D4D4',
                        }} />}
                      </div>
                      <div style={styles.timelineContent}>{renderCardBody(test, false)}</div>
                    </div>
                  ))}
                </div>
                {showScrollHint && <p style={{
                  ...styles.scrollHint,
                  color: isDark ? '#6B7280' : '#A3A3A3',
                }}>↓ Scroll for more</p>}
              </>
            )}
          </div>
          </>
        )}
      </div>

      {/* Floating theme toggle + create test, and jump-to-today */}
      <div style={styles.floatingStack}>
        {showScrollToTop && current && (
          <button style={{
            ...styles.floatingBtn,
            background: isDark ? '#2d2d44' : '#0A0A0A',
            color: isDark ? '#E5E5E5' : '#FFFFFF',
          }} onClick={scrollToLive}>
            <span style={styles.floatingBtnIcon}>⬆</span>
            Jump to Today
          </button>
        )}
      </div>
    </div>
  );
};

const InfoRow = ({ label, value, good, textColor, subtextColor, isLast }) => (
  <div style={{
    ...styles.infoRow,
    borderBottom: isLast ? 'none' : styles.infoRow.borderBottom,
    borderBottomColor: textColor === '#E5E5E5' ? '#2d2d44' : '#F0F0F0',
  }}>
    <span style={{
      ...styles.infoLabel,
      color: subtextColor || '#8A8A8A',
    }}>{label}</span>
    <span
      style={{
        ...styles.infoValue,
        color: good === true ? "#16A34A" : good === false ? "#DC2626" : (textColor || "#111111"),
      }}
    >
      {value}
    </span>
  </div>
);

const ThemedTestListPage = (props) => (
  <ThemeProvider>
    <TestListPage {...props} />
  </ThemeProvider>
);

export default ThemedTestListPage;

const globalCss = `
  * { box-sizing: border-box; }

  .card {
    transition: all 0.2s ease;
    position: relative;
  }
  .card:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(0,0,0,0.06) !important;
  }

  .btn-create, .btn-primary, .btn-secondary, .btn-ghost, .btn-step {
    transition: all 0.15s ease;
  }
  .btn-create:hover, .btn-primary:hover {
    transform: scale(1.02);
    opacity: 0.9;
  }
  .btn-secondary:hover:not(:disabled), .btn-ghost:hover, .btn-step:hover:not(:disabled) {
    transform: scale(1.02);
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @keyframes pulse-ring {
    0% { transform: scale(0.9); opacity: 0.7; }
    70% { transform: scale(1.9); opacity: 0; }
    100% { transform: scale(1.9); opacity: 0; }
  }

  @keyframes glow-pulse {
    0%, 100% {
      box-shadow: 0 0 16px rgba(34, 197, 94, 0.18), 0 0 44px rgba(34, 197, 94, 0.08);
    }
    50% {
      box-shadow: 0 0 22px rgba(34, 197, 94, 0.3), 0 0 60px rgba(34, 197, 94, 0.14);
    }
  }

  .dot-pulse::before {
    content: "";
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    background: #22C55E;
    animation: pulse-ring 1.8s cubic-bezier(0.2, 0.6, 0.4, 1) infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .dot-pulse::before { animation: none; }
    .card, .btn-create, .btn-primary, .btn-secondary, .btn-ghost, .btn-step { transition: none; }
  }

  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: #D4D4D4;
    border-radius: 3px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: #A3A3A3;
  }

  @media (prefers-color-scheme: dark) {
    ::-webkit-scrollbar-thumb {
      background: #2d2d44;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: #3d3d5a;
    }
  }

  @media (max-width: 480px) {
    .stepsRow-mobile { flex-direction: column; }
  }
`;

const styles = {
  page: {
    minHeight: "100vh",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    padding: "20px 16px 64px",
    position: "relative",
    transition: "background 0.3s ease",
  },

  container: {
    maxWidth: 640,
    margin: "0 auto",
  },

  emptyState: {
    textAlign: "center",
    padding: "48px 20px",
    borderRadius: 12,
    border: "1px dashed #D4D4D4",
    transition: "all 0.3s ease",
  },

  emptyTitle: {
    fontSize: 15,
    fontWeight: 650,
    margin: "0 0 4px",
    transition: "color 0.3s ease",
  },

  emptySubtitle: {
    fontSize: 12.5,
    margin: 0,
    transition: "color 0.3s ease",
  },

  noticeBanner: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    border: "1px solid #FECACA",
    background: "#FEF2F2",
    boxShadow: "0 2px 10px rgba(220, 38, 38, 0.08)",
    position: "sticky",
    top: 12,
    zIndex: 20,
  },

  noticeTitle: {
    fontSize: 12.5,
    fontWeight: 700,
    color: "#991B1B",
    marginBottom: 6,
  },

  noticeList: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },

  noticeItem: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    fontSize: 11.5,
    color: "#7F1D1D",
  },

  summaryCard: {
    marginBottom: 16,
    padding: 14,
    borderRadius: 12,
    border: "1px solid #E5E7EB",
    boxShadow: "0 2px 10px rgba(15, 23, 42, 0.04)",
  },

  summaryHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  summaryTitle: {
    fontSize: 13,
    fontWeight: 700,
    margin: 0,
  },

  summarySubtitle: {
    fontSize: 11.5,
    margin: "2px 0 0",
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
    gap: 8,
    marginBottom: 10,
  },

  summaryTile: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.04)",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },

  summaryLabel: {
    fontSize: 10.5,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },

  summaryValue: {
    fontSize: 18,
    fontWeight: 700,
  },

  statusList: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },

  statusChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 9px",
    borderRadius: 999,
    border: "1px solid #E5E7EB",
    fontSize: 11.5,
  },

  statusChipLabel: {
    textTransform: "capitalize",
    fontWeight: 600,
  },

  timeline: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },

  timelineTrack: {
    display: "flex",
    flexDirection: "column",
  },

  futureScroll: {
    maxHeight: 560,
    overflowY: "auto",
    paddingRight: 4,
  },

  timelineRow: {
    display: "flex",
    gap: 12,
    paddingBottom: 2,
  },

  timelineRowLive: {
    display: "flex",
    gap: 12,
    paddingBottom: 2,
    scrollMargin: "40vh",
  },

  timelineRail: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: 14,
    flexShrink: 0,
  },

  timelineRailLive: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: 14,
    flexShrink: 0,
    paddingTop: 6,
  },

  railLine: {
    flex: 1,
    width: 2,
    marginTop: 3,
    transition: "background 0.3s ease",
  },

  railLineDashed: {
    flex: 1,
    width: 0,
    borderLeft: "2px dashed #D4D4D4",
    marginTop: 3,
    transition: "border-color 0.3s ease",
  },

  dotPast: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    flexShrink: 0,
    marginTop: 14,
    transition: "background 0.3s ease",
  },

  dotFuture: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    flexShrink: 0,
    marginTop: 14,
    transition: "all 0.3s ease",
  },

  dotCurrentOuter: {
    position: "relative",
    width: 12,
    height: 12,
    borderRadius: "50%",
    background: "#22C55E",
    flexShrink: 0,
    marginTop: 12,
  },

  dotCurrentInner: {
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
    background: "#22C55E",
  },

  timelineContent: {
    flex: 1,
    paddingBottom: 10,
    minWidth: 0,
  },

  timelineContentLive: {
    flex: 1,
    paddingBottom: 10,
    minWidth: 0,
  },

  nowDivider: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    margin: "6px 0 10px 0",
  },

  nowLine: {
    flex: 1,
    height: 2,
    background: "#22C55E",
  },

  nowLabel: {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 1.1,
    color: "#15803D",
    padding: "2px 12px",
    border: "1.5px solid #22C55E",
    borderRadius: 999,
    background: "#F0FDF4",
  },

  pastDivider: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    margin: "0 0 10px 0",
  },

  pastLine: {
    flex: 1,
    height: 1,
    transition: "background 0.3s ease",
  },

  pastLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1.1,
    padding: "2px 9px",
    border: "1px solid #D4D4D4",
    borderRadius: 999,
    transition: "all 0.3s ease",
  },

  futureDivider: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    margin: "6px 0 10px 0",
  },

  futureLine: {
    flex: 1,
    height: 1,
    transition: "background 0.3s ease",
  },

  futureLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1.1,
    padding: "2px 9px",
    border: "1px solid #D4D4D4",
    borderRadius: 999,
    transition: "all 0.3s ease",
  },

  countdownChip: {
    marginTop: -6,
    marginLeft: 3,
    display: "inline-block",
    fontSize: 11,
    fontWeight: 700,
    color: "#15803D",
    background: "#F0FDF4",
    border: "1px solid #BBF7D0",
    borderRadius: 999,
    padding: "4px 11px",
    animation: "glow-pulse 2s ease-in-out infinite",
  },

  scrollHint: {
    textAlign: "center",
    fontSize: 11,
    fontWeight: 600,
    margin: "6px 0 0 26px",
    transition: "color 0.3s ease",
  },

  card: {
    position: "relative",
    borderRadius: 10,
    padding: "14px",
    border: "1px solid #E9E9EC",
    transition: "all 0.2s ease",
  },

  liveCard: {
    border: "1.5px solid #22C55E",
    boxShadow: "0 0 16px rgba(34, 197, 94, 0.12), 0 0 44px rgba(34, 197, 94, 0.04)",
    animation: "glow-pulse 3s ease-in-out infinite",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
    gap: 8,
  },

  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },

  typeTag: {
    flexShrink: 0,
    fontSize: 9.5,
    fontWeight: 700,
    padding: "2px 6px",
    borderRadius: 5,
    letterSpacing: 0.2,
  },

  testName: {
    margin: 0,
    fontSize: 14,
    fontWeight: 650,
    letterSpacing: -0.2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    transition: "color 0.3s ease",
    minWidth: 0,
  },

  testId: {
    margin: "2px 0 0",
    fontSize: 11,
    fontWeight: 500,
    transition: "color 0.3s ease",
  },

  badge: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    fontSize: 10.5,
    padding: "3px 8px",
    borderRadius: 999,
    textTransform: "capitalize",
    fontWeight: 650,
    whiteSpace: "nowrap",
    flexShrink: 0,
  },

  badgeDot: {
    width: 5,
    height: 5,
    borderRadius: "50%",
    display: "inline-block",
  },

  info: {
    display: "grid",
    gap: 0,
  },

  expandedInfo: {
    display: "grid",
    gap: 0,
    marginTop: 2,
  },

  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "5px 0",
    borderBottom: "1px solid #F0F0F0",
    fontSize: 12,
    transition: "border-color 0.3s ease",
  },

  infoLabel: {
    fontWeight: 500,
    transition: "color 0.3s ease",
  },

  infoValue: {
    fontWeight: 600,
    textAlign: "right",
    maxWidth: "60%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    transition: "color 0.3s ease",
  },

  showMoreBtn: {
    margin: "4px 0 0",
    padding: "3px 0",
    background: "transparent",
    border: "none",
    fontSize: 10.5,
    fontWeight: 600,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    transition: "all 0.15s ease",
  },

  generateError: {
    color: "#DC2626",
    fontSize: 11.5,
    fontWeight: 600,
    margin: "6px 0 0",
  },

  actions: {
    display: "flex",
    gap: 6,
    marginTop: 10,
  },

  btnPrimary: {
    flex: 1,
    padding: "7px",
    border: "1px solid #0A0A0A",
    borderRadius: 7,
    fontWeight: 600,
    fontSize: 12,
    cursor: "pointer",
    transition: "all 0.2s ease",
  },

  btnSecondary: {
    flex: 1,
    padding: "7px",
    border: "1px solid #D9D9DE",
    borderRadius: 7,
    fontWeight: 600,
    fontSize: 12,
    transition: "all 0.2s ease",
  },

  btnAnalytics: {
    flex: 1,
    padding: "7px",
    border: "1px solid #D9D9DE",
    borderRadius: 7,
    fontWeight: 600,
    fontSize: 12,
    cursor: "pointer",
    transition: "all 0.2s ease",
  },

  stepsRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 8,
  },

  btnStep: {
    flex: "1 1 auto",
    minWidth: 88,
    padding: "6px 9px",
    border: "1px solid #D9D9DE",
    borderRadius: 6,
    fontWeight: 600,
    fontSize: 11,
    whiteSpace: "nowrap",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },

  btnStepDone: {
    border: "1px solid #BBF7D0",
    background: "#F0FDF4",
    color: "#15803D",
  },

  floatingStack: {
    position: "fixed",
    bottom: 20,
    right: 20,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 8,
    zIndex: 1000,
  },

  floatingBtn: {
    padding: "10px 16px",
    border: "none",
    borderRadius: 999,
    fontWeight: 600,
    fontSize: 12.5,
    cursor: "pointer",
    boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
    transition: "all 0.2s ease",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },

  floatingBtnIcon: {
    fontSize: 14,
  },

  center: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh",
    gap: 12,
  },

  centerText: {
    fontSize: 13,
    fontWeight: 500,
    transition: "color 0.3s ease",
  },

  spinner: {
    width: 24,
    height: 24,
    borderRadius: "50%",
    border: "2.5px solid #E5E5E5",
    borderTopColor: "#0A0A0A",
    animation: "spin 0.7s linear infinite",
  },

  errorBox: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    padding: "18px 20px",
    borderRadius: 10,
    border: "1px solid #FCA5A5",
    maxWidth: 400,
    transition: "all 0.3s ease",
  },

  errorIcon: {
    width: 24,
    height: 24,
    borderRadius: "50%",
    background: "#FEF2F2",
    color: "#DC2626",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    fontSize: 13,
    flexShrink: 0,
  },

  errorTitle: {
    fontWeight: 650,
    fontSize: 13,
    margin: "0 0 3px",
    transition: "color 0.3s ease",
  },

  errorText: {
    fontWeight: 500,
    fontSize: 12.5,
    margin: 0,
    transition: "color 0.3s ease",
  },
};