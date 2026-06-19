"use client";

import React, { useEffect, useState } from "react";
import { Send, Flame, Swords } from "lucide-react";
import Link from "next/link";
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
      
      {/* ─── TOP ROW: Welcome + Stats + FIND MATCH ─── */}
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

        <Link href="/play" className="dh-find-match glass-card">
          <Swords size={22} />
          <span>FIND MATCH</span>
        </Link>
      </div>

      {/* ─── MIDDLE ROW: Active Games ─── */}
      <div className="dh-section glass-card">
        <div className="dh-section-header">
          <h3 className="dh-section-title">YOUR ACTIVE GAMES</h3>
          <span className="dh-section-link">View All</span>
        </div>
        <div className="dh-games-grid">
          <div className="dh-game-card">
            <div className="dh-game-thumb">
              <MiniChessBoard fen="rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1" />
            </div>
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
            <div className="dh-game-thumb">
              <MiniChessBoard fen="r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4" />
            </div>
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

      {/* ─── BOTTOM ROW: ELO Chart + Side Panel ─── */}
      <div className="dh-bottom-row">
        <div className="dh-elo-card glass-card">
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
          <div className="dh-elo-chart">
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
                <path d="M 0 98 Q 50 96, 100 84 T 200 92 T 300 76 T 400 30 T 500 15" fill="none" stroke="#c084fc" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
                <defs>
                  <linearGradient id="eloGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c084fc" /><stop offset="100%" stopColor="#c084fc" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <text x="0" y="142" className="dh-chart-label">May 01</text>
                <text x="250" y="142" textAnchor="middle" className="dh-chart-label">May 15</text>
                <text x="500" y="142" textAnchor="end" className="dh-chart-label">Today</text>
                <circle cx="500" cy="15" r="4" fill="#121216" stroke="#c084fc" strokeWidth="2" />
              </svg>
            </div>
          </div>
        </div>

        <div className="dh-side-panel">
          <div className="dh-puzzle glass-card">
            <div className="dh-puzzle-header">
              <h3 className="dh-puzzle-title">DAILY PUZZLE</h3>
              <span className="dh-puzzle-badge">Extreme</span>
            </div>
            <div className="dh-puzzle-board">
              <MiniChessBoard fen="r1b2rk1/pp2bppp/2n1pn2/q5B1/2BP4/2N2N2/PP2QPPP/R4RK1 w - - 0 1" />
            </div>
            <div className="dh-puzzle-info">
              <span>MATE IN 3</span>
              <span className="dh-puzzle-side">White To Move</span>
            </div>
            <button className="dh-btn-secondary">Solve Challenge</button>
          </div>

          <div className="dh-chat glass-card">
            <div className="dh-chat-header">
              <div className="dh-chat-title-row">
                <h3 className="dh-chat-title">GLOBAL SANCTUARY</h3>
                <div className="dh-chat-online">
                  <span className="dh-chat-dot" />
                  <span>2,841 Online</span>
                </div>
              </div>
            </div>
            <div className="dh-chat-msgs">
              <div className="dh-chat-msg">
                <span className="dh-chat-user">GM_KOOK</span>
                <span className="dh-chat-time">11:34</span>
                <p className="dh-chat-text">Anyone up for a Bullet 1|0 match? Testing the new engine.</p>
              </div>
              <div className="dh-chat-msg">
                <span className="dh-chat-user">SILICA_VOID</span>
                <span className="dh-chat-time">11:38</span>
                <p className="dh-chat-text">The endgame analysis for the Grand Finals is insane. Check the Archives.</p>
              </div>
              <div className="dh-chat-msg">
                <span className="dh-chat-user">SHADOW_STEP</span>
                <span className="dh-chat-time">11:42</span>
                <p className="dh-chat-text">Just hit 2600! Finally.</p>
              </div>
            </div>
            <div className="dh-chat-input-row">
              <input type="text" placeholder="Send transmission..." className="dh-chat-input" />
              <button className="dh-chat-send"><Send size={16} /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniChessBoard({ fen }: { fen: string }) {
  const [rows] = fen.split(" ");
  const ranks = rows.split("/");
  const pieceMap: Record<string, string> = {
    "r":"\u265C","n":"\u265E","b":"\u265D","q":"\u265B","k":"\u265A","p":"\u265F",
    "R":"\u2656","N":"\u2658","B":"\u2657","Q":"\u2655","K":"\u2654","P":"\u2659",
  };
  const squares: { piece: string; isLight: boolean }[] = [];
  for (let rank = 0; rank < 8; rank++) {
    let file = 0;
    for (const ch of ranks[rank]) {
      if (ch >= "1" && ch <= "8") {
        for (let i = 0; i < Number(ch); i++) {
          squares.push({ piece: "", isLight: (rank + file) % 2 === 0 });
          file++;
        }
      } else {
        squares.push({ piece: pieceMap[ch] || ch, isLight: (rank + file) % 2 === 0 });
        file++;
      }
    }
  }
  return (
    <div className="mini-board">
      {squares.map((sq, i) => (
        <div key={i} className={`mini-sq ${sq.isLight ? "light" : "dark"}`}>
          {sq.piece && <span className="mini-piece">{sq.piece}</span>}
        </div>
      ))}
    </div>
  );
}