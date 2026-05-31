"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { Chess } from "chess.js";
import { useParams, useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { Flag, Handshake, ChevronLeft, ChevronRight, Trophy, Clock } from "lucide-react";
import { getUser, AuthUser } from "@/lib/auth";

const Chessboard: any = dynamic(
  () => import("react-chessboard").then((mod) => mod.Chessboard as any),
  { ssr: false }
);

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8080";
const TC_LABELS: Record<string, string> = {
  bullet_1: "Bullet 1+0", blitz_3: "Blitz 3+0", blitz_5: "Blitz 5+0",
  rapid_10: "Rapid 10+0", rapid_15_10: "Rapid 15+10",
};
const TIME_CONTROLS: Record<string, { baseMs: number; incrementMs: number }> = {
  bullet_1: { baseMs: 60_000, incrementMs: 0 },
  blitz_3: { baseMs: 3 * 60_000, incrementMs: 0 },
  blitz_5: { baseMs: 5 * 60_000, incrementMs: 0 },
  rapid_10: { baseMs: 10 * 60_000, incrementMs: 0 },
  rapid_15_10: { baseMs: 15 * 60_000, incrementMs: 10_000 },
};

interface GameState {
  gameId: string; fen: string; pgn: string;
  whiteId: string; blackId: string;
  whiteUsername: string; blackUsername: string;
  status: string; timeControl: string;
  whiteTimeMs: number; blackTimeMs: number;
  turn: "w" | "b"; winner?: string;
  moveHistory: string[]; lastMoveAt?: number;
  isTournament?: boolean; tournamentId?: string;
}

function formatMs(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m.toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

export default function TournamentGamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mounted, setMounted] = useState(false);
  const [game, setGame] = useState<GameState | null>(null);
  const [gameOver, setGameOver] = useState<{ status: string; winner?: string; message: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [drawOffered, setDrawOffered] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Move history navigation
  const [viewIndex, setViewIndex] = useState(-1); // -1 = live
  const [viewFen, setViewFen] = useState<string | null>(null);
  const moveHistoryRef = useRef<HTMLDivElement>(null);

  // Clocks
  const [whiteClock, setWhiteClock] = useState(0);
  const [blackClock, setBlackClock] = useState(0);

  useEffect(() => {
    setMounted(true);
    setUser(getUser());
  }, []);

  const isPlayerWhite = useMemo(() => game?.whiteId === user?.id, [game, user]);
  const isMyTurn = useMemo(() => {
    if (!game || !user) return false;
    return (game.turn === "w" && game.whiteId === user.id) ||
           (game.turn === "b" && game.blackId === user.id);
  }, [game, user]);

  // ── Socket connection ────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !gameId) return;

    const sock = io(`${BACKEND}/chess`, {
      transports: ["websocket", "polling"],
      reconnection: true,
    });
    socketRef.current = sock;

    sock.on("connect", () => {
      sock.emit("join_game", { gameId, userId: user.id, username: user.username });
    });

    sock.on("game_state", (data: any) => {
      setGame({ ...data, gameId: data.gameId ?? data.id });
      setWhiteClock(data.whiteTimeMs);
      setBlackClock(data.blackTimeMs);
      setViewIndex(-1);
    });

    sock.on("move_made", (data: any) => {
      setGame(prev => {
        if (!prev) return null;
        const updated = { ...prev, ...data, gameId: prev.gameId };
        setWhiteClock(updated.whiteTimeMs);
        setBlackClock(updated.blackTimeMs);
        return updated;
      });
      setViewIndex(-1);
    });

    sock.on("game_over", (data: any) => {
      setGame(prev => prev ? { ...prev, status: data.status, winner: data.winner } : null);
      setGameOver({ status: data.status, winner: data.winner, message: data.message });
    });

    sock.on("draw_offered", () => setDrawOffered(true));
    sock.on("draw_declined", () => setDrawOffered(false));

    sock.on("move_error", (data: any) => {
      setErrorMsg(data.error);
      setTimeout(() => setErrorMsg(null), 2500);
    });

    return () => { sock.disconnect(); };
  }, [user, gameId]);

  // ── Real-time clock countdown ────────────────────────────────────────────
  useEffect(() => {
    if (!game || game.status !== "active" || !game.lastMoveAt) return;
    const interval = setInterval(() => {
      const elapsed = Date.now() - game.lastMoveAt!;
      if (game.turn === "w") {
        setWhiteClock(Math.max(0, game.whiteTimeMs - elapsed));
      } else {
        setBlackClock(Math.max(0, game.blackTimeMs - elapsed));
      }
    }, 100);
    return () => clearInterval(interval);
  }, [game?.turn, game?.status, game?.lastMoveAt, game?.whiteTimeMs, game?.blackTimeMs]);

  // ── Move navigation ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!game) return;
    if (viewIndex === -1) { setViewFen(null); return; }
    try {
      const chess = new Chess();
      const moves = game.moveHistory.slice(0, viewIndex + 1);
      for (const san of moves) chess.move(san);
      setViewFen(chess.fen());
    } catch { setViewFen(game.fen); }
  }, [viewIndex, game?.moveHistory]);

  const displayFen = viewFen ?? game?.fen ?? "start";

  const goBack = useCallback(() => {
    if (!game) return;
    setViewIndex(i => i === -1 ? game.moveHistory.length - 2 : Math.max(-1, i - 1));
  }, [game]);

  const goForward = useCallback(() => {
    if (!game) return;
    setViewIndex(i => {
      const next = i + 1;
      return next >= game.moveHistory.length ? -1 : next;
    });
  }, [game]);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goBack();
      if (e.key === "ArrowRight") goForward();
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [goBack, goForward]);

  // ── Auto-scroll move history ──────────────────────────────────────────────
  useEffect(() => {
    if (moveHistoryRef.current) {
      moveHistoryRef.current.scrollTop = moveHistoryRef.current.scrollHeight;
    }
  }, [game?.moveHistory?.length]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const onDrop = useCallback((sourceSquare: string, targetSquare: string) => {
    if (!game || game.status !== "active" || !isMyTurn || viewIndex !== -1) return false;
    socketRef.current?.emit("make_move", { gameId, userId: user!.id, move: { from: sourceSquare, to: targetSquare } });
    return true;
  }, [game, isMyTurn, viewIndex, gameId, user]);

  const resign = () => {
    if (!confirm("Bạn chắc chắn muốn đầu hàng?")) return;
    socketRef.current?.emit("resign", { gameId, userId: user!.id });
  };

  const offerDraw = () => {
    socketRef.current?.emit("offer_draw", { gameId, userId: user!.id });
  };

  const acceptDraw = () => {
    setDrawOffered(false);
    socketRef.current?.emit("accept_draw", { gameId, userId: user!.id });
  };

  const declineDraw = () => {
    setDrawOffered(false);
    socketRef.current?.emit("decline_draw", { gameId });
  };

  const backToTournament = () => {
    if (game?.tournamentId) router.push(`/tournaments/${game.tournamentId}`);
    else router.push("/tournaments");
  };

  if (!mounted) return null;

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#0a0a12,#0d0d1a)", color: "white", fontFamily: "Inter,sans-serif", display: "flex", flexDirection: "column" }}>

      {/* Top bar */}
      <div style={{ padding: "12px 24px", borderBottom: "1px solid rgba(168,85,247,0.2)", display: "flex", alignItems: "center", gap: "14px", background: "rgba(168,85,247,0.05)" }}>
        <button onClick={backToTournament} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", color: "rgba(255,255,255,0.7)", cursor: "pointer", padding: "7px 14px", display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
          <Trophy size={14} /> Tournament
        </button>
        <div style={{ flex: 1, textAlign: "center" }}>
          <span style={{ color: "#a855f7", fontWeight: 700, fontSize: "13px" }}>
            ♟ Tournament Game
          </span>
          {game && <span style={{ marginLeft: "10px", fontSize: "12px", color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.07)", padding: "2px 8px", borderRadius: "6px" }}>
            {TC_LABELS[game.timeControl] ?? game.timeControl}
          </span>}
        </div>
        {errorMsg && <span style={{ color: "#ef4444", fontSize: "12px" }}>{errorMsg}</span>}
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "20px", gap: "24px", flexWrap: "wrap" }}>

        {/* Board column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "center" }}>

          {/* Top player (opponent) */}
          <PlayerBar
            username={isPlayerWhite ? (game?.blackUsername ?? "...") : (game?.whiteUsername ?? "...")}
            clockMs={isPlayerWhite ? blackClock : whiteClock}
            isActive={game?.status === "active" && (isPlayerWhite ? game.turn === "b" : game.turn === "w")}
            side={isPlayerWhite ? "black" : "white"}
          />

          {/* Board */}
          <div style={{ width: "min(520px, 90vw)", aspectRatio: "1", position: "relative" }}>
            {typeof window !== "undefined" && (
              <Chessboard
                position={displayFen}
                onPieceDrop={onDrop}
                boardOrientation={isPlayerWhite ? "white" : "black"}
                arePiecesDraggable={game?.status === "active" && isMyTurn && viewIndex === -1}
                animationDuration={120}
                customBoardStyle={{ borderRadius: "10px", boxShadow: "0 16px 48px rgba(0,0,0,0.7)" }}
                customDarkSquareStyle={{ backgroundColor: "#4a3728" }}
                customLightSquareStyle={{ backgroundColor: "#f0c080" }}
              />
            )}
            {/* Viewing past move indicator */}
            {viewIndex !== -1 && (
              <div style={{ position: "absolute", top: "8px", left: "50%", transform: "translateX(-50%)", background: "rgba(168,85,247,0.85)", borderRadius: "8px", padding: "4px 12px", fontSize: "12px", fontWeight: 700 }}>
                Move {viewIndex + 1} / {game?.moveHistory.length ?? 0}
              </div>
            )}
          </div>

          {/* Bottom player (me) */}
          <PlayerBar
            username={isPlayerWhite ? (game?.whiteUsername ?? user?.username ?? "...") : (game?.blackUsername ?? user?.username ?? "...")}
            clockMs={isPlayerWhite ? whiteClock : blackClock}
            isActive={game?.status === "active" && (isPlayerWhite ? game.turn === "w" : game.turn === "b")}
            side={isPlayerWhite ? "white" : "black"}
            isMe
          />

          {/* Nav controls */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: "14px", padding: "8px 16px" }}>
            <NavBtn onClick={() => setViewIndex(0)} disabled={!game?.moveHistory.length} title="First">|◀</NavBtn>
            <NavBtn onClick={goBack} disabled={!game?.moveHistory.length} title="←">
              <ChevronLeft size={16} />
            </NavBtn>
            <span style={{ minWidth: "72px", textAlign: "center", fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>
              {viewIndex === -1 ? "Live" : `${viewIndex + 1} / ${game?.moveHistory.length}`}
            </span>
            <NavBtn onClick={goForward} disabled={viewIndex === -1} title="→">
              <ChevronRight size={16} />
            </NavBtn>
            <NavBtn onClick={() => setViewIndex(-1)} disabled={viewIndex === -1} title="Last">▶|</NavBtn>
          </div>

          {/* Action buttons */}
          {game?.status === "active" && (
            <div style={{ display: "flex", gap: "8px" }}>
              <ActionBtn onClick={resign} color="#ef4444" icon={<Flag size={13} />}>Đầu hàng</ActionBtn>
              <ActionBtn onClick={offerDraw} color="#f59e0b" icon={<Handshake size={13} />}>Hòa</ActionBtn>
            </div>
          )}
        </div>

        {/* Right panel */}
        <div style={{ width: "260px", display: "flex", flexDirection: "column", gap: "12px", marginTop: "4px" }}>

          {/* Game status card */}
          {gameOver && (
            <div style={{ background: "linear-gradient(135deg,rgba(168,85,247,0.2),rgba(124,58,237,0.2))", border: "1px solid rgba(168,85,247,0.4)", borderRadius: "14px", padding: "18px", textAlign: "center" }}>
              <Trophy size={28} color="#a855f7" style={{ margin: "0 auto 8px" }} />
              <div style={{ fontWeight: 800, fontSize: "16px", marginBottom: "6px" }}>
                {gameOver.winner === "draw" ? "Hòa!" : gameOver.winner === (isPlayerWhite ? "white" : "black") ? "🎉 Bạn thắng!" : "Bạn thua"}
              </div>
              <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", marginBottom: "14px" }}>{gameOver.message}</div>
              <button onClick={backToTournament} style={{ background: "linear-gradient(135deg,#a855f7,#7c3aed)", border: "none", borderRadius: "8px", color: "white", padding: "8px 18px", cursor: "pointer", fontWeight: 700, fontSize: "13px" }}>
                Về giải đấu →
              </button>
            </div>
          )}

          {/* Draw offer */}
          {drawOffered && (
            <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.35)", borderRadius: "12px", padding: "14px", textAlign: "center" }}>
              <p style={{ margin: "0 0 10px", fontSize: "13px" }}>Đối thủ đề nghị hòa</p>
              <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                <button onClick={acceptDraw} style={{ background: "#22c55e", border: "none", borderRadius: "8px", color: "white", padding: "7px 14px", cursor: "pointer", fontWeight: 700, fontSize: "12px" }}>Chấp nhận</button>
                <button onClick={declineDraw} style={{ background: "#ef4444", border: "none", borderRadius: "8px", color: "white", padding: "7px 14px", cursor: "pointer", fontWeight: 700, fontSize: "12px" }}>Từ chối</button>
              </div>
            </div>
          )}

          {/* Move history */}
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)", fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Lịch sử nước đi
            </div>
            <div ref={moveHistoryRef} style={{ padding: "8px", maxHeight: "320px", overflowY: "auto" }}>
              {!game?.moveHistory.length && <div style={{ textAlign: "center", padding: "20px", color: "rgba(255,255,255,0.2)", fontSize: "12px" }}>Chưa có nước đi</div>}
              {game?.moveHistory && Array.from({ length: Math.ceil(game.moveHistory.length / 2) }).map((_, i) => {
                const wIdx = i * 2;
                const bIdx = i * 2 + 1;
                return (
                  <div key={i} style={{ display: "flex", gap: "4px", padding: "2px 4px", borderRadius: "6px", fontSize: "13px" }}>
                    <span style={{ width: "24px", color: "rgba(255,255,255,0.28)", fontSize: "11px", lineHeight: "1.8" }}>{i + 1}.</span>
                    <MoveChip san={game.moveHistory[wIdx]} isActive={viewIndex === wIdx} onClick={() => setViewIndex(wIdx)} />
                    {game.moveHistory[bIdx] && <MoveChip san={game.moveHistory[bIdx]} isActive={viewIndex === bIdx} onClick={() => setViewIndex(bIdx)} />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function PlayerBar({ username, clockMs, isActive, side, isMe }: { username: string; clockMs: number; isActive: boolean; side: "white" | "black"; isMe?: boolean }) {
  return (
    <div style={{ width: "min(520px, 90vw)", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "10px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div style={{ width: "10px", height: "10px", borderRadius: "2px", background: side === "white" ? "#fff" : "#1a1a1a", border: "1px solid rgba(255,255,255,0.3)" }} />
        <span style={{ fontWeight: isMe ? 700 : 400, fontSize: "14px", color: isMe ? "#c084fc" : "white" }}>{username}</span>
      </div>
      <div style={{ fontFamily: "monospace", fontSize: "18px", fontWeight: 700, padding: "4px 12px", borderRadius: "8px", background: isActive ? "rgba(168,85,247,0.2)" : "rgba(255,255,255,0.07)", border: `1px solid ${isActive ? "rgba(168,85,247,0.5)" : "rgba(255,255,255,0.1)"}`, color: isActive ? "#a855f7" : "rgba(255,255,255,0.8)", display: "flex", alignItems: "center", gap: "5px" }}>
        {isActive && <Clock size={12} color="#a855f7" />}
        {formatMs(clockMs)}
      </div>
    </div>
  );
}

function ActionBtn({ children, onClick, color, icon }: { children: React.ReactNode; onClick: () => void; color: string; icon: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: "5px", padding: "8px 14px", borderRadius: "10px", border: `1px solid ${color}40`, background: `${color}15`, color, fontWeight: 700, fontSize: "12px", cursor: "pointer" }}>
      {icon}{children}
    </button>
  );
}

function NavBtn({ children, onClick, disabled, title }: { children: React.ReactNode; onClick: () => void; disabled: boolean; title: string }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title} style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "6px 8px", borderRadius: "8px", background: "none", border: "none", color: disabled ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.65)", cursor: disabled ? "default" : "pointer" }}>
      {children}
    </button>
  );
}

function MoveChip({ san, isActive, onClick }: { san: string; isActive: boolean; onClick: () => void }) {
  return (
    <span onClick={onClick} style={{ flex: 1, padding: "2px 7px", borderRadius: "5px", cursor: "pointer", fontWeight: 600, background: isActive ? "rgba(168,85,247,0.28)" : "transparent", color: isActive ? "#c084fc" : "rgba(255,255,255,0.82)", userSelect: "none", transition: "background 0.15s" }}>
      {san}
    </span>
  );
}
