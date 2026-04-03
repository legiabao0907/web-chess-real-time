"use client";

import React, { useState, useEffect, useRef } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import {
  Settings,
  Flag,
  Undo,
  Handshake,
  MessageSquare,
  ShieldAlert
} from "lucide-react";
import "./play.css";

export default function PlayPage() {
  const [mounted, setMounted] = useState(false);
  const [game, setGame] = useState(new Chess());
  const moveHistoryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    setGame(new Chess());
  }, []);

  const history = game.history();
  const moveRows = [];
  for (let i = 0; i < history.length; i += 2) {
    moveRows.push({
      turn: Math.floor(i / 2) + 1,
      white: history[i],
      black: history[i + 1] || null,
    });
  }

  useEffect(() => {
    if (moveHistoryRef.current) {
      moveHistoryRef.current.scrollTop = moveHistoryRef.current.scrollHeight;
    }
  }, [history.length]);

  function makeAMove(move: any) {
    const gameCopy = new Chess();
    gameCopy.loadPgn(game.pgn());
    try {
      const result = gameCopy.move(move);
      setGame(gameCopy);
      return result; // null if the move was illegal
    } catch (e) {
      return null;
    }
  }

  function onDrop({ sourceSquare, targetSquare, piece }: any) {
    if (!targetSquare) return false;

    // In react-chessboard v5, piece might be a string like 'wP' or an object. 
    // We safely extract the promotion piece char.
    const pieceChar = typeof piece === 'string' ? piece[1] : 'q';
    const promotion = pieceChar?.toLowerCase() ?? "q";

    const move = makeAMove({
      from: sourceSquare,
      to: targetSquare,
      promotion,
    });

    // illegal move
    if (move === null) return false;
    return true;
  }

  if (!mounted) return null;

  return (
    <div className="play-container">

      {/* LEFT COLUMN: Board Area */}
      <div className="board-area">

        {/* Opponent Row */}
        <div className="player-row">
          <div className="player-info">
            <div className="player-avatar">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Jack" alt="Opponent" />
              <div className="status-dot online"></div>
            </div>
            <div className="player-details">
              <div className="player-name">
                <ShieldAlert size={14} className="text-[#a855f7]" />
                Grandmaster Player 1
              </div>
              <div className="player-meta">ELO 2610 • United States</div>
            </div>
          </div>
          <div className="clock">
            <span className="clock-label">Black Timer</span>
            <span className="clock-time">04:25</span>
          </div>
        </div>

        {/* Board Wrapper */}
        <div className="board-wrapper">
          <div>
            <Chessboard
              options={{
                position: game.fen(),
                onPieceDrop: onDrop,
                animationDurationInMs: 200,

              }}
            />
          </div>
        </div>

        {/* Player Row */}
        <div className="player-row">
          <div className="player-info">
            <div className="player-avatar">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="You" />
              <div className="status-dot online"></div>
            </div>
            <div className="player-details">
              <div className="player-name">The Strategist (You)</div>
              <div className="player-meta">ELO 2450 • Global Ranking #1,204</div>
            </div>
          </div>
          <div className="clock active">
            <span className="clock-label">White Timer</span>
            <span className="clock-time">04:32</span>
          </div>
        </div>

      </div>

      {/* RIGHT COLUMN: Console Area */}
      <div className="console-area">

        {/* Console Header */}
        <div className="console-header">
          <h3 className="console-title">Move History</h3>
          <span className="console-badge">Blitz 5+0</span>
        </div>

        {/* Move History List */}
        <div className="move-history" ref={moveHistoryRef}>
          {moveRows.length === 0 ? (
            <div className="text-center text-xs text-white/30 pt-4 italic">No moves yet</div>
          ) : (
            moveRows.map((row, index) => (
              <div key={index} className={`move-row ${index === moveRows.length - 1 ? 'active' : ''}`}>
                <span className="move-number">{row.turn}.</span>
                <span className="move-white">{row.white}</span>
                <span className="move-black">{row.black ? row.black : "..."}</span>
              </div>
            ))
          )}
        </div>

        {/* Console Footer */}
        <div className="console-footer">

          <div className="eval-bar-container">
            <div className="eval-bar">
              <div className="eval-fill" style={{ width: '40%' }}></div>
            </div>
            <span className="eval-text">-0.4</span>
          </div>

          <div className="action-buttons">
            <button className="action-btn">
              <Handshake size={14} />
              Draw Offer
            </button>
            <button className="action-btn">
              <Undo size={14} />
              Takeback
            </button>
            <button className="action-btn">
              <Settings size={14} />
              Settings
            </button>
            <button className="action-btn primary-action">
              <Flag size={14} />
              Resign
            </button>
          </div>

          <div className="chat-row">
            <div className="chat-avatars">
              <div className="chat-avatar-mini">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Jack" alt="User" />
              </div>
              <div className="chat-avatar-mini">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="User" />
              </div>
              <span className="chat-count-badge">+241</span>
            </div>

            <button className="open-chat-btn">
              Open Chat
              <MessageSquare size={14} />
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}