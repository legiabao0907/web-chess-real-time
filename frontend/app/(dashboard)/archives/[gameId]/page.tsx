"use client";

import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
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
import ChessReplay, { VerboseMove } from "@/components/chess/ChessReplay";

// ── Types ──────────────────────────────────────────────────────────────────────

interface GameHistory {
  gameId: string;
  whiteUsername: string | null;
  blackUsername: string | null;
  status: string | null;
  winner: string | null;       // this is actually winnerId from DB
  timeControl: string | null;
  finalFen: string | null;
  moves: VerboseMove[];
}

/** Full game detail — from GET /game/:id */
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

// ── Constants ─────────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("vi-VN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getTimeControlLabel(tc: string | null) {
  if (!tc) return "—";
  const map: Record<string, string> = {
    bullet_1: "Bullet 1+0",
    bullet_1_1: "Bullet 1+1",
    blitz_3: "Blitz 3+0",
    blitz_3_2: "Blitz 3+2",
    blitz_5: "Blitz 5+0",
    blitz_5_3: "Blitz 5+3",
    rapid_10: "Rapid 10+0",
    rapid_15_10: "Rapid 15+10",
  };
  return map[tc] ?? tc.replace(/_/g, " ").toUpperCase();
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GameReviewPage() {
  const params = useParams();
  const gameId = params?.gameId as string;

  const [game, setGame] = useState<GameDetail | null>(null);
  const [history, setHistory] = useState<GameHistory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  const user = getUser();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!gameId) return;

    const fetchAll = async () => {
      try {
        const token = localStorage.getItem("accessToken");
        const headers = { Authorization: `Bearer ${token}` };

        // Fetch both in parallel
        const [detailRes, historyRes] = await Promise.all([
          fetch(`${API_URL}/game/${gameId}`, { headers, cache: "no-store" }),
          fetch(`${API_URL}/game/${gameId}/history`, { headers, cache: "no-store" }),
        ]);

        if (!detailRes.ok) throw new Error("Game not found");

        const detailData: GameDetail = await detailRes.json();
        setGame(detailData);

        if (historyRes.ok) {
          const historyData: GameHistory = await historyRes.json();
          setHistory(historyData);
        } else {
          console.warn(`getGameMoveHistory returned ${historyRes.status} for game ${gameId}`);
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAll();
  }, [gameId]);

  const handleCopyPgn = () => {
    if (!game?.pgn) return;
    navigator.clipboard.writeText(game.pgn);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getResultLabel = () => {
    if (!game) return null;
    const isDraw =
      game.status === "draw" ||
      (game.winnerId === null && game.status === "finished");
    const isWinner = game.winnerId === user?.id;
    if (isDraw) return { label: "Draw", color: "#94a3b8", icon: <Handshake size={16} /> };
    if (isWinner) return { label: "Victory", color: "#22c55e", icon: <Trophy size={16} /> };
    return { label: "Defeat", color: "#ef4444", icon: <Flag size={16} /> };
  };

  // ── Loading ────────────────────────────────────────────────────────────────

  if (!mounted || isLoading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          gap: "1rem",
          color: "white",
        }}
      >
        <div
          style={{
            width: "48px",
            height: "48px",
            border: "3px solid rgba(168,85,247,0.3)",
            borderTopColor: "#a855f7",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }}
        />
        <p style={{ color: "rgba(255,255,255,0.4)" }}>Loading game archive…</p>
        <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          gap: "1rem",
          color: "white",
        }}
      >
        <h2 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Game Not Found</h2>
        <p style={{ color: "rgba(255,255,255,0.4)" }}>
          {error ?? "This game does not exist or you don't have access."}
        </p>
        <Link
          href="/archives"
          style={{
            padding: "10px 24px",
            background: "#a855f7",
            borderRadius: "10px",
            color: "white",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          ← Back to Archives
        </Link>
      </div>
    );
  }

  const isPlayerWhite = game.whiteId === user?.id;
  const result = getResultLabel();
  const moves: VerboseMove[] = history?.moves ?? [];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        color: "white",
        overflow: "hidden",
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          padding: "1rem 1.5rem",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          background: "rgba(255,255,255,0.02)",
          flexShrink: 0,
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/archives"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            color: "rgba(255,255,255,0.5)",
            textDecoration: "none",
            fontSize: "0.85rem",
            transition: "color 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "white")}
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = "rgba(255,255,255,0.5)")
          }
        >
          <ArrowLeft size={16} /> Archives
        </Link>

        <div
          style={{
            width: "1px",
            height: "20px",
            background: "rgba(255,255,255,0.1)",
          }}
        />

        {/* Players */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            flex: 1,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                background: "#f0d9b5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
              }}
            >
              ♔
            </div>
            <span
              style={{
                fontWeight: 600,
                color: game.whiteId === user?.id ? "#a855f7" : "white",
              }}
            >
              {game.whiteUsername ?? "Unknown"}
            </span>
          </div>

          <span style={{ color: "rgba(255,255,255,0.3)", fontWeight: 700 }}>
            vs
          </span>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                background: "#333",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
              }}
            >
              ♚
            </div>
            <span
              style={{
                fontWeight: 600,
                color: game.blackId === user?.id ? "#a855f7" : "white",
              }}
            >
              {game.blackUsername ?? "Unknown"}
            </span>
          </div>
        </div>

        {/* Meta badges */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {result && (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "4px 12px",
                borderRadius: "8px",
                fontSize: "0.8rem",
                fontWeight: 700,
                background: `${result.color}20`,
                color: result.color,
                border: `1px solid ${result.color}40`,
              }}
            >
              {result.icon} {result.label}
            </span>
          )}
          <span
            style={{
              padding: "4px 10px",
              borderRadius: "8px",
              fontSize: "0.75rem",
              fontWeight: 700,
              background: game.timeControl?.includes("blitz")
                ? "rgba(245,158,11,0.15)"
                : game.timeControl?.includes("bullet")
                ? "rgba(239,68,68,0.15)"
                : "rgba(59,130,246,0.15)",
              color: game.timeControl?.includes("blitz")
                ? "#f59e0b"
                : game.timeControl?.includes("bullet")
                ? "#ef4444"
                : "#3b82f6",
            }}
          >
            {getTimeControlLabel(game.timeControl)}
          </span>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "0.75rem",
              color: "rgba(255,255,255,0.35)",
            }}
          >
            <Calendar size={12} /> {formatDate(game.createdAt)}
            <Clock size={12} style={{ marginLeft: "4px" }} />{" "}
            {formatTime(game.createdAt)}
          </span>
        </div>
      </div>

      {/* ── Main content ──────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "auto", padding: "1.5rem" }}>
        {/* No moves notice — only when the game truly has NO navigable data at all */}
        {moves.length === 0 && !game.pgn && (
          <div
            style={{
              marginBottom: "1rem",
              padding: "10px 16px",
              background: "rgba(245,158,11,0.1)",
              border: "1px solid rgba(245,158,11,0.25)",
              borderRadius: "10px",
              color: "#f59e0b",
              fontSize: "0.82rem",
            }}
          >
            ⚠️ No move data available for this game.
          </div>
        )}

        {/* Player label above board */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "8px",
          }}
        >
          <div
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "50%",
              background: isPlayerWhite ? "#333" : "#f0d9b5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isPlayerWhite ? "♚" : "♔"}
          </div>
          <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>
            {isPlayerWhite ? game.blackUsername : game.whiteUsername}
          </span>
          <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.3)" }}>
            Opponent
          </span>
        </div>

        {/* ── Chess Replay Component ─────────────────────────────────────── */}
        <ChessReplay
          moves={moves}
          orientation={isPlayerWhite ? "white" : "black"}
          boardSize="min(520px, calc(100vw - 340px))"
          finalFen={game.finalFen ?? undefined}
        />

        {/* Player label below board */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginTop: "8px",
          }}
        >
          <div
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "50%",
              background: isPlayerWhite ? "#f0d9b5" : "#333",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isPlayerWhite ? "♔" : "♚"}
          </div>
          <span
            style={{ fontWeight: 600, fontSize: "0.9rem", color: "#a855f7" }}
          >
            {isPlayerWhite ? game.whiteUsername : game.blackUsername} (You)
          </span>
          <span
            style={{
              fontSize: "0.72rem",
              color: result?.color ?? "rgba(255,255,255,0.3)",
            }}
          >
            {result?.label ?? ""}
          </span>
        </div>

        {/* ── Result summary ────────────────────────────────────────────── */}
        <div
          style={{
            marginTop: "1.5rem",
            padding: "12px 16px",
            background: result ? `${result.color}0d` : "rgba(255,255,255,0.03)",
            border: result
              ? `1px solid ${result.color}30`
              : "1px solid rgba(255,255,255,0.07)",
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                fontWeight: 700,
                fontSize: "0.9rem",
                color: result?.color ?? "white",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {result?.icon}
              {result?.label ?? (game.winnerId ? "Decided" : "Draw")}
            </span>
            <span
              style={{
                fontSize: "0.75rem",
                color: "rgba(255,255,255,0.3)",
              }}
            >
              {game.status === "resigned"
                ? "By resignation"
                : game.status === "draw"
                ? "Agreed draw"
                : game.status === "finished"
                ? "By checkmate"
                : game.status ?? ""}
            </span>
          </div>

          <span
            style={{
              fontSize: "0.75rem",
              color: "rgba(255,255,255,0.25)",
            }}
          >
            {moves.length} moves played
          </span>
        </div>

        {/* ── PGN section ───────────────────────────────────────────────── */}
        {game.pgn && (
          <div
            style={{
              marginTop: "1rem",
              padding: "12px",
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: "12px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "8px",
              }}
            >
              <span
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  color: "rgba(255,255,255,0.35)",
                  textTransform: "uppercase",
                }}
              >
                PGN
              </span>
              <button
                onClick={handleCopyPgn}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  border: "none",
                  background: copied
                    ? "rgba(34,197,94,0.15)"
                    : "rgba(255,255,255,0.07)",
                  color: copied ? "#22c55e" : "rgba(255,255,255,0.5)",
                  cursor: "pointer",
                  fontSize: "0.7rem",
                  transition: "all 0.2s",
                }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? "Copied!" : "Copy PGN"}
              </button>
            </div>
            <textarea
              readOnly
              value={game.pgn}
              style={{
                width: "100%",
                height: "72px",
                resize: "none",
                background: "transparent",
                border: "none",
                color: "rgba(255,255,255,0.45)",
                fontSize: "0.7rem",
                lineHeight: 1.6,
                fontFamily: "monospace",
                outline: "none",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
