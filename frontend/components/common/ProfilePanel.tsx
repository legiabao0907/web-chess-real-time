"use client";

import React, { useRef, useEffect } from "react";
import {
  X,
  User,
  Edit3,
  BarChart2,
  Users,
  Camera,
  Check,
  Loader2,
  Zap,
  Timer,
  Wind,
  Trophy,
  Star,
  Globe,
  Calendar,
  TrendingUp,
  MessageCircle,
  History,
} from "lucide-react";
import { useProfileStore } from "@/store/useProfileStore";
import { useChatStore } from "@/store/useChatStore";
import "./ProfilePanel.css";

// ─── Tab definitions ─────────────────────────────────────────────────────────
const TABS = [
  { id: "overview" as const, label: "Overview", icon: User },
  { id: "dashboard" as const, label: "Dashboard", icon: BarChart2 },
  { id: "edit" as const, label: "Edit Profile", icon: Edit3 },
  { id: "history" as const, label: "History", icon: History },
  { id: "friends" as const, label: "Friends", icon: Users },
];

// ─── Elo Tier Color ────────────────────────────────────────────────────────
function eloColor(elo: number): string {
  if (elo >= 2000) return "#f59e0b";
  if (elo >= 1600) return "#8b5cf6";
  if (elo >= 1300) return "#3b82f6";
  return "#6b7280";
}

function eloTier(elo: number): string {
  if (elo >= 2000) return "MASTER";
  if (elo >= 1600) return "EXPERT";
  if (elo >= 1300) return "INTER";
  return "BEGINNER";
}

// ─── Win Rate Bar ──────────────────────────────────────────────────────────
function WinRateBar({ wins = 0, losses = 0, draws = 0 }: { wins?: number; losses?: number; draws?: number }) {
  const total = wins + losses + draws || 1;
  const wPct = Math.round((wins / total) * 100);
  const lPct = Math.round((losses / total) * 100);
  const dPct = 100 - wPct - lPct;
  return (
    <div className="pp-winrate">
      <div className="pp-winrate-bar">
        <div className="pp-winrate-seg pp-winrate-w" style={{ width: `${wPct}%` }} title={`Win ${wPct}%`} />
        <div className="pp-winrate-seg pp-winrate-d" style={{ width: `${dPct}%` }} title={`Draw ${dPct}%`} />
        <div className="pp-winrate-seg pp-winrate-l" style={{ width: `${lPct}%` }} title={`Loss ${lPct}%`} />
      </div>
      <div className="pp-winrate-labels">
        <span className="pp-wr-win">{wPct}% W</span>
        <span className="pp-wr-draw">{dPct}% D</span>
        <span className="pp-wr-loss">{lPct}% L</span>
      </div>
    </div>
  );
}

