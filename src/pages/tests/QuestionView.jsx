import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import "../../styles/QuestionView.css";

const API_ENDPOINT =
  "https://6mgkhsbr1a.execute-api.ap-south-1.amazonaws.com/default/question-get";

const getOptionLabel = (index) => String.fromCharCode(65 + index);

// Maps internal question-type codes to short, human-readable badges.
const QUESTION_TYPE_LABELS = {
  MCQ: "Multiple choice",
  ASSERTION_REASON: "Assertion & reason",
  MATCHING: "Matching",
};

const QuestionView = () => {
  const { testId } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAnswers, setShowAnswers] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [testData, setTestData] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const exportMenuRef = useRef(null);
  const pdfContentRef = useRef(null);

  const fetchQuestions = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          testId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setTestData(data.data);
        setQuestions(data.data.questions || []);
      } else {
        setError("Failed to fetch questions");
      }
    } catch (err) {
      console.error(err);
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [testId, token]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // Close the export dropdown when clicking outside of it.
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(event.target)
      ) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const totalMarks = questions.reduce(
    (sum, q) => sum + (q.weightage || 0),
    0
  );

  // ---------------------------------------------------------------------
  // PDF export with proper styling and overflow prevention
  // ---------------------------------------------------------------------
  const exportQuestionsPDF = (includeAnswers = true, includeOptions = true) => {
    try {
      setExporting(true);
      const pdf = new jsPDF("p", "mm", "a4");
      
      // Set margins
      const margin = 15;
      const pageWidth = 210;
      const pageHeight = 297;
      const maxWidth = pageWidth - 2 * margin;
      let y = margin + 10;

      // Helper function to add text with auto page break
      const addTextWithWrap = (text, x, y, fontSize = 10, maxWidth = 180) => {
        pdf.setFontSize(fontSize);
        const lines = pdf.splitTextToSize(text, maxWidth);
        const lineHeight = fontSize * 0.5 + 2;
        
        lines.forEach((line) => {
          if (y + lineHeight > pageHeight - margin) {
            pdf.addPage();
            y = margin + 10;
          }
          pdf.text(line, x, y);
          y += lineHeight;
        });
        
        return y;
      };

      // Add content with proper styling
      questions.forEach((q, index) => {
        // Check if we need a new page
        if (y > pageHeight - 60) {
          pdf.addPage();
          y = margin + 10;
        }

        // Question number and text
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(0, 0, 0);
        
        const questionText = `Q${index + 1}. ${q.question}`;
        const questionLines = pdf.splitTextToSize(questionText, maxWidth);
        
        questionLines.forEach((line) => {
          if (y + 6 > pageHeight - margin) {
            pdf.addPage();
            y = margin + 10;
          }
          pdf.text(line, margin, y);
          y += 6;
        });

        // Question type only (removed weightage/marks)
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "italic");
        pdf.setTextColor(100, 100, 100);
        
        const metaText = `${QUESTION_TYPE_LABELS[q.questionType] || q.questionType}${q.topic ? ` • ${q.topic}` : ''}`;
        const metaLines = pdf.splitTextToSize(metaText, maxWidth);
        metaLines.forEach((line) => {
          if (y + 4 > pageHeight - margin) {
            pdf.addPage();
            y = margin + 10;
          }
          pdf.text(line, margin, y);
          y += 4;
        });
        
        y += 2;

        // MCQ Options
        if (includeOptions && q.options?.length) {
          pdf.setFontSize(10);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(0, 0, 0);
          
          q.options.forEach((option, idx) => {
            const optionText = `${String.fromCharCode(65 + idx)}. ${option}`;
            const optionLines = pdf.splitTextToSize(optionText, maxWidth - 8);
            
            optionLines.forEach((line, lineIndex) => {
              if (y + 5 > pageHeight - margin) {
                pdf.addPage();
                y = margin + 10;
              }
              pdf.text(line, margin + 5, y);
              y += 5;
            });
          });
        }

        // Assertion Reason
        if (includeOptions && q.questionType === "ASSERTION_REASON") {
          pdf.setFontSize(10);
          pdf.setFont("helvetica", "normal");
          
          if (q.assertion) {
            const assertionLines = pdf.splitTextToSize(`Assertion: ${q.assertion}`, maxWidth - 5);
            assertionLines.forEach((line) => {
              if (y + 5 > pageHeight - margin) {
                pdf.addPage();
                y = margin + 10;
              }
              pdf.text(line, margin + 5, y);
              y += 5;
            });
          }
          
          if (q.reason) {
            const reasonLines = pdf.splitTextToSize(`Reason: ${q.reason}`, maxWidth - 5);
            reasonLines.forEach((line) => {
              if (y + 5 > pageHeight - margin) {
                pdf.addPage();
                y = margin + 10;
              }
              pdf.text(line, margin + 5, y);
              y += 5;
            });
          }
        }

        // Matching Pairs
        if (includeOptions && q.questionType === "MATCHING" && q.pairs?.length) {
          pdf.setFontSize(10);
          pdf.setFont("helvetica", "bold");
          pdf.text("Pairs:", margin + 5, y);
          y += 5;
          
          pdf.setFont("helvetica", "normal");
          q.pairs.forEach((pair, idx) => {
            const pairText = `${idx + 1}. ${pair}`;
            const pairLines = pdf.splitTextToSize(pairText, maxWidth - 10);
            pairLines.forEach((line) => {
              if (y + 5 > pageHeight - margin) {
                pdf.addPage();
                y = margin + 10;
              }
              pdf.text(line, margin + 10, y);
              y += 5;
            });
          });
        }

        // Answer
        if (includeAnswers && showAnswers) {
          y += 2;
          
          if (q.correctAnswer) {
            pdf.setFontSize(10);
            pdf.setFont("helvetica", "bold");
            pdf.setTextColor(0, 0, 200);
            
            const answerText = `Answer: ${q.correctAnswer}`;
            if (y + 5 > pageHeight - margin) {
              pdf.addPage();
              y = margin + 10;
            }
            pdf.text(answerText, margin + 5, y);
            y += 5;
          }

          if (q.explanation) {
            pdf.setFontSize(9);
            pdf.setFont("helvetica", "italic");
            pdf.setTextColor(80, 80, 80);
            
            const explanationLines = pdf.splitTextToSize(`Explanation: ${q.explanation}`, maxWidth - 5);
            explanationLines.forEach((line) => {
              if (y + 5 > pageHeight - margin) {
                pdf.addPage();
                y = margin + 10;
              }
              pdf.text(line, margin + 5, y);
              y += 5;
            });
          }

          pdf.setTextColor(0, 0, 0);
          pdf.setFont("helvetica", "normal");
        }

        // Add spacing between questions
        y += 4;
        
        // Draw separator line between questions
        pdf.setDrawColor(230, 230, 230);
        pdf.line(margin + 5, y, pageWidth - margin - 5, y);
        y += 6;
      });

      pdf.save(`Test-${testId}.pdf`);
    } catch (error) {
      console.error("PDF Error:", error);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  // Screenshot PDF export using html2canvas with overflow prevention
  const exportPDFWithScreenshot = async () => {
    try {
      setExporting(true);
      const input = document.getElementById("pdf-content");

      if (!input) {
        throw new Error("PDF content element not found");
      }

      // Ensure the content is properly styled for screenshot
      const canvas = await html2canvas(input, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        allowTaint: true,
        width: input.scrollWidth,
        height: input.scrollHeight,
        windowWidth: input.scrollWidth,
        windowHeight: input.scrollHeight,
      });

      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = 210;
      const pdfHeight = 297;
      
      // Calculate image dimensions to fit within page
      const imgAspectRatio = canvas.width / canvas.height;
      let imgWidth = pdfWidth - 20; // Add margins
      let imgHeight = imgWidth / imgAspectRatio;
      
      // If image is taller than page, split into multiple pages
      if (imgHeight > pdfHeight - 20) {
        const pageHeightPx = (pdfHeight - 20) * (canvas.width / imgWidth);
        const totalPages = Math.ceil(canvas.height / pageHeightPx);
        
        for (let i = 0; i < totalPages; i++) {
          if (i > 0) {
            pdf.addPage();
          }
          
          const sourceY = i * pageHeightPx;
          const sourceHeight = Math.min(pageHeightPx, canvas.height - sourceY);
          
          // Create a temporary canvas for the page section
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = canvas.width;
          tempCanvas.height = sourceHeight;
          const tempCtx = tempCanvas.getContext('2d');
          tempCtx.drawImage(canvas, 0, sourceY, canvas.width, sourceHeight, 0, 0, canvas.width, sourceHeight);
          
          const pageImgData = tempCanvas.toDataURL("image/png");
          pdf.addImage(pageImgData, "PNG", 10, 10, imgWidth, (sourceHeight * imgWidth) / canvas.width);
        }
      } else {
        // Single page
        pdf.addImage(imgData, "PNG", 10, 10, imgWidth, imgHeight);
      }
      
      pdf.save(`Test-${testId}-screenshot.pdf`);
    } catch (error) {
      console.error("PDF Error:", error);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  // Export functions for dropdown menu
  const exportPDFWithAnswers = () => {
    setExportMenuOpen(false);
    setShowAnswers(true);
    setTimeout(() => exportQuestionsPDF(true, true), 100);
  };

  const exportPDFWithoutAnswers = () => {
    setExportMenuOpen(false);
    setShowAnswers(false);
    setTimeout(() => exportQuestionsPDF(false, true), 100);
  };

  const exportPDFWithOnlyQuestions = () => {
    setExportMenuOpen(false);
    setShowAnswers(false);
    setTimeout(() => exportQuestionsPDF(false, false), 100);
  };

  const handleScreenshotExport = () => {
    setExportMenuOpen(false);
    exportPDFWithScreenshot();
  };

  // Handle back navigation
  const handleGoBack = () => {
    navigate(-1); // Go back to previous page
  };

  // ---------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------
  if (loading) {
    return (
      <div className="qv-page">
        <div className="qv-loading-state">
          <div className="qv-spinner" aria-hidden="true" />
          <h2 className="qv-loading-title">Loading your questions</h2>
          <p className="qv-loading-subtitle">
            Fetching test <strong>{testId}</strong> from the question bank…
          </p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------
  if (error) {
    return (
      <div className="qv-page">
        <div className="qv-error-state">
          <div className="qv-error-icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 8.5v4.5M12 16.5h.01M10.29 3.86 1.82 18a1.5 1.5 0 0 0 1.3 2.25h17.76a1.5 1.5 0 0 0 1.3-2.25L13.71 3.86a1.5 1.5 0 0 0-2.42 0Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h2 className="qv-error-title">{error}</h2>
          <p className="qv-error-subtitle">
            We couldn't load this test. Check your connection and try again.
          </p>
          <button className="qv-btn qv-btn-primary" onClick={fetchQuestions}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------
  const isEmpty = !loading && !error && questions.length === 0;

  return (
    <div className="qv-page">
      {/* ----------------------------------------------------------------
          Top bar: title, breadcrumb-style context, and primary actions
      ---------------------------------------------------------------- */}
      <header className="qv-topbar">
        <div className="qv-topbar-left">
          <button onClick={handleGoBack} className="qv-back-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M15 18l-6-6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Back
          </button>
          <span className="qv-divider" aria-hidden="true">/</span>
          <span className="qv-topbar-current">Test questions</span>
        </div>

        <div className="qv-topbar-right">
          <button
            className="qv-btn qv-btn-secondary"
            onClick={() => setShowAnswers(!showAnswers)}
            aria-pressed={showAnswers}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              {showAnswers ? (
                <path
                  d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.5 5.2A10.7 10.7 0 0 1 12 5c5 0 8.5 3.5 10 7-.6 1.3-1.4 2.5-2.4 3.5M6.4 6.4C4.4 7.8 2.9 9.7 2 12c1.5 3.5 5 7 10 7 1.3 0 2.6-.2 3.7-.6"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : (
                <>
                  <path
                    d="M2 12c1.5-3.5 5-7 10-7s8.5 3.5 10 7c-1.5 3.5-5 7-10 7s-8.5-3.5-10-7Z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
                </>
              )}
            </svg>
            {showAnswers ? "Hide answers" : "Show answers"}
          </button>

          {/* Export dropdown */}
          <div className="qv-dropdown" ref={exportMenuRef}>
            <button
              className="qv-btn qv-btn-primary"
              onClick={() => setExportMenuOpen((open) => !open)}
              disabled={exporting}
              aria-haspopup="true"
              aria-expanded={exportMenuOpen}
            >
              {exporting ? (
                <>
                  <span className="qv-btn-spinner" aria-hidden="true" />
                  Exporting…
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Export
                  <svg
                    className="qv-chevron"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <path
                      d="M6 9l6 6 6-6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </>
              )}
            </button>

            {exportMenuOpen && (
              <div className="qv-dropdown-menu" role="menu">
                <button className="qv-dropdown-item" onClick={exportPDFWithAnswers} role="menuitem">
                  <span className="qv-dropdown-item-icon qv-icon-doc" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                      <path d="M9 12h6M9 16h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span>
                    <span className="qv-dropdown-item-title">PDF with answers</span>
                    <span className="qv-dropdown-item-desc">Includes correct answers &amp; explanations</span>
                  </span>
                </button>

                <button className="qv-dropdown-item" onClick={exportPDFWithoutAnswers} role="menuitem">
                  <span className="qv-dropdown-item-icon qv-icon-doc" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                      <path d="M9 12h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span>
                    <span className="qv-dropdown-item-title">PDF without answers</span>
                    <span className="qv-dropdown-item-desc">Questions and options only</span>
                  </span>
                </button>

                <button className="qv-dropdown-item" onClick={exportPDFWithOnlyQuestions} role="menuitem">
                  <span className="qv-dropdown-item-icon qv-icon-doc" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span>
                    <span className="qv-dropdown-item-title">Questions only</span>
                    <span className="qv-dropdown-item-desc">No options, answers or explanations</span>
                  </span>
                </button>

                <div className="qv-dropdown-sep" role="separator" />

                <button className="qv-dropdown-item" onClick={handleScreenshotExport} role="menuitem">
                  <span className="qv-dropdown-item-icon qv-icon-camera" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M4 8h2.5L8 5h8l1.5 3H20a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                      <circle cx="12" cy="13.5" r="3.2" stroke="currentColor" strokeWidth="1.6" />
                    </svg>
                  </span>
                  <span>
                    <span className="qv-dropdown-item-title">PDF as screenshot</span>
                    <span className="qv-dropdown-item-desc">Pixel-perfect snapshot of this page</span>
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ----------------------------------------------------------------
          Page heading + summary stat cards
      ---------------------------------------------------------------- */}
      <div className="qv-page-head">
        <div>
          <h1 className="qv-page-title">Test questions</h1>
          <p className="qv-page-subtitle">
            Review every question, option, and answer for this test before publishing or exporting.
          </p>
        </div>
      </div>

      <section className="qv-summary-grid" aria-label="Test summary">
        <div className="qv-summary-card">
          <span className="qv-summary-icon qv-summary-icon-id" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
              <path d="M7 9h6M7 13h10M7 16h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </span>
          <div>
            <span className="qv-summary-label">Test ID</span>
            <span className="qv-summary-value qv-summary-value-mono">
              {testData?.testId || testId}
            </span>
          </div>
        </div>

        <div className="qv-summary-card">
          <span className="qv-summary-icon qv-summary-icon-questions" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 17h.01M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.35-1 .9-1 1.7"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </span>
          <div>
            <span className="qv-summary-label">Total questions</span>
            <span className="qv-summary-value">{questions.length}</span>
          </div>
        </div>

      

        <div className="qv-summary-card">
          <span className="qv-summary-icon qv-summary-icon-visibility" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M2 12c1.5-3.5 5-7 10-7s8.5 3.5 10 7c-1.5 3.5-5 7-10 7s-8.5-3.5-10-7Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </span>
          <div>
            <span className="qv-summary-label">Answers</span>
            <span
              className={`qv-status-pill ${
                showAnswers ? "qv-status-pill-visible" : "qv-status-pill-hidden"
              }`}
            >
              {showAnswers ? "Visible" : "Hidden"}
            </span>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------------
          Question list / empty state
      ---------------------------------------------------------------- */}
      {isEmpty ? (
        <div className="qv-empty-state">
          <div className="qv-empty-icon" aria-hidden="true">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M9 12h6M9 16h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
          <h3 className="qv-empty-title">No questions in this test yet</h3>
          <p className="qv-empty-subtitle">
            Once questions are added to test <strong>{testId}</strong>, they'll show up here for review and export.
          </p>
        </div>
      ) : (
        <div id="pdf-content" className="qv-question-list" ref={pdfContentRef}>
          {questions.map((question, index) => (
            <article key={question.questionNumber || index} className="qv-question-card">
              {/* Card header: number, type badge, topic, weightage */}
              <div className="qv-question-card-header">
                <div className="qv-question-number" aria-hidden="true">
                  {question.questionNumber || index + 1}
                </div>

                <div className="qv-question-heading">
                  <h3 className="qv-question-text">{question.question}</h3>

                  <div className="qv-question-meta">
                    <span className="qv-badge qv-badge-type">
                      {QUESTION_TYPE_LABELS[question.questionType] ||
                        question.questionType}
                    </span>
                    {question.topic && (
                      <span className="qv-badge qv-badge-topic">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                          <path d="M4 6h16M4 12h10M4 18h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        {question.topic}
                      </span>
                    )}
                    {/* Removed weightage badge from UI */}
                  </div>
                </div>
              </div>

              {/* Card body: options / assertion-reason / matching */}
              <div className="qv-question-body">
                {/* MCQ */}
                {question.questionType === "MCQ" &&
                  question.options?.length > 0 && (
                    <ul className="qv-options-list">
                      {question.options.map((option, idx) => {
                        const isCorrect =
                          showAnswers &&
                          (question.correctAnswer === getOptionLabel(idx) ||
                            question.correctAnswer === option);
                        return (
                          <li
                            key={idx}
                            className={`qv-option ${isCorrect ? "qv-option-correct" : ""}`}
                          >
                            <span className="qv-option-label">{getOptionLabel(idx)}</span>
                            <span className="qv-option-text">{option}</span>
                            {isCorrect && (
                              <svg
                                className="qv-option-check"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                aria-hidden="true"
                              >
                                <path
                                  d="M5 12.5 9.5 17 19 7"
                                  stroke="currentColor"
                                  strokeWidth="2.2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}

                {/* Assertion Reason */}
                {question.questionType === "ASSERTION_REASON" && (
                  <div className="qv-assertion-block">
                    <div className="qv-assertion-row">
                      <span className="qv-assertion-label">Assertion</span>
                      <p className="qv-assertion-text">{question.assertion}</p>
                    </div>
                    <div className="qv-assertion-row">
                      <span className="qv-assertion-label">Reason</span>
                      <p className="qv-assertion-text">{question.reason}</p>
                    </div>

                    {question.options && (
                      <ul className="qv-options-list qv-options-list-compact">
                        {question.options.map((option, idx) => (
                          <li key={idx} className="qv-option">
                            <span className="qv-option-label">{getOptionLabel(idx)}</span>
                            <span className="qv-option-text">{option}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Matching */}
                {question.questionType === "MATCHING" &&
                  question.pairs?.length > 0 && (
                    <div className="qv-matching-grid">
                      <div className="qv-matching-col">
                        <h4 className="qv-matching-heading">Pairs</h4>
                        <ul className="qv-matching-list">
                          {question.pairs.map((pair, idx) => (
                            <li key={idx} className="qv-matching-item">
                              <span className="qv-matching-index">{idx + 1}</span>
                              {pair}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {question.options?.length > 0 && (
                        <div className="qv-matching-col">
                          <h4 className="qv-matching-heading">Options</h4>
                          <ul className="qv-options-list qv-options-list-compact">
                            {question.options.map((option, idx) => (
                              <li key={idx} className="qv-option">
                                <span className="qv-option-label">{getOptionLabel(idx)}</span>
                                <span className="qv-option-text">{option}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
              </div>

              {/* Card footer: answer + explanation (toggleable) */}
              {showAnswers && (question.correctAnswer || question.explanation) && (
                <div className="qv-answer-box">
                  {question.correctAnswer && (
                    <div className="qv-answer-row">
                      <svg
                        className="qv-answer-icon"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                      >
                        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
                        <path d="M8 12.5 11 15.5 16 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="qv-answer-label">Correct answer</span>
                      <span className="qv-answer-value">{question.correctAnswer}</span>
                    </div>
                  )}
                  {question.explanation && (
                    <p className="qv-explanation">
                      <span className="qv-explanation-label">Explanation —</span>{" "}
                      {question.explanation}
                    </p>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default QuestionView;