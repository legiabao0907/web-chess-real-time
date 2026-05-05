"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
const Chessboard: any = dynamic(
  () => import("react-chessboard").then((mod) => mod.Chessboard as any),
  { ssr: false }
);
import { Chess } from "chess.js";
import {
  Flag,
  Handshake,
  ChevronLeft,
  ChevronRight,
  SkipBack,
  SkipForward,
  Bot,
  Cpu,
  Zap,
  Brain,
  ArrowLeft,
  BarChart3,
} from "lucide-react";
import "../play/play.css";
import "./bot.css";
import { useChessSocket, Difficulty, GameState } from "@/hooks/useChessSocket";
import { getUser, AuthUser } from "@/lib/auth";
import EvaluationBar from "@/components/chess/EvaluationBar";

const DIFFICULTY_CONFIG = {
  easy: {
    label: "Easy",
    description: "Beginner-friendly, makes random mistakes",
    icon: Zap,
    color: "#22c55e",
    bg: "rgba(34,197,94,0.12)",
    border: "rgba(34,197,94,0.35)",
    depth: "Depth 1",
  },
  medium: {
    label: "Medium",
    description: "Intermediate — plays solid chess",
    icon: Cpu,
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.12)",
    border: "rgba(245,158,11,0.35)",
    depth: "Depth 3",
  },
  hard: {
    label: "Hard",
    description: "Advanced minimax with α-β pruning",
    icon: Brain,
    color: "#ef4444",
    bg: "rgba(239,68,68,0.12)",
    border: "rgba(239,68,68,0.35)",
    depth: "Depth 5",
  },
} as const;

