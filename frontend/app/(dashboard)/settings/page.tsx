"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Monitor,
  Moon,
  Sun,
  Volume2,
  VolumeX,
  Palette,
  ChevronRight,
  ArrowLeft,
  Eye,
  User,
  Shield,
  Save,
} from "lucide-react";
import { useSettingsStore, ThemeMode, BoardStyle, PieceStyle } from "@/store/useSettingsStore";
import { getUser, AuthUser } from "@/lib/auth";
import "../dashboard.css";

// ─── Preview helpers ────────────────────────────────────────────────
const boardPreviews: Record<BoardStyle, string> = {
  classic: "bg-amber-100",
  wood: "bg-yellow-900",
  neon: "bg-purple-900",
};
const pieceLabels: Record<PieceStyle, string> = {
  standard: "♚ Standard",
  neo: "♛ Neo",
  classic: "♔ Classic",
};

export default function SettingsPage() {
  const router = useRouter();
  const theme = useSettingsStore((s) => s.theme);
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const boardStyle = useSettingsStore((s) => s.boardStyle);
  const pieceStyle = useSettingsStore((s) => s.pieceStyle);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const setSoundEnabled = useSettingsStore((s) => s.setSoundEnabled);
  const setBoardStyle = useSettingsStore((s) => s.setBoardStyle);
  const setPieceStyle = useSettingsStore((s) => s.setPieceStyle);

  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
    const u = getUser();
    setUser(u);
    if (u?.id) {
      void (useSettingsStore.getState() as any).fetchSettings();
    }
  }, []);

  if (!mounted || !user) return null;

  const flashSave = (label: string) => {
    setSaving(label);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSaving(null), 1200);
  };

  const handleThemeChange = async (t: ThemeMode) => {
    await setTheme(t);
    flashSave('Theme');
  };

  const handleSoundToggle = async () => {
    await setSoundEnabled(!soundEnabled);
    flashSave('Sound');
  };

  const handleBoardStyle = async (s: BoardStyle) => {
    await setBoardStyle(s);
    flashSave('Board');
  };

  const handlePieceStyle = async (s: PieceStyle) => {
    await setPieceStyle(s);
    flashSave('Pieces');
  };

  return (
    <div className="dashboard-home-new">
      {/* ─── HEADER ─── */}
      <div className="dh-top-row">
        <div className="dh-welcome glass-card" style={{ flex: 1 }}>
          <button
            onClick={() => router.push('/home')}
            className="inline-flex items-center gap-2 text-purple-300 hover:text-purple-100 transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </button>
          <h1 className="dh-welcome-title mt-2">
            SYSTEM <span className="dh-welcome-gradient">CONFIGURATION</span>
          </h1>
          <p className="dh-welcome-sub">Customize your interface &middot; Changes save automatically</p>
        </div>
        {saving && (
          <div className="glass-card flex items-center gap-2 px-4 py-3 text-green-400 text-sm animate-pulse">
            <Save size={14} />
            {saving} saved
          </div>
        )}
      </div>

      {/* ─── SETTINGS GRID ─── */}
      <div className="settings-grid">

        {/* ── THEME ── */}
        <div className="glass-card settings-card">
          <div className="flex items-center gap-3 mb-4">
            <Monitor size={20} className="text-purple-400" />
            <h3 className="text-white font-semibold text-base">Interface Theme</h3>
          </div>
          <div className="theme-options">
            <button
              onClick={() => handleThemeChange('dark')}
              className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
            >
              <Moon size={24} />
              <span>Dark</span>
            </button>
            <button
              onClick={() => handleThemeChange('light')}
              className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
            >
              <Sun size={24} />
              <span>Light</span>
            </button>
          </div>
        </div>

        {/* ── SOUND ── */}
        <div className="glass-card settings-card">
          <div className="flex items-center gap-3 mb-4">
            {soundEnabled ? (
              <Volume2 size={20} className="text-purple-400" />
            ) : (
              <VolumeX size={20} className="text-gray-500" />
            )}
            <h3 className="text-white font-semibold text-base">Sound Effects</h3>
          </div>
          <button
            onClick={handleSoundToggle}
            className={`sound-toggle ${soundEnabled ? 'on' : 'off'}`}
          >
            <div className="sound-knob" />
            <span className="sound-label">{soundEnabled ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        {/* ── BOARD STYLE ── */}
        <div className="glass-card settings-card">
          <div className="flex items-center gap-3 mb-4">
            <Palette size={20} className="text-purple-400" />
            <h3 className="text-white font-semibold text-base">Board Style</h3>
          </div>
          <div className="style-grid">
            {(['classic', 'wood', 'neon'] as BoardStyle[]).map((s) => (
              <button
                key={s}
                onClick={() => handleBoardStyle(s)}
                className={`style-option ${boardStyle === s ? 'active' : ''}`}
              >
                <div className={`style-preview ${boardPreviews[s]}`} />
                <span className="style-label">{s.charAt(0).toUpperCase() + s.slice(1)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── PIECE STYLE ── */}
        <div className="glass-card settings-card">
          <div className="flex items-center gap-3 mb-4">
            <Eye size={20} className="text-purple-400" />
            <h3 className="text-white font-semibold text-base">Piece Style</h3>
          </div>
          <div className="style-grid">
            {(['standard', 'neo', 'classic'] as PieceStyle[]).map((s) => (
              <button
                key={s}
                onClick={() => handlePieceStyle(s)}
                className={`style-option ${pieceStyle === s ? 'active' : ''}`}
              >
                <div className="style-preview bg-purple-950 flex items-center justify-center text-2xl">
                  {s === 'standard' ? '♚' : s === 'neo' ? '♛' : '♔'}
                </div>
                <span className="style-label">{pieceLabels[s]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── QUICK LINKS ── */}
        <div className="glass-card settings-card">
          <div className="flex items-center gap-3 mb-4">
            <User size={20} className="text-purple-400" />
            <h3 className="text-white font-semibold text-base">Account</h3>
          </div>
          <div className="quick-links">
            <button
              onClick={() => router.push('/home')}
              className="quick-link"
            >
              <User size={16} />
              <span>Edit Profile</span>
              <ChevronRight size={16} className="ml-auto" />
            </button>
            <button className="quick-link">
              <Shield size={16} />
              <span>Privacy & Security</span>
              <ChevronRight size={16} className="ml-auto" />
            </button>
          </div>
        </div>

      </div>

      {/* ─── STYLES ─── */}
      <style jsx>{`
        .settings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 18px;
          margin-top: 24px;
        }
        .settings-card {
          padding: 20px 22px;
        }
        .theme-options, .style-grid {
          display: flex;
          gap: 12px;
        }
        .theme-btn, .style-option {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 16px 12px;
          border-radius: 12px;
          border: 2px solid transparent;
          background: rgba(255,255,255,0.03);
          color: #9ca3af;
          cursor: pointer;
          transition: all 0.2s;
        }
        .theme-btn:hover, .style-option:hover {
          background: rgba(168,85,247,0.08);
          color: #c4b5fd;
        }
        .theme-btn.active, .style-option.active {
          border-color: #a855f7;
          background: rgba(168,85,247,0.12);
          color: #c084fc;
          box-shadow: 0 0 16px rgba(168,85,247,0.15);
        }
        .sound-toggle {
          display: flex;
          align-items: center;
          gap: 14px;
          width: 100%;
          padding: 14px 16px;
          border-radius: 12px;
          border: none;
          background: rgba(255,255,255,0.03);
          cursor: pointer;
          transition: all 0.2s;
        }
        .sound-toggle.on {
          background: rgba(34,197,94,0.08);
        }
        .sound-toggle.off {
          background: rgba(239,68,68,0.05);
        }
        .sound-knob {
          width: 44px;
          height: 26px;
          border-radius: 13px;
          background: #374151;
          position: relative;
          transition: background 0.3s;
        }
        .sound-knob::after {
          content: '';
          position: absolute;
          top: 3px;
          left: 3px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #9ca3af;
          transition: all 0.3s;
        }
        .sound-toggle.on .sound-knob {
          background: #22c55e;
        }
        .sound-toggle.on .sound-knob::after {
          left: 21px;
          background: white;
        }
        .sound-label {
          font-weight: 600;
          font-size: 14px;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 2px;
        }
        .sound-toggle.on .sound-label {
          color: #22c55e;
        }
        .style-preview {
          width: 60px;
          height: 44px;
          border-radius: 6px;
          border: 1px solid rgba(255,255,255,0.06);
        }
        .style-label {
          font-size: 12px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .quick-links {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .quick-link {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 12px 14px;
          border-radius: 8px;
          border: none;
          background: transparent;
          color: #9ca3af;
          cursor: pointer;
          transition: all 0.15s;
          font-size: 14px;
        }
        .quick-link:hover {
          background: rgba(255,255,255,0.04);
          color: #c4b5fd;
        }
      `}</style>
    </div>
  );
}
