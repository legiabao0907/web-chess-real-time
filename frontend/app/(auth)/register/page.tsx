"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { registerUser, saveTokens, saveUser, persistCookies } from "@/lib/auth";

const archetypes = [
  { id: "king", icon: "♚", label: "THE KING", sub: "STRATEGIC" },
  { id: "queen", icon: "♛", label: "THE QUEEN", sub: "VERSATILE" },
  { id: "knight", icon: "♞", label: "THE KNIGHT", sub: "TACTICAL" },
];

export default function ObsidianUltraPage() {
  const router = useRouter();

  const [selected, setSelected] = useState("queen");
  const [accepted, setAccepted] = useState(false);

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
    else if (username.trim().length < 3) errs.username = "Min 3 characters";
    if (!email.trim()) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Invalid email";
    if (!password) errs.password = "Password is required";
    else if (password.length < 6) errs.password = "Min 6 characters";
    if (password !== confirmPassword) errs.confirmPassword = "Passwords do not match";
    if (!accepted) errs.terms = "You must accept the terms";
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
      setError(err instanceof Error ? err.message : "Đăng ký thất bại");
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
      }}
    >
      {/* Background */}
      <Image
        src="/chess-bg.png"
        alt="Chess background"
        fill
        style={{ objectFit: "cover", objectPosition: "center", opacity: 1 }}
        priority
      />
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} />

      {/* Subtle grid */}
      <div
        style={{
          position: "absolute", inset: 0, opacity: 0.04,
          backgroundImage: "linear-gradient(#a855f7 1px, transparent 1px), linear-gradient(90deg, #a855f7 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Bottom left status */}
      <div style={{ position: "absolute", bottom: "24px", left: "24px", fontSize: "10px", color: "#4a3f5c", letterSpacing: "0.15em", lineHeight: "1.8", zIndex: 10 }}>
        <div>SYSTEM_STATUS: <span style={{ color: "#22c55e" }}>ONLINE</span></div>
        <div>ELITE_NODES: <span style={{ color: "#7c3aed" }}>128_CONNECTED</span></div>
        <div>VERSION: <span style={{ color: "#7c3aed" }}>2.0.4-ULTRA</span></div>
      </div>

      {/* Sound wave bottom right */}
      <div style={{ position: "absolute", bottom: "32px", right: "24px", display: "flex", alignItems: "flex-end", gap: "3px", zIndex: 10 }}>
        {[12, 20, 28, 20, 35, 15, 25, 18].map((h, i) => (
          <div key={i} style={{ width: "3px", height: `${h}px`, backgroundColor: "rgba(168,85,247,0.4)", borderRadius: "9999px", animation: `pulse 1.5s ease-in-out ${i * 0.1}s infinite` }} />
        ))}
      </div>

      {/* Main layout */}
      <div style={{ position: "relative", zIndex: 10, minHeight: "100vh", display: "flex", alignItems: "stretch" }}>

        {/* ─── LEFT PANEL ─── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "48px 80px", maxWidth: "560px" }}>
          {/* Badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", border: "1px solid rgba(124,58,237,0.40)", borderRadius: "9999px", padding: "6px 16px", marginBottom: "32px", width: "fit-content", backgroundColor: "rgba(124,58,237,0.10)" }}>
            <svg style={{ width: "12px", height: "12px", color: "#a855f7", fill: "currentColor" }} viewBox="0 0 20 20">
              <path d="M9 2a7 7 0 100 14A7 7 0 009 2zm0 2a5 5 0 110 10A5 5 0 019 4zm-.5 2.5v3l2 1.5 1-1.7-1.5-1V6.5h-1.5z" />
            </svg>
            <span style={{ color: "#a855f7", fontSize: "11px", fontWeight: 700, letterSpacing: "0.2em" }}>GRANDMASTER TIER</span>
          </div>

          {/* Title */}
          <div style={{ marginBottom: "24px" }}>
            <div style={{ fontSize: "80px", fontWeight: 900, lineHeight: 0.9, letterSpacing: "-0.03em", color: "#ffffff" }}>OBSIDIAN</div>
            <div style={{ fontSize: "80px", fontWeight: 900, lineHeight: 0.9, letterSpacing: "-0.03em", color: "#e040fb" }}>ULTRA</div>
          </div>

          <p style={{ color: "#8b7fa8", fontSize: "15px", lineHeight: 1.6, marginBottom: "40px", maxWidth: "340px" }}>
            Join the Pantheon of Grandmasters in the most exclusive digital arena ever forged.
          </p>

          {/* Features */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px", marginBottom: "40px" }}>
            {[
              {
                icon: <svg style={{ width: "20px", height: "20px", color: "#a855f7" }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
                title: "DEEP BLUE NEURAL", desc: "Predictive move analysis powered by a decentralized quantum engine.",
              },
              {
                icon: <svg style={{ width: "20px", height: "20px", color: "#a855f7" }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
                title: "GRANDMASTER PROTOCOL", desc: "Immutable blockchain verification for every move, in every match.",
              },
            ].map((f, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "12px", backgroundColor: "#1a1028", border: "1px solid rgba(124,58,237,0.30)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {f.icon}
                </div>
                <div>
                  <div style={{ color: "white", fontWeight: 700, fontSize: "13px", letterSpacing: "0.1em", marginBottom: "4px" }}>{f.title}</div>
                  <div style={{ color: "#8b7fa8", fontSize: "13px", lineHeight: 1.5 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Featured in */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <span style={{ color: "#4a3f5c", fontSize: "11px", letterSpacing: "0.15em" }}>FEATURED IN:</span>
            {["◎", "⬡", "✦"].map((sym, i) => (
              <span key={i} style={{ color: "#5a4f6c", fontSize: "18px", cursor: "pointer", transition: "color 0.2s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#a855f7")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#5a4f6c")}>
                {sym}
              </span>
            ))}
          </div>
        </div>

        {/* ─── RIGHT PANEL ─── */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 32px" }}>
          <div style={{ width: "100%", maxWidth: "520px", backgroundColor: "rgba(19,16,30,0.92)", border: "1px solid #2a2040", borderRadius: "16px", padding: "32px", backdropFilter: "blur(8px)", boxShadow: "0 25px 50px rgba(0,0,0,0.5)" }}>

            {/* Header */}
            <div style={{ marginBottom: "28px" }}>
              <h2 style={{ color: "white", fontSize: "30px", fontWeight: 900, marginBottom: "8px" }}>Claim Your Rank</h2>
              <p style={{ color: "#8b7fa8", fontSize: "14px" }}>The board is set. Select your archetype to begin.</p>
            </div>

            {/* Error Banner */}
            {error && (
              <div style={{ backgroundColor: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "10px", padding: "12px 16px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ color: "#f87171", fontSize: "14px" }}>⚠</span>
                <span style={{ color: "#f87171", fontSize: "13px", fontWeight: 600 }}>{error}</span>
              </div>
            )}

            {/* Success Banner */}
            {success && (
              <div style={{ backgroundColor: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: "10px", padding: "12px 16px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ color: "#4ade80", fontSize: "14px" }}>✓</span>
                <span style={{ color: "#4ade80", fontSize: "13px", fontWeight: 600 }}>Đăng ký thành công! Đang vào hệ thống...</span>
              </div>
            )}

            {/* Archetype Selector */}
            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", color: "#a855f7", fontSize: "11px", fontWeight: 700, letterSpacing: "0.2em", marginBottom: "12px" }}>
                SELECT YOUR ARCHETYPE
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
                {archetypes.map((a) => (
                  <button
                    key={a.id}
                    id={`archetype-${a.id}`}
                    type="button"
                    onClick={() => setSelected(a.id)}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center",
                      padding: "20px 12px", borderRadius: "12px",
                      border: selected === a.id ? "1px solid #a855f7" : "1px solid #2a2040",
                      backgroundColor: selected === a.id ? "rgba(168,85,247,0.10)" : "#0f0d1a",
                      boxShadow: selected === a.id ? "0 0 20px rgba(168,85,247,0.15)" : "none",
                      cursor: "pointer", transition: "all 0.2s",
                    }}
                  >
                    <span style={{ fontSize: "28px", marginBottom: "8px", color: selected === a.id ? "#a855f7" : "#5a4f6c" }}>{a.icon}</span>
                    <span style={{ fontSize: "11px", fontWeight: 900, letterSpacing: "0.1em", color: selected === a.id ? "white" : "#8b7fa8" }}>{a.label}</span>
                    <span style={{ fontSize: "10px", letterSpacing: "0.15em", marginTop: "2px", color: selected === a.id ? "#a855f7" : "#4a3f5c" }}>{a.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                {/* Username */}
                <div>
                  <label style={{ display: "block", color: "#8b7fa8", fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", marginBottom: "8px" }}>
                    GRANDMASTER ALIAS
                  </label>
                  <input
                    id="alias-input"
                    type="text"
                    placeholder="MAGNUS_X"
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); setFieldErrors(p => ({ ...p, username: "" })); }}
                    disabled={loading || success}
                    style={{
                      width: "100%", backgroundColor: "transparent",
                      borderBottom: fieldErrors.username ? "1px solid #ef4444" : "1px solid #2a2040",
                      color: "white", fontSize: "14px", padding: "8px 0", outline: "none",
                      opacity: loading || success ? 0.6 : 1,
                    }}
                  />
                  {fieldErrors.username && <p style={{ color: "#f87171", fontSize: "10px", marginTop: "4px" }}>{fieldErrors.username}</p>}
                </div>

                {/* Email */}
                <div>
                  <label style={{ display: "block", color: "#8b7fa8", fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", marginBottom: "8px" }}>
                    SECURE COMMS (EMAIL)
                  </label>
                  <input
                    id="email-input"
                    type="email"
                    placeholder="vault@obsidian.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setFieldErrors(p => ({ ...p, email: "" })); }}
                    disabled={loading || success}
                    style={{
                      width: "100%", backgroundColor: "transparent",
                      borderBottom: fieldErrors.email ? "1px solid #ef4444" : "1px solid #2a2040",
                      color: "white", fontSize: "14px", padding: "8px 0", outline: "none", fontFamily: "monospace",
                      opacity: loading || success ? 0.6 : 1,
                    }}
                  />
                  {fieldErrors.email && <p style={{ color: "#f87171", fontSize: "10px", marginTop: "4px" }}>{fieldErrors.email}</p>}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "28px" }}>
                {/* Password */}
                <div>
                  <label style={{ display: "block", color: "#8b7fa8", fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", marginBottom: "8px" }}>
                    ACCESS KEY
                  </label>
                  <input
                    id="password-input"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setFieldErrors(p => ({ ...p, password: "" })); }}
                    disabled={loading || success}
                    style={{
                      width: "100%", backgroundColor: "transparent",
                      borderBottom: fieldErrors.password ? "1px solid #ef4444" : "1px solid #2a2040",
                      color: "white", fontSize: "14px", padding: "8px 0", outline: "none", fontFamily: "monospace",
                      opacity: loading || success ? 0.6 : 1,
                    }}
                  />
                  {fieldErrors.password && <p style={{ color: "#f87171", fontSize: "10px", marginTop: "4px" }}>{fieldErrors.password}</p>}
                </div>

                {/* Confirm Password */}
                <div>
                  <label style={{ display: "block", color: "#8b7fa8", fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", marginBottom: "8px" }}>
                    VERIFY KEY
                  </label>
                  <input
                    id="confirm-password-input"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setFieldErrors(p => ({ ...p, confirmPassword: "" })); }}
                    disabled={loading || success}
                    style={{
                      width: "100%", backgroundColor: "transparent",
                      borderBottom: fieldErrors.confirmPassword ? "1px solid #ef4444" : "1px solid #2a2040",
                      color: "white", fontSize: "14px", padding: "8px 0", outline: "none", fontFamily: "monospace",
                      opacity: loading || success ? 0.6 : 1,
                    }}
                  />
                  {fieldErrors.confirmPassword && <p style={{ color: "#f87171", fontSize: "10px", marginTop: "4px" }}>{fieldErrors.confirmPassword}</p>}
                </div>
              </div>

              {/* Submit */}
              <button
                id="submit-btn"
                type="submit"
                disabled={loading || success}
                style={{
                  width: "100%", padding: "16px", borderRadius: "12px",
                  background: success
                    ? "linear-gradient(to right, #22c55e, #16a34a)"
                    : "linear-gradient(to right, #d946ef, #e679ea)",
                  color: "white", fontWeight: 900, fontSize: "13px", letterSpacing: "0.3em",
                  border: "none", cursor: loading || success ? "not-allowed" : "pointer",
                  marginBottom: "20px", boxShadow: "0 8px 25px rgba(168,85,247,0.25)",
                  transition: "opacity 0.15s, transform 0.15s",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                  opacity: loading ? 0.8 : 1,
                }}
                onMouseEnter={(e) => { if (!loading && !success) e.currentTarget.style.opacity = "0.9"; }}
                onMouseLeave={(e) => { if (!loading && !success) e.currentTarget.style.opacity = "1"; }}
              >
                {loading ? (
                  <>
                    <span style={{ display: "inline-block", width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }}></span>
                    INITIATING...
                  </>
                ) : success ? (
                  <>✓ WELCOME GRANDMASTER</>
                ) : (
                  <>INITIATE ENTRANCE</>
                )}
              </button>
            </form>

            {/* Terms */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", justifyContent: "center", marginBottom: fieldErrors.terms ? "8px" : "16px" }}>
              <button
                id="terms-checkbox"
                type="button"
                onClick={() => { setAccepted(!accepted); setFieldErrors(p => ({ ...p, terms: "" })); }}
                style={{
                  width: "20px", height: "20px", borderRadius: "4px",
                  border: fieldErrors.terms ? "1px solid #ef4444" : (accepted ? "1px solid #a855f7" : "1px solid #3a2f50"),
                  backgroundColor: accepted ? "rgba(168,85,247,0.20)" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer",
                }}
              >
                {accepted && <span style={{ color: "#e679ea", fontSize: "12px" }}>✓</span>}
              </button>
              <span style={{ color: "#4a3f5c", fontSize: "11px", letterSpacing: "0.15em" }}>
                I ACCEPT THE TERMS OF THE GRANDMASTER SANCTUARY
              </span>
            </div>
            {fieldErrors.terms && (
              <p style={{ color: "#f87171", fontSize: "10px", textAlign: "center", marginBottom: "16px" }}>{fieldErrors.terms}</p>
            )}

            {/* Sign in link */}
            <div style={{ textAlign: "center" }}>
              <span style={{ color: "#4a3f5c", fontSize: "11px", letterSpacing: "0.15em" }}>ALREADY RANKED? </span>
              <button
                id="signin-link"
                type="button"
                onClick={() => router.push("/login")}
                style={{
                  color: "#e679ea", fontSize: "11px", fontWeight: 700, letterSpacing: "0.15em",
                  textDecoration: "underline", textUnderlineOffset: "2px",
                  background: "none", border: "none", cursor: "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#d946ef")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#e679ea")}
              >
                SIGN IN
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; transform: scaleY(0.8); }
          50% { opacity: 1; transform: scaleY(1); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: #3a2f50; }
        input:focus { border-bottom-color: #a855f7 !important; caret-color: #a855f7; }
      `}</style>
    </div>
  );
}