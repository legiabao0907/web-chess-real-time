"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
const Chessboard: any = dynamic(
  () => import("react-chessboard").then((mod) => mod.Chessboard as any),
  { ssr: false }
);
import { Chess } from "chess.js";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  SkipBack,
  SkipForward,
  Trophy,
  Handshake,
  Flag,
  Calendar,
  Clock,
  Copy,
  Check,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getUser } from "@/lib/auth";

interface GameDetail {
  id: string;
  whiteId: string | null;
  blackId: string | null;
  whiteUsername: string | null;
  blackUsername: string | null;
  winnerId: string | null;
  status: string | null;
  timeControl: string | null;
  pgn: string | null;
  finalFen: string | null;
  createdAt: string | null;
  tournamentId: string | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";

export default function GameReviewPage() {
  const params = useParams();
  const gameId = params?.gameId as string;
  const [game, setGame] = useState<GameDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewIndex, setViewIndex] = useState(-1); // -1 = final position
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  const user = getUser();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!gameId) return;
    const fetchGame = async () => {
      try {
        const token = localStorage.getItem("accessToken");
        const res = await fetch(`${API_URL}/game/${gameId}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Game not found");
        const data = await res.json();
        setGame(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchGame();
  }, [gameId]);

  // Build FEN snapshots from PGN
  const allFens = useMemo(() => {
    if (!game?.pgn) return [];
    try {
      const chess = new Chess();
      chess.loadPgn(game.pgn);
      const history = chess.history({ verbose: false });
      const chess2 = new Chess();
      const fens: string[] = [];
      fens.push(chess2.fen()); // starting position
      for (const san of history) {
        chess2.move(san);
        fens.push(chess2.fen());
      }
      return fens;
    } catch {
      return [];
    }
  }, [game?.pgn]);

  // Build move list from PGN
  const moveList = useMemo(() => {
    if (!game?.pgn) return [];
    try {
      const chess = new Chess();
      chess.loadPgn(game.pgn);
      return chess.history();
    } catch {
      return [];
    }
  }, [game?.pgn]);

  const moveRows = useMemo(() => {
    const rows: { turn: number; white: string; black: string | null; whiteIdx: number; blackIdx: number | null }[] = [];
    for (let i = 0; i < moveList.length; i += 2) {
      rows.push({
        turn: Math.floor(i / 2) + 1,
        white: moveList[i],
        black: moveList[i + 1] ?? null,
        whiteIdx: i + 1, // +1 because allFens[0] is start
        blackIdx: moveList[i + 1] != null ? i + 2 : null,
      });
    }
    return rows;
  }, [moveList]);

  const navigateTo = useCallback(
    (idx: number) => {
      if (idx < 0) setViewIndex(0);
      else if (idx >= allFens.length) setViewIndex(allFens.length - 1);
      else setViewIndex(idx);
    },
    [allFens.length]
  );

  // Init at final position
  useEffect(() => {
    if (allFens.length > 0) setViewIndex(allFens.length - 1);
  }, [allFens.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!allFens.length) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); navigateTo(viewIndex - 1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); navigateTo(viewIndex + 1); }
      else if (e.key === "ArrowUp" || e.key === "Home") { e.preventDefault(); navigateTo(0); }
      else if (e.key === "ArrowDown" || e.key === "End") { e.preventDefault(); navigateTo(allFens.length - 1); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [allFens.length, viewIndex, navigateTo]);

  const handleCopyPgn = () => {
    if (!game?.pgn) return;
    navigator.clipboard.writeText(game.pgn);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("vi-VN", {
      year: "numeric", month: "long", day: "numeric",
    });
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleTimeString("vi-VN", {
      hour: "2-digit", minute: "2-digit",
    });
  };

  const getResultLabel = () => {
    if (!game) return null;
    const isWhite = game.whiteId === user?.id;
    const isDraw = game.status === "draw" || game.winnerId === null && game.status === "finished";
    const isWinner = game.winnerId === user?.id;
    if (isDraw) return { label: "Draw", color: "#94a3b8", icon: <Handshake size={16} /> };
    if (isWinner) return { label: "Victory", color: "#22c55e", icon: <Trophy size={16} /> };
    return { label: "Defeat", color: "#ef4444", icon: <Flag size={16} /> };
  };

  const getTimeControlLabel = (tc: string | null) => {
    if (!tc) return "—";
    const map: Record<string, string> = {
      bullet_1: "Bullet 1+0", bullet_1_1: "Bullet 1+1",
      blitz_3: "Blitz 3+0", blitz_3_2: "Blitz 3+2",
      blitz_5: "Blitz 5+0", blitz_5_3: "Blitz 5+3",
      rapid_10: "Rapid 10+0", rapid_15_10: "Rapid 15+10",
    };
    return map[tc] ?? tc.replace(/_/g, " ").toUpperCase();
  };

  const displayFen = allFens[viewIndex] ?? game?.finalFen ?? "start";
  const isPlayerWhite = game?.whiteId === user?.id;
  const result = getResultLabel();

  // ── Loading / Error states ────────────────────────────────────────────────
  if (!mounted || isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "1rem", color: "white" }}>
        <div style={{ width: "48px", height: "48px", border: "3px solid rgba(168,85,247,0.3)", borderTopColor: "#a855f7", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        <p style={{ color: "rgba(255,255,255,0.4)" }}>Loading game archive...</p>
        <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "1rem", color: "white" }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Game Not Found</h2>
        <p style={{ color: "rgba(255,255,255,0.4)" }}>{error ?? "This game does not exist or you don't have access."}</p>
        <Link href="/archives" style={{ padding: "10px 24px", background: "#a855f7", borderRadius: "10px", color: "white", textDecoration: "none", fontWeight: 600 }}>
          ← Back to Archives
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", color: "white", overflow: "hidden" }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", gap: "1rem",
        padding: "1rem 1.5rem", borderBottom: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(255,255,255,0.02)", flexShrink: 0,
      }}>
        <Link href="/archives" style={{
          display: "flex", alignItems: "center", gap: "6px",
          color: "rgba(255,255,255,0.5)", textDecoration: "none", fontSize: "0.85rem",
          transition: "color 0.2s",
        }}
          onMouseEnter={e => (e.currentTarget.style.color = "white")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
        >
          <ArrowLeft size={16} /> Archives
        </Link>

        <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.1)" }} />

        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flex: 1 }}>
          {/* White player */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "#f0d9b5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>♔</div>
            <span style={{ fontWeight: 600, color: game.whiteId === user?.id ? "#a855f7" : "white" }}>
              {game.whiteUsername ?? "Unknown"}
            </span>
          </div>

          <span style={{ color: "rgba(255,255,255,0.3)", fontWeight: 700 }}>vs</span>

          {/* Black player */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "#333", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>♚</div>
            <span style={{ fontWeight: 600, color: game.blackId === user?.id ? "#a855f7" : "white" }}>
              {game.blackUsername ?? "Unknown"}
            </span>
          </div>
        </div>

        {/* Meta badges */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {result && (
            <span style={{
              display: "flex", alignItems: "center", gap: "4px",
              padding: "4px 12px", borderRadius: "8px", fontSize: "0.8rem", fontWeight: 700,
              background: `${result.color}20`, color: result.color, border: `1px solid ${result.color}40`,
            }}>
              {result.icon} {result.label}
            </span>
          )}
          <span style={{
            padding: "4px 10px", borderRadius: "8px", fontSize: "0.75rem", fontWeight: 700,
            background: game.timeControl?.includes("blitz") ? "rgba(245,158,11,0.15)" : game.timeControl?.includes("bullet") ? "rgba(239,68,68,0.15)" : "rgba(59,130,246,0.15)",
            color: game.timeControl?.includes("blitz") ? "#f59e0b" : game.timeControl?.includes("bullet") ? "#ef4444" : "#3b82f6",
          }}>
            {getTimeControlLabel(game.timeControl)}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.75rem", color: "rgba(255,255,255,0.35)" }}>
            <Calendar size={12} /> {formatDate(game.createdAt)}
            <Clock size={12} style={{ marginLeft: "4px" }} /> {formatTime(game.createdAt)}
          </span>
        </div>
      </div>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* LEFT: Board area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1.5rem", gap: "1rem" }}>
          {/* Player labels */}
          <div style={{ width: "min(560px, 100%)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{
                width: "32px", height: "32px", borderRadius: "50%",
                background: isPlayerWhite ? "#333" : "#f0d9b5",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px",
              }}>
                {isPlayerWhite ? "♚" : "♔"}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                  {isPlayerWhite ? game.blackUsername : game.whiteUsername}
                </div>
                <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.35)" }}>Opponent</div>
              </div>
            </div>
            {/* Result badge for top player */}
            <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.3)" }}>
              {moveList.length > 0 && `${moveList.length} moves`}
            </div>
          </div>

          {/* Board */}
          <div style={{ width: "min(560px, 100%)", aspectRatio: "1", position: "relative" }}>
            {typeof window !== "undefined" && (
              <Chessboard
                position={displayFen}
                arePiecesDraggable={false}
                animationDuration={100}
                boardOrientation={isPlayerWhite ? "white" : "black"}
                customBoardStyle={{
                  borderRadius: "8px",
                  boxShadow: "0 12px 40px rgba(0,0,0,0.7)",
                }}
              />
            )}
          </div>

          {/* Navigation controls */}
          <div style={{
            display: "flex", alignItems: "center", gap: "8px",
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "12px", padding: "8px 16px",
          }}>
            <button onClick={() => navigateTo(0)} disabled={viewIndex === 0}
              style={{ padding: "6px", borderRadius: "8px", background: "none", border: "none", color: viewIndex === 0 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.6)", cursor: viewIndex === 0 ? "default" : "pointer", transition: "color 0.2s" }}>
              <SkipBack size={16} />
            </button>
            <button onClick={() => navigateTo(viewIndex - 1)} disabled={viewIndex === 0}
              style={{ padding: "6px", borderRadius: "8px", background: "none", border: "none", color: viewIndex === 0 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.6)", cursor: viewIndex === 0 ? "default" : "pointer", transition: "color 0.2s" }}>
              <ChevronLeft size={18} />
            </button>
            <span style={{ minWidth: "80px", textAlign: "center", fontSize: "0.8rem", color: "rgba(255,255,255,0.5)", fontVariantNumeric: "tabular-nums" }}>
              {viewIndex === 0 ? "Start" : viewIndex === allFens.length - 1 ? "Final" : `Move ${viewIndex} / ${allFens.length - 1}`}
            </span>
            <button onClick={() => navigateTo(viewIndex + 1)} disabled={viewIndex >= allFens.length - 1}
              style={{ padding: "6px", borderRadius: "8px", background: "none", border: "none", color: viewIndex >= allFens.length - 1 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.6)", cursor: viewIndex >= allFens.length - 1 ? "default" : "pointer", transition: "color 0.2s" }}>
              <ChevronRight size={18} />
            </button>
            <button onClick={() => navigateTo(allFens.length - 1)} disabled={viewIndex >= allFens.length - 1}
              style={{ padding: "6px", borderRadius: "8px", background: "none", border: "none", color: viewIndex >= allFens.length - 1 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.6)", cursor: viewIndex >= allFens.length - 1 ? "default" : "pointer", transition: "color 0.2s" }}>
              <SkipForward size={16} />
            </button>
          </div>

          {/* Keyboard hint */}
          <p style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.2)", margin: 0 }}>
            ← → Arrow keys to navigate · Home/End to jump
          </p>

          {/* Bottom player */}
          <div style={{ width: "min(560px, 100%)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{
                width: "32px", height: "32px", borderRadius: "50%",
                background: isPlayerWhite ? "#f0d9b5" : "#333",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px",
              }}>
                {isPlayerWhite ? "♔" : "♚"}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#a855f7" }}>
                  {isPlayerWhite ? game.whiteUsername : game.blackUsername} (You)
                </div>
                <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.35)" }}>
                  {result?.label ?? "Player"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Move list + PGN */}
        <div style={{
          width: "280px", flexShrink: 0, borderLeft: "1px solid rgba(255,255,255,0.07)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          {/* Move history */}
          <div style={{
            padding: "12px 12px 6px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em",
            color: "rgba(255,255,255,0.35)", textTransform: "uppercase",
          }}>
            Move History
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
            {moveRows.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem", color: "rgba(255,255,255,0.2)", fontSize: "0.8rem" }}>
                No moves recorded
              </div>
            ) : moveRows.map((row, i) => (
              <div key={i} style={{ display: "flex", padding: "2px 4px", borderRadius: "6px", fontSize: "0.85rem" }}>
                <span style={{ width: "28px", color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>{row.turn}.</span>
                <span
                  onClick={() => navigateTo(row.whiteIdx)}
                  style={{
                    flex: 1, padding: "2px 6px", borderRadius: "4px", cursor: "pointer",
                    fontWeight: 600, transition: "background 0.15s",
                    background: viewIndex === row.whiteIdx ? "rgba(168,85,247,0.25)" : "transparent",
                    color: viewIndex === row.whiteIdx ? "#a855f7" : "rgba(255,255,255,0.85)",
                  }}
                  onMouseEnter={e => { if (viewIndex !== row.whiteIdx) e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
                  onMouseLeave={e => { if (viewIndex !== row.whiteIdx) e.currentTarget.style.background = "transparent"; }}
                >
                  {row.white}
                </span>
                {row.blackIdx !== null && (
                  <span
                    onClick={() => row.blackIdx !== null && navigateTo(row.blackIdx)}
                    style={{
                      flex: 1, padding: "2px 6px", borderRadius: "4px", cursor: row.black ? "pointer" : "default",
                      fontWeight: 600, transition: "background 0.15s",
                      background: viewIndex === row.blackIdx ? "rgba(168,85,247,0.25)" : "transparent",
                      color: viewIndex === row.blackIdx ? "#a855f7" : "rgba(255,255,255,0.85)",
                    }}
                    onMouseEnter={e => { if (row.black && viewIndex !== row.blackIdx) e.currentTarget.style.background = "rgba(255,255,255,0.07)"; }}
                    onMouseLeave={e => { if (row.black && viewIndex !== row.blackIdx) e.currentTarget.style.background = "transparent"; }}
                  >
                    {row.black ?? ""}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* PGN section */}
          {game.pgn && (
            <div style={{
              borderTop: "1px solid rgba(255,255,255,0.07)",
              padding: "12px",
              flexShrink: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>
                  PGN
                </span>
                <button
                  onClick={handleCopyPgn}
                  style={{
                    display: "flex", alignItems: "center", gap: "4px",
                    padding: "4px 8px", borderRadius: "6px", border: "none",
                    background: copied ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.07)",
                    color: copied ? "#22c55e" : "rgba(255,255,255,0.5)",
                    cursor: "pointer", fontSize: "0.7rem", transition: "all 0.2s",
                  }}
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <textarea
                readOnly
                value={game.pgn}
                style={{
                  width: "100%", height: "80px", resize: "none",
                  background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "8px", color: "rgba(255,255,255,0.5)", padding: "8px",
                  fontSize: "0.7rem", lineHeight: 1.5, fontFamily: "monospace",
                  outline: "none",
                }}
              />
            </div>
          )}

          {/* Result summary */}
          <div style={{
            padding: "12px", borderTop: "1px solid rgba(255,255,255,0.07)",
            background: "rgba(255,255,255,0.02)", flexShrink: 0,
          }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "10px", borderRadius: "10px",
              background: result ? `${result.color}10` : "rgba(255,255,255,0.05)",
              border: result ? `1px solid ${result.color}30` : "1px solid rgba(255,255,255,0.08)",
            }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontWeight: 700, fontSize: "0.85rem", color: result?.color ?? "white", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                  {result?.icon}
                  {result?.label ?? (game.winnerId ? "Decided" : "Draw")}
                </div>
                <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.3)", marginTop: "2px" }}>
                  {game.status === "resigned" ? "By resignation" : game.status === "draw" ? "Agreed draw" : game.status === "finished" ? "By checkmate" : game.status ?? ""}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
