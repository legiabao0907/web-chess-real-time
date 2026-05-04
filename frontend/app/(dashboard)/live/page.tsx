"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Swords, Radio, RefreshCw, Clock } from "lucide-react";
import { useWatchStore, LiveGameSummary } from "@/store/useWatchStore";
import { useWatchSocket } from "@/hooks/useWatchSocket";

export default function LivePage() {
  const router = useRouter();
  const { liveGames, isLoadingGames } = useWatchStore();
  const [mounted, setMounted] = useState(false);

  // Connect to watch socket just to list games (no gameId)
  const { fetchLiveGames } = useWatchSocket();

  useEffect(() => {
    setMounted(true);
  }, []);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    return `${minutes} min`;
  };

  const getTimeControlLabel = (tc: string) => {
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
    return map[tc] ?? tc.replace(/_/g, " ");
  };

  const getCategoryColor = (tc: string) => {
    if (tc.startsWith("bullet")) return { bg: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.4)", text: "#ef4444" };
    if (tc.startsWith("blitz")) return { bg: "rgba(245,158,11,0.15)", border: "rgba(245,158,11,0.4)", text: "#f59e0b" };
    return { bg: "rgba(59,130,246,0.15)", border: "rgba(59,130,246,0.4)", text: "#3b82f6" };
  };

  if (!mounted) return null;

  return (
    <div style={{
      padding: "32px 40px",
      minHeight: "100%",
      background: "linear-gradient(180deg, #0a0a12 0%, #0d0d1a 100%)",
      color: "white",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "32px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
            <div style={{
              background: "rgba(239,68,68,0.15)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "20px",
              padding: "4px 14px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}>
              <Radio size={12} color="#ef4444" style={{ animation: "livePulse 1s infinite" }} />
              <span style={{ color: "#ef4444", fontSize: "13px", fontWeight: 700 }}>LIVE</span>
            </div>
            <h1 style={{ fontSize: "28px", fontWeight: 800, margin: 0 }}>Live Matches</h1>
          </div>
          <p style={{ color: "rgba(255,255,255,0.4)", margin: 0, fontSize: "14px" }}>
            Watch real-time chess games being played right now
          </p>
        </div>

        <button
          onClick={fetchLiveGames}
          disabled={isLoadingGames}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "rgba(168,85,247,0.15)",
            border: "1px solid rgba(168,85,247,0.3)",
            color: "#a855f7",
            borderRadius: "10px",
            padding: "10px 18px",
            cursor: isLoadingGames ? "not-allowed" : "pointer",
            fontSize: "13px",
            fontWeight: 600,
            transition: "all 0.2s",
            opacity: isLoadingGames ? 0.6 : 1,
          }}
        >
          <RefreshCw size={14} style={{ animation: isLoadingGames ? "spin 1s linear infinite" : "none" }} />
          Refresh
        </button>
      </div>

      {/* Games Grid */}
      {isLoadingGames ? (
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "300px",
          gap: "16px",
        }}>
          <div style={{
            width: "48px",
            height: "48px",
            border: "3px solid rgba(168,85,247,0.3)",
            borderTop: "3px solid #a855f7",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }} />
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px" }}>Loading live games...</p>
        </div>
      ) : liveGames.length === 0 ? (
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "300px",
          gap: "16px",
          background: "rgba(255,255,255,0.02)",
          borderRadius: "16px",
          border: "1px dashed rgba(255,255,255,0.1)",
        }}>
          <Swords size={48} color="rgba(255,255,255,0.15)" />
          <div style={{ textAlign: "center" }}>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "16px", fontWeight: 600, margin: "0 0 8px" }}>
              No live games right now
            </p>
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "13px", margin: 0 }}>
              Games will appear here when players start matches
            </p>
          </div>
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "16px",
        }}>
          {liveGames.map((game) => (
            <LiveGameCard
              key={game.gameId}
              game={game}
              getTimeControlLabel={getTimeControlLabel}
              getCategoryColor={getCategoryColor}
              onWatch={() => router.push(`/watch/${game.gameId}`)}
            />
          ))}
        </div>
      )}

      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function LiveGameCard({
  game,
  getTimeControlLabel,
  getCategoryColor,
  onWatch,
}: {
  game: LiveGameSummary;
  getTimeControlLabel: (tc: string) => string;
  getCategoryColor: (tc: string) => { bg: string; border: string; text: string };
  onWatch: () => void;
}) {
  const colors = getCategoryColor(game.timeControl);
  const elapsed = Date.now() - game.startedAt;
  const elapsedMin = Math.floor(elapsed / 60000);

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "16px",
        padding: "20px",
        cursor: "pointer",
        transition: "all 0.2s",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = "rgba(168,85,247,0.07)";
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(168,85,247,0.3)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
        (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 32px rgba(168,85,247,0.15)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
      onClick={onWatch}
    >
      {/* Live indicator */}
      <div style={{
        position: "absolute",
        top: "12px",
        right: "12px",
        display: "flex",
        alignItems: "center",
        gap: "5px",
        background: "rgba(239,68,68,0.15)",
        border: "1px solid rgba(239,68,68,0.3)",
        borderRadius: "12px",
        padding: "3px 8px",
      }}>
        <div style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: "#ef4444",
          animation: "livePulse 1s infinite",
        }} />
        <span style={{ color: "#ef4444", fontSize: "10px", fontWeight: 700 }}>LIVE</span>
      </div>

      {/* Players */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
        <PlayerChip username={game.whiteUsername} side="white" />
        <div style={{
          width: "28px",
          height: "28px",
          borderRadius: "50%",
          background: "rgba(168,85,247,0.15)",
          border: "1px solid rgba(168,85,247,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}>
          <Swords size={12} color="#a855f7" />
        </div>
        <PlayerChip username={game.blackUsername} side="black" />
      </div>

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span style={{
            background: colors.bg,
            border: `1px solid ${colors.border}`,
            color: colors.text,
            borderRadius: "8px",
            padding: "3px 8px",
            fontSize: "11px",
            fontWeight: 700,
          }}>
            {getTimeControlLabel(game.timeControl)}
          </span>

          <span style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            color: "rgba(255,255,255,0.4)",
            fontSize: "12px",
          }}>
            <Clock size={11} />
            {elapsedMin}m
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <Eye size={13} color="rgba(255,255,255,0.4)" />
          <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>
            {game.spectatorCount}
          </span>

          <button
            onClick={(e) => { e.stopPropagation(); onWatch(); }}
            style={{
              marginLeft: "8px",
              background: "linear-gradient(135deg, #a855f7, #7c3aed)",
              border: "none",
              borderRadius: "8px",
              color: "white",
              padding: "6px 14px",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Watch
          </button>
        </div>
      </div>
    </div>
  );
}

function PlayerChip({ username, side }: { username: string; side: "white" | "black" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, overflow: "hidden" }}>
      <div style={{
        width: "32px",
        height: "32px",
        borderRadius: "50%",
        overflow: "hidden",
        flexShrink: 0,
        border: "2px solid rgba(255,255,255,0.1)",
      }}>
        <img
          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`}
          alt={username}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
      <span style={{
        fontWeight: 600,
        fontSize: "13px",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>
        {username}
      </span>
    </div>
  );
}
