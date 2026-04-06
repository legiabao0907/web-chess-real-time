"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
const Chessboard: any = dynamic(() => import("react-chessboard").then(mod => mod.Chessboard as any), { ssr: false });
import { Chess } from "chess.js";
import {
  Settings,
  Flag,
  Undo,
  Handshake,
  MessageSquare,
  ShieldAlert,
  Search,
  X
} from "lucide-react";
import "./play.css";
import { useChessSocket } from "@/hooks/useChessSocket";
import { getUser, AuthUser } from "@/lib/auth";

export default function PlayPage() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const moveHistoryRef = useRef<HTMLDivElement>(null);
  
  // Clocks states for real-time ticking
  const [whiteClock, setWhiteClock] = useState(0);
  const [blackClock, setBlackClock] = useState(0);

  // Local instance for move validation
  const localGame = useMemo(() => new Chess(), []);

  useEffect(() => {
    setMounted(true);
    setUser(getUser());
  }, []);

  const {
    connected,
    gameStatus,
    game,
    chatMessages,
    drawOffered,
    errorMessage,
    searchingTimeControl,
    actions
  } = useChessSocket({
    userId: user?.id ?? "",
    username: user?.username ?? "Guest"
  });

  // Sync timers when game update comes from server
  useEffect(() => {
    if (game) {
      setWhiteClock(game.whiteTimeMs);
      setBlackClock(game.blackTimeMs);
      localGame.load(game.fen);
    }
  }, [game?.whiteTimeMs, game?.blackTimeMs, game?.fen, game?.gameId, localGame]);

  // Real-time countdown interval
  useEffect(() => {
    if (!game || game.status !== 'active' || !game.lastMoveAt) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - game.lastMoveAt!;

      if (game.turn === 'w') {
        const remaining = Math.max(0, game.whiteTimeMs - elapsed);
        setWhiteClock(remaining);
      } else {
        const remaining = Math.max(0, game.blackTimeMs - elapsed);
        setBlackClock(remaining);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [game?.turn, game?.status, game?.lastMoveAt, game?.whiteTimeMs, game?.blackTimeMs]);

  useEffect(() => {
    if (moveHistoryRef.current) {
      moveHistoryRef.current.scrollTop = moveHistoryRef.current.scrollHeight;
    }
  }, [game?.moveHistory?.length]);

  function onDrop(sourceSquare: any, targetSquare: any, piece: any) {
    if (!user || !game || game.status !== 'active') return false;
    
    // Check if it's our turn
    const isMyTurn = (game.turn === 'w' && game.whiteId === user.id) || 
                     (game.turn === 'b' && game.blackId === user.id);
    if (!isMyTurn) return false;

    if (!targetSquare) return false;

    const pieceChar = typeof piece === 'string' ? piece[1] : 'q';
    const promotion = pieceChar?.toLowerCase() ?? "q";

    try {
      const move = localGame.move({ from: sourceSquare, to: targetSquare, promotion });
      if (!move) return false;
      
      actions.makeMove(game.gameId, { from: sourceSquare, to: targetSquare, promotion });
      return true;
    } catch (e) {
      return false;
    }
  }

  // Formatting clock time
  const formatTime = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!mounted) return null;
  
  if (!user) {
    return <div className="p-8 text-center text-white flex flex-col items-center justify-center h-full">
      <h2 className="text-2xl font-bold mb-4">You are not logged in</h2>
      <p>Please log in to play matches.</p>
    </div>;
  }

  // Pre-calculate moves list for History
  const moveRows = [];
  if (game?.moveHistory) {
    for (let i = 0; i < game.moveHistory.length; i += 2) {
      moveRows.push({
        turn: Math.floor(i / 2) + 1,
        white: game.moveHistory[i],
        black: game.moveHistory[i + 1] || null,
      });
    }
  }

  // Determine opponent name etc
  const isPlayerWhite = game?.whiteId === user.id;
  const opponentName = game 
    ? (isPlayerWhite ? game.blackUsername : game.whiteUsername) 
    : "Opponent";
  
  const myClock = isPlayerWhite ? whiteClock : blackClock;
  const opponentClock = isPlayerWhite ? blackClock : whiteClock;
  
  const isMyTurn = game?.status === 'active' && 
    (isPlayerWhite ? game.turn === 'w' : game.turn === 'b');
  const isOpponentTurn = game?.status === 'active' && !isMyTurn;

  return (
    <div className="play-container relative flex h-full">
      {errorMessage && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded shadow z-50">
          {errorMessage}
        </div>
      )}

      {/* LEFT COLUMN: Board Area */}
      <div className="board-area relative flex-1">
        
        {/* Matchmaking Overlay */}
        {(gameStatus === "idle" || gameStatus === "searching") && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm rounded-lg border border-white/10 m-4">
            {gameStatus === "idle" ? (
              <div className="text-center p-8 bg-[#1f2937] rounded-xl shadow-2xl border border-white/5">
                <h2 className="text-3xl font-bold text-white mb-8">Play Real-Time Chess</h2>
                <div className="flex flex-col gap-4">
                  <button 
                    onClick={() => actions.findGame("blitz_5")}
                    disabled={!connected}
                    className="flex items-center justify-center gap-3 px-8 py-4 bg-[#a855f7] hover:bg-[#9333ea] text-white rounded-lg font-bold transition text-lg w-full disabled:opacity-50"
                  >
                    <Search size={22} />
                    Find Match (5 min)
                  </button>
                  <button 
                    onClick={() => actions.findGame("rapid_10")}
                    disabled={!connected}
                    className="flex items-center justify-center gap-3 px-8 py-4 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-lg font-bold transition text-lg w-full disabled:opacity-50"
                  >
                    <Search size={22} />
                    Find Match (10 min)
                  </button>
                </div>
                {!connected && (
                  <p className="mt-6 text-yellow-400 text-sm">Server offline. Trying to reconnect...</p>
                )}
              </div>
            ) : (
              <div className="text-center p-8 bg-[#1f2937] rounded-xl shadow-2xl border border-white/5">
                <div className="animate-spin rounded-full border-b-4 border-[#a855f7] w-16 h-16 mb-6 mx-auto"></div>
                <h2 className="text-2xl font-bold text-white mb-2">Searching for Opponent...</h2>
                <p className="text-white/60 mb-8 max-w-[200px] mx-auto break-words">{searchingTimeControl?.replace('_', ' ')}</p>
                <button 
                  onClick={() => searchingTimeControl && actions.cancelSearch(searchingTimeControl)}
                  className="flex flex-row items-center justify-center gap-2 px-8 py-3 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition font-medium w-full"
                >
                  <X size={18} />
                  Cancel Search
                </button>
              </div>
            )}
          </div>
        )}

        {/* Opponent Row */}
        <div className="player-row px-4 pt-4">
          <div className="player-info">
            <div className="player-avatar">
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${opponentName}`} alt="Opponent" />
              <div className={`status-dot ${gameStatus === "active" ? 'online' : 'offline'}`}></div>
            </div>
            <div className="player-details">
              <div className="player-name">
                <ShieldAlert size={14} className="text-[#a855f7] inline mr-1" />
                {opponentName}
              </div>
              <div className="player-meta">ELO {game ? "---" : "---"}</div>
            </div>
          </div>
          <div className={`clock ${isOpponentTurn ? 'active' : ''}`}>
             <span className="clock-time">
              {formatTime(opponentClock)}
            </span>
          </div>
        </div>

        {/* Board Wrapper */}
        <div className="board-wrapper p-4 relative flex-1 flex justify-center items-center">
          <div className={`w-full max-w-[600px] max-h-[600px] aspect-square ${game?.status !== 'active' && game?.status ? 'opacity-50 pointer-events-none' : ''}`}>
             {typeof window !== 'undefined' && (
                <Chessboard
                  position={game?.fen ?? "start"}
                  onPieceDrop={onDrop}
                  animationDuration={200}
                  boardOrientation={!isPlayerWhite ? "black" : "white"}
                />
             )}
          </div>
          
          {/* Game Over Overlay */}
          {(game?.status && game?.status !== 'active') && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md rounded-lg m-4">
               <div className="text-center p-8 bg-[#1f2937] rounded-xl shadow-2xl border border-[#a855f7]/30 min-w-[300px]">
                 <h2 className="text-4xl font-bold text-white mb-2">Game Over</h2>
                 <p className="text-2xl text-[#a855f7] mb-8 font-semibold">
                    {game.winner === 'draw' ? 'Draw' : 
                    `${game.winner === 'white' ? game.whiteUsername : game.blackUsername} Wins!`}
                 </p>
                 <button 
                    onClick={() => {
                        window.location.reload();
                    }}
                    className="px-8 py-3 bg-[#a855f7] hover:bg-[#9333ea] text-white rounded-lg transition font-bold block w-full"
                  >
                    Play Again
                  </button>
               </div>
            </div>
          )}
        </div>

        {/* Player Row */}
        <div className="player-row px-4 pb-4 border-none">
          <div className="player-info">
            <div className="player-avatar">
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username}`} alt="You" />
              <div className="status-dot online"></div>
            </div>
            <div className="player-details">
              <div className="player-name">{user?.username} (You)</div>
              <div className="player-meta">ELO {user?.eloBlitz ?? "---"}</div>
            </div>
          </div>
          <div className={`clock ${isMyTurn ? 'active' : ''}`}>
             <span className="clock-time">
              {formatTime(myClock)}
            </span>
          </div>
        </div>

      </div>

      {/* RIGHT COLUMN: Console Area */}
      <div className="console-area w-[320px] shrink-0 border-l border-white/10 flex flex-col">

        <div className="console-header p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
          <h3 className="console-title text-sm font-bold text-white/80">Move History</h3>
          <span className="console-badge text-xs bg-[#a855f7]/20 text-[#a855f7] px-2 py-1 rounded">{game?.timeControl?.replace('_', ' ') ?? "---"}</span>
        </div>

        <div className="move-history flex-1 overflow-y-auto p-4 flex flex-col gap-1" ref={moveHistoryRef}>
          {moveRows.length === 0 ? (
            <div className="text-center text-xs text-white/30 pt-4 italic">No moves yet</div>
          ) : (
            moveRows.map((row, index) => (
              <div key={index} className={`move-row flex py-1 px-2 rounded text-sm ${index === moveRows.length - 1 ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                <span className="move-number w-8 text-white/40">{row.turn}.</span>
                <span className="move-white flex-1 font-semibold">{row.white}</span>
                <span className="move-black flex-1 font-semibold">{row.black ? row.black : "..."}</span>
              </div>
            ))
          )}
        </div>

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

          <div className="action-buttons grid grid-cols-2 gap-2">
            <button 
              className="action-btn flex items-center justify-center gap-2 py-2 rounded bg-white/5 hover:bg-white/10 text-white/80 transition disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => game?.gameId && actions.offerDraw(game.gameId)}
              disabled={!game || game.status !== 'active' || drawOffered}
            >
              <Handshake size={14} />
              Draw
            </button>
            <button 
              className="action-btn primary-action flex items-center justify-center gap-2 py-2 rounded bg-red-500/20 hover:bg-red-500/40 text-red-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => game?.gameId && actions.resign(game.gameId)}
              disabled={!game || game.status !== 'active'}
            >
              <Flag size={14} />
              Resign
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}