export default function PlayBotPage() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  // Setup state
  const [setupDone, setSetupDone] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>("medium");
  const [selectedSide, setSelectedSide] = useState<"white" | "black">("white");

  // Navigation
  const [viewIndex, setViewIndex] = useState<number>(-1);
  const [viewFen, setViewFen] = useState<string | null>(null);
  const moveHistoryRef = useRef<HTMLDivElement>(null);

  // Analysis mode
  const [analysisEnabled, setAnalysisEnabled] = useState(false);
  const analysisTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const localGame = useMemo(() => new Chess(), []);

  useEffect(() => {
    setMounted(true);
    setUser(getUser());
  }, []);

  const { connected, gameStatus, game, drawOffered, errorMessage, analysis, actions } =
    useChessSocket({ userId: user?.id ?? "", username: user?.username ?? "Guest" });

  // Sync local chess engine
  useEffect(() => {
    if (game) {
      localGame.load(game.fen);
      setViewIndex(-1);
      setViewFen(null);
    }
  }, [game?.fen, localGame]);

  // Auto-analyze when enabled & position changes
  useEffect(() => {
    if (!analysisEnabled || !game?.fen || game.status !== "active") return;
    if (analysisTimeoutRef.current) clearTimeout(analysisTimeoutRef.current);
    analysisTimeoutRef.current = setTimeout(() => {
      actions.analyzePosition(game.fen, game.gameId);
    }, 400);
    return () => {
      if (analysisTimeoutRef.current) clearTimeout(analysisTimeoutRef.current);
    };
  }, [game?.fen, analysisEnabled]);

  // Auto-scroll history
  useEffect(() => {
    if (viewIndex === -1) {
      moveHistoryRef.current?.scrollTo({ top: moveHistoryRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [game?.moveHistory?.length, viewIndex]);

  // Build FEN list for navigation
  const allFens = useMemo(() => {
    if (!game?.moveHistory?.length) return [];
    try {
      const chess = new Chess();
      return game.moveHistory.map((san) => { chess.move(san); return chess.fen(); });
    } catch { return []; }
  }, [game?.moveHistory]);

  const navigateTo = useCallback((idx: number) => {
    if (!game) return;
    if (idx === -1 || idx >= allFens.length) { setViewIndex(-1); setViewFen(null); }
    else if (idx < 0) { setViewIndex(0); setViewFen(allFens[0] ?? null); }
    else { setViewIndex(idx); setViewFen(allFens[idx] ?? null); }
  }, [allFens, game]);

  // Keyboard nav
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!game || !allFens.length) return;
      if (document.activeElement?.tagName === "INPUT") return;
      const current = viewIndex === -1 ? allFens.length - 1 : viewIndex;
      if (e.key === "ArrowLeft") { e.preventDefault(); navigateTo(Math.max(0, current - 1)); }
      else if (e.key === "ArrowRight") { e.preventDefault(); if (current >= allFens.length - 1) navigateTo(-1); else navigateTo(current + 1); }
      else if (e.key === "ArrowUp" || e.key === "Home") { e.preventDefault(); navigateTo(0); }
      else if (e.key === "ArrowDown" || e.key === "End") { e.preventDefault(); navigateTo(-1); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [game, allFens, viewIndex, navigateTo]);

  function onDrop(sourceSquare: any, targetSquare: any, piece: any) {
    if (!user || !game || game.status !== "active") return false;
    if (viewIndex !== -1) return false;
    // Prevent moves when it's bot's turn
    const isMyTurn =
      (game.turn === "w" && game.whiteId === user.id) ||
      (game.turn === "b" && game.blackId === user.id);
    if (!isMyTurn) return false;
    const promotion = (typeof piece === "string" ? piece[1] : "q")?.toLowerCase() ?? "q";
    try {
      const move = localGame.move({ from: sourceSquare, to: targetSquare, promotion });
      if (!move) return false;
      actions.makeMove(game.gameId, { from: sourceSquare, to: targetSquare, promotion });
      return true;
    } catch { return false; }
  }

  function handleStartGame() {
    if (!connected || !user) return;
    actions.startBotGame(selectedDifficulty, selectedSide, "blitz_5");
    setSetupDone(true);
  }

  function handleNewGame() {
    actions.clearGame();
    setSetupDone(false);
    setViewIndex(-1);
    setViewFen(null);
  }

  const formatTime = (ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  };

  if (!mounted) return null;
  if (!user) return (
    <div className="p-8 text-center text-white flex flex-col items-center justify-center h-full">
      <h2 className="text-2xl font-bold mb-4">You are not logged in</h2>
      <p>Please log in to play against the bot.</p>
    </div>
  );

  const isPlayerWhite = game ? game.whiteId === user.id : selectedSide === "white";
  const opponentName = game
    ? (isPlayerWhite ? game.blackUsername : game.whiteUsername)
    : `Chess Bot (${DIFFICULTY_CONFIG[selectedDifficulty].label})`;
  const displayFen = viewFen ?? game?.fen ?? "start";
  const isReviewing = viewIndex !== -1;
  const currentMoveIdx = viewIndex === -1 ? allFens.length - 1 : viewIndex;
  const isMyTurn = game?.status === "active" &&
    ((isPlayerWhite && game.turn === "w") || (!isPlayerWhite && game.turn === "b"));
  const isBotTurn = game?.status === "active" && !isMyTurn;

  const cfg = DIFFICULTY_CONFIG[selectedDifficulty];

  const moveRows: { turn: number; white: string; black: string | null; whiteIdx: number; blackIdx: number | null }[] = [];
  if (game?.moveHistory) {
    for (let i = 0; i < game.moveHistory.length; i += 2) {
      moveRows.push({
        turn: Math.floor(i / 2) + 1,
        white: game.moveHistory[i],
        black: game.moveHistory[i + 1] ?? null,
        whiteIdx: i,
        blackIdx: game.moveHistory[i + 1] != null ? i + 1 : null,
      });
    }
  }

  // ── Setup Screen ─────────────────────────────────────────────────────────
  if (!setupDone || gameStatus === "idle") {
    return (
      <div className="bot-setup-screen">
        <div className="bot-setup-card">
          <div className="bot-setup-header">
            <div className="bot-icon-wrap">
              <Bot size={36} />
            </div>
            <h1 className="bot-setup-title">Play vs Bot</h1>
            <p className="bot-setup-sub">Challenge our Minimax AI with Alpha-Beta Pruning</p>
          </div>

          {/* Difficulty Selection */}
          <div className="setup-section">
            <label className="setup-label">Difficulty</label>
            <div className="difficulty-grid">
              {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map((d) => {
                const c = DIFFICULTY_CONFIG[d];
                const Icon = c.icon;
                const selected = selectedDifficulty === d;
                return (
                  <button
                    key={d}
                    onClick={() => setSelectedDifficulty(d)}
                    className={`diff-btn ${selected ? "selected" : ""}`}
                    style={selected ? {
                      borderColor: c.border,
                      background: c.bg,
                      boxShadow: `0 0 20px ${c.bg}`,
                    } : {}}
                  >
                    <Icon size={22} style={{ color: selected ? c.color : "rgba(255,255,255,0.4)" }} />
                    <span className="diff-label" style={{ color: selected ? c.color : "rgba(255,255,255,0.8)" }}>
                      {c.label}
                    </span>
                    <span className="diff-depth">{c.depth}</span>
                    <span className="diff-desc">{c.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Side Selection */}
          <div className="setup-section">
            <label className="setup-label">Play as</label>
            <div className="side-grid">
              {(["white", "black"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedSide(s)}
                  className={`side-btn ${selectedSide === s ? "selected" : ""}`}
                >
                  <span className="side-piece">{s === "white" ? "♔" : "♚"}</span>
                  <span className="side-label">{s === "white" ? "White" : "Black"}</span>
                  <span className="side-sub">{s === "white" ? "Move first" : "Move second"}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            id="start-bot-game-btn"
            onClick={handleStartGame}
            disabled={!connected}
            className="start-bot-btn"
            style={{ background: `linear-gradient(135deg, ${cfg.color}, ${cfg.color}cc)` }}
          >
            <Bot size={18} />
            Start Game vs {cfg.label} Bot
          </button>

          {!connected && (
            <p className="text-yellow-400 text-sm text-center mt-2">
              Connecting to server...
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Game Screen ───────────────────────────────────────────────────────────
  return (
    <div className="play-container relative flex h-full">
      {errorMessage && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded shadow z-50 text-sm">
          {errorMessage}
        </div>
      )}

      {/* LEFT COLUMN */}
      <div className="board-area relative flex-1">
        {/* Bot difficulty badge */}
        <div className="px-4 pt-2 flex items-center gap-2">
          <button
            onClick={handleNewGame}
            className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition"
          >
            <ArrowLeft size={12} /> New game
          </button>
          <span
            className="ml-auto flex items-center gap-1 text-xs px-2 py-1 rounded font-bold"
            style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
          >
            <Bot size={11} /> {cfg.label} Bot
          </span>
          {/* Analysis toggle */}
          <button
            onClick={() => setAnalysisEnabled(!analysisEnabled)}
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition font-bold ${analysisEnabled ? "bg-purple-500/20 text-purple-400 border border-purple-500/40" : "text-white/30 hover:text-white/60"}`}
          >
            <BarChart3 size={11} /> Analysis
          </button>
        </div>

        {/* Opponent Row */}
        <div className="player-row px-4 pt-2">
          <div className="player-info">
            <div className="player-avatar" style={{ background: "linear-gradient(135deg, #1a1a2e, #16213e)" }}>
              <Bot size={28} style={{ color: cfg.color, margin: "auto", display: "block", marginTop: "10px" }} />
            </div>
            <div className="player-details">
              <div className="player-name">
                {opponentName}
                {isBotTurn && (
                  <span className="ml-2 text-xs animate-pulse" style={{ color: cfg.color }}>
                    thinking...
                  </span>
                )}
              </div>
              <div className="player-meta" style={{ color: cfg.color }}>
                Minimax AI · {cfg.depth}
              </div>
            </div>
          </div>
          <div className={`clock ${isBotTurn ? "active" : ""}`}>
            <span className="clock-time">
              {formatTime(isPlayerWhite ? (game?.blackTimeMs ?? 0) : (game?.whiteTimeMs ?? 0))}
            </span>
          </div>
        </div>

        {/* Board row with EvaluationBar */}
        <div className="board-wrapper p-4 relative flex-1 flex gap-3 justify-center items-center">
          {/* Evaluation Bar */}
          {analysisEnabled && analysis && (
            <EvaluationBar
              score={analysis.score}
              orientation={isPlayerWhite ? "white" : "black"}
              isCheckmate={analysis.isCheckmate}
            />
          )}

          <div className="w-full max-w-[580px] max-h-[580px] aspect-square relative">
            {typeof window !== "undefined" && (
              <Chessboard
                position={displayFen}
                onPieceDrop={isReviewing ? () => false : onDrop}
                animationDuration={150}
                boardOrientation={isPlayerWhite ? "white" : "black"}
                arePiecesDraggable={!isReviewing && game?.status === "active" && isMyTurn}
                customBoardStyle={{
                  borderRadius: "6px",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                }}
              />
            )}

            {/* Reviewing banner */}
            {isReviewing && (
              <div style={{
                position: "absolute", bottom: "8px", left: "50%", transform: "translateX(-50%)",
                background: "rgba(0,0,0,0.85)", borderRadius: "8px", padding: "6px 14px",
                color: "rgba(255,255,255,0.7)", fontSize: "12px", fontWeight: 600,
                border: "1px solid rgba(255,255,255,0.15)", whiteSpace: "nowrap",
              }}>
                Move {currentMoveIdx + 1} / {allFens.length} · ← → to navigate
              </div>
            )}

            {/* Game Over Overlay */}
            {game?.status && game.status !== "active" && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/65 backdrop-blur-md rounded-lg">
                <div className="text-center p-8 bg-[#1a1a24] rounded-xl shadow-2xl border border-[#a855f7]/30 min-w-[280px]">
                  <div className="text-5xl mb-3">
                    {game.winner === "draw" ? "🤝" :
                      ((game.winner === "white" && isPlayerWhite) || (game.winner === "black" && !isPlayerWhite)) ? "🏆" : "🤖"}
                  </div>
                  <h2 className="text-3xl font-bold text-white mb-1">
                    {game.winner === "draw" ? "Draw!" :
                      ((game.winner === "white" && isPlayerWhite) || (game.winner === "black" && !isPlayerWhite))
                        ? "You Win!" : "Bot Wins!"}
                  </h2>
                  <p className="text-white/50 text-sm mb-6">
                    {game.winner === "draw" ? "Stalemate or insufficient material" :
                      game.status === "resigned" ? "By resignation" : "By checkmate"}
                  </p>
                  <button
                    onClick={handleNewGame}
                    className="px-8 py-3 bg-[#a855f7] hover:bg-[#9333ea] text-white rounded-lg transition font-bold block w-full"
                  >
                    Play Again
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* My Row */}
        <div className="player-row px-4 pb-4">
          <div className="player-info">
            <div className="player-avatar">
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username}`} alt="You" />
              <div className="status-dot online" />
            </div>
            <div className="player-details">
              <div className="player-name">{user?.username} (You)</div>
              <div className="player-meta">ELO {user?.eloBlitz ?? "---"}</div>
            </div>
          </div>
          <div className={`clock ${isMyTurn ? "active" : ""}`}>
            <span className="clock-time">
              {formatTime(isPlayerWhite ? (game?.whiteTimeMs ?? 0) : (game?.blackTimeMs ?? 0))}
            </span>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN */}
      <div className="console-area w-[300px] shrink-0 border-l border-white/10 flex flex-col">
        <div className="console-header p-3 border-b border-white/10 flex items-center bg-white/5">
          <span className="text-xs font-bold text-white/70 uppercase tracking-widest">Move History</span>
          <span className="ml-auto text-xs bg-[#a855f7]/20 text-[#a855f7] px-2 py-1 rounded">
            vs Bot
          </span>
        </div>

        {/* Analysis Panel */}
        {analysisEnabled && analysis && (
          <div className="bot-analysis-panel">
            <div className="analysis-score-row">
              <span className="analysis-score-label">Evaluation</span>
              <span
                className="analysis-score-val"
                style={{ color: analysis.score > 30 ? "#f0d9b5" : analysis.score < -30 ? "#aaa" : "#888" }}
              >
                {analysis.isCheckmate
                  ? (analysis.score > 0 ? "White mates" : "Black mates")
                  : Math.abs(analysis.score) < 30
                  ? "Equal"
                  : `${analysis.score > 0 ? "+" : ""}${(analysis.score / 100).toFixed(2)}`}
              </span>
            </div>
            {analysis.bestMove && (
              <div className="analysis-best-move">
                <span className="analysis-bm-label">Best move</span>
                <span className="analysis-bm-val">
                  {analysis.bestMove.from} → {analysis.bestMove.to}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Move history */}
        <div className="move-history flex-1 overflow-y-auto p-3 flex flex-col gap-1" ref={moveHistoryRef}>
          {moveRows.length === 0 ? (
            <div className="text-center text-xs text-white/30 pt-6 italic flex flex-col items-center gap-2">
              <Bot size={24} className="opacity-20" />
              Game started — make your move!
            </div>
          ) : moveRows.map((row, i) => (
            <div key={i} className="move-row flex py-1 px-2 rounded text-sm">
              <span className="move-number w-8 text-white/40">{row.turn}.</span>
              <span
                onClick={() => navigateTo(row.whiteIdx)}
                className={`move-white flex-1 font-semibold px-1 rounded cursor-pointer hover:bg-white/10 ${currentMoveIdx === row.whiteIdx ? "bg-[#a855f7]/25 text-[#a855f7]" : ""}`}
              >
                {row.white}
              </span>
              <span
                onClick={() => row.blackIdx !== null && navigateTo(row.blackIdx)}
                className={`move-black flex-1 font-semibold px-1 rounded ${row.black ? "cursor-pointer hover:bg-white/10" : ""} ${row.blackIdx !== null && currentMoveIdx === row.blackIdx ? "bg-[#a855f7]/25 text-[#a855f7]" : ""}`}
              >
                {row.black ?? "..."}
              </span>
            </div>
          ))}
        </div>

        {/* Navigation controls */}
        {allFens.length > 0 && (
          <div className="flex items-center justify-center gap-1 p-2 border-t border-white/10 bg-white/3">
            <button onClick={() => navigateTo(0)} disabled={currentMoveIdx === 0}
              className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white disabled:opacity-25 transition">
              <SkipBack size={14} />
            </button>
            <button onClick={() => navigateTo(Math.max(0, currentMoveIdx - 1))} disabled={currentMoveIdx === 0}
              className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white disabled:opacity-25 transition">
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs text-white/40 mx-2 min-w-[60px] text-center">
              {isReviewing ? `${currentMoveIdx + 1}/${allFens.length}` : "Live"}
            </span>
            <button onClick={() => navigateTo(Math.min(allFens.length - 1, currentMoveIdx + 1))} disabled={!isReviewing}
              className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white disabled:opacity-25 transition">
              <ChevronRight size={14} />
            </button>
            <button onClick={() => navigateTo(-1)} disabled={!isReviewing}
              className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white disabled:opacity-25 transition">
              <SkipForward size={14} />
            </button>
          </div>
        )}

        {/* Footer actions */}
        <div className="console-footer p-4 bg-white/5 border-t border-white/10">
          <div className="action-buttons grid grid-cols-2 gap-2">
            <button
              onClick={() => game?.gameId && actions.resign(game.gameId)}
              disabled={!game || game.status !== "active"}
              className="action-btn primary-action flex items-center justify-center gap-2 py-2 rounded bg-red-500/20 hover:bg-red-500/40 text-red-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Flag size={14} /> Resign
            </button>
            <button
              onClick={handleNewGame}
              className="action-btn flex items-center justify-center gap-2 py-2 rounded bg-white/5 hover:bg-white/10 text-white/80 transition"
            >
              <Bot size={14} /> New Game
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