// ─── Overview Tab ──────────────────────────────────────────────────────────
function OverviewTab() {
  const profile = useProfileStore((s) => s.profile);
  if (!profile) return null;

  const eloBlitz = profile.eloBlitz ?? 1200;
  const eloRapid = profile.eloRapid ?? 1200;
  const eloBullet = profile.eloBullet ?? 1150;

  return (
    <div className="pp-tab-content">
      {/* Hero avatar + name */}
      <div className="pp-hero">
        <AvatarDisplay />
        <div className="pp-hero-info">
          <h2 className="pp-username">{profile.username}</h2>
          <p className="pp-email">{profile.email}</p>
          {profile.bio && <p className="pp-bio">{profile.bio}</p>}
          <div className="pp-meta-row">
            {profile.country && (
              <span className="pp-meta-chip">
                <Globe size={12} /> {profile.country}
              </span>
            )}
            {profile.joinedAt && (
              <span className="pp-meta-chip">
                <Calendar size={12} /> {new Date(profile.joinedAt).getFullYear()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ELO Cards */}
      <div className="pp-section-title">
        <Star size={14} />
        ELO RATINGS
      </div>
      <div className="pp-elo-grid">
        <EloCard icon={<Zap size={18} />} label="Blitz" elo={eloBlitz} color={eloColor(eloBlitz)} />
        <EloCard icon={<Timer size={18} />} label="Rapid" elo={eloRapid} color={eloColor(eloRapid)} />
        <EloCard icon={<Wind size={18} />} label="Bullet" elo={eloBullet} color={eloColor(eloBullet)} />
      </div>

      {/* Win rate */}
      <div className="pp-section-title">
        <TrendingUp size={14} />
        WIN RATE
      </div>
      <WinRateBar wins={profile.wins} losses={profile.losses} draws={profile.draws} />

      {/* Quick stats */}
      <div className="pp-stats-row">
        <div className="pp-stat-chip">
          <span className="pp-stat-val">{profile.totalGames ?? 0}</span>
          <span className="pp-stat-lbl">GAMES</span>
        </div>
        <div className="pp-stat-chip">
          <span className="pp-stat-val" style={{ color: "#22c55e" }}>{profile.wins ?? 0}</span>
          <span className="pp-stat-lbl">WINS</span>
        </div>
        <div className="pp-stat-chip">
          <span className="pp-stat-val" style={{ color: "#ef4444" }}>{profile.losses ?? 0}</span>
          <span className="pp-stat-lbl">LOSSES</span>
        </div>
        <div className="pp-stat-chip">
          <span className="pp-stat-val" style={{ color: "#f59e0b" }}>{profile.draws ?? 0}</span>
          <span className="pp-stat-lbl">DRAWS</span>
        </div>
      </div>
    </div>
  );
}

// ─── EloCard ───────────────────────────────────────────────────────────────
function EloCard({ icon, label, elo, color }: { icon: React.ReactNode; label: string; elo: number; color: string }) {
  return (
    <div className="pp-elo-card" style={{ borderColor: color + "30" }}>
      <div className="pp-elo-icon" style={{ color }}>
        {icon}
      </div>
      <span className="pp-elo-label">{label}</span>
      <span className="pp-elo-value" style={{ color }}>{elo}</span>
      <span className="pp-elo-tier" style={{ color: color + "aa" }}>{eloTier(elo)}</span>
    </div>
  );
}

// ─── Dashboard Tab ─────────────────────────────────────────────────────────
function DashboardTab() {
  const profile = useProfileStore((s) => s.profile);
  if (!profile) return null;

  const points = [
    { month: "Oct", elo: 1100 },
    { month: "Nov", elo: 1180 },
    { month: "Dec", elo: 1150 },
    { month: "Jan", elo: 1250 },
    { month: "Feb", elo: 1320 },
    { month: "Mar", elo: profile.eloBlitz ?? 1200 },
  ];

  const maxElo = Math.max(...points.map((p) => p.elo));
  const minElo = Math.min(...points.map((p) => p.elo));
  const range = maxElo - minElo || 1;
  const svgW = 280;
  const svgH = 120;

  const ptsStr = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * svgW;
      const y = svgH - ((p.elo - minElo) / range) * (svgH - 20) - 10;
      return `${x},${y}`;
    })
    .join(" ");

  const areaStr = `0,${svgH} ` + ptsStr + ` ${svgW},${svgH}`;

  return (
    <div className="pp-tab-content">
      <div className="pp-section-title">
        <TrendingUp size={14} />
        ELO HISTORY (6 months)
      </div>

      <div className="pp-chart-card">
        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="pp-chart-svg" preserveAspectRatio="none">
          <defs>
            <linearGradient id="eloGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={areaStr} fill="url(#eloGrad)" />
          <polyline points={ptsStr} fill="none" stroke="#a855f7" strokeWidth="2" strokeLinejoin="round" />
          {points.map((p, i) => {
            const x = (i / (points.length - 1)) * svgW;
            const y = svgH - ((p.elo - minElo) / range) * (svgH - 20) - 10;
            return <circle key={i} cx={x} cy={y} r="4" fill="#a855f7" />;
          })}
        </svg>
        <div className="pp-chart-labels">
          {points.map((p) => (
            <span key={p.month}>{p.month}</span>
          ))}
        </div>
      </div>

      {/* Performance summary */}
      <div className="pp-section-title" style={{ marginTop: "1.5rem" }}>
        <Trophy size={14} />
        PERFORMANCE
      </div>
      <div className="pp-perf-grid">
        <div className="pp-perf-card">
          <span className="pp-perf-num">{Math.round(((profile.wins ?? 0) / (profile.totalGames || 1)) * 100)}%</span>
          <span className="pp-perf-lbl">Win Rate</span>
        </div>
        <div className="pp-perf-card">
          <span className="pp-perf-num">{Math.max(profile.eloBlitz ?? 0, profile.eloRapid ?? 0, profile.eloBullet ?? 0)}</span>
          <span className="pp-perf-lbl">Peak ELO</span>
        </div>
        <div className="pp-perf-card">
          <span className="pp-perf-num">{profile.totalGames ?? 0}</span>
          <span className="pp-perf-lbl">Games</span>
        </div>
        <div className="pp-perf-card">
          <span className="pp-perf-num">{profile.draws ?? 0}</span>
          <span className="pp-perf-lbl">Draws</span>
        </div>
      </div>

      <WinRateBar wins={profile.wins} losses={profile.losses} draws={profile.draws} />
    </div>
  );
}

// ─── Edit Tab ──────────────────────────────────────────────────────────────
function EditTab() {
  const { editForm, updateEditForm, saveProfile, isSaving, uploadAvatar } = useProfileStore();
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="pp-tab-content">
      <div className="pp-section-title">
        <Edit3 size={14} />
        EDIT PROFILE
      </div>

      {/* Avatar upload */}
      <div className="pp-avatar-upload-wrap">
        <div className="pp-avatar-upload-preview">
          {editForm.avatarUrl ? (
            <img src={editForm.avatarUrl} alt="avatar" className="pp-avatar-img-large" />
          ) : (
            <div className="pp-avatar-placeholder-large">
              <User size={40} color="#a855f7" />
            </div>
          )}
          <button className="pp-avatar-camera-btn" onClick={() => fileRef.current?.click()}>
            <Camera size={16} />
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="pp-hidden-input"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadAvatar(f);
          }}
        />
        <p className="pp-avatar-hint">Click camera icon to change photo</p>
      </div>

      {/* Form fields */}
      <div className="pp-edit-form">
        <div className="pp-field">
          <label className="pp-field-label">USERNAME</label>
          <input
            className="pp-field-input"
            value={editForm.username ?? ""}
            onChange={(e) => updateEditForm({ username: e.target.value })}
            placeholder="Your username"
          />
        </div>

        <div className="pp-field">
          <label className="pp-field-label">BIO</label>
          <textarea
            className="pp-field-input pp-field-textarea"
            value={editForm.bio ?? ""}
            onChange={(e) => updateEditForm({ bio: e.target.value })}
            placeholder="Tell us about yourself..."
            rows={3}
          />
        </div>

        <div className="pp-field">
          <label className="pp-field-label">COUNTRY</label>
          <input
            className="pp-field-input"
            value={editForm.country ?? ""}
            onChange={(e) => updateEditForm({ country: e.target.value })}
            placeholder="e.g. Vietnam"
          />
        </div>

        <button className="pp-save-btn" onClick={saveProfile} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 size={16} className="pp-spin" /> Saving...
            </>
          ) : (
            <>
              <Check size={16} /> Save Changes
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Friends Tab ───────────────────────────────────────────────────────────
function FriendsTab() {
  const profile = useProfileStore((s) => s.profile);
  const { closeProfile } = useProfileStore();
  const { openChat, onlineUsers } = useChatStore();
  const friends = profile?.friends ?? [];

  const handleChat = (friendId: string, friendUsername: string) => {
    closeProfile();
    openChat(friendId, friendUsername);
  };

  return (
    <div className="pp-tab-content">
      <div className="pp-section-title">
        <Users size={14} />
        FRIENDS ({friends.length})
      </div>
      {friends.length === 0 ? (
        <div className="pp-empty-state">
          <Users size={32} opacity={0.3} />
          <p>No friends yet</p>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", marginTop: "4px" }}>
            Add friends by clicking their profile during a game
          </p>
        </div>
      ) : (
        <div className="pp-friends-list">
          {friends.map((f) => {
            const isOnline = onlineUsers.has(f.id);
            return (
              <div key={f.id} className="pp-friend-card">
                <div className="pp-friend-avatar">
                  {f.avatarUrl ? (
                    <img src={f.avatarUrl} alt={f.username} />
                  ) : (
                    <img
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${f.username}`}
                      alt={f.username}
                      style={{ width: "100%", height: "100%", borderRadius: "50%" }}
                    />
                  )}
                  <span className={`pp-online-dot ${isOnline ? "online" : "offline"}`} />
                </div>
                <div className="pp-friend-info">
                  <span className="pp-friend-name">{f.username}</span>
                  <span className="pp-friend-elo" style={{ color: eloColor(f.eloBlitz) }}>
                    {f.eloBlitz} Blitz
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      fontSize: "11px",
                      color: isOnline ? "#22c55e" : "rgba(255,255,255,0.3)",
                      minWidth: "44px",
                      textAlign: "right",
                    }}
                  >
                    {isOnline ? "● Online" : "○ Offline"}
                  </span>
                  <button
                    onClick={() => handleChat(f.id, f.username)}
                    title="Send message"
                    style={{
                      background: "rgba(168,85,247,0.15)",
                      border: "1px solid rgba(168,85,247,0.3)",
                      borderRadius: "8px",
                      color: "#a855f7",
                      cursor: "pointer",
                      padding: "5px 8px",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "11px",
                      fontWeight: 600,
                      transition: "all 0.2s",
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "rgba(168,85,247,0.3)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "rgba(168,85,247,0.15)";
                    }}
                  >
                    <MessageCircle size={12} />
                    Chat
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── History Tab ───────────────────────────────────────────────────────────
function HistoryTab() {
  const [games, setGames] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const profile = useProfileStore((s) => s.profile);

  React.useEffect(() => {
    const fetchHistory = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";
        const token = localStorage.getItem("accessToken");
        const res = await fetch(`${API_URL}/game/history`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setGames(data.slice(0, 10)); // Show last 10
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  if (loading) return (
    <div className="pp-loading">
      <Loader2 size={24} className="pp-spin" color="#a855f7" />
    </div>
  );

  return (
    <div className="pp-tab-content">
      <div className="pp-section-title">
        <History size={14} />
        RECENT GAMES
      </div>
      {games.length === 0 ? (
        <div className="pp-empty-state">
          <History size={32} opacity={0.2} />
          <p>No games played yet</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {games.map((g) => {
            const isWhite = g.whiteId === profile?.id;
            const isWinner = g.winnerId === profile?.id;
            const isDraw = g.status === "draw";
            return (
              <div key={g.id} className="pp-game-item">
                <div className="pp-game-meta">
                  <span className="pp-game-tc">{g.timeControl.split("_")[0]}</span>
                  <span className="pp-game-date">{new Date(g.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="pp-game-players">
                  <span style={{ color: isWhite ? "#a855f7" : "white" }}>{g.whiteUsername}</span>
                  <span style={{ opacity: 0.3 }}>vs</span>
                  <span style={{ color: !isWhite ? "#a855f7" : "white" }}>{g.blackUsername}</span>
                </div>
                <div className={`pp-game-result ${isDraw ? "draw" : isWinner ? "win" : "loss"}`}>
                  {isDraw ? "½" : isWinner ? "+1" : "-1"}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <a href="/archives" style={{
        display: "block",
        textAlign: "center",
        marginTop: "1rem",
        color: "#a855f7",
        fontSize: "12px",
        textDecoration: "none",
        fontWeight: 600
      }}>
        VIEW FULL ARCHIVES →
      </a>
    </div>
  );
}

// ─── Avatar Display ─────────────────────────────────────────────────────────
function AvatarDisplay() {
  const profile = useProfileStore((s) => s.profile);
  return (
    <div className="pp-avatar-wrap">
      {profile?.avatarUrl ? (
        <img src={profile.avatarUrl} alt="avatar" className="pp-avatar-img" />
      ) : (
        <div className="pp-avatar-fallback">
          <User size={36} color="#a855f7" />
        </div>
      )}
    </div>
  );
}

// ─── Main Panel ────────────────────────────────────────────────────────────
export default function ProfilePanel() {
  const { isOpen, closeProfile, activeTab, setActiveTab, isLoading } = useProfileStore();
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on overlay click
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) closeProfile();
  };

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeProfile(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeProfile]);

  return (
    <>
      {/* Overlay */}
      <div
        ref={overlayRef}
        className={`pp-overlay ${isOpen ? "pp-overlay-visible" : ""}`}
        onClick={handleOverlayClick}
      />

      {/* Panel */}
      <div className={`pp-panel ${isOpen ? "pp-panel-open" : ""}`}>
        {/* Panel Header */}
        <div className="pp-header">
          <span className="pp-header-title">MY PROFILE</span>
          <button className="pp-close-btn" onClick={closeProfile}>
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="pp-tabs">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`pp-tab ${activeTab === tab.id ? "pp-tab-active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="pp-body">
          {isLoading ? (
            <div className="pp-loading">
              <Loader2 size={32} className="pp-spin" color="#a855f7" />
              <p>Loading profile...</p>
            </div>
          ) : (
            <>
              {activeTab === "overview" && <OverviewTab />}
              {activeTab === "dashboard" && <DashboardTab />}
              {activeTab === "edit" && <EditTab />}
              {activeTab === "history" && <HistoryTab />}
              {activeTab === "friends" && <FriendsTab />}
            </>
          )}
        </div>
      </div>
    </>
  );
}
