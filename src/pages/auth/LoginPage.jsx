import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import "./LoginPage.css"; // Assuming you have a CSS file for styling
const SEND_OTP_API =
  "https://3k4ygdloz8.execute-api.ap-south-1.amazonaws.com/dev/academy-login";

const VERIFY_OTP_API =
  "https://3k4ygdloz8.execute-api.ap-south-1.amazonaws.com/dev/academy_verify_otp";

function App() {
  const navigate = useNavigate();

  const [academyId, setAcademyId] = useState("");
  const [gmail, setGmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [deviceId, setDeviceId] = useState("");

  useEffect(() => {
    let id = localStorage.getItem("deviceId");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("deviceId", id);
    }
    setDeviceId(id);
    const token = localStorage.getItem("token");
    if (token) navigate("/home");
  }, [navigate]);

  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;

    const rawValue = value.replace(/\D/g, "");
    if (rawValue.length > 1) {
      const pastedDigits = rawValue.slice(0, 6).split("");
      const filledOtp = [...Array(6)].map((_, i) => pastedDigits[i] || "");
      setOtp(filledOtp);
      const nextIndex = Math.min(pastedDigits.length, 5);
      document.getElementById(`otp-${nextIndex}`)?.focus();
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus();
    }
  };

  const sendOtp = async () => {
    try {
      setLoading(true);
      setError("");
      setMessage("");
      const response = await fetch(SEND_OTP_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ academyId, gmail }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message || "Failed to send OTP");
        return;
      }
      setMessage(data.message || "OTP sent successfully");
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    try {
      setLoading(true);
      setError("");
      setMessage("");
      const response = await fetch(VERIFY_OTP_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academyId,
          gmail,
          otp: otp.join(""),
          deviceId,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message || "OTP verification failed");
        return;
      }
      localStorage.setItem("token", data.token);
      setMessage("Login successful — welcome back!");
      setTimeout(() => navigate("/home"), 1000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-root">
      <div className="auth-left">
        <div className="auth-brand">
          <div className="auth-logo">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="8" fill="#6C63FF" />
              <path d="M8 20L14 8L20 20M10.5 15.5H17.5" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="auth-logo-text">AcademyHub</span>
          </div>
        </div>

        <div className="auth-illustration">
          <div className="illus-circle illus-c1"></div>
          <div className="illus-circle illus-c2"></div>
          <div className="illus-circle illus-c3"></div>
          <div className="illus-cards">
            <div className="illus-card ic1">
              <div className="ic-dot" style={{ background: "#6C63FF" }}></div>
              <div className="ic-lines">
                <div className="ic-line" style={{ width: "70%" }}></div>
                <div className="ic-line" style={{ width: "50%" }}></div>
              </div>
            </div>
            <div className="illus-card ic2">
              <div className="ic-dot" style={{ background: "#FF6584" }}></div>
              <div className="ic-lines">
                <div className="ic-line" style={{ width: "60%" }}></div>
                <div className="ic-line" style={{ width: "80%" }}></div>
              </div>
            </div>
            <div className="illus-card ic3">
              <div className="ic-dot" style={{ background: "#43C59E" }}></div>
              <div className="ic-lines">
                <div className="ic-line" style={{ width: "55%" }}></div>
                <div className="ic-line" style={{ width: "65%" }}></div>
              </div>
            </div>
          </div>
        </div>

        <div className="auth-tagline">
          <h2>Manage your academy, effortlessly.</h2>
          <p>Batches, students, and assignments — all in one place.</p>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-card">
          <div className="auth-steps">
            <div className={`auth-step-dot ${step >= 1 ? "active" : ""}`}></div>
            <div className={`auth-step-line ${step >= 2 ? "filled" : ""}`}></div>
            <div className={`auth-step-dot ${step >= 2 ? "active" : ""}`}></div>
          </div>

          {step === 1 ? (
            <>
              <h1 className="auth-title">Sign in</h1>
              <p className="auth-subtitle">Enter your academy credentials to continue</p>

              <div className="auth-field">
                <label>Academy ID</label>
                <input
                  type="text"
                  placeholder="e.g. ACE-2024"
                  value={academyId}
                  onChange={(e) => setAcademyId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendOtp()}
                  autoFocus
                />
              </div>

              <div className="auth-field">
                <label>Gmail address</label>
                <input
                  type="email"
                  placeholder="you@gmail.com"
                  value={gmail}
                  onChange={(e) => setGmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendOtp()}
                />
              </div>

              <button
                className={`auth-btn ${loading ? "loading" : ""}`}
                onClick={sendOtp}
                disabled={loading || !academyId || !gmail}
              >
                {loading ? (
                  <span className="auth-spinner"></span>
                ) : (
                  "Send OTP"
                )}
              </button>
            </>
          ) : (
            <>
              <button className="auth-back" onClick={() => { setStep(1); setError(""); setMessage(""); setOtp(["","","","","",""]); }}>
                ← Back
              </button>
              <h1 className="auth-title">Check your email</h1>
              <p className="auth-subtitle">
                We sent a 6-digit code to <strong>{gmail}</strong>
              </p>

              <div className="otp-grid">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    id={`otp-${i}`}
                    className="otp-box"
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    autoFocus={i === 0}
                  />
                ))}
              </div>

              <button
                className={`auth-btn ${loading ? "loading" : ""}`}
                onClick={verifyOtp}
                disabled={loading || otp.join("").length < 6}
              >
                {loading ? (
                  <span className="auth-spinner"></span>
                ) : (
                  "Verify & sign in"
                )}
              </button>

              <p className="auth-resend">
                Didn't receive it?{" "}
                <button className="resend-link" onClick={sendOtp} disabled={loading}>
                  Resend OTP
                </button>
              </p>
            </>
          )}

          {message && <div className="auth-message success">{message}</div>}
          {error && <div className="auth-message error">{error}</div>}
        </div>
      </div>
    </div>
  );
}

export default App;