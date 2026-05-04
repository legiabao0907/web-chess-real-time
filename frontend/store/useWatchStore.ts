"use client";

import { create } from 'zustand';

export interface LiveGameSummary {
  gameId: string;
  whiteUsername: string;
  blackUsername: string;
  timeControl: string;
  spectatorCount: number;
  startedAt: number;
  fen: string;
  moveCount: number;
}

export interface WatchGameState {
  gameId: string;
  fen: string;
  pgn: string;
  whiteId: string;
  blackId: string;
  whiteUsername: string;
  blackUsername: string;
  status: string;
  timeControl: string;
  whiteTimeMs: number;
  blackTimeMs: number;
  turn: 'w' | 'b';
  moveHistory: string[];
  lastMoveAt?: number;
  winner?: string;
  spectatorCount: number;
}

interface WatchState {
  liveGames: LiveGameSummary[];
  watchingGame: WatchGameState | null;
  isLoadingGames: boolean;
  spectatorCount: number;

  // Actions
  setLiveGames: (games: LiveGameSummary[]) => void;
  setWatchingGame: (game: WatchGameState | null) => void;
  updateWatchGame: (update: Partial<WatchGameState>) => void;
  setSpectatorCount: (count: number) => void;
  setLoadingGames: (loading: boolean) => void;
  stopWatching: () => void;
}

export const useWatchStore = create<WatchState>((set, get) => ({
  liveGames: [],
  watchingGame: null,
  isLoadingGames: false,
  spectatorCount: 0,

  setLiveGames: (games) => set({ liveGames: games, isLoadingGames: false }),

  setWatchingGame: (game) =>
    set({ watchingGame: game, spectatorCount: game?.spectatorCount ?? 0 }),

  updateWatchGame: (update) => {
    set((state) => {
      if (!state.watchingGame) return state;
      return {
        watchingGame: {
          ...state.watchingGame,
          ...update,
        },
      };
    });
  },

  setSpectatorCount: (count) => set({ spectatorCount: count }),

  setLoadingGames: (loading) => set({ isLoadingGames: loading }),

  stopWatching: () => set({ watchingGame: null, spectatorCount: 0 }),
}));
