"use client";

import { useState } from "react";
import Image from "next/image";
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
      setError("Vui lòng điền đầy đủ thông tin");
      return;
    }

    setLoading(true);
    try {
      const data = await loginUser({ identifier: identifier.trim(), password });
      saveTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      await persistCookies({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      saveUser(data.user);
      setSuccess(true);
      // Chuyển về trang dashboard home sau khi login thành công
      setTimeout(() => router.push("/home"), 500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        backgroundColor: "#0d0b12",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Background chess image */}
      <Image
        src="/chess-bg.png"
        alt="Chess background"
        fill
        style={{ objectFit: "cover", objectPosition: "center", opacity: 0.5 }}
        priority
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, rgba(13,11,18,0.7) 0%, rgba(13,11,18,0.95) 100%)",
        }}
      />

      {/* Top right status */}
      <div style={{ position: "absolute", top: "32px", right: "32px", display: "flex", alignItems: "center", gap: "12px", zIndex: 10 }}>
        <div style={{ width: "60px", height: "1px", backgroundColor: "#a855f7", opacity: 0.5 }}></div>
        <span style={{ color: "#a855f7", fontSize: "10px", letterSpacing: "0.2em", fontWeight: 700 }}>SYSTEM_STABLE</span>
      </div>

      {/* Bottom left coords */}
      <div style={{ position: "absolute", bottom: "32px", left: "32px", zIndex: 10 }}>
        <div style={{ color: "#a855f7", fontSize: "10px", letterSpacing: "0.2em", marginBottom: "8px", opacity: 0.8 }}>LAT: 41.5871 N</div>
        <div style={{ color: "#a855f7", fontSize: "10px", letterSpacing: "0.2em", opacity: 0.8 }}>LON: 8.1278 W</div>
      </div>

      {/* Main Content */}
      <div style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", width: "100%", maxWidth: "420px", padding: "0 16px" }}>

        {/* Logo */}
        <div style={{
          width: "56px", height: "56px",
          backgroundColor: "rgba(30,22,48,0.6)",
          borderRadius: "14px",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: "24px",
          border: "1px solid rgba(168,85,247,0.15)",
          backdropFilter: "blur(8px)"
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px" }}>
            <div style={{ width: "10px", height: "10px", backgroundColor: "#a855f7", borderRadius: "2px" }}></div>
            <div style={{ width: "10px", height: "10px", backgroundColor: "#a855f7", borderRadius: "2px" }}></div>
            <div style={{ width: "10px", height: "10px", backgroundColor: "#a855f7", borderRadius: "2px" }}></div>
            <div style={{ width: "10px", height: "10px", backgroundColor: "#a855f7", borderRadius: "2px" }}></div>
          </div>
        </div>

        {/* Title */}
        <h1 style={{ fontSize: "32px", fontWeight: 900, color: "#fff", letterSpacing: "0.05em", marginBottom: "8px", textAlign: "center" }}>
          OBSIDIAN <span style={{ color: "#e679ea" }}>ULTRA</span>
        </h1>

        <p style={{ color: "#fb923c", fontSize: "12px", fontWeight: 700, letterSpacing: "0.15em", marginBottom: "36px", textAlign: "center" }}>
          ESTABLISH ENCRYPTION CHANNEL
        </p>

        {/* Card */}
        <div style={{
          width: "100%",
          backgroundColor: "rgba(19,16,30,0.85)",
          border: "1px solid rgba(42,32,64,0.6)",
          borderRadius: "16px",
          padding: "36px 32px",
          backdropFilter: "blur(12px)",
          boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
          marginBottom: "32px"
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
              <span style={{ color: "#4ade80", fontSize: "12px", fontWeight: 600 }}>Đăng nhập thành công! Đang chuyển hướng...</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Email / Username */}
            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", color: "#a855f7", fontSize: "10px", fontWeight: 700, letterSpacing: "0.15em", marginBottom: "10px" }}>
                GRANDMASTER ID / EMAIL
              </label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#5a4f6c" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                </span>
                <input
                  id="identifier-input"
                  type="text"
                  placeholder="GM_MAGNUS_99 hoặc email@domain.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  disabled={loading || success}
                  style={{
                    width: "100%",
                    backgroundColor: "rgba(13,11,18,0.8)",
                    border: "1px solid #2a2040",
                    borderRadius: "10px",
                    color: "white",
                    fontSize: "14px",
                    padding: "14px 14px 14px 40px",
                    outline: "none",
                    fontFamily: "monospace",
                    transition: "border-color 0.2s",
                    boxSizing: "border-box",
                    opacity: loading || success ? 0.6 : 1,
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", color: "#a855f7", fontSize: "10px", fontWeight: 700, letterSpacing: "0.15em", marginBottom: "10px" }}>
                ACCESS KEY
              </label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#5a4f6c" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                </span>
                <input
                  id="password-input"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading || success}
                  style={{
                    width: "100%",
                    backgroundColor: "rgba(13,11,18,0.8)",
                    border: "1px solid #2a2040",
                    borderRadius: "10px",
                    color: "white",
                    fontSize: "14px",
                    padding: "14px 40px 14px 40px",
                    outline: "none",
                    fontFamily: "monospace",
                    letterSpacing: "0.15em",
                    transition: "border-color 0.2s",
                    boxSizing: "border-box",
                    opacity: loading || success ? 0.6 : 1,
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", color: showPassword ? "#a855f7" : "#5a4f6c", background: "none", border: "none", cursor: "pointer" }}
                >
                  {showPassword ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  )}
                </button>
              </div>
            </div>

            {/* Options */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }} onClick={() => setRemember(!remember)}>
                <div style={{
                  width: "16px", height: "16px",
                  border: remember ? "1px solid #a855f7" : "1px solid #3a2f50",
                  backgroundColor: remember ? "rgba(168,85,247,0.15)" : "transparent",
                  borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.2s"
                }}>
                  {remember && <span style={{ color: "#e679ea", fontSize: "12px", lineHeight: 1 }}>✓</span>}
                </div>
                <span style={{ color: "#8b7fa8", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em" }}>REMEMBER SESSION</span>
              </div>
              <a href="#" style={{ color: "#c084fc", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textDecoration: "none" }}>
                FORGOT ENCRYPTION?
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
                borderRadius: "10px",
                background: success
                  ? "linear-gradient(to right, #22c55e, #16a34a)"
                  : "linear-gradient(to right, #d946ef, #c084fc)",
                color: "white",
                fontWeight: 800,
                fontSize: "12px",
                letterSpacing: "0.2em",
                border: "none",
                cursor: loading || success ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                marginBottom: "28px",
                boxShadow: "0 8px 25px rgba(168,85,247,0.25)",
                transition: "all 0.2s",
                opacity: loading ? 0.8 : 1,
              }}
            >
              {loading ? (
                <>
                  <span style={{ display: "inline-block", width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }}></span>
                  AUTHENTICATING...
                </>
              ) : success ? (
                <>✓ ACCESS GRANTED</>
              ) : (
                <>
                  INITIATE PROTOCOL
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5-4 5-4l3 3"></path></svg>
                </>
              )}
            </button>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
              <div style={{ flex: 1, height: "1px", backgroundColor: "rgba(42,32,64,0.8)" }}></div>
              <span style={{ color: "#5a4f6c", fontSize: "9px", fontWeight: 700, letterSpacing: "0.15em" }}>FEDERATION LOGIN</span>
              <div style={{ flex: 1, height: "1px", backgroundColor: "rgba(42,32,64,0.8)" }}></div>
            </div>

            {/* Social Logins */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <button type="button" style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                padding: "12px", backgroundColor: "rgba(17,14,24,0.8)", border: "1px solid rgba(42,32,64,0.8)", borderRadius: "10px",
                color: "white", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer",
                transition: "background-color 0.2s"
              }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(42,32,64,0.4)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "rgba(17,14,24,0.8)")}
              >
                <div style={{ width: "6px", height: "6px", backgroundColor: "#5865F2", borderRadius: "50%", boxShadow: "0 0 8px #5865F2" }}></div>
                DISCORD
              </button>
              <button type="button" style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                padding: "12px", backgroundColor: "rgba(17,14,24,0.8)", border: "1px solid rgba(42,32,64,0.8)", borderRadius: "10px",
                color: "white", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", cursor: "pointer",
                transition: "background-color 0.2s"
              }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(42,32,64,0.4)")}
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
          <span style={{ color: "#8b7fa8", fontSize: "11px", letterSpacing: "0.1em" }}>NEW TO THE SANCTUARY? </span>
          <Link href="/register" style={{ color: "#e679ea", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textDecoration: "none" }}>
            RECRUIT PROTOCOL
          </Link>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "32px", opacity: 0.5 }}>
          <span style={{ color: "#a855f7", fontSize: "10px", fontStyle: "italic", fontWeight: 700, letterSpacing: "0.15em" }}>FDECOMPLIANT</span>
          <span style={{ color: "#a855f7", fontSize: "10px", fontStyle: "italic", fontWeight: 700, letterSpacing: "0.15em" }}>QUANTUMSECURE</span>
          <span style={{ color: "#a855f7", fontSize: "10px", fontStyle: "italic", fontWeight: 700, letterSpacing: "0.15em" }}>NEURALLINKREADY</span>
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