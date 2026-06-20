import { create } from 'zustand';
import { apiFetch } from '@/lib/api';

export type ThemeMode = 'dark' | 'light';
export type BoardStyle = 'classic' | 'wood' | 'neon';
export type PieceStyle = 'standard' | 'neo' | 'classic';

interface UserSettingsResponse {
  theme?: string;
  soundEnabled?: boolean;
  boardStyle?: string;
  pieceStyle?: string;
}

interface SettingsState {
  theme: ThemeMode;
  soundEnabled: boolean;
  boardStyle: BoardStyle;
  pieceStyle: PieceStyle;
  loading: boolean;

  fetchSettings: () => Promise<void>;
  setTheme: (theme: ThemeMode) => Promise<void>;
  setSoundEnabled: (enabled: boolean) => Promise<void>;
  setBoardStyle: (style: BoardStyle) => Promise<void>;
  setPieceStyle: (style: PieceStyle) => Promise<void>;
  applyTheme: (theme: ThemeMode) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  theme: 'dark',
  soundEnabled: true,
  boardStyle: 'classic',
  pieceStyle: 'standard',
  loading: false,

  fetchSettings: async () => {
    try {
      const data = await apiFetch<UserSettingsResponse>('/user/me');
      const t = (data.theme as ThemeMode) || 'dark';
      set({
        theme: t,
        soundEnabled: data.soundEnabled !== false,
        boardStyle: (data.boardStyle as BoardStyle) || 'classic',
        pieceStyle: (data.pieceStyle as PieceStyle) || 'standard',
        loading: false,
      });
      get().applyTheme(t);
    } catch {
      set({ loading: false });
    }
  },

  setTheme: async (theme) => {
    set({ theme });
    get().applyTheme(theme);
    try {
      await apiFetch('/user/settings', {
        method: 'PATCH',
        body: JSON.stringify({ theme }),
      });
    } catch { /* ignore */ }
  },

  setSoundEnabled: async (enabled) => {
    set({ soundEnabled: enabled });
    try {
      await apiFetch('/user/settings', {
        method: 'PATCH',
        body: JSON.stringify({ soundEnabled: enabled }),
      });
    } catch { /* ignore */ }
  },

  setBoardStyle: async (style) => {
    set({ boardStyle: style });
    try {
      await apiFetch('/user/settings', {
        method: 'PATCH',
        body: JSON.stringify({ boardStyle: style }),
      });
    } catch { /* ignore */ }
  },

  setPieceStyle: async (style) => {
    set({ pieceStyle: style });
    try {
      await apiFetch('/user/settings', {
        method: 'PATCH',
        body: JSON.stringify({ pieceStyle: style }),
      });
    } catch { /* ignore */ }
  },

  applyTheme: (theme) => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark');
      document.documentElement.classList.toggle('light', theme === 'light');
    }
  },
}));
