"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  X,
  UserPlus,
  UserCheck,
  UserX,
  MessageCircle,
  Swords,
  Globe,
  Calendar,
  Zap,
  Timer,
  Wind,
  TrendingUp,
  Clock,
  Loader2,
  Users,
} from "lucide-react";
import { useProfileStore, PublicProfile } from "@/store/useProfileStore";
import { useFriendStore, FriendshipStatus } from "@/store/useFriendStore";
import { useChatStore } from "@/store/useChatStore";
import { useRouter } from "next/navigation";
import "./PublicProfilePanel.css";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

interface GameRecord {
  id: string;
  whiteId: string | null;
  blackId: string | null;
  whiteUsername: string;
  blackUsername: string;
  winnerId: string | null;
  status: string;
  timeControl: string;
  createdAt: string;
}

interface H2HStats {
  myWins: number;
  theirWins: number;
  draws: number;
  total: number;
}

function computeH2H(games: GameRecord[], myId: string, theirId: string): H2HStats {
  const h2h = games.filter(
    (g) =>
      (g.whiteId === myId || g.blackId === myId) &&
      (g.whiteId === theirId || g.blackId === theirId),
  );

  let myWins = 0;
  let theirWins = 0;
  let draws = 0;

  for (const g of h2h) {
    if (g.status === "draw") {
      draws++;
    } else if (g.winnerId === myId) {
      myWins++;
    } else if (g.winnerId === theirId) {
      theirWins++;
    } else {
      // resigned/finished with no winner counted (shouldn't happen often)
      draws++;
    }
  }

  return { myWins, theirWins, draws, total: h2h.length };
}

// ─── FriendActionButtons ─────────────────────────────────────────────────────

