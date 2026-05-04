"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8080";

// sessionStorage key for persisting active game across page reloads
const SESSION_GAME_KEY = "chess_active_game";

export type GameStatus = "idle" | "searching" | "active" | "finished" | "draw" | "resigned";

export interface GameState {
  gameId: string;
  fen: string;
  pgn: string;
  whiteId: string;
  blackId: string;
  whiteUsername: string;
  blackUsername: string;
  status: GameStatus;
  timeControl: string;
  whiteTimeMs: number;
  blackTimeMs: number;
  turn: "w" | "b";
  moveHistory: string[];
  winner?: "white" | "black" | "draw";
  lastMove?: { from: string; to: string };
  lastMoveAt?: number;
}

export interface ChatMessage {
  userId: string;
  username: string;
  message: string;
  timestamp: number;
}

interface UseChessSocketOptions {
  userId: string;
  username: string;
}

// ── Helpers to persist game in sessionStorage ──────────────────────────────
function saveGameToSession(game: GameState | null) {
  if (typeof window === "undefined") return;
  if (game && game.status === "active") {
    sessionStorage.setItem(SESSION_GAME_KEY, JSON.stringify(game));
  } else {
    sessionStorage.removeItem(SESSION_GAME_KEY);
  }
}

function loadGameFromSession(): GameState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_GAME_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GameState;
  } catch {
    return null;
  }
}

export function useChessSocket({ userId, username }: UseChessSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  // Initialize game state from sessionStorage on first render (survive reload)
  const [game, setGame] = useState<GameState | null>(() => loadGameFromSession());
  const [gameStatus, setGameStatus] = useState<GameStatus>(() => {
    const saved = loadGameFromSession();
    return saved ? (saved.status as GameStatus) : "idle";
  });

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [drawOffered, setDrawOffered] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchingTimeControl, setSearchingTimeControl] = useState<string | null>(null);

  // Keep sessionStorage in sync whenever game changes
  useEffect(() => {
    saveGameToSession(game);
  }, [game]);

  useEffect(() => {
    if (!userId) return;

    const socket = io(`${SOCKET_URL}/chess`, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      console.log("✅ Socket connected:", socket.id);
      // Always send reconnect_check — backend will restore active game if any
      socket.emit("reconnect_check", { userId, username });
    });

    socket.on("disconnect", () => {
      setConnected(false);
      console.log("❌ Socket disconnected");
    });

    socket.on("searching", (data: { timeControl: string; message: string }) => {
      setGameStatus("searching");
      setSearchingTimeControl(data.timeControl);
    });

    socket.on("game_start", (data: GameState) => {
      setGame(data);
      setGameStatus("active");
      setSearchingTimeControl(null);
      setChatMessages([]);
      setDrawOffered(false);
    });

    socket.on("game_state", (data: GameState) => {
      // Backend restored the game after reconnect
      setGame(data);
      setGameStatus(data.status as GameStatus);
    });

    socket.on("move_made", (data: Partial<GameState> & { lastMove?: { from: string; to: string } }) => {
      setGame((prev) => {
        if (!prev) return null;
        const updated = {
          ...prev,
          ...data,
          status: (data.status ?? prev.status) as GameStatus,
        };
        return updated;
      });
    });

    socket.on("game_over", (data: { gameId: string; status: string; winner?: string; message: string }) => {
      setGame((prev) => {
        if (!prev) return null;
        const updated = {
          ...prev,
          status: data.status as GameStatus,
          winner: data.winner as "white" | "black" | "draw" | undefined,
        };
        // Clear sessionStorage when game ends
        sessionStorage.removeItem(SESSION_GAME_KEY);
        return updated;
      });
      setGameStatus(data.status as GameStatus);
    });

    socket.on("move_error", (data: { error: string }) => {
      setErrorMessage(data.error);
      setTimeout(() => setErrorMessage(null), 3000);
    });

    socket.on("draw_offered", () => {
      setDrawOffered(true);
    });

    socket.on("draw_offer_sent", () => {
      // Optimistic UI
    });

    socket.on("draw_declined", () => {
      setDrawOffered(false);
    });

    socket.on("chat_message", (msg: ChatMessage) => {
      setChatMessages((prev) => [...prev, msg]);
    });

    socket.on("opponent_disconnected", () => {
      setErrorMessage("Opponent disconnected. Waiting for reconnect...");
    });

    socket.on("search_cancelled", () => {
      setGameStatus("idle");
      setSearchingTimeControl(null);
    });

    socket.on("error", (data: { message: string }) => {
      setErrorMessage(data.message);
    });

    return () => {
      socket.disconnect();
    };
  }, [userId]);

  // ────────────────────────────────────────────────────
  // Actions
  // ────────────────────────────────────────────────────

  const findGame = useCallback(
    (timeControl: string, rating = 1200) => {
      if (!socketRef.current?.connected) return;
      socketRef.current.emit("find_game", { userId, username, timeControl, rating });
    },
    [userId, username]
  );

  const cancelSearch = useCallback(
    (timeControl: string) => {
      socketRef.current?.emit("cancel_search", { userId, timeControl });
    },
    [userId]
  );

  const joinGame = useCallback(
    (gameId: string) => {
      socketRef.current?.emit("join_game", { gameId, userId, username });
    },
    [userId, username]
  );

  const makeMove = useCallback(
    (gameId: string, move: { from: string; to: string; promotion?: string }) => {
      socketRef.current?.emit("make_move", { gameId, userId, move });
    },
    [userId]
  );

  const resign = useCallback(
    (gameId: string) => {
      socketRef.current?.emit("resign", { gameId, userId });
    },
    [userId]
  );

  const offerDraw = useCallback(
    (gameId: string) => {
      socketRef.current?.emit("offer_draw", { gameId, userId });
    },
    [userId]
  );

  const acceptDraw = useCallback(
    (gameId: string) => {
      setDrawOffered(false);
      socketRef.current?.emit("accept_draw", { gameId, userId });
    },
    [userId]
  );

  const declineDraw = useCallback(
    (gameId: string) => {
      setDrawOffered(false);
      socketRef.current?.emit("decline_draw", { gameId });
    },
    [userId]
  );

  const sendMessage = useCallback(
    (gameId: string, message: string) => {
      socketRef.current?.emit("send_message", { gameId, userId, username, message });
    },
    [userId, username]
  );

  return {
    connected,
    gameStatus,
    game,
    chatMessages,
    drawOffered,
    errorMessage,
    searchingTimeControl,
    actions: {
      findGame,
      cancelSearch,
      joinGame,
      makeMove,
      resign,
      offerDraw,
      acceptDraw,
      declineDraw,
      sendMessage,
    },
  };
}
