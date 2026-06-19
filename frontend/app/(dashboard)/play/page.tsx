"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
const Chessboard: any = dynamic(
  () => import("react-chessboard").then((mod) => mod.Chessboard as any),
  { ssr: false }
);
import { Chess, Square } from "chess.js";
import { Flag, Handshake, MessageSquare, Search, X, Send, ChevronLeft, ChevronRight, SkipBack, SkipForward, BarChart3, Swords } from "lucide-react";
import "./play.css";
import { useChessSocket } from "@/hooks/useChessSocket";
import { getUser, AuthUser } from "@/lib/auth";
import { useSearchParams } from "next/navigation";
import { useChatStore } from "@/store/useChatStore";
import OpponentProfilePopup from "@/components/chess/OpponentProfilePopup";
import EvaluationBar from "@/components/chess/EvaluationBar";

// ─── Premove types ──────────────────────────────────────────────────────
type Premove = { from: Square; to: Square; promotion?: string } | null;

function PlayPageContent() {
  const searchParams = useSearchParams();
  const urlGameId = searchParams.get("gameId");
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const moveHistoryRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"history" | "chat">("history");
  const [chatInput, setChatInput] = useState("");
  const [analysisEnabled, setAnalysisEnabled] = useState(false);
  const analysisTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Arrow-key move navigation
  const [viewIndex, setViewIndex] = useState<number>(-1); // -1 = live (latest)
  const [viewFen, setViewFen] = useState<string | null>(null);

  // Online tracking via ChatGateway
  const { onlineUsers } = useChatStore();

  // Opponent profile popup
  const [showOpponentPopup, setShowOpponentPopup] = useState(false);

  // Matchmaking
  const [selectedTc, setSelectedTc] = useState<string | null>(null);

  // Clocks
  const [whiteClock, setWhiteClock] = useState(0);
  const [blackClock, setBlackClock] = useState(0);

  // ─── Click-to-move state ────────────────────────────────────────────
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  // Legal moves from selected piece (for highlighting)
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);

  // ─── Premove state ──────────────────────────────────────────────────
  const [premove, setPremove] = useState<Premove>(null);
  const premoveRef = useRef<Premove>(null); // ref for latest premove in event handlers

  const localGame = useMemo(() => new Chess(), []);

  useEffect(() => {
    setMounted(true);
    setUser(getUser());
  }, []);

  const { connected, gameStatus, game, chatMessages, drawOffered, errorMessage, searchingTimeControl, analysis, searchProgress, actions } =
    useChessSocket({ userId: user?.id ?? "", username: user?.username ?? "Guest" });

  // Auto-join game from URL if connected
  useEffect(() => {
    if (connected && urlGameId) {
      if (game?.gameId !== urlGameId) {
        actions.joinGame(urlGameId);
      }
    }
  }, [connected, urlGameId, game?.gameId, actions]);

  // Sync clocks
  useEffect(() => {
    if (game) {
      setWhiteClock(game.whiteTimeMs);
      setBlackClock(game.blackTimeMs);
      localGame.load(game.fen);
      setViewIndex(-1);
      setViewFen(null);
      // Clear selection & premove when game state updates from server
      setSelectedSquare(null);
      setLegalMoves([]);
      // Clear premove when game is no longer active
      if (game.status !== "active") {
        setPremove(null);
        premoveRef.current = null;
      }
      // Auto-analyze if enabled
      if (analysisEnabled) {
        if (analysisTimerRef.current) clearTimeout(analysisTimerRef.current);
        analysisTimerRef.current = setTimeout(() => actions.analyzePosition(game.fen, game.gameId), 400);
      }
    }
  }, [game?.whiteTimeMs, game?.blackTimeMs, game?.fen, game?.gameId, localGame]);

  // Real-time countdown
  useEffect(() => {
    if (!game || game.status !== "active" || !game.lastMoveAt) return;
    const interval = setInterval(() => {
      const elapsed = Date.now() - game.lastMoveAt!;
      if (game.turn === "w") {
        const remaining = Math.max(0, game.whiteTimeMs - elapsed);
        setWhiteClock(remaining);
        if (remaining === 0) actions.claimTimeout(game.gameId);
      } else {
        const remaining = Math.max(0, game.blackTimeMs - elapsed);
        setBlackClock(remaining);
        if (remaining === 0) actions.claimTimeout(game.gameId);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [game?.turn, game?.status, game?.lastMoveAt, game?.whiteTimeMs, game?.blackTimeMs, game?.gameId]);

  // Auto-scroll move history
  useEffect(() => {
    if (activeTab === "history" && viewIndex === -1) {
      moveHistoryRef.current?.scrollTo({ top: moveHistoryRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [game?.moveHistory?.length, activeTab, viewIndex]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages.length]);

  // Client-side elapsed time counter during searching
  const [clientElapsed, setClientElapsed] = useState(0);
  useEffect(() => {
    if (gameStatus !== "searching") {
      setClientElapsed(0);
      return;
    }
    const interval = setInterval(() => {
      setClientElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [gameStatus]);

  // Merge server progress with client elapsed
  const displayProgress = searchProgress
    ? { ...searchProgress, elapsed: clientElapsed || searchProgress.elapsed }
    : null;

  // ── Build FEN list from moveHistory for arrow-key navigation ───────────────
  // Replay each SAN move from the beginning to capture the board state after each move.
  const allFens = useMemo(() => {
    if (!game?.moveHistory?.length) return [];
    try {
      const chess = new Chess(); // starts at initial position
      return game.moveHistory.map((san) => {
        chess.move(san);
        return chess.fen();
      });
    } catch {
      return [];
    }
  }, [game?.moveHistory]);

  const navigateTo = useCallback((idx: number) => {
    if (!game) return;
    if (idx === -1 || idx >= allFens.length) {
      setViewIndex(-1);
      setViewFen(null);
    } else if (idx < 0) {
      // Go to start
      setViewIndex(0);
      setViewFen(allFens[0] ?? null);
    } else {
      setViewIndex(idx);
      setViewFen(allFens[idx] ?? null);
    }
  }, [allFens, game]);

  // Keyboard handler
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!game || !allFens.length) return;
      // Don't interfere with chat input
      if (document.activeElement?.tagName === "INPUT") return;
      const current = viewIndex === -1 ? allFens.length - 1 : viewIndex;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        navigateTo(Math.max(0, current - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (current >= allFens.length - 1) navigateTo(-1);
        else navigateTo(current + 1);
      } else if (e.key === "ArrowUp" || e.key === "Home") {
        e.preventDefault();
        navigateTo(0);
      } else if (e.key === "ArrowDown" || e.key === "End") {
        e.preventDefault();
        navigateTo(-1);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [game, allFens, viewIndex, navigateTo]);

  const handleSendMessage = useCallback(() => {
    if (!game?.gameId || !chatInput.trim()) return;
    actions.sendMessage(game.gameId, chatInput.trim());
    setChatInput("");
  }, [game?.gameId, chatInput, actions]);

  const handleChatKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
  };

  // ── Premove execution: when opponent's move arrives, check & fire stored premove ──
  const executePremove = useCallback((currentGame: typeof game) => {
    const p = premoveRef.current;
    if (!p || !currentGame || currentGame.status !== "active") return;
    // Only execute if it's now our turn
    const isPlayerTurn = (currentGame.turn === "w" && currentGame.whiteId === user?.id) ||
                         (currentGame.turn === "b" && currentGame.blackId === user?.id);
    if (!isPlayerTurn) return;

    // Validate premove is still legal
    try {
      const chess = new Chess(currentGame.fen);
      const move = chess.move({ from: p.from, to: p.to, promotion: p.promotion ?? "q" });
      if (move) {
        // Premove is legal — send to server with premove flag
        actions.makeMove(currentGame.gameId, { from: p.from, to: p.to, promotion: p.promotion }, true);
      }
    } catch { /* illegal premove after opponent's move — discard silently */ }
    // Clear premove regardless (even if illegal after opponent's move)
    setPremove(null);
    premoveRef.current = null;
  }, [user?.id, actions]);

  // ── Watch for opponent's move to trigger premove ──
  const prevTurnRef = useRef(game?.turn);
  useEffect(() => {
    if (!game || !user) return;
    const prevTurn = prevTurnRef.current;
    prevTurnRef.current = game.turn;
    // If turn changed to ours, try executing premove
    const isNowMyTurn = (game.turn === "w" && game.whiteId === user.id) ||
                        (game.turn === "b" && game.blackId === user.id);
    if (isNowMyTurn && prevTurn && prevTurn !== game.turn) {
      executePremove(game);
    }
  }, [game?.turn, game?.whiteId, game?.blackId, user?.id, executePremove]);

  // ── Click-to-move: select a piece ────────────────────────────────────
  function onPieceClick(piece: string) {
    if (!user || !game || game.status !== "active") return;
    if (viewIndex !== -1) return;
    const isMyTurn = (game.turn === "w" && game.whiteId === user.id) || (game.turn === "b" && game.blackId === user.id);

    // Extract square from piece (format: "wP", "bK", etc.)
    const boardPos = getBoardPosition(game.fen);
    const square = findPieceSquare(boardPos, piece);
    if (!square) { setSelectedSquare(null); setLegalMoves([]); return; }

    // Only allow selecting own pieces
    const pieceColor = piece[0]; // "w" or "b"
    const myColor = isPlayerWhite ? "w" : "b";
    if (pieceColor !== myColor) { setSelectedSquare(null); setLegalMoves([]); return; }

    if (selectedSquare === square) {
      setSelectedSquare(null);
      setLegalMoves([]);
    } else {
      setSelectedSquare(square);
      try {
        const chess = new Chess(game.fen);
        const moves = chess.moves({ square: square, verbose: true });
        setLegalMoves(moves.map((m: any) => m.to as Square));
      } catch { setLegalMoves([]); }
    }
  }

  // ── Click-to-move: select destination ────────────────────────────────
  function onSquareClick(square: Square) {
    if (!user || !game || game.status !== "active") return;
    if (viewIndex !== -1) return;
    const isMyTurn = (game.turn === "w" && game.whiteId === user.id) || (game.turn === "b" && game.blackId === user.id);

    if (selectedSquare) {
      if (isMyTurn) {
        // Regular move
        const promotion = (() => {
          const piece = getPieceAt(game.fen, selectedSquare);
          if (piece && piece.toLowerCase() === (isPlayerWhite ? 'p' : 'p')) {
            const targetRank = square[1];
            if (targetRank === '8' || targetRank === '1') return 'q';
          }
          return undefined;
        })();
        try {
          const chess = new Chess(game.fen);
          const move = chess.move({ from: selectedSquare, to: square, promotion: promotion ?? "q" });
          if (move) {
            actions.makeMove(game.gameId, { from: selectedSquare, to: square, promotion });
            setSelectedSquare(null);
            setLegalMoves([]);
            setPremove(null);
            premoveRef.current = null;
            return;
          }
        } catch { /* illegal — fall through */ }
      } else {
        // Not our turn — set premove via click
        const p: Premove = { from: selectedSquare, to: square, promotion: "q" };
        setPremove(p);
        premoveRef.current = p;
        setSelectedSquare(null);
        setLegalMoves([]);
        return;
      }
    }

    setSelectedSquare(null);
    setLegalMoves([]);
  }

  // ── Drag-drop move handler (also called by library for premove execution) ──
  function onDrop(sourceSquare: any, targetSquare: any, piece: any) {
    if (!user || !game || game.status !== "active") return false;
    if (viewIndex !== -1) return false;
    const isMyTurn = (game.turn === "w" && game.whiteId === user.id) || (game.turn === "b" && game.blackId === user.id);
    if (!targetSquare) return false;
    const promotion = (typeof piece === "string" ? piece[1] : "q")?.toLowerCase() ?? "q";

    if (!isMyTurn) {
      // NOT our turn → this is a PREMOVE (library handles visual indicator)
      const p: Premove = { from: sourceSquare as Square, to: targetSquare as Square, promotion };
      setPremove(p);
      premoveRef.current = p;
      // Don't send to server — wait for opponent's move
      return true; // Allow library to show premove indicator
    }

    // Our turn → regular move
    try {
      const move = localGame.move({ from: sourceSquare, to: targetSquare, promotion });
      if (!move) return false;
      actions.makeMove(game.gameId, { from: sourceSquare, to: targetSquare, promotion }, false);
      // Clear any stale premove
      setPremove(null);
      premoveRef.current = null;
      setSelectedSquare(null);
      setLegalMoves([]);
      return true;
    } catch { return false; }
  }

  const formatTime = (ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  };

  const formatChatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // ─── Helper: parse FEN to get piece at a square ──────────────────────
  function getBoardPosition(fen: string): Record<string, string> {
    const result: Record<string, string> = {};
    const [rows] = fen.split(" ");
    const ranks = rows.split("/");
    const files = "abcdefgh";
    for (let rankIdx = 0; rankIdx < 8; rankIdx++) {
      let fileIdx = 0;
      for (const ch of ranks[rankIdx]) {
        if (ch >= "1" && ch <= "8") { fileIdx += parseInt(ch); }
        else { const sq = files[fileIdx] + (8 - rankIdx); result[sq] = ch; fileIdx++; }
      }
    }
    return result;
  }

  function findPieceSquare(boardPos: Record<string, string>, piece: string): Square | null {
    // piece format: "wP", "bK" etc. In FEN: "P" = white pawn, "p" = black pawn
    const color = piece[0]; // "w" or "b"
    const type = piece[1]; // "P", "N", "B", "R", "Q", "K"
    const fenChar = color === "w" ? type.toUpperCase() : type.toLowerCase();
    for (const [sq, p] of Object.entries(boardPos)) {
      if (p === fenChar) return sq as Square;
    }
    return null;
  }

  function getPieceAt(fen: string, square: Square): string | null {
    const pos = getBoardPosition(fen);
    return pos[square] ?? null;
  }

  if (!mounted) return null;
  if (!user) return (
    <div className="p-8 text-center text-white flex flex-col items-center justify-center h-full">
      <h2 className="text-2xl font-bold mb-4">You are not logged in</h2>
      <p>Please log in to play matches.</p>
    </div>
  );

  // Derived values
  const isPlayerWhite = game?.whiteId === user.id;
  const opponentName = game ? (isPlayerWhite ? game.blackUsername : game.whiteUsername) : "Opponent";
  const opponentId = game ? (isPlayerWhite ? game.blackId : game.whiteId) : "";
  const myClock = isPlayerWhite ? whiteClock : blackClock;
  const opponentClock = isPlayerWhite ? blackClock : whiteClock;
  const isMyTurn = game?.status === "active" && (isPlayerWhite ? game.turn === "w" : game.turn === "b");
  const isOpponentTurn = game?.status === "active" && !isMyTurn;
  const isOpponentOnline = opponentId ? onlineUsers.has(opponentId) : gameStatus === "active";

  // FEN to display (either live or historical)
  const displayFen = viewFen ?? game?.fen ?? "start";
  const isReviewing = viewIndex !== -1;
  const currentMoveIdx = viewIndex === -1 ? allFens.length - 1 : viewIndex;

  // Move rows for history
  const moveRows: { turn: number; white: string; black: string | null; whiteIdx: number; blackIdx: number | null }[] = [];
  if (game?.moveHistory) {
    for (let i = 0; i < game.moveHistory.length; i += 2) {
      moveRows.push({ turn: Math.floor(i / 2) + 1, white: game.moveHistory[i], black: game.moveHistory[i + 1] ?? null, whiteIdx: i, blackIdx: game.moveHistory[i + 1] != null ? i + 1 : null });
    }
  }

  return (
    <div className="play-container relative flex h-full">
      {/* Opponent Profile Popup */}
      {showOpponentPopup && opponentId && (
        <OpponentProfilePopup
          opponentId={opponentId}
          opponentUsername={opponentName}
          isOnline={isOpponentOnline}
          onClose={() => setShowOpponentPopup(false)}
        />
      )}

      {errorMessage && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded shadow z-50">
          {errorMessage}
        </div>
      )}

      {/* LEFT COLUMN */}
      <div className="board-area relative flex-1">
        {/* Matchmaking Overlay — Professional Design */} 
        {(gameStatus === "idle" || gameStatus === "searching") && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm rounded-lg border border-white/10 m-4">
            {gameStatus === "idle" ? (
              <div className="matchmaking-panel">
                {/* Floating Knight Icon */}
                <div className="matchmaking-logo">
                  <span className="knight-icon">♞</span>
                </div>
                <h2 className="matchmaking-title">Find Your Opponent</h2>
                <p className="matchmaking-subtitle">Select a time control to start matchmaking</p>

                {/* Time Control Cards */}
                <div className="tc-cards">
                  {[
                    { label: "Bullet", detail: "1 min", inc: "+0 sec", tc: "bullet_1", color: "#ef4444", icon: "⚡", eloKey: "eloBullet" as const },
                    { label: "Blitz", detail: "5 min", inc: "+0 sec", tc: "blitz_5", color: "#a855f7", icon: "🔥", eloKey: "eloBlitz" as const },
                    { label: "Rapid", detail: "10 min", inc: "+0 sec", tc: "rapid_10", color: "#2563eb", icon: "🧠", eloKey: "eloRapid" as const },
                  ].map((tc) => (
                    <button
                      key={tc.tc}
                      onClick={() => setSelectedTc(tc.tc)}
                      disabled={!connected}
                      className={`tc-card ${selectedTc === tc.tc ? "selected" : ""}`}
                      style={{ "--tc-color": tc.color } as React.CSSProperties}
                    >
                      <div className="tc-card-header">
                        <span className="tc-icon">{tc.icon}</span>
                        <span className="tc-label">{tc.label}</span>
                      </div>
                      <div className="tc-detail">{tc.detail} &middot; {tc.inc}</div>
                      <div className="tc-elo">{(user as any)?.[tc.eloKey] ?? 1200} ELO</div>
                    </button>
                  ))}
                </div>

                {/* Find Match Button */}
                <button
                  onClick={() => selectedTc && actions.findGame(selectedTc, (user as any)?.[selectedTc === "bullet_1" ? "eloBullet" : selectedTc === "blitz_5" ? "eloBlitz" : "eloRapid"] ?? 1200)}
                  disabled={!connected || !selectedTc}
                  className="find-match-btn"
                >
                  <Swords size={20} />
                  Find Match
                </button>

                {!connected && (
                  <p className="text-yellow-400 text-sm mt-4 text-center">
                    Server offline. Trying to reconnect...
                  </p>
                )}
              </div>
            ) : (
              <div className="matchmaking-panel searching">
                {/* Radar Pulse Animation */}
                <div className="radar-container">
                  <div className="radar-ring ring-1" />
                  <div className="radar-ring ring-2" />
                  <div className="radar-ring ring-3" />
                  <div className="radar-center">♞</div>
                </div>

                <h2 className="matchmaking-title">Searching for Opponent</h2>
                <p className="matchmaking-subtitle">
                  {searchingTimeControl?.replace("_", " ")}
                </p>

                {/* ELO Range Bar */}
                <div className="elo-range-section">
                  <div className="elo-range-labels">
                    <span>{Math.max(0, (displayProgress?.eloRange ? (user as any)?.eloBlitz ?? 1200 - displayProgress.eloRange : 1170))}</span>
                    <span className="elo-my-rating">{(user as any)?.eloBlitz ?? 1200} (you)</span>
                    <span>{Math.max(0, (displayProgress?.eloRange ? (user as any)?.eloBlitz ?? 1200 + displayProgress.eloRange : 1230))}</span>
                  </div>
                  <div className="elo-range-bar">
                    <div
                      className="elo-range-fill"
                      style={{
                        left: `${Math.max(0, 50 - (displayProgress?.eloRange ?? 30) / 200 * 50)}%`,
                        width: `${Math.min(100, (displayProgress?.eloRange ?? 30) / 200 * 100)}%`,
                      }}
                    />
                    <div className="elo-range-dot" style={{ left: "50%" }} />
                  </div>
                  <div className="elo-range-label-row">
                    <span>Range: &plusmn;{displayProgress?.eloRange ?? 30} ELO</span>
                  </div>
                </div>

                {/* Search Stats */}
                <div className="search-stats">
                  <div className="search-stat">
                    <span className="stat-label">Elapsed</span>
                    <span className="stat-value">{String(Math.floor((displayProgress?.elapsed ?? 0) / 60)).padStart(2, "0")}:{String((displayProgress?.elapsed ?? 0) % 60).padStart(2, "0")}</span>
                  </div>
                  <div className="search-stat">
                    <span className="stat-label">Est. Wait</span>
                    <span className="stat-value">~{displayProgress?.estimatedWait ?? 15}s</span>
                  </div>
                  <div className="search-stat">
                    <span className="stat-label">In Queue</span>
                    <span className="stat-value">{displayProgress?.queueSize ?? 0} players</span>
                  </div>
                </div>

                {/* Cancel Button */}
                <button
                  onClick={() => searchingTimeControl && actions.cancelSearch(searchingTimeControl)}
                  className="cancel-search-btn"
                >
                  <X size={18} />
                  Cancel Search
                </button>
              </div>
            )}
          </div>
        )}

        {/* Opponent Row — clickable to open profile */}
        <div className="player-row px-4 pt-4">
          <button
            onClick={() => game && opponentId && setShowOpponentPopup(true)}
            className="player-info"
            style={{ background: "none", border: "none", cursor: game ? "pointer" : "default", textAlign: "left", padding: 0 }}
            title={game ? "View Profile" : ""}
          >
            <div className="player-avatar" style={{ position: "relative" }}>
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${opponentName}`} alt="Opponent" />
              <div className={`status-dot ${isOpponentOnline ? "online" : "offline"}`} />
            </div>
            <div className="player-details">
              <div className="player-name" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span>{opponentName}</span>
                {game && (
                  <span style={{ fontSize: "10px", color: "#a855f7", background: "rgba(168,85,247,0.15)", padding: "1px 6px", borderRadius: "6px" }}>
                    View Profile
                  </span>
                )}
              </div>
              <div className="player-meta">
                <span style={{ color: isOpponentOnline ? "#22c55e" : "rgba(255,255,255,0.3)", fontSize: "11px" }}>
                  {isOpponentOnline ? "● Online" : "○ Offline"}
                </span>
              </div>
            </div>
          </button>
          <div className={`clock ${isOpponentTurn ? "active" : ""}`}>
            <span className="clock-time">{formatTime(opponentClock)}</span>
          </div>
        </div>

        {/* Board */}
        <div className="board-wrapper p-4 relative flex-1 flex gap-3 justify-center items-center">
          {/* Premove indicator */}
          {premove && (
            <div style={{
              position: "absolute", top: "10px", left: "50%", transform: "translateX(-50%)", zIndex: 15,
              background: "rgba(34,197,94,0.2)", backdropFilter: "blur(4px)",
              border: "1px solid rgba(34,197,94,0.5)", borderRadius: "8px",
              padding: "4px 12px", color: "#4ade80", fontSize: "12px", fontWeight: 700,
              display: "flex", alignItems: "center", gap: "6px",
            }}>
              <span>⚡</span> Premove: {premove.from}→{premove.to}
              <button onClick={() => { setPremove(null); premoveRef.current = null; }}
                style={{ marginLeft: "4px", background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: "14px", lineHeight: 1 }}>
                ✕
              </button>
            </div>
          )}
          {/* Evaluation Bar */}
          {analysisEnabled && analysis && (
            <EvaluationBar
              evaluation={{
                score: analysis.score,
                mate: analysis.isCheckmate ? (analysis.score > 0 ? 1 : -1) : null,
                depth: 0,
                isCalculating: false
              }}
              orientation={!isPlayerWhite ? "black" : "white"}
            />
          )}
          <div className={`w-full max-w-[580px] max-h-[580px] aspect-square relative`}>
            {typeof window !== "undefined" && (
              <Chessboard
                id="playBoard"
                position={displayFen}
                onPieceDrop={isReviewing ? () => false : onDrop}
                onPieceClick={isReviewing ? undefined : onPieceClick}
                onSquareClick={isReviewing ? undefined : onSquareClick}
                animationDuration={150}
                boardOrientation={!isPlayerWhite ? "black" : "white"}
                arePiecesDraggable={!isReviewing && game?.status === "active"}
                arePremovesAllowed={!isReviewing && game?.status === "active"}
                customPremoveDarkSquareStyle={{ backgroundColor: "rgba(34,197,94,0.45)" }}
                customPremoveLightSquareStyle={{ backgroundColor: "rgba(34,197,94,0.55)" }}
                customSquareStyles={{
                  // Highlight selected square
                  ...(selectedSquare ? { [selectedSquare]: { backgroundColor: "rgba(255,255,50,0.5)", borderRadius: "2px" } } : {}),
                  // Highlight legal move squares
                  ...Object.fromEntries(legalMoves.map(sq => [sq, {
                    background: "radial-gradient(circle, rgba(0,0,0,0.35) 20%, transparent 25%)",
                    borderRadius: "50%",
                  }])),
                }}
                customDarkSquareStyle={{ backgroundColor: "#7e22ce" }}
                customLightSquareStyle={{ backgroundColor: "#f3e8ff" }}
                customDropSquareStyle={{ boxShadow: 'inset 0 0 1px 6px rgba(236,72,153,0.75)' }}
                clearPremovesOnRightClick={true}
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
                Move {currentMoveIdx + 1} / {allFens.length} · ← → to navigate · ↓ to latest
              </div>
            )}
          </div>

          {/* Game Over Overlay */}
          {game?.status && game.status !== "active" && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md rounded-lg m-4">
              <div className="text-center p-8 bg-[#1f2937] rounded-xl shadow-2xl border border-[#a855f7]/30 min-w-[320px]">
                {/* Result icon */}
                <div className="text-5xl mb-3">
                  {game.winner === "draw" ? "🤝" 
                    : game.isBot ? (game.winner === "white" ? "🏆" : "🤖")
                    : (game.winner === "white") === (game.whiteId === user?.id) ? "🏆" : "💔"}
                </div>

                {/* Result text */}
                <h2 className="text-3xl font-bold text-white mb-1">
                  {game.winner === "draw" ? "Draw!" 
                    : `${game.winner === "white" ? game.whiteUsername : game.blackUsername} Wins!`}
                </h2>
                <p className="text-sm text-white/40 mb-4">
                  {game.status === "resigned" ? "by resignation" 
                    : game.status === "draw" ? "by agreement" 
                    : game.status === "finished" ? "by checkmate" : ""}
                </p>

                {/* ELO Change (only for non-bot games) */}
                {!game.isBot && game.eloChange !== undefined && (
                  <div className="my-4 py-4 px-6 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center justify-center gap-2 text-sm text-white/60 mb-1">
                      <span>ELO</span>
                      <span className="text-white/40">{(game.newElo ?? 0) - (game.eloChange ?? 0)}</span>
                      <span className="text-white/40">→</span>
                      <span className="text-white font-bold text-base">{game.newElo}</span>
                    </div>
                    <div className={`text-2xl font-black ${
                      (game.eloChange ?? 0) > 0 ? "text-green-400 drop-shadow-[0_0_8px_rgba(34,197,94,0.4)]" 
                      : (game.eloChange ?? 0) < 0 ? "text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.4)]" 
                      : "text-yellow-400"
                    }`}>
                      {(game.eloChange ?? 0) > 0 ? "+" : ""}{game.eloChange} ELO
                    </div>
                    {game.opponentEloChange !== undefined && (
                      <div className="text-xs text-white/30 mt-1">
                        Opponent {game.opponentEloChange > 0 ? "+" : ""}{game.opponentEloChange}
                      </div>
                    )}
                  </div>
                )}

                <button onClick={() => window.location.reload()}
                  className="px-8 py-3 bg-[#a855f7] hover:bg-[#9333ea] text-white rounded-lg transition font-bold block w-full">
                  Play Again
                </button>
              </div>
            </div>
          )}
        </div>

        {/* My Row */}
        <div className="player-row px-4 pb-4 border-none">
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
            <span className="clock-time">{formatTime(myClock)}</span>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN */}
      <div className="console-area w-[320px] shrink-0 border-l border-white/10 flex flex-col">
        {/* Tab Bar */}
        <div className="console-header p-3 border-b border-white/10 flex items-center bg-white/5">
          <button onClick={() => setActiveTab("history")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-l transition ${activeTab === "history" ? "bg-[#a855f7]/20 text-[#a855f7]" : "text-white/40 hover:text-white/70"}`}>
            Moves
          </button>
          <button onClick={() => setActiveTab("chat")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-r transition relative ${activeTab === "chat" ? "bg-[#a855f7]/20 text-[#a855f7]" : "text-white/40 hover:text-white/70"}`}>
            Chat
            {chatMessages.length > 0 && activeTab !== "chat" && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#a855f7] rounded-full text-white text-[9px] flex items-center justify-center">
                {chatMessages.length > 9 ? "9+" : chatMessages.length}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              const next = !analysisEnabled;
              setAnalysisEnabled(next);
              if (next && game?.fen) actions.analyzePosition(game.fen, game.gameId);
            }}
            title="Toggle analysis bar"
            className={`ml-2 p-1.5 rounded transition ${analysisEnabled ? "bg-[#a855f7]/20 text-[#a855f7]" : "text-white/30 hover:text-white/60"}`}
          >
            <BarChart3 size={13} />
          </button>
          <span className="ml-2 text-xs bg-[#a855f7]/20 text-[#a855f7] px-2 py-1 rounded">
            {game?.timeControl?.replace("_", " ") ?? "---"}
          </span>
        </div>
        {/* Analysis score strip */}
        {analysisEnabled && analysis && (
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#a855f7]/5 border-b border-[#a855f7]/15 text-xs">
            <span className="text-white/40 uppercase tracking-wider font-bold">Eval</span>
            <span className="font-mono font-bold" style={{ color: analysis.score > 30 ? '#f0d9b5' : analysis.score < -30 ? '#aaa' : '#888' }}>
              {analysis.isCheckmate ? (analysis.score > 0 ? 'White mates' : 'Black mates') : Math.abs(analysis.score) < 30 ? 'Equal' : `${analysis.score > 0 ? '+' : ''}${(analysis.score / 100).toFixed(2)}`}
            </span>
            {analysis.bestMove && (
              <span className="text-[#a855f7] font-mono bg-[#a855f7]/15 px-1.5 py-0.5 rounded">
                {analysis.bestMove.from}→{analysis.bestMove.to}
              </span>
            )}
          </div>
        )}

        {/* Moves Tab */}
        {activeTab === "history" && (
          <>
            <div className="move-history flex-1 overflow-y-auto p-4 flex flex-col gap-1" ref={moveHistoryRef}>
              {moveRows.length === 0 ? (
                <div className="text-center text-xs text-white/30 pt-4 italic">No moves yet</div>
              ) : moveRows.map((row, i) => (
                <div key={i} className="move-row flex py-1 px-2 rounded text-sm">
                  <span className="move-number w-8 text-white/40">{row.turn}.</span>
                  <span
                    onClick={() => navigateTo(row.whiteIdx)}
                    className={`move-white flex-1 font-semibold px-1 rounded cursor-pointer hover:bg-white/10 ${currentMoveIdx === row.whiteIdx ? "bg-[#a855f7]/25 text-[#a855f7]" : ""}`}>
                    {row.white}
                  </span>
                  <span
                    onClick={() => row.blackIdx !== null && navigateTo(row.blackIdx)}
                    className={`move-black flex-1 font-semibold px-1 rounded ${row.black ? "cursor-pointer hover:bg-white/10" : ""} ${row.blackIdx !== null && currentMoveIdx === row.blackIdx ? "bg-[#a855f7]/25 text-[#a855f7]" : ""}`}>
                    {row.black ?? "..."}
                  </span>
                </div>
              ))}
            </div>

            {/* Navigation Controls */}
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
          </>
        )}

        {/* Chat Tab */}
        {activeTab === "chat" && (
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
            {chatMessages.length === 0 ? (
              <div className="text-center text-xs text-white/30 pt-4 italic">
                <MessageSquare size={24} className="mx-auto mb-2 opacity-30" />
                No messages yet. Say hello!
              </div>
            ) : chatMessages.map((msg, i) => {
              const isMe = msg.userId === user?.id;
              return (
                <div key={i} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div style={{ maxWidth: "80%" }}>
                    {!isMe && <div className="text-xs text-white/40 mb-1 ml-1">{msg.username}</div>}
                    <div style={{
                      background: isMe ? "linear-gradient(135deg, #a855f7, #7c3aed)" : "rgba(255,255,255,0.08)",
                      borderRadius: isMe ? "12px 12px 0 12px" : "12px 12px 12px 0",
                      padding: "8px 12px", color: "white", fontSize: "13px", lineHeight: "1.4",
                      boxShadow: isMe ? "0 2px 8px rgba(168,85,247,0.3)" : "none",
                    }}>
                      {msg.message}
                    </div>
                    <div className={`text-[10px] text-white/25 mt-0.5 ${isMe ? "text-right" : "text-left"}`}>
                      {formatChatTime(msg.timestamp)}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>
        )}

        {/* Footer */}
        <div className="console-footer p-4 bg-white/5 border-t border-white/10">
          {drawOffered && (
            <div className="w-full bg-[#1f2937] p-3 rounded-lg mb-4 flex flex-col gap-3 border border-yellow-500/30">
              <p className="text-sm text-center text-white/90">Opponent offered a draw</p>
              <div className="flex gap-2 justify-center">
                <button onClick={() => actions.acceptDraw(game!.gameId)} className="bg-green-600/80 hover:bg-green-500 text-white text-xs px-4 py-2 rounded font-bold flex-1">Accept</button>
                <button onClick={() => actions.declineDraw(game!.gameId)} className="bg-red-600/80 hover:bg-red-500 text-white text-xs px-4 py-2 rounded font-bold flex-1">Decline</button>
              </div>
            </div>
          )}

          {activeTab === "chat" ? (
            <div className="flex gap-2">
              <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={handleChatKeyDown}
                placeholder="Message opponent..." disabled={!game || game.status !== "active"}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-[#a855f7]/50 disabled:opacity-40" />
              <button onClick={handleSendMessage} disabled={!chatInput.trim() || !game || game.status !== "active"}
                className="bg-[#a855f7] hover:bg-[#9333ea] text-white rounded-lg p-2 transition disabled:opacity-40 disabled:cursor-not-allowed">
                <Send size={14} />
              </button>
            </div>
          ) : (
            <div className="action-buttons grid grid-cols-2 gap-2">
              <button onClick={() => game?.gameId && actions.offerDraw(game.gameId)}
                disabled={!game || game.status !== "active" || drawOffered || isReviewing}
                className="action-btn flex items-center justify-center gap-2 py-2 rounded bg-white/5 hover:bg-white/10 text-white/80 transition disabled:opacity-50 disabled:cursor-not-allowed">
                <Handshake size={14} /> Draw
              </button>
              <button onClick={() => game?.gameId && actions.resign(game.gameId)}
                disabled={!game || game.status !== "active" || isReviewing}
                className="action-btn primary-action flex items-center justify-center gap-2 py-2 rounded bg-red-500/20 hover:bg-red-500/40 text-red-400 transition disabled:opacity-50 disabled:cursor-not-allowed">
                <Flag size={14} /> Resign
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PlayPage() {
  return (
    <React.Suspense fallback={<div className="p-8 text-white text-center">Loading...</div>}>
      <PlayPageContent />
    </React.Suspense>
  );
}