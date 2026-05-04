"use client";

import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useWatchStore, WatchGameState, LiveGameSummary } from "@/store/useWatchStore";

const SOCKET_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8080";

export function useWatchSocket(gameId?: string) {
  const socketRef = useRef<Socket | null>(null);
  const {
    setLiveGames,
    setWatchingGame,
    updateWatchGame,
    setSpectatorCount,
    setLoadingGames,
    stopWatching,
  } = useWatchStore();

  useEffect(() => {
    const socket = io(`${SOCKET_URL}/watch`, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("👁️  Watch socket connected:", socket.id);

      if (gameId) {
        socket.emit("watch_game", { gameId });
      } else {
        setLoadingGames(true);
        socket.emit("list_live_games");
      }
    });

    // Re-subscribe after reconnect
    socket.on("reconnect", () => {
      if (gameId) socket.emit("watch_game", { gameId });
    });

    socket.on("disconnect", () => {
      console.log("👁️  Watch socket disconnected");
    });

    // Initial full game state for new spectator
    socket.on("watch_state", (data: WatchGameState) => {
      console.log("👁️  watch_state received fen:", data.fen?.substring(0, 40));
      setWatchingGame(data);
    });

    // Real-time move updates pushed from GameGateway → WatchGateway → here
    // This contains the full updated game fields: fen, moveHistory, turn, clocks, etc.
    socket.on("watch_update", (data: Partial<WatchGameState>) => {
      console.log("👁️  watch_update received fen:", (data as any).fen?.substring(0, 40));
      updateWatchGame(data);
    });

    // Game ended
    socket.on("watch_game_over", (data: Partial<WatchGameState>) => {
      console.log("👁️  watch_game_over received");
      updateWatchGame(data);
    });

    // Spectator count update
    socket.on("spectator_count", (data: { gameId: string; spectatorCount: number }) => {
      setSpectatorCount(data.spectatorCount);
    });

    // Live games list
    socket.on("live_games", (data: { games: LiveGameSummary[] }) => {
      setLiveGames(data.games);
    });

    socket.on("watch_error", (data: { message: string }) => {
      console.error("Watch error:", data.message);
    });

    return () => {
      if (gameId) socket.emit("leave_watch", { gameId });
      socket.disconnect();
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
