"use client";

import React, { useState } from "react";
import {
  useLeaderboard,
  LeaderboardCategory,
  LeaderboardEntry,
} from "@/hooks/useLeaderboard";
import { Trophy, Zap, Clock, Flame, TrendingUp, TrendingDown, Minus, RefreshCw, Wifi, WifiOff, Crown, Medal, Award } from "lucide-react";
import "./ranks.css";

const CATEGORIES: { key: LeaderboardCategory; label: string; icon: React.ReactNode; desc: string }[] = [
  { key: "blitz",  label: "BLITZ",  icon: <Zap size={16} />,   desc: "3–5 min" },
  { key: "bullet", label: "BULLET", icon: <Flame size={16} />, desc: "1–2 min" },
  { key: "rapid",  label: "RAPID",  icon: <Clock size={16} />, desc: "10–15 min" },
];

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <span className="rank-badge rank-1">
        <Crown size={14} />
        &nbsp;1
      </span>
    );
  if (rank === 2)
    return (
      <span className="rank-badge rank-2">
        <Medal size={14} />
        &nbsp;2
      </span>
    );
  if (rank === 3)
    return (
      <span className="rank-badge rank-3">
        <Award size={14} />
        &nbsp;3
      </span>
    );
  return <span className="rank-number">#{rank}</span>;
}

function TrendIcon({ trend, eloChange }: { trend: string; eloChange?: number }) {
  if (trend === "up")
    return (
      <span className="trend up">
        <TrendingUp size={13} />
        {eloChange !== undefined && eloChange > 0 && <span>+{eloChange}</span>}
      </span>
    );
  if (trend === "down")
    return (
      <span className="trend down">
        <TrendingDown size={13} />
        {eloChange !== undefined && eloChange < 0 && <span>{eloChange}</span>}
      </span>
    );
  return (
    <span className="trend stable">
      <Minus size={13} />
    </span>
  );
}

function WinRateBar({ rate }: { rate: number }) {
  return (
    <div className="winrate-bar-wrap">
      <div className="winrate-bar-track">
        <div
          className="winrate-bar-fill"
          style={{ width: `${Math.min(rate, 100)}%` }}
        />
      </div>
      <span className="winrate-label">{rate}%</span>
    </div>
  );
}

function SkeletonRow({ index }: { index: number }) {
  return (
    <div className="lb-row skeleton" style={{ animationDelay: `${index * 60}ms` }}>
      <div className="skel skel-rank" />
      <div className="skel skel-name" />
      <div className="skel skel-elo" />
      <div className="skel skel-bar" />
      <div className="skel skel-stat" />
    </div>
  );
}

export default function RanksPage() {
  const { connected, category, data, loading, flashedRows, switchCategory, refresh } =
    useLeaderboard();

  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const topThree = data?.entries.slice(0, 3) ?? [];
  const restEntries = data?.entries.slice(3) ?? [];

  const updatedStr = data?.updatedAt
    ? new Date(data.updatedAt).toLocaleTimeString("vi-VN")
    : "--:--:--";

  return (
    <div className="ranks-page">
      {/* ── Page header ── */}
      <div className="ranks-header">
        <div className="ranks-title-group">
          <Trophy size={28} className="trophy-icon" />
          <div>
            <h1 className="ranks-title">GLOBAL RANKS</h1>
            <p className="ranks-subtitle">Live ELO Leaderboard · Updated in real-time</p>
          </div>
        </div>

        <div className="ranks-header-right">
          <span className={`conn-pill ${connected ? "online" : "offline"}`}>
            {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
            {connected ? "LIVE" : "OFFLINE"}
          </span>
          <button className="refresh-btn" onClick={refresh} title="Refresh">
            <RefreshCw size={15} />
          </button>
          <span className="updated-at">Updated: {updatedStr}</span>
        </div>
      </div>

      {/* ── Category tabs ── */}
      <div className="category-tabs">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            className={`cat-tab ${category === cat.key ? "active" : ""}`}
            onClick={() => switchCategory(cat.key)}
          >
            {cat.icon}
            <span className="cat-label">{cat.label}</span>
            <span className="cat-desc">{cat.desc}</span>
          </button>
        ))}
      </div>

      {/* ── Top 3 podium ── */}
      {!loading && topThree.length >= 3 && (
        <div className="podium">
          {/* 2nd place */}
          <PodiumCard entry={topThree[1]} place={2} />
          {/* 1st place */}
          <PodiumCard entry={topThree[0]} place={1} />
          {/* 3rd place */}
          <PodiumCard entry={topThree[2]} place={3} />
        </div>
      )}

      {/* ── Full table ── */}
      <div className="lb-table-card">
        <div className="lb-table-header">
          <span>RANK</span>
          <span>PLAYER</span>
          <span>ELO</span>
          <span>WIN RATE</span>
          <span>W / L / D</span>
        </div>

        <div className="lb-body">
          {loading
            ? Array.from({ length: 12 }).map((_, i) => <SkeletonRow key={i} index={i} />)
            : data?.entries.map((entry) => (
                <div
                  key={entry.userId}
                  className={[
                    "lb-row",
                    entry.rank <= 3 ? `top-${entry.rank}` : "",
                    flashedRows.has(entry.userId) ? "flash" : "",
                    hoveredRow === entry.userId ? "hovered" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onMouseEnter={() => setHoveredRow(entry.userId)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  <div className="lb-cell rank-cell">
                    <RankBadge rank={entry.rank} />
                  </div>

                  <div className="lb-cell player-cell">
                    <div className="player-avatar">
                      {entry.username.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="player-info">
                      <span className="player-name">{entry.username}</span>
                      <span className="player-games">{entry.gamesPlayed} games</span>
                    </div>
                  </div>

                  <div className="lb-cell elo-cell">
                    <span className="elo-num">{entry.elo}</span>
                    <TrendIcon trend={entry.trend} eloChange={entry.eloChange} />
                  </div>

                  <div className="lb-cell winrate-cell">
                    <WinRateBar rate={entry.winRate} />
                  </div>

                  <div className="lb-cell wld-cell">
                    <span className="wld-w">{entry.wins}W</span>
                    <span className="wld-sep">/</span>
                    <span className="wld-l">{entry.losses}L</span>
                    <span className="wld-sep">/</span>
                    <span className="wld-d">{entry.draws}D</span>
                  </div>
                </div>
              ))}
        </div>

        {!loading && data && (
          <div className="lb-footer">
            Showing {data.entries.length} of {data.totalPlayers} players ·{" "}
            <span className={connected ? "live-dot" : ""}>
              {connected ? "● LIVE" : "Disconnected"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function PodiumCard({ entry, place }: { entry: LeaderboardEntry; place: number }) {
  const icons = [null, <Crown size={20} key="crown" />, <Medal size={20} key="medal" />, <Award size={20} key="award" />];
  const heights = ["", "podium-1st", "podium-2nd", "podium-3rd"];

  return (
    <div className={`podium-card ${heights[place]}`}>
      <div className="podium-icon">{icons[place]}</div>
      <div className="podium-avatar">{entry.username.slice(0, 2).toUpperCase()}</div>
      <div className="podium-username">{entry.username}</div>
      <div className="podium-elo">{entry.elo}</div>
      <div className="podium-place">#{place}</div>
      <TrendIcon trend={entry.trend} eloChange={entry.eloChange} />
    </div>
  );
}
