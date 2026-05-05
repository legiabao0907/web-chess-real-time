"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Home,
  Swords,
  BrainCircuit,
  Trophy,
  History,
  Settings,
  Bell,
  LogOut,
  User,
  MessageCircle,
  Radio,
  Bot
} from "lucide-react";
import "./dashboard.css";
import { clearTokens, clearCookies, getUser } from "@/lib/auth";
import { useProfileStore } from "@/store/useProfileStore";
import ProfilePanel from "@/components/common/ProfilePanel";
import ChatDrawer from "@/components/common/ChatDrawer";
import { useChatStore, useTotalUnread } from "@/store/useChatStore";
import { useFriendChat } from "@/hooks/useFriendChat";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { openProfile, profile, loadProfile } = useProfileStore();
  const { openChat } = useChatStore();
  const totalUnread = useTotalUnread();
  const user = getUser();

  // Initialize friend chat socket connection for the whole dashboard session
  useFriendChat({
    userId: user?.id ?? '',
    username: user?.username ?? '',
    enabled: !!user?.id,
  });

  // Load profile data on mount from localStorage
  useEffect(() => {
    const localUser = getUser();
    if (localUser && !profile) {
      loadProfile();
    }
  }, []);

  const handleLogout = async () => {
    clearTokens();
    await clearCookies();
    router.push("/");
    router.refresh();
  };

  const displayUser = profile ?? getUser();

  return (
    <>
      <ProfilePanel />
      <ChatDrawer />

      <div className="dashboard-layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <div>
            <div className="logo-container">
              <span className="logo-text">
                <span className="text-purple">CHESSKY</span>
                <span>SCRAPPER</span>
              </span>
            </div>

            <div className="sidebar-header">
              <p className="sidebar-subtitle">The Sanctuary</p>
              <p className="sidebar-title">
                {displayUser ? displayUser.username.toUpperCase() : "GRANDMASTER"} STATUS
              </p>
            </div>

            <nav className="sidebar-nav">
              <Link href="/home" className="nav-link active">
                <div className="nav-link-content">
                  <Home size={18} className="text-purple" />
                  <span className="nav-text">HOME</span>
                </div>
                <div className="active-indicator"></div>
              </Link>

              <Link href="/live" className="nav-link" style={{ position: 'relative' }}>
                <Radio size={18} color="#ef4444" />
                <span className="nav-text">LIVE MATCHES</span>
                <span style={{
                  position: 'absolute',
                  top: '6px',
                  right: '8px',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#ef4444',
                  animation: 'liveBadgePulse 1.5s infinite',
                }} />
              </Link>

              <Link href="/analysis" className="nav-link">
                <BrainCircuit size={18} />
                <span className="nav-text">NEURAL ANALYSIS</span>
              </Link>

              <Link href="/ranks" className="nav-link">
                <Trophy size={18} />
                <span className="nav-text">GLOBAL RANKS</span>
              </Link>

              <Link href="/tournaments" className="nav-link">
                <Swords size={18} />
                <span className="nav-text">TOURNAMENTS</span>
              </Link>

              <Link href="/archives" className="nav-link">
                <History size={18} />
                <span className="nav-text">ARCHIVES</span>
              </Link>

              <Link href="/play-bot" className="nav-link" style={{ position: 'relative' }}>
                <Bot size={18} style={{ color: '#a855f7' }} />
                <span className="nav-text">PLAY VS BOT</span>
                <span style={{
                  position: 'absolute',
                  top: '6px',
                  right: '8px',
                  fontSize: '9px',
                  fontWeight: 700,
                  background: 'rgba(168,85,247,0.2)',
                  color: '#a855f7',
                  padding: '1px 5px',
                  borderRadius: '6px',
                  border: '1px solid rgba(168,85,247,0.3)',
                }}>AI</span>
              </Link>

              {/* Chat button */}
              <button
                onClick={() => openChat('', '')}
                className="nav-link"
                style={{ width: '100%', background: 'none', border: 'none', color: '#8b7fa8', cursor: 'pointer', textAlign: 'left', position: 'relative' }}
              >
                <MessageCircle size={18} />
                <span className="nav-text">MESSAGES</span>
                {totalUnread > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '6px',
                    right: '8px',
                    background: '#a855f7',
                    color: 'white',
                    borderRadius: '12px',
                    padding: '1px 6px',
                    fontSize: '10px',
                    fontWeight: 700,
                    minWidth: '18px',
                    textAlign: 'center',
                  }}>
                    {totalUnread > 9 ? '9+' : totalUnread}
                  </span>
                )}
              </button>

              <div className="find-match-container">
                <Link href="/play" className="btn-primary" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
                  FIND MATCH
                </Link>
              </div>
            </nav>
          </div>

          <div className="sidebar-footer">
            <Link href="/settings" className="nav-link">
              <Settings size={18} />
              <span className="nav-text">SETTINGS</span>
            </Link>
            <button
              onClick={handleLogout}
              className="nav-link logout-btn"
              style={{ width: '100%', background: 'none', border: 'none', color: '#8b7fa8', cursor: 'pointer', textAlign: 'left' }}
            >
              <LogOut size={18} color="#ef4444" />
              <span className="nav-text" style={{ color: '#ef4444' }}>TERMINATE SESSION</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="main-area">
          <header className="top-header">
            <nav className="top-nav">
              <Link href="/home" className="top-nav-item active">SANCTUARY</Link>
              <span className="top-nav-item">NEURAL ANALYSIS</span>
              <Link href="/archives" className="top-nav-item">ARCHIVES</Link>
            </nav>

            <div className="header-right">
              <div className="elo-badge">
                <span className="elo-label">ELO </span>
                <span className="elo-value">{displayUser?.eloBlitz || 1200}</span>
              </div>

              <button className="bell-btn">
                <Bell size={20} />
                <span className="bell-indicator"></span>
              </button>

              {/* Avatar: click to open profile panel */}
              <button
                id="profile-avatar-btn"
                className="avatar-container avatar-btn"
                onClick={openProfile}
                title="View Profile"
              >
                <div className="avatar-inner">
                  {displayUser?.avatarUrl ? (
                    <img src={displayUser.avatarUrl} alt="User" />
                  ) : (
                    <User size={24} color="#a855f7" />
                  )}
                </div>
              </button>
            </div>
          </header>

          <div className="content-scroll">
            {children}
          </div>

          <div className="footer-info">
            <span>The Protocol</span>
            <span>Privacy Void</span>
            <span>Neural API</span>
            <span>Legals</span>
          </div>
        </main>
      </div>
    </>
  );
}