function FriendActionButtons({
  targetId,
  targetUsername,
  myId,
}: {
  targetId: string;
  targetUsername: string;
  myId: string | undefined;
}) {
  const {
    checkFriendship,
    sendFriendRequest,
    acceptRequest,
    declineRequest,
    removeFriend,
    actionLoading,
    friendshipCache,
  } = useFriendStore();
  const { openChat } = useChatStore();
  const { closePublicProfile } = useProfileStore();
  const router = useRouter();

  const [status, setStatus] = useState<FriendshipStatus | null>(null);
  const isLoading = actionLoading[targetId];

  // Determine if viewing own profile
  const isSelf = myId === targetId;

  useEffect(() => {
    if (!myId || isSelf) return;
    if (friendshipCache[targetId]) {
      setStatus(friendshipCache[targetId]);
      return;
    }
    checkFriendship(targetId).then(setStatus);
  }, [targetId, myId, friendshipCache, isSelf]);

  const handleMessage = () => {
    closePublicProfile();
    openChat(targetId, targetUsername);
  };

  const handleChallenge = () => {
    closePublicProfile();
    router.push("/play");
  };

  const handleAddFriend = async () => {
    await sendFriendRequest(targetId);
    setStatus("pending_sent");
  };

  const handleAccept = async () => {
    await acceptRequest(targetId);
    setStatus("friends");
  };

  const handleDecline = async () => {
    await declineRequest(targetId);
    setStatus("none");
  };

  const handleRemove = async () => {
    await removeFriend(targetId);
    setStatus("none");
  };

  if (isSelf) return null;

  return (
    <div className="ppp-actions">
      {/* Friend status button */}
      {status === null && (
        <button className="ppp-btn ppp-btn-ghost ppp-actions-full" disabled>
          <Loader2 size={13} className="ppp-spin" /> Loading...
        </button>
      )}

      {status === "none" && (
        <button
          className="ppp-btn ppp-btn-primary ppp-actions-full"
          onClick={handleAddFriend}
          disabled={isLoading}
        >
          {isLoading ? <Loader2 size={13} className="ppp-spin" /> : <UserPlus size={13} />}
          Add Friend
        </button>
      )}

      {status === "pending_sent" && (
        <button className="ppp-btn ppp-btn-disabled ppp-actions-full" disabled>
          <Clock size={13} /> Request Sent
        </button>
      )}

      {status === "pending_received" && (
        <>
          <button
            className="ppp-btn ppp-btn-success-solid"
            onClick={handleAccept}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 size={13} className="ppp-spin" /> : <UserCheck size={13} />}
            Accept
          </button>
          <button
            className="ppp-btn ppp-btn-danger-ghost"
            onClick={handleDecline}
            disabled={isLoading}
          >
            <UserX size={13} /> Decline
          </button>
        </>
      )}

      {status === "friends" && (
        <>
          <button className="ppp-btn ppp-btn-success" disabled>
            <UserCheck size={13} /> Friends ✓
          </button>
          <button
            className="ppp-btn ppp-btn-danger-ghost"
            onClick={handleRemove}
            disabled={isLoading}
          >
            {isLoading ? <Loader2 size={13} className="ppp-spin" /> : <UserX size={13} />}
            Remove
          </button>
        </>
      )}

      {/* Message & Challenge always shown (when not self) */}
      <button className="ppp-btn ppp-btn-purple-ghost" onClick={handleMessage}>
        <MessageCircle size={13} /> Message
      </button>
      <button className="ppp-btn ppp-btn-ghost" onClick={handleChallenge}>
        <Swords size={13} /> Challenge
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PublicProfilePanel({ myId }: { myId?: string }) {
  const { isPublicProfileOpen, isPublicProfileLoading, publicProfile, closePublicProfile } =
    useProfileStore();

  const [games, setGames] = useState<GameRecord[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePublicProfile();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closePublicProfile]);

  // Load public game history when profile changes
  const loadGames = useCallback(async (userId: string) => {
    setGamesLoading(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";
      const res = await fetch(`${API_URL}/game/history/${userId}`);
      if (res.ok) {
        const data: GameRecord[] = await res.json();
        setGames(data);
      }
    } catch {
      setGames([]);
    } finally {
      setGamesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (publicProfile?.id) {
      setGames([]);
      loadGames(publicProfile.id);
    }
  }, [publicProfile?.id, loadGames]);

  const profile = publicProfile;

  // ── H2H computation ──
  const h2h: H2HStats =
    profile && myId ? computeH2H(games, myId, profile.id) : { myWins: 0, theirWins: 0, draws: 0, total: 0 };

  const totalH2H = h2h.total || 1;
  const myPct = Math.round((h2h.myWins / totalH2H) * 100);
  const theirPct = Math.round((h2h.theirWins / totalH2H) * 100);
  const drawPct = 100 - myPct - theirPct;

  // ── Recent games (top 5 for this user) ──
  const recentGames = games.slice(0, 5);

  // ── Win rate overall ──
  const totalGames = (profile?.wins ?? 0) + (profile?.losses ?? 0) + (profile?.draws ?? 0) || 1;
  const wPct = Math.round(((profile?.wins ?? 0) / totalGames) * 100);
  const lPct = Math.round(((profile?.losses ?? 0) / totalGames) * 100);
  const dPct = 100 - wPct - lPct;

  const blitz = profile?.eloBlitz ?? 1200;
  const rapid = profile?.eloRapid ?? 1200;
  const bullet = profile?.eloBullet ?? 1150;

  return (
    <>
      {/* Overlay */}
      <div
        className={`ppp-overlay ${isPublicProfileOpen ? "ppp-overlay-visible" : ""}`}
        onClick={closePublicProfile}
      />

      {/* Panel */}
      <div className={`ppp-panel ${isPublicProfileOpen ? "ppp-panel-open" : ""}`}>
        {/* Header */}
        <div className="ppp-header">
          <span className="ppp-header-title">USER PROFILE</span>
          <button className="ppp-close-btn" onClick={closePublicProfile}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="ppp-body">
          {isPublicProfileLoading ? (
            <div className="ppp-loading">
              <Loader2 size={32} className="ppp-spin" color="#a855f7" />
              <p>Loading profile...</p>
            </div>
          ) : !profile ? (
            <div className="ppp-loading">
              <Users size={32} opacity={0.3} />
              <p>Profile not found</p>
            </div>
          ) : (
            <>
              {/* ── Hero ── */}
              <div className="ppp-hero">
                <div className="ppp-hero-top">
                  {/* Avatar */}
                  <div className="ppp-avatar-wrap">
                    <div className="ppp-avatar-inner">
                      <img
                        src={
                          profile.avatarUrl ||
                          `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username}`
                        }
                        alt={profile.username}
                      />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="ppp-hero-info">
                    <div className="ppp-username">{profile.username}</div>
                    <div className="ppp-elo-badge" style={{ color: eloColor(blitz) }}>
                      <Zap size={14} />
                      {blitz} Blitz
                      <span className="ppp-elo-tier-badge" style={{ color: eloColor(blitz), borderColor: `${eloColor(blitz)}40`, background: `${eloColor(blitz)}15` }}>
                        {eloTier(blitz)}
                      </span>
                    </div>
                    <div className="ppp-meta-chips">
                      {profile.country && (
                        <span className="ppp-meta-chip">
                          <Globe size={10} /> {profile.country}
                        </span>
                      )}
                      {profile.createdAt && (
                        <span className="ppp-meta-chip">
                          <Calendar size={10} /> Since {new Date(profile.createdAt).getFullYear()}
                        </span>
                      )}
                      <span className="ppp-meta-chip">
                        {profile.totalGames} games
                      </span>
                    </div>
                    {profile.bio && <p className="ppp-bio">{profile.bio}</p>}
                  </div>
                </div>

                {/* Action buttons */}
                <FriendActionButtons
                  targetId={profile.id}
                  targetUsername={profile.username}
                  myId={myId}
                />
              </div>

              {/* ── Stats ── */}
              <div className="ppp-section">
                <div className="ppp-section-title">
                  <TrendingUp size={12} /> STATS
                </div>

                <div className="ppp-stats-grid">
                  <div className="ppp-stat-card">
                    <span className="ppp-stat-val" style={{ color: "#22c55e" }}>
                      {profile.wins ?? 0}
                    </span>
                    <span className="ppp-stat-lbl">Wins</span>
                  </div>
                  <div className="ppp-stat-card">
                    <span className="ppp-stat-val" style={{ color: "#ef4444" }}>
                      {profile.losses ?? 0}
                    </span>
                    <span className="ppp-stat-lbl">Losses</span>
                  </div>
                  <div className="ppp-stat-card">
                    <span className="ppp-stat-val" style={{ color: "#f59e0b" }}>
                      {profile.draws ?? 0}
                    </span>
                    <span className="ppp-stat-lbl">Draws</span>
                  </div>
                </div>

                {/* ELO row */}
                <div className="ppp-elo-row">
                  <div className="ppp-elo-mini" style={{ borderColor: `${eloColor(blitz)}25` }}>
                    <Zap size={12} style={{ color: eloColor(blitz) }} />
                    <span className="ppp-elo-mini-label">Blitz</span>
                    <span className="ppp-elo-mini-val" style={{ color: eloColor(blitz) }}>{blitz}</span>
                  </div>
                  <div className="ppp-elo-mini" style={{ borderColor: `${eloColor(rapid)}25` }}>
                    <Timer size={12} style={{ color: eloColor(rapid) }} />
                    <span className="ppp-elo-mini-label">Rapid</span>
                    <span className="ppp-elo-mini-val" style={{ color: eloColor(rapid) }}>{rapid}</span>
                  </div>
                  <div className="ppp-elo-mini" style={{ borderColor: `${eloColor(bullet)}25` }}>
                    <Wind size={12} style={{ color: eloColor(bullet) }} />
                    <span className="ppp-elo-mini-label">Bullet</span>
                    <span className="ppp-elo-mini-val" style={{ color: eloColor(bullet) }}>{bullet}</span>
                  </div>
                </div>

                {/* Win rate bar */}
                <div className="ppp-winrate-bar">
                  <div className="ppp-wr-w" style={{ width: `${wPct}%` }} title={`Win ${wPct}%`} />
                  <div className="ppp-wr-d" style={{ width: `${dPct}%` }} title={`Draw ${dPct}%`} />
                  <div className="ppp-wr-l" style={{ width: `${lPct}%` }} title={`Loss ${lPct}%`} />
                </div>
                <div className="ppp-wr-labels">
                  <span style={{ color: "#22c55e" }}>{wPct}% W</span>
                  <span style={{ color: "#f59e0b" }}>{dPct}% D</span>
                  <span style={{ color: "#ef4444" }}>{lPct}% L</span>
                </div>
              </div>

              {/* ── Head-to-Head ── */}
              {myId && myId !== profile.id && (
                <div className="ppp-section">
                  <div className="ppp-section-title">
                    <Swords size={12} /> HEAD-TO-HEAD
                  </div>
                  <div className="ppp-h2h-card">
                    {h2h.total === 0 ? (
                      <div className="ppp-h2h-no-games">
                        No games played against each other yet
                      </div>
                    ) : (
                      <>
                        <div className="ppp-h2h-scores">
                          <div className="ppp-h2h-player">
                            <span className="ppp-h2h-player-name">You</span>
                            <span className="ppp-h2h-score me">{h2h.myWins}</span>
                          </div>
                          <span className="ppp-h2h-vs">VS</span>
                          <div className="ppp-h2h-player">
                            <span className="ppp-h2h-player-name">{profile.username}</span>
                            <span className="ppp-h2h-score them">{h2h.theirWins}</span>
                          </div>
                        </div>
                        {h2h.draws > 0 && (
                          <div className="ppp-h2h-draws">{h2h.draws} draw{h2h.draws > 1 ? "s" : ""}</div>
                        )}
                        <div className="ppp-h2h-bar">
                          <div className="ppp-h2h-me" style={{ width: `${myPct}%` }} />
                          <div className="ppp-h2h-draw" style={{ width: `${drawPct}%` }} />
                          <div className="ppp-h2h-them" style={{ width: `${theirPct}%` }} />
                        </div>
                        <div style={{ textAlign: "center", fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>
                          {h2h.total} game{h2h.total > 1 ? "s" : ""} played against each other
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* ── Recent Games ── */}
              <div className="ppp-section">
                <div className="ppp-section-title">
                  <Clock size={12} /> RECENT GAMES
                </div>
                {gamesLoading ? (
                  <div className="ppp-empty">
                    <Loader2 size={20} className="ppp-spin" color="#a855f7" />
                  </div>
                ) : recentGames.length === 0 ? (
                  <div className="ppp-empty">No games played yet</div>
                ) : (
                  <div className="ppp-games-list">
                    {recentGames.map((g) => {
                      const isWhite = g.whiteId === profile.id;
                      const isWinner = g.winnerId === profile.id;
                      const isDraw = g.status === "draw";
                      const result = isDraw ? "draw" : isWinner ? "win" : "loss";
                      const resultLabel = isDraw ? "½" : isWinner ? "W" : "L";

                      return (
                        <div key={g.id} className="ppp-game-item">
                          <span className="ppp-game-tc">
                            {g.timeControl.split("_")[0]}
                          </span>
                          <div className="ppp-game-players">
                            <span style={{ color: isWhite ? "#a855f7" : "rgba(255,255,255,0.7)" }}>
                              {g.whiteUsername}
                            </span>
                            <span className="ppp-game-sep">vs</span>
                            <span style={{ color: !isWhite ? "#a855f7" : "rgba(255,255,255,0.7)" }}>
                              {g.blackUsername}
                            </span>
                          </div>
                          <span className="ppp-game-date">
                            {new Date(g.createdAt).toLocaleDateString()}
                          </span>
                          <div className={`ppp-game-result ${result}`}>{resultLabel}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
