"use client";

import React, { useEffect, useState } from "react";
import { Send, Flame, BrainCircuit } from "lucide-react";
import "../dashboard.css";

export default function DashboardHome() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="dashboard-home">
      
      {/* LEFT COLUMN */}
      <div className="left-column">
        
        {/* Header Section */}
        <div className="hero-section">
          <div>
            <h1 className="hero-title-regular">
              Welcome <br /> Back,
            </h1>
            <h1 className="hero-title-gradient">
              Grandmaster
            </h1>
            <p className="hero-subtitle">
              System Status: Optimal | Server Latency: 12ms
            </p>
          </div>

          <div className="stats-container">
            <div className="stat-card">
              <span className="stat-label">Global Rank</span>
              <span className="stat-value">#412</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Win Rate</span>
              <span className="stat-value stat-purple">68.4%</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Streak</span>
              <div className="stat-streak">
                <span className="stat-value">5</span>
                <Flame size={16} fill="#e230ff" className="stat-purple" />
              </div>
            </div>
          </div>
        </div>

        {/* Active Games */}
        <div>
          <div className="section-header">
            <h3 className="section-title">Your Active Games</h3>
            <span className="section-link">View All (12)</span>
          </div>
          
          <div className="games-grid">
            {/* Game Card 1 */}
            <div className="game-card">
              <div className="board-mock">
                {[...Array(16)].map((_, i) => (
                  <div key={i} className={`board-square ${(i + Math.floor(i / 4)) % 2 === 0 ? "light" : "dark"}`}></div>
                ))}
              </div>
              <div className="game-info">
                <div className="game-header-row">
                  <span className="turn-badge yours">Your Turn</span>
                  <span className="game-time">04:12</span>
                </div>
                <h4 className="game-opponent">Magnus_Alter</h4>
                <div className="game-status-row">
                  <div className="status-indicator yours"></div>
                  <span className="status-text">Waiting For Move</span>
                </div>
              </div>
            </div>

            {/* Game Card 2 */}
            <div className="game-card inactive">
              <div className="board-mock">
                {[...Array(16)].map((_, i) => (
                  <div key={i} className={`board-square ${(i + Math.floor(i / 4)) % 2 === 0 ? "light" : "dark"}`}></div>
                ))}
              </div>
              <div className="game-info">
                <div className="game-header-row">
                  <span className="turn-badge opponents">Opponent Turn</span>
                  <span className="game-time">14:55</span>
                </div>
                <h4 className="game-opponent">VoidWalker_7</h4>
                <div className="game-status-row">
                  <div className="status-indicator opponents"></div>
                  <span className="status-text">Thinking...</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ELO Progress Chart */}
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <h3 className="chart-title">Elo Progress</h3>
              <div className="chart-value-row">
                <span className="chart-value">+142</span>
                <span className="chart-timeframe">Last 30 Days</span>
              </div>
            </div>
            <div className="chart-filters">
              <button className="filter-btn active">30D</button>
              <button className="filter-btn">YTD</button>
            </div>
          </div>

          <div className="chart-body">
            <svg viewBox="0 0 500 100" preserveAspectRatio="none" className="svg-chart">
              <path 
                d="M 0 80 Q 50 80, 100 70 T 200 80 T 300 75 T 400 30 T 500 10" 
                fill="none" 
                stroke="#e230ff" 
                strokeWidth="3" 
                vectorEffect="non-scaling-stroke"
                className="svg-path-line"
              />
              <path 
                d="M 0 80 Q 50 80, 100 70 T 200 80 T 300 75 T 400 30 T 500 10 L 500 100 L 0 100 Z" 
                fill="url(#gradient)" 
                opacity="0.2"
              />
              <defs>
                <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#e230ff" />
                  <stop offset="100%" stopColor="#e230ff" stopOpacity="0" />
                </linearGradient>
              </defs>
              <text x="0" y="115" className="chart-axis-text">May 01</text>
              <text x="250" y="115" textAnchor="middle" className="chart-axis-text">May 15</text>
              <text x="500" y="115" textAnchor="end" className="chart-axis-text">Today</text>

              <circle cx="500" cy="10" r="4" fill="#121216" stroke="#e230ff" strokeWidth="2" className="chart-point" />
            </svg>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN */}
      <div className="right-column">
        
        {/* Daily Puzzle */}
        <div className="puzzle-card">
          <div className="puzzle-header">
            <h3 className="puzzle-title">Daily Puzzle</h3>
            <span className="puzzle-badge">Extreme</span>
          </div>
          
          <div className="puzzle-img-container">
            <div className="puzzle-overlay-1"></div>
            <div className="puzzle-overlay-2">
               <div className="puzzle-bg"></div>
            </div>
            
            <div className="puzzle-content">
              <h4 className="puzzle-main-text">MATE IN 3</h4>
              <p className="puzzle-sub-text">White To Move</p>
            </div>
          </div>
          
          <button className="btn-secondary">
            Solve Challenge
          </button>
        </div>

        {/* Global Sanctuary Chat */}
        <div className="chat-card">
          <div className="chat-header">
            <div className="chat-title-group">
              <div className="chat-icon-bg">
                <BrainCircuit size={14} className="stat-purple" />
              </div>
              <h3 className="chat-title">Global<br />Sanctuary</h3>
            </div>
            <div className="chat-stats">
              <p className="chat-online-count">2,841</p>
              <p className="chat-status">
                <span className="chat-status-dot"></span>
                Online
              </p>
            </div>
          </div>

          <div className="chat-messages">
            <div>
              <div className="chat-message-meta">
                <span className="chat-user">GM_KOOK</span>
                <span className="chat-time">11:34</span>
              </div>
              <div className="chat-bubble">
                Anyone up for a Bullet 1|0 match? Testing the new neural engine.
              </div>
            </div>

            <div>
              <div className="chat-message-meta">
                <span className="chat-user purple">SILICA_VOID</span>
                <span className="chat-time">11:38</span>
              </div>
              <div className="chat-bubble highlight">
                The endgame analysis for the Grand Finals is insane. Check the Archives.
              </div>
            </div>

            <div>
              <div className="chat-message-meta">
                <span className="chat-user">SHADOW_STEP</span>
                <span className="chat-time">11:42</span>
              </div>
              <div className="chat-bubble">
                Just hit 2600! Finally.
              </div>
            </div>
          </div>

          <div className="chat-input-area">
            <div className="chat-input-wrapper">
              <input 
                type="text" 
                placeholder="Send transmission..." 
                className="chat-input"
              />
              <button className="chat-send-btn">
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}