"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import {
  Trophy, ArrowLeft, Play, SkipForward, Swords, Crown,
  Clock, Users, ChevronRight, Loader2, CheckCircle2, Circle,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { getUser } from "@/lib/auth";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Participant { userId: string; username: string; points: number; rank: number | null; }
interface TournamentGame {
  gameId: string; round: number;
  whiteId: string; whiteUsername: string;
  blackId: string; blackUsername: string;
  status: "pending" | "active" | "finished";
  result: "white" | "black" | "draw" | null;
  whitePoints?: number; blackPoints?: number;
}
interface TournamentRound {
  tournamentId: string; round: number;
  games: TournamentGame[];
  status: "active" | "finished";
}
interface TournamentDetail {
  id: string; name: string; format: string;
  status: "upcoming" | "ongoing" | "finished";
  timeControl: string; startTime: string | null;
  creatorId: string; creatorUsername: string;
  participants: Participant[];
  currentRound: number;
}

const TC: Record<string, string> = {
  bullet_1: "Bullet 1+0", blitz_3: "Blitz 3+0", blitz_5: "Blitz 5+0",
  rapid_10: "Rapid 10+0", rapid_15_10: "Rapid 15+10",
};
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const user = getUser();

  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [rounds, setRounds] = useState<TournamentRound[]>([]);
  const [activeRound, setActiveRound] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ msg: string; gameId?: string } | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const notify = (msg: string, gameId?: string) => {
    setNotification({ msg, gameId });
    setTimeout(() => setNotification(null), 6000);
  };

  // ── REST fetch ──────────────────────────────────────────────────────────────
  const fetchState = useCallback(async () => {
    try {
      const [t, r] = await Promise.all([
        apiFetch<TournamentDetail>(`/tournament/${id}`),
        apiFetch<TournamentRound[]>(`/tournament/${id}/rounds`),
      ]);
      setTournament(t);
      setRounds(r);
      if (r.length > 0) setActiveRound(r.length - 1);
    } catch {}
  }, [id]);

  useEffect(() => { fetchState(); }, [fetchState]);

  // ── WebSocket ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const sock = io(`${API}/tournament`, { transports: ["websocket", "polling"] });
    socketRef.current = sock;

    sock.on("connect", () => {
      if (user) sock.emit("tournament_identify", { userId: user.id });
      sock.emit("join_tournament_room", { userId: user?.id ?? "", tournamentId: id });
    });

    sock.on("tournament_state", (data: { tournament: TournamentDetail; rounds: TournamentRound[] }) => {
      setTournament(data.tournament);
      setRounds(data.rounds);
      if (data.rounds.length > 0) setActiveRound(data.rounds.length - 1);
    });

    sock.on("tournament_update", (data: any) => {
      if (data.tournament) setTournament(data.tournament);
      if (data.rounds) {
        setRounds(data.rounds);
        setActiveRound(data.rounds.length - 1);
      }
      if (data.type === "tournament_started") notify("🏆 Tournament started! Round 1 pairings are ready.");
      if (data.type === "next_round") notify(`⚔️ Round ${data.rounds?.length} has started!`);
    });

    sock.on("tournament_game_ready", (data: any) => {
      notify(
        `♟ Your game is ready! You play ${data.yourColor === "white" ? "⬜ White" : "⬛ Black"} vs ${data.opponentUsername}`,
        data.gameId,
      );
    });

    return () => { sock.disconnect(); };
  }, [id, user?.id]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleJoin = async () => {
    setActionLoading("join");
    try {
      await apiFetch(`/tournament/${id}/join`, { method: "POST" });
      await fetchState();
    } catch (e: any) { alert(e.message); }
    finally { setActionLoading(null); }
  };

  const handleLeave = async () => {
    setActionLoading("leave");
    try {
      await apiFetch(`/tournament/${id}/leave`, { method: "DELETE" });
      await fetchState();
    } catch (e: any) { alert(e.message); }
    finally { setActionLoading(null); }
  };

  const handleStart = async () => {
    setActionLoading("start");
    try {
      await apiFetch(`/tournament/${id}/start`, { method: "PATCH" });
      await fetchState();
    } catch (e: any) { alert(e.message); }
    finally { setActionLoading(null); }
  };

  const handleNextRound = async () => {
    setActionLoading("next");
    try {
      await apiFetch(`/tournament/${id}/next-round`, { method: "PATCH" });
      await fetchState();
    } catch (e: any) { alert(e.message); }
    finally { setActionLoading(null); }
  };

  const handleFinish = async () => {
    if (!confirm("End this tournament?")) return;
    setActionLoading("finish");
    try {
      await apiFetch(`/tournament/${id}/finish`, { method: "PATCH" });
      await fetchState();
    } catch (e: any) { alert(e.message); }
    finally { setActionLoading(null); }
  };

  if (!tournament) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "80vh" }}>
      <Loader2 size={36} color="#a855f7" style={{ animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const isCreator = user?.id === tournament.creatorId;
  const isJoined = tournament.participants.some(p => p.userId === user?.id);
  const currentRound = rounds[activeRound];
  const allFinished = currentRound?.games.every(g => g.status === "finished");

  return (
    <div style={{ padding: "28px 36px", minHeight: "100%", background: "linear-gradient(180deg,#0a0a12,#0d0d1a)", color: "white", fontFamily: "Inter,sans-serif" }}>
      {/* Notification */}
      {notification && (
        <div style={{
          position: "fixed", top: "24px", right: "24px", zIndex: 9999,
          background: "linear-gradient(135deg,#1a0f2e,#2d1f4e)", border: "1px solid rgba(168,85,247,0.5)",
          borderRadius: "14px", padding: "14px 20px", maxWidth: "340px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)", display: "flex", flexDirection: "column", gap: "10px",
        }}>
          <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.9)" }}>{notification.msg}</p>
          {notification.gameId && (
            <button onClick={() => router.push(`/play?gameId=${notification.gameId}`)}
              style={{ background: "linear-gradient(135deg,#a855f7,#7c3aed)", border: "none", borderRadius: "8px", color: "white", padding: "8px 14px", cursor: "pointer", fontWeight: 700, fontSize: "12px" }}>
              Go to Game →
            </button>
          )}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "28px" }}>
        <button onClick={() => router.push("/tournaments")}
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", color: "rgba(255,255,255,0.7)", cursor: "pointer", padding: "8px 10px", display: "flex" }}>
          <ArrowLeft size={16} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Trophy size={22} color="#a855f7" />
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 800 }}>{tournament.name}</h1>
            <StatusBadge status={tournament.status} />
          </div>
          <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginTop: "4px", display: "flex", gap: "14px" }}>
            <span><Crown size={10} style={{ marginRight: 4, verticalAlign: "middle" }} />{tournament.creatorUsername}</span>
            <span><Clock size={10} style={{ marginRight: 4, verticalAlign: "middle" }} />{TC[tournament.timeControl] ?? tournament.timeControl}</span>
            <span><Users size={10} style={{ marginRight: 4, verticalAlign: "middle" }} />{tournament.participants.length} players</span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "8px" }}>
          {user && tournament.status === "upcoming" && (
            isJoined ? (
              <Btn onClick={handleLeave} loading={actionLoading === "leave"} color="#ef4444" variant="outline">
                Leave Tournament
              </Btn>
            ) : (
              <Btn onClick={handleJoin} loading={actionLoading === "join"} color="#a855f7">
                Join Tournament
              </Btn>
            )
          )}

          {/* Creator actions */}
          {isCreator && (
            <>
              {tournament.status === "upcoming" && (
                <Btn onClick={handleStart} loading={actionLoading === "start"} color="#22c55e" icon={<Play size={14} />}>
                  Start Tournament
                </Btn>
              )}
              {tournament.status === "ongoing" && allFinished && (
                <Btn onClick={handleNextRound} loading={actionLoading === "next"} color="#a855f7" icon={<SkipForward size={14} />}>
                  Next Round
                </Btn>
              )}
              {tournament.status === "ongoing" && (
                <Btn onClick={handleFinish} loading={actionLoading === "finish"} color="#ef4444" variant="outline">
                  End Tournament
                </Btn>
              )}
            </>
          )}
        </div>
      </div>

      {/* Body: 2-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "20px", alignItems: "start" }}>

        {/* Left: Rounds */}
        <div>
          {tournament.status === "upcoming" ? (
            <EmptyState icon={<Swords size={40} />} title="Waiting to start" desc={isCreator ? "Click 'Start Tournament' to generate Round 1 pairings." : "Waiting for the organizer to start the tournament."} />
          ) : rounds.length === 0 ? (
            <EmptyState icon={<Loader2 size={40} style={{ animation: "spin 1s linear infinite" }} />} title="Loading rounds..." desc="" />
          ) : (
            <>
              {/* Round tabs */}
              <div style={{ display: "flex", gap: "4px", marginBottom: "16px", flexWrap: "wrap" }}>
                {rounds.map((r, i) => (
                  <button key={i} onClick={() => setActiveRound(i)} style={{
                    padding: "6px 16px", borderRadius: "8px", fontWeight: 600, fontSize: "12px", cursor: "pointer", border: "none",
                    background: activeRound === i ? "rgba(168,85,247,0.25)" : "rgba(255,255,255,0.05)",
                    color: activeRound === i ? "#a855f7" : "rgba(255,255,255,0.5)",
                    outline: activeRound === i ? "1px solid rgba(168,85,247,0.4)" : "none",
                  }}>
                    Round {r.round}
                    {r.status === "finished" && <CheckCircle2 size={10} style={{ marginLeft: 5, color: "#22c55e", verticalAlign: "middle" }} />}
                    {r.status === "active" && <Circle size={10} style={{ marginLeft: 5, color: "#f59e0b", verticalAlign: "middle" }} />}
                  </button>
                ))}
              </div>

              {/* Current round pairings */}
              {currentRound && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {currentRound.games.map((game) => (
                    <GameCard key={game.gameId} game={game} userId={user?.id} onPlay={() => router.push(`/play?gameId=${game.gameId}`)} />
                  ))}
                </div>
              )}

              {/* Next round hint */}
              {isCreator && tournament.status === "ongoing" && allFinished && (
                <div style={{ marginTop: "18px", padding: "14px 18px", background: "rgba(168,85,247,0.07)", border: "1px solid rgba(168,85,247,0.25)", borderRadius: "12px", fontSize: "13px", color: "rgba(255,255,255,0.7)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>✅ All games in this round are finished.</span>
                  <button onClick={handleNextRound} disabled={!!actionLoading}
                    style={{ background: "linear-gradient(135deg,#a855f7,#7c3aed)", border: "none", borderRadius: "8px", color: "white", padding: "8px 16px", cursor: "pointer", fontWeight: 700, fontSize: "12px" }}>
                    {actionLoading === "next" ? "Generating..." : "Start Next Round →"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right: Leaderboard */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "18px" }}>
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", fontWeight: 700, marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Standings
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {[...tournament.participants]
              .map(p => {
                let livePoints = p.points ?? 0;
                rounds.forEach(r => {
                  if (r.status === "active") {
                    r.games.forEach(g => {
                      if (g.status === "finished") {
                        if (g.whiteId === p.userId) livePoints += (g.whitePoints ?? 0);
                        if (g.blackId === p.userId) livePoints += (g.blackPoints ?? 0);
                      }
                    });
                  }
                });
                return { ...p, livePoints };
              })
              .sort((a, b) => b.livePoints - a.livePoints)
              .map((p, i) => (
                <div key={p.userId} style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "8px 10px", borderRadius: "8px",
                  background: p.userId === user?.id ? "rgba(168,85,247,0.12)" : "transparent",
                  border: p.userId === user?.id ? "1px solid rgba(168,85,247,0.3)" : "1px solid transparent",
                }}>
                  <span style={{ width: "18px", textAlign: "center", fontWeight: 700, fontSize: "12px", color: ["#f59e0b", "#9ca3af", "#b45309"][i] ?? "rgba(255,255,255,0.3)" }}>
                    {i + 1}
                  </span>
                  <span style={{ flex: 1, fontSize: "13px", fontWeight: p.userId === user?.id ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.username}
                  </span>
                  <span style={{ fontSize: "13px", color: "#a855f7", fontWeight: 700, flexShrink: 0 }}>{p.livePoints}</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── GameCard ─────────────────────────────────────────────────────────────────
function GameCard({ game, userId, onPlay }: { game: TournamentGame; userId?: string; onPlay: () => void }) {
  const isBye = game.blackId === "BYE";
  const isMyGame = game.whiteId === userId || game.blackId === userId;
  const resultLabel = isBye ? "BYE +1pt"
    : game.result === "white" ? `${game.whiteUsername} wins`
    : game.result === "black" ? `${game.blackUsername} wins`
    : game.result === "draw" ? "Draw"
    : null;

  return (
    <div style={{
      background: isMyGame ? "rgba(168,85,247,0.08)" : "rgba(255,255,255,0.03)",
      border: `1px solid ${isMyGame ? "rgba(168,85,247,0.35)" : "rgba(255,255,255,0.07)"}`,
      borderRadius: "12px", padding: "14px 18px",
      display: "flex", alignItems: "center", gap: "12px",
    }}>
      {/* Status dot */}
      <div style={{
        width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0,
        background: game.status === "finished" ? "#22c55e" : game.status === "active" ? "#f59e0b" : "rgba(255,255,255,0.2)",
      }} />

      {/* Players */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <PlayerLabel name={game.whiteUsername} color="white" isMe={game.whiteId === userId}
          pts={game.status === "finished" ? game.whitePoints : undefined} />
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "11px", fontWeight: 700 }}>vs</span>
        <PlayerLabel name={isBye ? "BYE" : game.blackUsername} color="black" isMe={game.blackId === userId}
          pts={game.status === "finished" && !isBye ? game.blackPoints : undefined} />
      </div>

      {/* Result / Play button */}
      <div style={{ flexShrink: 0 }}>
        {resultLabel ? (
          <span style={{ fontSize: "12px", color: "#4ade80", fontWeight: 600 }}>{resultLabel}</span>
        ) : isMyGame && !isBye ? (
          <button onClick={onPlay} style={{
            background: "linear-gradient(135deg,#a855f7,#7c3aed)", border: "none",
            borderRadius: "8px", color: "white", padding: "7px 14px",
            cursor: "pointer", fontWeight: 700, fontSize: "12px",
            display: "flex", alignItems: "center", gap: "5px",
          }}>
            <Play size={12} /> Play
          </button>
        ) : (
          <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)" }}>
            {game.status === "pending" ? "Pending" : "In progress"}
          </span>
        )}
      </div>
    </div>
  );
}

function PlayerLabel({ name, color, isMe, pts }: { name: string; color: "white" | "black"; isMe?: boolean; pts?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <span style={{
        width: "14px", height: "14px", borderRadius: "3px", flexShrink: 0,
        background: color === "white" ? "#fff" : "#1a1a1a",
        border: "1px solid rgba(255,255,255,0.2)",
      }} />
      <span style={{ fontSize: "13px", fontWeight: isMe ? 700 : 400, color: isMe ? "#c084fc" : "white" }}>
        {name}
      </span>
      {pts !== undefined && (
        <span style={{ fontSize: "11px", color: pts > 0 ? "#4ade80" : "rgba(255,255,255,0.4)", fontWeight: 600 }}>
          +{pts}pt
        </span>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const MAP = {
    upcoming: { bg: "rgba(59,130,246,0.15)", color: "#60a5fa", label: "Upcoming" },
    ongoing:  { bg: "rgba(34,197,94,0.15)",  color: "#4ade80", label: "Live" },
    finished: { bg: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.4)", label: "Finished" },
  };
  const s = MAP[status as keyof typeof MAP] ?? MAP.upcoming;
  return <span style={{ background: s.bg, color: s.color, borderRadius: "8px", padding: "3px 10px", fontSize: "11px", fontWeight: 700 }}>{s.label}</span>;
}

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,0.3)" }}>
      <div style={{ marginBottom: "16px", opacity: 0.4 }}>{icon}</div>
      <p style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px", color: "rgba(255,255,255,0.6)" }}>{title}</p>
      {desc && <p style={{ fontSize: "13px" }}>{desc}</p>}
    </div>
  );
}

function Btn({ children, onClick, loading, color, icon, variant }: {
  children: React.ReactNode; onClick: () => void; loading?: boolean;
  color: string; icon?: React.ReactNode; variant?: "outline";
}) {
  const isOutline = variant === "outline";
  return (
    <button onClick={onClick} disabled={loading} style={{
      display: "flex", alignItems: "center", gap: "6px",
      padding: "9px 16px", borderRadius: "10px", fontWeight: 700, fontSize: "13px", cursor: loading ? "not-allowed" : "pointer",
      border: isOutline ? `1px solid ${color}40` : "none",
      background: isOutline ? `${color}15` : `linear-gradient(135deg,${color},${color}cc)`,
      color: isOutline ? color : "white", opacity: loading ? 0.6 : 1,
    }}>
      {loading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : icon}
      {children}
    </button>
  );
}
