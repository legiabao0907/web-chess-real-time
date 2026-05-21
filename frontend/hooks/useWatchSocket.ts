"use client";

import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useWatchStore, WatchGameState, LiveGameSummary } from "@/store/useWatchStore";

const SOCKET_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8080";

export function useWatchSocket(gameId?: string) {
  const socketRef = useRef<Socket | null>(null);
  // Buffer watch_updates that arrive before watch_state
  const pendingUpdatesRef = useRef<Partial<WatchGameState>[]>([]);
  const hasStateRef = useRef(false);

  const {
    setLiveGames,
    setWatchingGame,
    updateWatchGame,
    setSpectatorCount,
    setLoadingGames,
    stopWatching,
  } = useWatchStore();

  useEffect(() => {
    hasStateRef.current = false;
    pendingUpdatesRef.current = [];

    const socket = io(`${SOCKET_URL}/watch`, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    // ── subscribe helper ─────────────────────────────────────────────────────
    const subscribe = () => {
      if (gameId) {
        socket.emit("watch_game", { gameId });
      } else {
        setLoadingGames(true);
        socket.emit("list_live_games");
      }
    };

    // ── connect (fires on initial connect AND every reconnect in Socket.IO v4)
    socket.on("connect", () => {
      console.log("👁️  Watch socket connected:", socket.id);
      hasStateRef.current = false;
      pendingUpdatesRef.current = [];
      subscribe();
    });

    // ── Manager-level reconnect (Socket.IO v4) ───────────────────────────────
    socket.io.on("reconnect", () => {
      console.log("👁️  Watch socket reconnected");
      subscribe();
    });

    socket.on("disconnect", () => {
      console.log("👁️  Watch socket disconnected");
    });

    // ── Initial full game state ──────────────────────────────────────────────
    socket.on("watch_state", (data: WatchGameState) => {
      console.log("👁️  watch_state received fen:", data.fen?.substring(0, 40));
      setWatchingGame(data);
      hasStateRef.current = true;

      // Replay any buffered updates that arrived before watch_state
      if (pendingUpdatesRef.current.length > 0) {
        pendingUpdatesRef.current.forEach((update) => updateWatchGame(update));
        pendingUpdatesRef.current = [];
      }
    });

    // ── Real-time move updates ───────────────────────────────────────────────
    socket.on("watch_update", (data: Partial<WatchGameState>) => {
      console.log("👁️  watch_update received fen:", (data as any).fen?.substring(0, 40));
      if (!hasStateRef.current) {
        // watch_state not yet received — buffer this update
        pendingUpdatesRef.current.push(data);
        return;
      }
      updateWatchGame(data);
    });

    // ── Game ended ───────────────────────────────────────────────────────────
    socket.on("watch_game_over", (data: Partial<WatchGameState>) => {
      console.log("👁️  watch_game_over received");
      if (!hasStateRef.current) {
        pendingUpdatesRef.current.push(data);
        return;
      }
      updateWatchGame(data);
    });

    // ── Spectator count ──────────────────────────────────────────────────────
    socket.on("spectator_count", (data: { gameId: string; spectatorCount: number }) => {
      setSpectatorCount(data.spectatorCount);
    });

    // ── Live games list ──────────────────────────────────────────────────────
    socket.on("live_games", (data: { games: LiveGameSummary[] }) => {
      setLiveGames(data.games);
    });

    socket.on("watch_error", (data: { message: string }) => {
      console.error("Watch error:", data.message);
    });

    return () => {
      if (gameId) socket.emit("leave_watch", { gameId });
      socket.disconnect();
      hasStateRef.current = false;
      pendingUpdatesRef.current = [];
      stopWatching();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  const fetchLiveGames = useCallback(() => {
    setLoadingGames(true);
    socketRef.current?.emit("list_live_games");
  }, []);

  const watchGame = useCallback((id: string) => {
    socketRef.current?.emit("watch_game", { gameId: id });
  }, []);

  const leaveWatch = useCallback((id: string) => {
    socketRef.current?.emit("leave_watch", { gameId: id });
    stopWatching();
  }, []);

  return { fetchLiveGames, watchGame, leaveWatch, socket: socketRef };
}
