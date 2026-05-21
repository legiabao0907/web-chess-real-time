"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
const Chessboard: any = dynamic(() => import("react-chessboard").then((mod) => mod.Chessboard as any), { ssr: false });
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Eye, Clock, Trophy, Radio, Cpu } from "lucide-react";
import { useWatchStore } from "@/store/useWatchStore";
import { useWatchSocket } from "@/hooks/useWatchSocket";
import { useStockfish } from "@/hooks/useStockfish";
import EvaluationBar from "@/components/chess/EvaluationBar";
import { Chess } from "chess.js";
import { SkipBack, ChevronLeft, ChevronRight, SkipForward } from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Kích thước bàn cờ (px) — Eval Bar sẽ khớp chiều cao này */
const BOARD_SIZE = 520;

// ── Component ─────────────────────────────────────────────────────────────────

export default function WatchGamePage() {
  const params    = useParams();
  const router    = useRouter();
  const gameId    = params.gameId as string;
  const [mounted, setMounted] = useState(false);
  const moveHistoryRef = useRef<HTMLDivElement>(null);
  const [currentMoveIndex, setCurrentMoveIndex] = useState<number | null>(null);

  const { watchingGame, spectatorCount } = useWatchStore();
  const [whiteClock, setWhiteClock] = useState(0);
  const [blackClock, setBlackClock] = useState(0);

  // ── Socket connection ─────────────────────────────────────────────────────
  // Mỗi khi server emit "watch_update" với FEN mới,
  // useWatchStore.watchingGame.fen sẽ được cập nhật tự động qua updateWatchGame().
  useWatchSocket(gameId);

  // ── Stockfish Engine ──────────────────────────────────────────────────────
  // Hook nhận FEN từ store và tự động gửi lệnh phân tích khi FEN thay đổi.
  // Engine chỉ chạy khi ván đấu đang diễn ra (active) để tiết kiệm CPU.
  const isGameActive = watchingGame?.status === "active";

  // ── Move Index & Navigation ───────────────────────────────────────────────
  const moveCount = watchingGame?.moveHistory?.length ?? 0;
  const prevMoveCountRef = useRef(moveCount);

  useEffect(() => {
    if (moveCount > prevMoveCountRef.current) {
      setCurrentMoveIndex(moveCount - 1);
    } else if (currentMoveIndex === null && moveCount > 0) {
      setCurrentMoveIndex(moveCount - 1);
    } else if (currentMoveIndex === null && moveCount === 0) {
      setCurrentMoveIndex(-1);
    }
    prevMoveCountRef.current = moveCount;
  }, [moveCount, currentMoveIndex]);

  const displayFen = React.useMemo(() => {
    if (!watchingGame) return "start";
    if (currentMoveIndex === null || currentMoveIndex === moveCount - 1) {
      return watchingGame.fen;
    }
    if (currentMoveIndex === -1) {
      return "start";
    }
    try {
      const chess = new Chess();
      for (let i = 0; i <= currentMoveIndex; i++) {
        chess.move(watchingGame.moveHistory[i]);
      }
      return chess.fen();
    } catch (e) {
      return watchingGame.fen;
    }
  }, [watchingGame, currentMoveIndex, moveCount]);

  const goToStart = () => setCurrentMoveIndex(-1);
  const goToEnd = () => setCurrentMoveIndex(moveCount - 1);
  const goBack = () => setCurrentMoveIndex((i) => (i === null ? moveCount - 1 : Math.max(-1, i - 1)));
  const goForward = () => setCurrentMoveIndex((i) => (i === null ? moveCount - 1 : Math.min(moveCount - 1, i + 1)));

  const isAtStart = currentMoveIndex === -1;
  const isAtEnd = currentMoveIndex === null || currentMoveIndex === moveCount - 1;

  // ── Stockfish Engine ──────────────────────────────────────────────────────
  // Hook nhận FEN từ store và tự động gửi lệnh phân tích khi FEN thay đổi.
  // Engine chỉ chạy khi ván đấu đang diễn ra (active) để tiết kiệm CPU.
  const evaluation   = useStockfish(
    displayFen,
    isGameActive         // tắt engine khi game over
  );

  // ── Mount guard ───────────────────────────────────────────────────────────
  useEffect(() => { setMounted(true); }, []);

  // ── Sync clocks from game state ───────────────────────────────────────────
  useEffect(() => {
    if (watchingGame) {
      setWhiteClock(watchingGame.whiteTimeMs);
      setBlackClock(watchingGame.blackTimeMs);
    }
  }, [watchingGame?.whiteTimeMs, watchingGame?.blackTimeMs, watchingGame?.fen]);

  // ── Real-time countdown for the active player ─────────────────────────────
  useEffect(() => {
    if (!watchingGame || watchingGame.status !== "active" || !watchingGame.lastMoveAt) return;
    const interval = setInterval(() => {
      const elapsed = Date.now() - watchingGame.lastMoveAt!;
      if (watchingGame.turn === "w") {
        setWhiteClock(Math.max(0, watchingGame.whiteTimeMs - elapsed));
      } else {
        setBlackClock(Math.max(0, watchingGame.blackTimeMs - elapsed));
      }
    }, 100);
    return () => clearInterval(interval);
  }, [
    watchingGame?.turn,
    watchingGame?.status,
    watchingGame?.lastMoveAt,
    watchingGame?.whiteTimeMs,
    watchingGame?.blackTimeMs,
  ]);

  // ── Auto-scroll move history ──────────────────────────────────────────────
  useEffect(() => {
    if (moveHistoryRef.current) {
      moveHistoryRef.current.scrollTop = moveHistoryRef.current.scrollHeight;
    }
  }, [watchingGame?.moveHistory?.length]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const formatTime = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (!mounted) return null;

  // Build move rows
  const moveRows: { turn: number; white: string; black: string | null }[] = [];
  if (watchingGame?.moveHistory) {
    for (let i = 0; i < watchingGame.moveHistory.length; i += 2) {
      moveRows.push({
        turn:  Math.floor(i / 2) + 1,
        white: watchingGame.moveHistory[i],
        black: watchingGame.moveHistory[i + 1] ?? null,
      });
    }
  }

  const isGameOver = watchingGame && watchingGame.status !== "active";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        flexDirection: "column",
        background: "linear-gradient(180deg, #0a0a12 0%, #0d0d1a 100%)",
        color: "white",
      }}
    >
      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      <div
        style={{
          padding: "12px 20px",
          borderBottom: "1px solid rgba(168,85,247,0.15)",
          display: "flex",
          alignItems: "center",
          gap: "16px",
          background: "rgba(168,85,247,0.05)",
          flexShrink: 0,
        }}
      >
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
            zIndex: 10,
          }}
        >
          <ArrowLeft size={14} /> Back
        </button>

        {/* LIVE badge */}
        {watchingGame?.status === "active" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "rgba(239,68,68,0.15)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "20px",
              padding: "4px 12px",
            }}
          >
            <Radio size={12} color="#ef4444" style={{ animation: "pulse 1s infinite" }} />
            <span style={{ color: "#ef4444", fontSize: "12px", fontWeight: 700 }}>LIVE</span>
          </div>
        )}

        {/* Player names */}
        {watchingGame && (
          <div style={{ flex: 1, textAlign: "center" }}>
            <span style={{ fontSize: "16px", fontWeight: 700 }}>
              {watchingGame.whiteUsername}
            </span>
            <span style={{ color: "rgba(255,255,255,0.4)", margin: "0 10px" }}>vs</span>
            <span style={{ fontSize: "16px", fontWeight: 700 }}>
              {watchingGame.blackUsername}
            </span>
            <span
              style={{
                marginLeft: "12px",
                fontSize: "12px",
                color: "rgba(255,255,255,0.4)",
                background: "rgba(255,255,255,0.07)",
                padding: "2px 8px",
                borderRadius: "8px",
              }}
            >
              {watchingGame.timeControl?.replace("_", " ")}
            </span>
          </div>
        )}

        {/* Engine status indicator */}
        {isGameActive && (
          <div
            title={evaluation.isCalculating ? `Phân tích độ sâu ${evaluation.depth}...` : `Độ sâu ${evaluation.depth}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              fontSize: "11px",
              color: evaluation.isCalculating ? "#a855f7" : "rgba(255,255,255,0.35)",
              background: "rgba(168,85,247,0.08)",
              border: "1px solid rgba(168,85,247,0.15)",
              borderRadius: "8px",
              padding: "4px 10px",
              transition: "color 0.3s",
            }}
          >
            <Cpu size={11} />
            <span>d{evaluation.depth}</span>
          </div>
        )}

        {/* Spectator count */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            color: "rgba(255,255,255,0.5)",
            fontSize: "13px",
          }}
        >
          <Eye size={14} />
          <span>{spectatorCount} watching</span>
        </div>
      </div>

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── Left: Board + Eval Bar ──────────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: "16px",
          }}
        >
          {/* Game Over banner */}
          {isGameOver && watchingGame && (
            <div
              style={{
                background: "linear-gradient(135deg, rgba(168,85,247,0.2), rgba(124,58,237,0.2))",
                border: "1px solid rgba(168,85,247,0.4)",
                borderRadius: "12px",
                padding: "12px 20px",
                marginBottom: "12px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <Trophy size={20} color="#a855f7" />
              <span style={{ fontWeight: 700 }}>
                {watchingGame.winner === "draw"
                  ? "Hòa cờ!"
                  : `${watchingGame.winner === "white"
                      ? watchingGame.whiteUsername
                      : watchingGame.blackUsername} thắng!`}
              </span>
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>
                Ván đấu kết thúc
              </span>
            </div>
          )}

          {/* Black player row */}
          <PlayerRow
            username={watchingGame?.blackUsername ?? "Black"}
            clockMs={blackClock}
            isActive={isGameActive && watchingGame?.turn === "b"}
            formatTime={formatTime}
            side="black"
          />

          {/* ── Board + Eval Bar side-by-side ─────────────────────────── */}
          <div
            style={{
              flex: 1,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "10px",
              padding: "8px 0",
            }}
          >
            {/* Eval Bar — chiều cao khớp với bàn cờ */}
            <EvaluationBar
              evaluation={isGameActive ? evaluation : null}
              orientation="white"
              height={BOARD_SIZE}
              width={24}
            />

            {/* Bàn cờ */}
            <div style={{ width: `${BOARD_SIZE}px`, aspectRatio: "1", flexShrink: 0 }}>
              {typeof window !== "undefined" && (
                <Chessboard
                  position={displayFen}
                  arePiecesDraggable={false}
                  animationDuration={200}
                  boardOrientation="white"
                  boardWidth={BOARD_SIZE}
                  customBoardStyle={{
                    borderRadius: "8px",
                    boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
                  }}
                />
              )}
            </div>
          </div>

          {/* Navigation Controls */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: "14px",
              padding: "8px 18px",
              width: "fit-content",
              margin: "0 auto",
            }}
          >
            <NavBtn onClick={goToStart} disabled={isAtStart} title="Về đầu">
              <SkipBack size={15} />
            </NavBtn>
            <NavBtn onClick={goBack} disabled={isAtStart} title="Lùi 1 nước">
              <ChevronLeft size={18} />
            </NavBtn>
            <span
              style={{
                minWidth: "96px",
                textAlign: "center",
                fontSize: "0.78rem",
                color: "rgba(255,255,255,0.5)",
                fontVariantNumeric: "tabular-nums",
                userSelect: "none",
              }}
            >
              {currentMoveIndex === -1
                ? "Start"
                : currentMoveIndex === moveCount - 1
                ? "Live"
                : `Move ${currentMoveIndex! + 1} / ${moveCount}`}
            </span>
            <NavBtn onClick={goForward} disabled={isAtEnd} title="Tiến 1 nước">
              <ChevronRight size={18} />
            </NavBtn>
            <NavBtn onClick={goToEnd} disabled={isAtEnd} title="Đến cuối">
              <SkipForward size={15} />
            </NavBtn>
          </div>

          {/* White player row */}
          <PlayerRow
            username={watchingGame?.whiteUsername ?? "White"}
            clockMs={whiteClock}
            isActive={isGameActive && watchingGame?.turn === "w"}
            formatTime={formatTime}
            side="white"
          />
        </div>

        {/* ── Right: Move History ───────────────────────────────────────── */}
        <div
          style={{
            width: "280px",
            flexShrink: 0,
            borderLeft: "1px solid rgba(255,255,255,0.07)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "14px 16px",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
              background: "rgba(255,255,255,0.03)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "13px", fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>
              Move History
            </span>
            <span
              style={{
                fontSize: "11px",
                color: "#a855f7",
                background: "rgba(168,85,247,0.15)",
                padding: "2px 8px",
                borderRadius: "8px",
              }}
            >
              {watchingGame?.moveHistory?.length ?? 0} moves
            </span>
          </div>

          {/* Eval summary row */}
          {isGameActive && (
            <div
              style={{
                padding: "8px 14px",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "rgba(168,85,247,0.04)",
              }}
            >
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>
                Stockfish eval
              </span>
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: evaluation.mate !== null
                    ? "#f59e0b"
                    : evaluation.score >= 0 ? "#e5e7eb" : "#9ca3af",
                  opacity: evaluation.isCalculating ? 0.7 : 1,
                  transition: "opacity 0.3s",
                }}
              >
                {evaluation.mate !== null
                  ? evaluation.mate > 0 ? `M${evaluation.mate}` : `-M${Math.abs(evaluation.mate)}`
                  : `${evaluation.score >= 0 ? "+" : ""}${(evaluation.score / 100).toFixed(2)}`}
              </span>
            </div>
          )}

          {/* Moves list */}
          <div
            ref={moveHistoryRef}
            style={{ flex: 1, overflowY: "auto", padding: "8px" }}
          >
            {moveRows.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  color: "rgba(255,255,255,0.25)",
                  fontSize: "12px",
                  padding: "20px",
                }}
              >
                No moves yet
              </div>
            ) : (
              moveRows.map((row, i) => {
                const whiteMoveIdx = i * 2;
                const blackMoveIdx = i * 2 + 1;
                const isWhiteActive = currentMoveIndex === whiteMoveIdx;
                const isBlackActive = currentMoveIndex === blackMoveIdx;

                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      padding: "6px 8px",
                      borderRadius: "6px",
                      fontSize: "13px",
                      background:
                        i === moveRows.length - 1 && currentMoveIndex === moveCount - 1
                          ? "rgba(168,85,247,0.12)"
                          : "transparent",
                      marginBottom: "2px",
                    }}
                  >
                    <span style={{ width: "28px", color: "rgba(255,255,255,0.3)" }}>
                      {row.turn}.
                    </span>
                    <span
                      onClick={() => setCurrentMoveIndex(whiteMoveIdx)}
                      style={{
                        flex: 1,
                        fontWeight: 600,
                        cursor: "pointer",
                        color: isWhiteActive ? "#a855f7" : "white",
                        background: isWhiteActive ? "rgba(168,85,247,0.2)" : "transparent",
                        padding: "0 4px",
                        borderRadius: "4px",
                      }}
                    >
                      {row.white}
                    </span>
                    <span
                      onClick={() => row.black && setCurrentMoveIndex(blackMoveIdx)}
                      style={{
                        flex: 1,
                        fontWeight: 600,
                        cursor: row.black ? "pointer" : "default",
                        color: isBlackActive
                          ? "#a855f7"
                          : row.black
                          ? "white"
                          : "rgba(255,255,255,0.3)",
                        background: isBlackActive ? "rgba(168,85,247,0.2)" : "transparent",
                        padding: "0 4px",
                        borderRadius: "4px",
                      }}
                    >
                      {row.black ?? "…"}
                    </span>
                  </div>
                );
              })
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

// ── Sub-component: PlayerRow ───────────────────────────────────────────────────

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
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 4px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            overflow: "hidden",
            border: `2px solid ${isActive ? "#a855f7" : "rgba(255,255,255,0.1)"}`,
            flexShrink: 0,
            transition: "border-color 0.3s",
          }}
        >
          <img
            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`}
            alt={username}
            style={{ width: "100%", height: "100%" }}
          />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: "14px" }}>{username}</div>
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>
            {side === "white" ? "♔ White" : "♚ Black"}
          </div>
        </div>
      </div>

      <div
        style={{
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
        }}
      >
        {isActive && <Clock size={12} color="#a855f7" />}
        {formatTime(clockMs)}
      </div>
    </div>
  );
}

// ── Sub-component: NavBtn ──────────────────────────────────────────────────────

interface NavBtnProps {
  onClick: () => void;
  disabled: boolean;
  title: string;
  children: React.ReactNode;
}

function NavBtn({ onClick, disabled, title, children }: NavBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "7px",
        borderRadius: "8px",
        background: "none",
        border: "none",
        color: disabled ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.65)",
        cursor: disabled ? "default" : "pointer",
        transition: "color 0.2s, background 0.2s",
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.color = "white";
          e.currentTarget.style.background = "rgba(168,85,247,0.15)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = disabled
          ? "rgba(255,255,255,0.18)"
          : "rgba(255,255,255,0.65)";
        e.currentTarget.style.background = "none";
      }}
    >
      {children}
    </button>
  );
}
