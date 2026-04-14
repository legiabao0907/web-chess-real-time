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
  User
} from "lucide-react";
import "./dashboard.css";
import { clearTokens, clearCookies, getUser } from "@/lib/auth";
import { useProfileStore } from "@/store/useProfileStore";
import ProfilePanel from "@/components/common/ProfilePanel";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { openProfile, profile, loadProfile } = useProfileStore();

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

              <Link href="/live" className="nav-link">
                <Swords size={18} />
                <span className="nav-text">LIVE MATCHES</span>
              </Link>

              <Link href="/analysis" className="nav-link">
                <BrainCircuit size={18} />
                <span className="nav-text">NEURAL ANALYSIS</span>
              </Link>

              <Link href="/ranks" className="nav-link">
                <Trophy size={18} />
                <span className="nav-text">GLOBAL RANKS</span>
              </Link>

              <Link href="/archives" className="nav-link">
                <History size={18} />
                <span className="nav-text">ARCHIVES</span>
              </Link>

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
              <span className="top-nav-item active">SANCTUARY</span>
              <span className="top-nav-item">NEURAL ANALYSIS</span>
              <span className="top-nav-item">ARCHIVES</span>
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
