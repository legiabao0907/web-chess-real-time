"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8080";

export type LeaderboardCategory = "blitz" | "bullet" | "rapid";

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  gamesPlayed: number;
  winRate: number;
  trend: "up" | "down" | "stable";
  eloChange?: number;
}

export interface LeaderboardData {
  category: LeaderboardCategory;
  entries: LeaderboardEntry[];
  updatedAt: number;
  totalPlayers: number;
}

export function useLeaderboard() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [category, setCategory] = useState<LeaderboardCategory>("blitz");
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  // Track which row just changed for flash animation
  const [flashedRows, setFlashedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    const socket = io(`${SOCKET_URL}/leaderboard`, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      // Subscribe to initial category
      socket.emit("subscribe_leaderboard", { category, limit: 50 });
    });

    socket.on("disconnect", () => setConnected(false));

    socket.on("leaderboard_data", (incoming: LeaderboardData) => {
      setData((prev) => {
        if (prev) {
          // Detect changed rows to trigger flash animation
          const changed = new Set<string>();
          for (const entry of incoming.entries) {
            const old = prev.entries.find((e) => e.userId === entry.userId);
            if (!old || old.elo !== entry.elo || old.rank !== entry.rank) {
              changed.add(entry.userId);
            }
          }
          if (changed.size > 0) {
            setFlashedRows(changed);
            setTimeout(() => setFlashedRows(new Set()), 1500);
          }
        }
        return incoming;
      });
      setLoading(false);
    });

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch category: leave old room, join new one
  const switchCategory = useCallback(
    (newCategory: LeaderboardCategory) => {
      if (!socketRef.current?.connected) return;
      setLoading(true);
      setCategory(newCategory);
      socketRef.current.emit("unsubscribe_leaderboard", { category });
      socketRef.current.emit("subscribe_leaderboard", {
        category: newCategory,
        limit: 50,
      });
    },
    [category]
  );

  const refresh = useCallback(() => {
    if (!socketRef.current?.connected) return;
    setLoading(true);
    socketRef.current.emit("request_leaderboard", { category, limit: 50 });
  }, [category]);

  return {
    connected,
    category,
    data,
    loading,
    flashedRows,
    switchCategory,
    refresh,
  };
}
