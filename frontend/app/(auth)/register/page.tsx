"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { registerUser, saveTokens, saveUser, persistCookies } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();

  // Form state
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!username.trim()) errs.username = "Username is required";
    else if (username.trim().length < 3) errs.username = "Minimum 3 characters";
    if (!email.trim()) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Please enter a valid email";
    if (!password) errs.password = "Password is required";
    else if (password.length < 6) errs.password = "Minimum 6 characters";
    if (password !== confirmPassword) errs.confirmPassword = "Passwords do not match";
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      const data = await registerUser({
        username: username.trim(),
        email: email.trim(),
        password,
      });
      saveTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      await persistCookies({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      saveUser(data.user);
      setSuccess(true);
      setTimeout(() => router.push("/home"), 800);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        backgroundColor: "#0a0812",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
      }}
    >
      {/* Dark gradient overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse at 75% 50%, rgba(120,50,180,0.10) 0%, transparent 50%),
            radial-gradient(ellipse at 25% 30%, rgba(100,60,200,0.05) 0%, transparent 45%),
            linear-gradient(180deg, rgba(12,10,22,0.4) 0%, rgba(15,12,28,0.95) 100%)
          `,
          zIndex: 0,
        }}
      />

      {/* Blurred chessboard pattern overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(45deg, rgba(120,80,180,0.06) 25%, transparent 25%),
            linear-gradient(-45deg, rgba(120,80,180,0.06) 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, rgba(120,80,180,0.06) 75%),
            linear-gradient(-45deg, transparent 75%, rgba(120,80,180,0.06) 75%)
          `,
          backgroundSize: "100px 100px",
          backgroundPosition: "0 0, 0 50px, 50px -50px, -50px 0px",
          opacity: 0.5,
          filter: "blur(2px)",
          zIndex: 0,
        }}
      />

      {/* Large decorative queen piece (right side) */}
      <div
        style={{
          position: "absolute",
          right: "-6%",
          top: "50%",
          transform: "translateY(-50%)",
          fontSize: "min(50vw, 700px)",
          lineHeight: 1,
          color: "rgba(140,90,200,0.05)",
          fontWeight: 900,
          userSelect: "none",
          pointerEvents: "none",
          zIndex: 1,
          fontFamily: "serif",
        }}
      >
        ♛
      </div>

      {/* Subtle grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(120,100,180,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(120,100,180,0.025) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
          zIndex: 0,
        }}
      />

      {/* ─── Brand name "ChessSkyscraper" at the top ─── */}
      <div
        className="register-brand"
        style={{
          position: "absolute",
          top: "5%",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10,
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: "0px",
        }}
      >
        <span style={{
          fontFamily: "'Playfair Display', 'Georgia', serif",
          fontSize: "clamp(28px, 3.5vw, 48px)",
          fontWeight: 700,
          color: "#e8e0f0",
          letterSpacing: "0.06em",
          textShadow: "0 0 40px rgba(168,120,220,0.4), 0 0 80px rgba(168,120,220,0.15)",
          whiteSpace: "nowrap",
          userSelect: "none",
        }}>
          ChessSkyscraper
        </span>
      </div>

      {/* ─── Main Content ─── */}
      <div style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", width: "100%", maxWidth: "460px", padding: "0 20px" }}>

        {/* Knight Icon */}
        <div style={{ marginBottom: "12px" }}>
          <svg width="44" height="44" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M32 8C32 8 28 4 22 4C16 4 12 8 12 8C12 8 8 12 8 18C8 24 12 28 12 28L10 34C10 34 8 38 14 40C20 42 24 40 24 40L26 44L30 44L32 40C32 40 36 42 38 38C40 34 38 28 38 28L36 22C36 22 40 18 40 14C40 10 36 8 32 8Z"
              stroke="#c4a0e8"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <circle cx="22" cy="16" r="3" fill="#c4a0e8" opacity="0.6" />
            <path d="M26 28C26 28 24 26 22 26C20 26 18 28 18 28" stroke="#c4a0e8" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M28 20L34 14" stroke="#c4a0e8" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
          </svg>
        </div>

        {/* Title */}
        <h1 className="register-title" style={{
          fontSize: "36px",
          fontWeight: 900,
          letterSpacing: "0.08em",
          marginBottom: "28px",
          textAlign: "center",
          background: "linear-gradient(180deg, #ffffff 0%, #d8a8f0 60%, #c084fc 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          lineHeight: 1.1,
        }}>
          REGISTER
        </h1>

        {/* Card */}
        <div className="register-card" style={{
          width: "100%",
          backgroundColor: "rgba(18,14,30,0.80)",
          border: "1px solid rgba(140,110,180,0.28)",
          borderRadius: "20px",
          padding: "36px 32px",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: "0 30px 60px rgba(0,0,0,0.5), 0 0 80px rgba(120,60,180,0.06)",
        }}>

          {/* Error Banner */}
          {error && (
            <div style={{
              backgroundColor: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "10px",
              padding: "12px 16px",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}>
              <span style={{ color: "#f87171", fontSize: "14px" }}>⚠</span>
              <span style={{ color: "#f87171", fontSize: "12px", fontWeight: 600 }}>{error}</span>
            </div>
          )}

          {/* Success Banner */}
          {success && (
            <div style={{
              backgroundColor: "rgba(34,197,94,0.12)",
              border: "1px solid rgba(34,197,94,0.3)",
              borderRadius: "10px",
              padding: "12px 16px",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}>
              <span style={{ color: "#4ade80", fontSize: "14px" }}>✓</span>
              <span style={{ color: "#4ade80", fontSize: "12px", fontWeight: 600 }}>Registration successful! Redirecting...</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Username */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", color: "#d1c4e0", fontSize: "11px", fontWeight: 600, letterSpacing: "0.05em", marginBottom: "8px" }}>
                Username
              </label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#6b5b8a", pointerEvents: "none" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                </span>
                <input
                  type="text"
                  placeholder="Create a username"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setFieldErrors(p => ({ ...p, username: "" })); }}
                  disabled={loading || success}
                  style={{
                    width: "100%",
                    backgroundColor: "rgba(10,8,18,0.7)",
                    border: `1px solid ${fieldErrors.username ? "rgba(239,68,68,0.5)" : "rgba(100,75,140,0.35)"}`,
                    borderRadius: "12px",
                    color: "#e8e0f0",
                    fontSize: "14px",
                    padding: "14px 14px 14px 42px",
                    outline: "none",
                    fontFamily: "'Inter', sans-serif",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                    boxSizing: "border-box",
                    opacity: loading || success ? 0.5 : 1,
                  }}
                  onFocus={(e) => {
                    if (!fieldErrors.username) e.target.style.borderColor = "#a855f7";
                    e.target.style.boxShadow = "0 0 0 3px rgba(168,85,247,0.08)";
                  }}
                  onBlur={(e) => {
                    if (!fieldErrors.username) e.target.style.borderColor = "rgba(100,75,140,0.35)";
                    e.target.style.boxShadow = "none";
                  }}
                />
              </div>
              {fieldErrors.username && <p style={{ color: "#f87171", fontSize: "10px", marginTop: "6px", marginLeft: "4px" }}>{fieldErrors.username}</p>}
            </div>

            {/* Email */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", color: "#d1c4e0", fontSize: "11px", fontWeight: 600, letterSpacing: "0.05em", marginBottom: "8px" }}>
                Email
              </label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#6b5b8a", pointerEvents: "none" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"></rect><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path></svg>
                </span>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setFieldErrors(p => ({ ...p, email: "" })); }}
                  disabled={loading || success}
                  style={{
                    width: "100%",
                    backgroundColor: "rgba(10,8,18,0.7)",
                    border: `1px solid ${fieldErrors.email ? "rgba(239,68,68,0.5)" : "rgba(100,75,140,0.35)"}`,
                    borderRadius: "12px",
                    color: "#e8e0f0",
                    fontSize: "14px",
                    padding: "14px 14px 14px 42px",
                    outline: "none",
                    fontFamily: "'Inter', sans-serif",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                    boxSizing: "border-box",
                    opacity: loading || success ? 0.5 : 1,
                  }}
                  onFocus={(e) => {
                    if (!fieldErrors.email) e.target.style.borderColor = "#a855f7";
                    e.target.style.boxShadow = "0 0 0 3px rgba(168,85,247,0.08)";
                  }}
                  onBlur={(e) => {
                    if (!fieldErrors.email) e.target.style.borderColor = "rgba(100,75,140,0.35)";
                    e.target.style.boxShadow = "none";
                  }}
                />
              </div>
              {fieldErrors.email && <p style={{ color: "#f87171", fontSize: "10px", marginTop: "6px", marginLeft: "4px" }}>{fieldErrors.email}</p>}
            </div>

            {/* Password */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", color: "#d1c4e0", fontSize: "11px", fontWeight: 600, letterSpacing: "0.05em", marginBottom: "8px" }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#6b5b8a", pointerEvents: "none" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                </span>
                <input
                  type="password"
                  placeholder="Create a strong password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setFieldErrors(p => ({ ...p, password: "" })); }}
                  disabled={loading || success}
                  style={{
                    width: "100%",
                    backgroundColor: "rgba(10,8,18,0.7)",
                    border: `1px solid ${fieldErrors.password ? "rgba(239,68,68,0.5)" : "rgba(100,75,140,0.35)"}`,
                    borderRadius: "12px",
                    color: "#e8e0f0",
                    fontSize: "14px",
                    padding: "14px 14px 14px 42px",
                    outline: "none",
                    fontFamily: "'Inter', sans-serif",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                    boxSizing: "border-box",
                    opacity: loading || success ? 0.5 : 1,
                  }}
                  onFocus={(e) => {
                    if (!fieldErrors.password) e.target.style.borderColor = "#a855f7";
                    e.target.style.boxShadow = "0 0 0 3px rgba(168,85,247,0.08)";
                  }}
                  onBlur={(e) => {
                    if (!fieldErrors.password) e.target.style.borderColor = "rgba(100,75,140,0.35)";
                    e.target.style.boxShadow = "none";
                  }}
                />
              </div>
              {fieldErrors.password && <p style={{ color: "#f87171", fontSize: "10px", marginTop: "6px", marginLeft: "4px" }}>{fieldErrors.password}</p>}
            </div>

            {/* Confirm Password */}
            <div style={{ marginBottom: "28px" }}>
              <label style={{ display: "block", color: "#d1c4e0", fontSize: "11px", fontWeight: 600, letterSpacing: "0.05em", marginBottom: "8px" }}>
                Confirm Password
              </label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#6b5b8a", pointerEvents: "none" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                </span>
                <input
                  type="password"
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setFieldErrors(p => ({ ...p, confirmPassword: "" })); }}
                  disabled={loading || success}
                  style={{
                    width: "100%",
                    backgroundColor: "rgba(10,8,18,0.7)",
                    border: `1px solid ${fieldErrors.confirmPassword ? "rgba(239,68,68,0.5)" : "rgba(100,75,140,0.35)"}`,
                    borderRadius: "12px",
                    color: "#e8e0f0",
                    fontSize: "14px",
                    padding: "14px 14px 14px 42px",
                    outline: "none",
                    fontFamily: "'Inter', sans-serif",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                    boxSizing: "border-box",
                    opacity: loading || success ? 0.5 : 1,
                  }}
                  onFocus={(e) => {
                    if (!fieldErrors.confirmPassword) e.target.style.borderColor = "#a855f7";
                    e.target.style.boxShadow = "0 0 0 3px rgba(168,85,247,0.08)";
                  }}
                  onBlur={(e) => {
                    if (!fieldErrors.confirmPassword) e.target.style.borderColor = "rgba(100,75,140,0.35)";
                    e.target.style.boxShadow = "none";
                  }}
                />
              </div>
              {fieldErrors.confirmPassword && <p style={{ color: "#f87171", fontSize: "10px", marginTop: "6px", marginLeft: "4px" }}>{fieldErrors.confirmPassword}</p>}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || success}
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: "12px",
                background: success
                  ? "linear-gradient(135deg, #22c55e, #16a34a)"
                  : "linear-gradient(135deg, #c084fc, #a855f7)",
                color: "white",
                fontWeight: 800,
                fontSize: "14px",
                letterSpacing: "0.1em",
                border: "none",
                cursor: loading || success ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                marginBottom: "24px",
                boxShadow: "0 8px 30px rgba(168,85,247,0.35)",
                transition: "all 0.2s",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? (
                <>
                  <span style={{ display: "inline-block", width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }}></span>
                  CREATING ACCOUNT...
                </>
              ) : success ? (
                <>✓ ACCOUNT CREATED</>
              ) : (
                <>SIGN UP</>
              )}
            </button>
          </form>

          {/* Sign in link */}
          <div style={{ textAlign: "center" }}>
            <span style={{ color: "#8b7fa8", fontSize: "12px", letterSpacing: "0.04em" }}>ALREADY RANKED? </span>
            <Link
              href="/login"
              style={{
                color: "#c4a0e8",
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.04em",
                textDecoration: "underline",
                textUnderlineOffset: "3px",
              }}
            >
              SIGN IN
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        input::placeholder { color: #4a3f5c; }
        input:focus { border-color: #a855f7 !important; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ─── Mobile responsive ─── */
        @media (max-width: 600px) {
          .register-card {
            padding: 28px 20px !important;
            border-radius: 16px !important;
          }
          .register-title {
            font-size: 26px !important;
            margin-bottom: 20px !important;
          }
          .register-brand {
            font-size: clamp(20px, 5vw, 32px) !important;
            top: 3% !important;
          }
        }
        @media (max-width: 400px) {
          .register-card {
            padding: 22px 14px !important;
          }
          .register-title {
            font-size: 20px !important;
          }
        }
      `}</style>
    </div>
  );
}