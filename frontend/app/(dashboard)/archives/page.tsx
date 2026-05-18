"use client";

import React, { useEffect, useState } from "react";
import { History, Swords, Calendar, Clock, Trophy, ExternalLink, Search, Bot } from "lucide-react";
import { getUser } from "@/lib/auth";
import { useRouter } from "next/navigation";

interface GameHistory {
  id: string;
  whiteId: string;
  blackId: string;
  whiteUsername: string;
  blackUsername: string;
  winnerId: string | null;
  status: string;
  timeControl: string;
  pgn: string;
  finalFen: string;
  createdAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";

export default function ArchivesPage() {
  const [games, setGames] = useState<GameHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const user = getUser();
  const router = useRouter();

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const token = localStorage.getItem("accessToken");
        const res = await fetch(`${API_URL}/game/history`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          setGames(data);
        }
      } catch (error) {
        console.error("Failed to fetch game history", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const filteredGames = games.filter(g =>
    (g.whiteUsername ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (g.blackUsername ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="archives-container" style={{ padding: "2rem", color: "white" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ fontSize: "2.5rem", fontWeight: 800, letterSpacing: "-1px", display: "flex", alignItems: "center", gap: "1rem" }}>
            <History size={36} color="#a855f7" />
            GAME ARCHIVES
          </h1>
          <p style={{ color: "rgba(255,255,255,0.4)", marginTop: "0.5rem" }}>
            Review your neural battle history and analyze past strategies.
          </p>
        </div>

        <div style={{ position: "relative" }}>
          <Search style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)" }} size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search opponent..."
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(168,85,247,0.2)",
              borderRadius: "12px",
              padding: "12px 12px 12px 40px",
              color: "white",
              width: "300px",
              outline: "none",
            }}
          />
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "100px" }}>
          <div className="pp-spin" style={{ width: "40px", height: "40px", border: "3px solid rgba(168,85,247,0.3)", borderTopColor: "#a855f7", borderRadius: "50%" }} />
          <p style={{ marginTop: "1rem", color: "rgba(255,255,255,0.5)" }}>Decrypting archives...</p>
        </div>
      ) : filteredGames.length === 0 ? (
        <div style={{ textAlign: "center", padding: "100px", background: "rgba(255,255,255,0.02)", borderRadius: "24px", border: "1px dashed rgba(255,255,255,0.1)" }}>
          <History size={48} color="rgba(255,255,255,0.1)" style={{ marginBottom: "1rem" }} />
          <h3>No games found in the Void.</h3>
          <p style={{ color: "rgba(255,255,255,0.3)" }}>Enter the arena to start recording your legacy.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "1rem" }}>
          {filteredGames.map((game) => {
            const isWhite = game.whiteId === user?.id;
            const isWinner = game.winnerId === user?.id;
            const isDraw = game.status === "draw" || (game.winnerId === null && game.status === "finished");
            const isBot = game.whiteId === null || game.blackId === null;

            return (
              <div
                key={game.id}
                style={{
                  background: "linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
                  border: "1px solid rgba(255,255,255,0.05)",
                  borderRadius: "16px",
                  padding: "1.25rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  transition: "all 0.3s ease",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(168,85,247,0.4)";
                  e.currentTarget.style.background = "rgba(168,85,247,0.05)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)";
                  e.currentTarget.style.background = "linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "2rem", flex: 1 }}>
                  <div style={{ display: "flex", flexDirection: "column", minWidth: "120px" }}>
                    <span style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.3)", display: "flex", alignItems: "center", gap: "4px" }}>
                      <Calendar size={12} /> {formatDate(game.createdAt)}
                    </span>
                    <span style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.3)", display: "flex", alignItems: "center", gap: "4px" }}>
                      <Clock size={12} /> {formatTime(game.createdAt)}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "1rem", flex: 1 }}>
                    <div style={{ textAlign: "right", flex: 1 }}>
                      <span style={{ fontWeight: 600, color: isWhite ? "#a855f7" : "white" }}>{game.whiteUsername}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                      <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "rgba(255,255,255,0.2)" }}>VS</div>
                      <div style={{
                        padding: "2px 8px",
                        borderRadius: "4px",
                        fontSize: "0.6rem",
                        fontWeight: 800,
                        background: game.timeControl.includes("blitz") ? "#f59e0b" : game.timeControl.includes("bullet") ? "#ef4444" : "#3b82f6",
                        color: "white"
                      }}>
                        {game.timeControl.toUpperCase()}
                      </div>
                      {isBot && (
                        <div style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "0.6rem", color: "rgba(168,85,247,0.7)", fontWeight: 700 }}>
                          <Bot size={10} /> BOT
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: "left", flex: 1 }}>
                      <span style={{ fontWeight: 600, color: !isWhite ? "#a855f7" : "white" }}>{game.blackUsername}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "2rem", minWidth: "200px", justifyContent: "flex-end" }}>
                  <div style={{ textAlign: "center" }}>
                    {isDraw ? (
                      <span style={{ color: "#94a3b8", fontWeight: 700, fontSize: "0.9rem" }}>DRAW</span>
                    ) : (
                      <span style={{
                        color: isWinner ? "#22c55e" : "#ef4444",
                        fontWeight: 700,
                        fontSize: "0.9rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px"
                      }}>
                        {isWinner ? <Trophy size={14} /> : null}
                        {isWinner ? "VICTORY" : "DEFEAT"}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => router.push(`/archives/${game.id}`)}
                    style={{
                    background: "rgba(168,85,247,0.1)",
                    border: "1px solid rgba(168,85,247,0.25)",
                    borderRadius: "8px",
                    padding: "8px 14px",
                    color: "#a855f7",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(168,85,247,0.2)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(168,85,247,0.1)"; }}
                  >
                    <ExternalLink size={14} /> View
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .pp-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
