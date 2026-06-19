"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loginUser, saveTokens, saveUser, persistCookies } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();

  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form state
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!identifier.trim() || !password.trim()) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      const data = await loginUser({ identifier: identifier.trim(), password });
      saveTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      await persistCookies({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      saveUser(data.user);
      setSuccess(true);
      // Redirect to dashboard home after successful login
      setTimeout(() => { window.location.href = "/home"; }, 500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
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
        flexDirection: "column",
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
            radial-gradient(ellipse at 75% 50%, rgba(120,50,180,0.12) 0%, transparent 55%),
            radial-gradient(ellipse at 25% 20%, rgba(100,60,200,0.06) 0%, transparent 50%),
            linear-gradient(180deg, rgba(10,8,18,0.3) 0%, rgba(15,12,28,0.9) 100%)
          `,
        }}
      />

      {/* Large decorative queen piece silhouette (right side) */}
      <div
        style={{
          position: "absolute",
          right: "-8%",
          top: "50%",
          transform: "translateY(-50%)",
          fontSize: "min(55vw, 800px)",
          lineHeight: 1,
          color: "rgba(120,80,180,0.06)",
          fontWeight: 900,
          userSelect: "none",
          pointerEvents: "none",
          zIndex: 1,
          fontFamily: "serif",
        }}
      >
        ♛
      </div>

      {/* Subtle grid overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(120,100,180,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(120,100,180,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
          zIndex: 0,
        }}
      />

      {/* Top right status */}
      <div style={{ position: "absolute", top: "32px", right: "32px", display: "flex", alignItems: "center", gap: "12px", zIndex: 10 }}>
        <div style={{ width: "60px", height: "1px", backgroundColor: "#b392d9", opacity: 0.5 }}></div>
        <span style={{ color: "#b392d9", fontSize: "10px", letterSpacing: "0.2em", fontWeight: 700 }}>SECURE CONNECTION</span>
      </div>

      {/* Bottom left coords */}
      <div style={{ position: "absolute", bottom: "32px", left: "32px", zIndex: 10 }}>
        <div style={{ color: "#8b7fa8", fontSize: "10px", letterSpacing: "0.2em", marginBottom: "8px", opacity: 0.7 }}>ELO 2800+ TIER</div>
        <div style={{ color: "#8b7fa8", fontSize: "10px", letterSpacing: "0.2em", opacity: 0.7 }}>GRANDMASTER REALM</div>
      </div>

      {/* Main Content */}
      <div style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", width: "100%", maxWidth: "440px", padding: "0 16px" }}>

        {/* Knight Icon */}
        <div style={{ marginBottom: "16px" }}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
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
        <h1 style={{
          fontSize: "38px",
          fontWeight: 900,
          letterSpacing: "0.04em",
          marginBottom: "6px",
          textAlign: "center",
          background: "linear-gradient(180deg, #ffffff 0%, #c4a0e8 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          lineHeight: 1.15,
        }}>
          CHESS
        </h1>
        <h2 style={{
          fontSize: "38px",
          fontWeight: 900,
          letterSpacing: "0.08em",
          marginBottom: "32px",
          textAlign: "center",
          background: "linear-gradient(180deg, #e0c8f8 0%, #a070d8 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          lineHeight: 1.15,
        }}>
          SKYSCRAPER
        </h2>

        {/* Card */}
        <div style={{
          width: "100%",
          backgroundColor: "rgba(18,14,30,0.82)",
          border: "1px solid rgba(140,110,180,0.3)",
          borderRadius: "20px",
          padding: "40px 36px",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: "0 30px 60px rgba(0,0,0,0.55), 0 0 80px rgba(120,60,180,0.08)",
          marginBottom: "32px",
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
              <span style={{ color: "#4ade80", fontSize: "12px", fontWeight: 600 }}>Login successful! Redirecting...</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Username */}
            <div style={{ marginBottom: "22px" }}>
              <label style={{ display: "block", color: "#b392d9", fontSize: "10px", fontWeight: 700, letterSpacing: "0.15em", marginBottom: "10px" }}>
                USERNAME
              </label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: "15px", top: "50%", transform: "translateY(-50%)", color: "#6b5b8a", pointerEvents: "none" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                </span>
                <input
                  id="identifier-input"
                  type="text"
                  placeholder="Enter your username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  disabled={loading || success}
                  style={{
                    width: "100%",
                    backgroundColor: "rgba(10,8,18,0.7)",
                    border: "1px solid rgba(100,75,140,0.35)",
                    borderRadius: "12px",
                    color: "#e8e0f0",
                    fontSize: "14px",
                    padding: "15px 15px 15px 44px",
                    outline: "none",
                    fontFamily: "'Inter', sans-serif",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                    boxSizing: "border-box",
                    opacity: loading || success ? 0.5 : 1,
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "#a855f7";
                    e.target.style.boxShadow = "0 0 0 3px rgba(168,85,247,0.1)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "rgba(100,75,140,0.35)";
                    e.target.style.boxShadow = "none";
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", color: "#b392d9", fontSize: "10px", fontWeight: 700, letterSpacing: "0.15em", marginBottom: "10px" }}>
                PASSWORD
              </label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: "15px", top: "50%", transform: "translateY(-50%)", color: "#6b5b8a", pointerEvents: "none" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                </span>
                <input
                  id="password-input"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading || success}
                  style={{
                    width: "100%",
                    backgroundColor: "rgba(10,8,18,0.7)",
                    border: "1px solid rgba(100,75,140,0.35)",
                    borderRadius: "12px",
                    color: "#e8e0f0",
                    fontSize: "14px",
                    padding: "15px 44px 15px 44px",
                    outline: "none",
                    fontFamily: "'Inter', sans-serif",
                    letterSpacing: "0.1em",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                    boxSizing: "border-box",
                    opacity: loading || success ? 0.5 : 1,
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "#a855f7";
                    e.target.style.boxShadow = "0 0 0 3px rgba(168,85,247,0.1)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "rgba(100,75,140,0.35)";
                    e.target.style.boxShadow = "none";
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", color: showPassword ? "#c4a0e8" : "#5a4f6c", background: "none", border: "none", cursor: "pointer", padding: "4px" }}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  )}
                </button>
              </div>
            </div>

            {/* Options */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }} onClick={() => setRemember(!remember)}>
                <div style={{
                  width: "16px", height: "16px",
                  border: remember ? "1px solid #c4a0e8" : "1px solid #3a2f50",
                  backgroundColor: remember ? "rgba(168,85,247,0.15)" : "transparent",
                  borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.2s"
                }}>
                  {remember && <span style={{ color: "#c4a0e8", fontSize: "12px", lineHeight: 1 }}>✓</span>}
                </div>
                <span style={{ color: "#8b7fa8", fontSize: "10px", fontWeight: 600, letterSpacing: "0.1em" }}>REMEMBER ME</span>
              </div>
              <a href="#" style={{ color: "#c4a0e8", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textDecoration: "none" }}>
                FORGOT PASSWORD?
              </a>
            </div>

            {/* Submit Button */}
            <button
              id="login-submit-btn"
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
                fontSize: "13px",
                letterSpacing: "0.15em",
                border: "none",
                cursor: loading || success ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                marginBottom: "28px",
                boxShadow: "0 8px 30px rgba(168,85,247,0.35)",
                transition: "all 0.2s",
                opacity: loading ? 0.8 : 1,
              }}
            >
              {loading ? (
                <>
                  <span style={{ display: "inline-block", width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }}></span>
                  SIGNING IN...
                </>
              ) : success ? (
                <>✓ LOGGED IN</>
              ) : (
                <>LOGIN</>
              )}
            </button>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
              <div style={{ flex: 1, height: "1px", backgroundColor: "rgba(100,75,140,0.3)" }}></div>
              <span style={{ color: "#6b5b8a", fontSize: "9px", fontWeight: 700, letterSpacing: "0.15em" }}>CHESS PLATFORM</span>
              <div style={{ flex: 1, height: "1px", backgroundColor: "rgba(100,75,140,0.3)" }}></div>
            </div>

            {/* Social Logins */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <button type="button" style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                padding: "12px", backgroundColor: "rgba(17,14,24,0.8)", border: "1px solid rgba(100,75,140,0.3)", borderRadius: "10px",
                color: "#d1c4e0", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer",
                transition: "background-color 0.2s"
              }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(60,40,80,0.4)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "rgba(17,14,24,0.8)")}
              >
                <div style={{ width: "6px", height: "6px", backgroundColor: "#5865F2", borderRadius: "50%", boxShadow: "0 0 8px #5865F2" }}></div>
                DISCORD
              </button>
              <button type="button" style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                padding: "12px", backgroundColor: "rgba(17,14,24,0.8)", border: "1px solid rgba(100,75,140,0.3)", borderRadius: "10px",
                color: "#d1c4e0", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer",
                transition: "background-color 0.2s"
              }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(60,40,80,0.4)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "rgba(17,14,24,0.8)")}
              >
                <div style={{ width: "6px", height: "6px", backgroundColor: "#4285F4", borderRadius: "50%", boxShadow: "0 0 8px #4285F4" }}></div>
                GOOGLE
              </button>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <span style={{ color: "#8b7fa8", fontSize: "11px", letterSpacing: "0.05em" }}>Don&apos;t have an account? </span>
          <Link href="/register" style={{ color: "#c4a0e8", fontSize: "11px", fontWeight: 700, letterSpacing: "0.05em", textDecoration: "none" }}>
            Create Account
          </Link>
        </div>

        {/* Bottom technical text */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "28px", opacity: 0.4 }}>
          <span style={{ color: "#b392d9", fontSize: "10px", fontWeight: 600, letterSpacing: "0.12em" }}>SECURE • ENCRYPTED</span>
          <span style={{ color: "#b392d9", fontSize: "10px", fontWeight: 600, letterSpacing: "0.12em" }}>ELO RATED</span>
          <span style={{ color: "#b392d9", fontSize: "10px", fontWeight: 600, letterSpacing: "0.12em" }}>FAIR PLAY</span>
        </div>
      </div>

      <style>{`
        input::placeholder { color: #4a3f5c; }
        input:focus { border-color: #a855f7 !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}