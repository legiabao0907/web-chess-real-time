"use client";

import React, { useEffect, useState } from "react";
import { Flame, Swords, Trophy, User } from "lucide-react";
import { getUser, AuthUser } from "@/lib/auth";
import "../dashboard.css";

export default function DashboardHome() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setMounted(true);
    setUser(getUser());
  }, []);

  if (!mounted) return null;

  return (
    <div className="dashboard-home-new">
      
      {/* ─── TOP ROW: Welcome + Stats ─── */}
      <div className="dh-top-row">
        <div className="dh-welcome glass-card">
          <div>
            <h1 className="dh-welcome-title">
              WELCOME BACK, <span className="dh-welcome-gradient">GRANDMASTER</span>
            </h1>
            <p className="dh-welcome-sub">
              System: Optimal &middot; Server Latency: 15ms
            </p>
          </div>
        </div>

        <div className="dh-stats-row">
          <div className="dh-stat glass-card">
            <span className="dh-stat-label">Global Rank</span>
            <span className="dh-stat-value">#412</span>
          </div>
          <div className="dh-stat glass-card">
            <span className="dh-stat-label">Win Rate</span>
            <span className="dh-stat-value dh-purple">68.4%</span>
          </div>
          <div className="dh-stat glass-card">
            <span className="dh-stat-label">Streak</span>
            <div className="dh-stat-streak">
              <span className="dh-stat-value">5</span>
              <Flame size={16} fill="#e230ff" className="dh-purple" />
            </div>
          </div>
        </div>
      </div>

      {/* ─── MIDDLE ROW: Active Games ─── */}
      <div className="dh-section glass-card">
        <div className="dh-section-header">
          <h3 className="dh-section-title">YOUR ACTIVE GAMES</h3>
          <span className="dh-section-link">View All</span>
        </div>
        <div className="dh-games-grid">
          <div className="dh-game-card">
            <MiniChessBoard fen="rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1" />
            <div className="dh-game-info">
              <div className="dh-game-top">
                <span className="dh-turn-badge yours">Your Turn</span>
                <span className="dh-game-clock">04:12</span>
              </div>
              <h4 className="dh-game-opponent">Magnus_Alter</h4>
              <div className="dh-game-status">
                <span className="dh-status-dot yours" />
                <span>Waiting For Move</span>
              </div>
            </div>
          </div>
          <div className="dh-game-card">
            <MiniChessBoard fen="r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4" />
            <div className="dh-game-info">
              <div className="dh-game-top">
                <span className="dh-turn-badge opponents">Opponent Turn</span>
                <span className="dh-game-clock">14:55</span>
              </div>
              <h4 className="dh-game-opponent">VoidWalker_7</h4>
              <div className="dh-game-status">
                <span className="dh-status-dot opponents" />
                <span>Thinking...</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── BOTTOM ROW: ELO full-width + Right Column ─── */}
      <div className="dh-bottom-row-v2">
        
        {/* ELO Progress - full width, no side panel */}
        <div className="dh-elo-card-full glass-card">
          <div className="dh-elo-header">
            <div>
              <h3 className="dh-elo-title">ELO PROGRESS</h3>
              <div className="dh-elo-value-row">
                <span className="dh-elo-gain">+142</span>
                <span className="dh-elo-period">Last 30 Days</span>
              </div>
            </div>
            <div className="dh-elo-filters">
              <button className="dh-filter-btn active">30D</button>
              <button className="dh-filter-btn">YTD</button>
            </div>
          </div>
          <div className="dh-elo-chart-full">
            <div className="dh-elo-yaxis">
              <span>1400</span><span>1350</span><span>1300</span><span>1250</span><span>1200</span>
            </div>
            <div className="dh-elo-chart-area">
              <svg viewBox="0 0 500 130" preserveAspectRatio="none" className="dh-svg-chart">
                <line x1="0" y1="26" x2="500" y2="26" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                <line x1="0" y1="52" x2="500" y2="52" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                <line x1="0" y1="78" x2="500" y2="78" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                <line x1="0" y1="104" x2="500" y2="104" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                <path d="M 0 98 Q 50 96, 100 84 T 200 92 T 300 76 T 400 30 T 500 15 L 500 130 L 0 130 Z" fill="url(#eloGrad)" opacity="0.12" />
                <path d="M 0 98 Q 50 96, 100 84 T 200 92 T 300 76 T 400 30 T 500 15" fill="none" stroke="#e879f9" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
                <defs>
                  <linearGradient id="eloGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e879f9" /><stop offset="100%" stopColor="#e879f9" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <text x="0" y="142" className="dh-chart-label">May 01</text>
                <text x="250" y="142" textAnchor="middle" className="dh-chart-label">May 15</text>
                <text x="500" y="142" textAnchor="end" className="dh-chart-label">Today</text>
                <circle cx="500" cy="15" r="4" fill="#121216" stroke="#e879f9" strokeWidth="2" />
              </svg>
            </div>
          </div>
        </div>

        {/* Right Column: Recent Matches + Leaderboard */}
        <div className="dh-right-col">
          
          {/* Recent Matches */}
          <div className="dh-recent glass-card">
            <h3 className="dh-section-title-sm">RECENT MATCHES</h3>
            {[
              { opp: "Magnus_Alter", type: "Blitz 5+0", result: "win", change: "+8" },
              { opp: "NightKing_99", type: "Bullet 1+0", result: "loss", change: "-6" },
              { opp: "QuantumBishop", type: "Rapid 10+0", result: "win", change: "+12" },
              { opp: "VoidWalker_7", type: "Blitz 3+2", result: "draw", change: "+1" },
            ].map((m, i) => (
              <div key={i} className="dh-match-row">
                <div className="dh-match-info">
                  <span className="dh-match-opp">{m.opp}</span>
                  <span className="dh-match-type">{m.type}</span>
                </div>
                <span className={`dh-match-result ${m.result}`}>
                  {m.result === "win" ? m.change : m.result === "loss" ? m.change : m.change}
                </span>
              </div>
            ))}
          </div>

          {/* Leaderboard */}
          <div className="dh-leader glass-card">
            <h3 className="dh-section-title-sm">LEADERBOARD</h3>
            {[
              { rank: 1, name: "Magnus_Alter", elo: 2847 },
              { rank: 2, name: "QuantumBishop", elo: 2791 },
              { rank: 3, name: "VoidWalker_7", elo: 2755 },
              { rank: 4, name: "NightKing_99", elo: 2720 },
              { rank: 5, name: "DeepThinker", elo: 2698 },
            ].map((p, i) => (
              <div key={i} className="dh-lb-row">
                <span className="dh-lb-rank">{p.rank}</span>
                <div className="dh-lb-avatar">
                  <User size={14} />
                </div>
                <span className="dh-lb-name">{p.name}</span>
                <span className="dh-lb-elo">{p.elo}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Premium miniature chessboard from FEN — Staunton-style pieces */
function MiniChessBoard({ fen }: { fen: string }) {
  const [rows] = fen.split(" ");
  const ranks = rows.split("/");
  // Standard Unicode chess pieces (black & white outlines for contrast)
  const pieceMap: Record<string, { sym: string; white: boolean }> = {
    "r": { sym: "\u265C", white: false }, "n": { sym: "\u265E", white: false },
    "b": { sym: "\u265D", white: false }, "q": { sym: "\u265B", white: false },
    "k": { sym: "\u265A", white: false }, "p": { sym: "\u265F", white: false },
    "R": { sym: "\u2656", white: true },  "N": { sym: "\u2658", white: true },
    "B": { sym: "\u2657", white: true },  "Q": { sym: "\u2655", white: true },
    "K": { sym: "\u2654", white: true },  "P": { sym: "\u2659", white: true },
  };
  
  const squares: React.ReactNode[] = [];
  for (let rank = 0; rank < 8; rank++) {
    let file = 0;
    for (const ch of ranks[rank]) {
      if (ch >= "1" && ch <= "8") {
        for (let i = 0; i < Number(ch); i++) {
          const isLight = (rank + file) % 2 === 0;
          squares.push(<div key={`${rank}-${file}`} className={`mini-sq ${isLight ? "light" : "dark"}`} />);
          file++;
        }
      } else {
        const p = pieceMap[ch];
        const isLight = (rank + file) % 2 === 0;
        squares.push(
          <div key={`${rank}-${file}`} className={`mini-sq ${isLight ? "light" : "dark"}`}>
            {p && (
              <span className={`mini-piece ${p.white ? "white" : "black"}`}>
                {p.sym}
              </span>
            )}
          </div>
        );
        file++;
      }
    }
  }

  return <div className="mini-board">{squares}</div>;
}
