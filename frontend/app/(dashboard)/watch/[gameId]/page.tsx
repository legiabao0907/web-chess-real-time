"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
const Chessboard: any = dynamic(() => import("react-chessboard").then((mod) => mod.Chessboard as any), { ssr: false });
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Eye, Clock, Trophy, Radio } from "lucide-react";
import { useWatchStore } from "@/store/useWatchStore";
import { useWatchSocket } from "@/hooks/useWatchSocket";

export default function WatchGamePage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.gameId as string;
  const [mounted, setMounted] = useState(false);
  const moveHistoryRef = useRef<HTMLDivElement>(null);

  const { watchingGame, spectatorCount } = useWatchStore();
  const [whiteClock, setWhiteClock] = useState(0);
  const [blackClock, setBlackClock] = useState(0);

  // Connect to watch socket
  useWatchSocket(gameId);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync clocks from game state
  useEffect(() => {
    if (watchingGame) {
      setWhiteClock(watchingGame.whiteTimeMs);
      setBlackClock(watchingGame.blackTimeMs);
    }
  }, [watchingGame?.whiteTimeMs, watchingGame?.blackTimeMs, watchingGame?.fen]);

  // Real-time countdown for the active player
  useEffect(() => {
    if (!watchingGame || watchingGame.status !== "active" || !watchingGame.lastMoveAt) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - watchingGame.lastMoveAt!;
      if (watchingGame.turn === "w") {
        setWhiteClock(Math.max(0, watchingGame.whiteTimeMs - elapsed));
      } else {
        setBlackClock(Math.max(0, watchingGame.blackTimeMs - elapsed));
      }
    }, 100);

    return () => clearInterval(interval);
  }, [watchingGame?.turn, watchingGame?.status, watchingGame?.lastMoveAt, watchingGame?.whiteTimeMs, watchingGame?.blackTimeMs]);

  // Scroll move history
  useEffect(() => {
    if (moveHistoryRef.current) {
      moveHistoryRef.current.scrollTop = moveHistoryRef.current.scrollHeight;
    }
  }, [watchingGame?.moveHistory?.length]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  if (!mounted) return null;

  const moveRows: { turn: number; white: string; black: string | null }[] = [];
  if (watchingGame?.moveHistory) {
    for (let i = 0; i < watchingGame.moveHistory.length; i += 2) {
      moveRows.push({
        turn: Math.floor(i / 2) + 1,
        white: watchingGame.moveHistory[i],
        black: watchingGame.moveHistory[i + 1] ?? null,
      });
    }
  }

  const isGameOver = watchingGame && watchingGame.status !== "active";

  return (
    <div style={{
      display: "flex",
      height: "100%",
      flexDirection: "column",
      background: "linear-gradient(180deg, #0a0a12 0%, #0d0d1a 100%)",
      color: "white",
    }}>
      {/* Top Bar */}
      <div style={{
        padding: "12px 20px",
        borderBottom: "1px solid rgba(168,85,247,0.15)",
        display: "flex",
        alignItems: "center",
        gap: "16px",
        background: "rgba(168,85,247,0.05)",
        flexShrink: 0,
      }}>
        <button
          onClick={() => router.push("/live")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.7)",
            borderRadius: "8px",
            padding: "6px 12px",
            cursor: "pointer",
            fontSize: "13px",
          }}
        >
          <ArrowLeft size={14} /> Back
        </button>

        {/* LIVE badge */}
        {watchingGame?.status === "active" && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: "rgba(239,68,68,0.15)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: "20px",
            padding: "4px 12px",
          }}>
            <Radio size={12} color="#ef4444" style={{ animation: "pulse 1s infinite" }} />
            <span style={{ color: "#ef4444", fontSize: "12px", fontWeight: 700 }}>LIVE</span>
          </div>
        )}

        {watchingGame && (
          <div style={{ flex: 1, textAlign: "center" }}>
            <span style={{ fontSize: "16px", fontWeight: 700 }}>
              {watchingGame.whiteUsername}
            </span>
            <span style={{ color: "rgba(255,255,255,0.4)", margin: "0 10px" }}>vs</span>
            <span style={{ fontSize: "16px", fontWeight: 700 }}>
              {watchingGame.blackUsername}
            </span>
            <span style={{
              marginLeft: "12px",
              fontSize: "12px",
              color: "rgba(255,255,255,0.4)",
              background: "rgba(255,255,255,0.07)",
              padding: "2px 8px",
              borderRadius: "8px",
            }}>
              {watchingGame.timeControl?.replace("_", " ")}
            </span>
          </div>
        )}

        {/* Spectator Count */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          color: "rgba(255,255,255,0.5)",
          fontSize: "13px",
        }}>
          <Eye size={14} />
          <span>{spectatorCount} watching</span>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left: Board */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "16px" }}>

          {/* Game Over Banner */}
          {isGameOver && watchingGame && (
            <div style={{
              background: "linear-gradient(135deg, rgba(168,85,247,0.2), rgba(124,58,237,0.2))",
              border: "1px solid rgba(168,85,247,0.4)",
              borderRadius: "12px",
              padding: "12px 20px",
              marginBottom: "12px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}>
              <Trophy size={20} color="#a855f7" />
              <span style={{ fontWeight: 700 }}>
                {watchingGame.winner === "draw"
                  ? "Draw!"
                  : `${watchingGame.winner === "white" ? watchingGame.whiteUsername : watchingGame.blackUsername} wins!`}
              </span>
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>
                Game over
              </span>
            </div>
          )}

          {/* Opponent (top) */}
          <PlayerRow
            username={watchingGame?.blackUsername ?? "Black"}
            clockMs={blackClock}
            isActive={watchingGame?.status === "active" && watchingGame?.turn === "b"}
            formatTime={formatTime}
            side="black"
          />

          {/* Board */}
          <div style={{
            flex: 1,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "8px 0",
          }}>
            <div style={{ width: "min(100%, 540px)", aspectRatio: "1" }}>
              {typeof window !== "undefined" && (
                <Chessboard
                  position={watchingGame?.fen ?? "start"}
                  arePiecesDraggable={false}
                  animationDuration={200}
                  boardOrientation="white"
                />
              )}
            </div>
          </div>

          {/* Player (bottom) */}
          <PlayerRow
            username={watchingGame?.whiteUsername ?? "White"}
            clockMs={whiteClock}
            isActive={watchingGame?.status === "active" && watchingGame?.turn === "w"}
            formatTime={formatTime}
            side="white"
          />
        </div>

        {/* Right: Move History */}
        <div style={{
          width: "280px",
          flexShrink: 0,
          borderLeft: "1px solid rgba(255,255,255,0.07)",
          display: "flex",
          flexDirection: "column",
        }}>
          <div style={{
            padding: "14px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            background: "rgba(255,255,255,0.03)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>
              Move History
            </span>
            <span style={{
              fontSize: "11px",
              color: "#a855f7",
              background: "rgba(168,85,247,0.15)",
              padding: "2px 8px",
              borderRadius: "8px",
            }}>
              {watchingGame?.moveHistory?.length ?? 0} moves
            </span>
          </div>

          <div
            ref={moveHistoryRef}
            style={{ flex: 1, overflowY: "auto", padding: "8px" }}
          >
            {moveRows.length === 0 ? (
              <div style={{ textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: "12px", padding: "20px" }}>
                No moves yet
              </div>
            ) : (
              moveRows.map((row, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    padding: "6px 8px",
                    borderRadius: "6px",
                    fontSize: "13px",
                    background: i === moveRows.length - 1 ? "rgba(168,85,247,0.12)" : "transparent",
                    marginBottom: "2px",
                  }}
                >
                  <span style={{ width: "28px", color: "rgba(255,255,255,0.3)" }}>{row.turn}.</span>
                  <span style={{ flex: 1, fontWeight: 600 }}>{row.white}</span>
                  <span style={{ flex: 1, fontWeight: 600, color: row.black ? "white" : "rgba(255,255,255,0.3)" }}>
                    {row.black ?? "…"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

function PlayerRow({
  username,
  clockMs,
  isActive,
  formatTime,
  side,
}: {
  username: string;
  clockMs: number;
  isActive: boolean;
  formatTime: (ms: number) => string;
  side: "white" | "black";
}) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "8px 4px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{
          width: "36px",
          height: "36px",
          borderRadius: "50%",
          overflow: "hidden",
          border: `2px solid ${isActive ? "#a855f7" : "rgba(255,255,255,0.1)"}`,
          flexShrink: 0,
        }}>
          <img
            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`}
            alt={username}
            style={{ width: "100%", height: "100%" }}
          />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: "14px" }}>{username}</div>
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>{side === "white" ? "♔ White" : "♚ Black"}</div>
        </div>
      </div>

      <div style={{
        background: isActive ? "rgba(168,85,247,0.2)" : "rgba(255,255,255,0.07)",
        border: `1px solid ${isActive ? "rgba(168,85,247,0.5)" : "rgba(255,255,255,0.1)"}`,
        borderRadius: "8px",
        padding: "6px 14px",
        fontWeight: 700,
        fontFamily: "monospace",
        fontSize: "18px",
        color: isActive ? "#a855f7" : "rgba(255,255,255,0.7)",
        transition: "all 0.3s",
        display: "flex",
        alignItems: "center",
        gap: "6px",
      }}>
        {isActive && <Clock size={12} color="#a855f7" />}
        {formatTime(clockMs)}
      </div>
    </div>
  );
}
