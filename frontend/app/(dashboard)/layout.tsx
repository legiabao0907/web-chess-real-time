"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Swords,
  Trophy,
  History,
  Settings,
  Bell,
  LogOut,
  User,
  MessageCircle,
  Radio,
  Bot,
  Users,
} from "lucide-react";
import "./dashboard.css";
import { clearTokens, clearCookies, getUser } from "@/lib/auth";
import { useProfileStore } from "@/store/useProfileStore";
import ProfilePanel from "@/components/common/ProfilePanel";
import ChatDrawer from "@/components/common/ChatDrawer";
import PublicProfilePanel from "@/components/common/PublicProfilePanel";
import { useChatStore, useTotalUnread } from "@/store/useChatStore";
import { useFriendChat } from "@/hooks/useFriendChat";
import { useFriendStore } from "@/store/useFriendStore";
import ClientOnly from "@/components/common/ClientOnly";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { openProfile, profile, loadProfile } = useProfileStore();
  const { openChat } = useChatStore();
  const totalUnread = useTotalUnread();
  const pendingCount = useFriendStore((s) => s.pendingRequests.length);
  const { loadPendingRequests } = useFriendStore();

  const [clientUser, setClientUser] = useState<ReturnType<typeof getUser>>(null);

  useFriendChat({
    userId: clientUser?.id ?? '',
    username: clientUser?.username ?? '',
    enabled: !!clientUser?.id,
  });

  useEffect(() => {
    const localUser = getUser();
    setClientUser(localUser);
    if (localUser && !profile) {
      loadProfile();
    }
    if (localUser?.id) {
      loadPendingRequests();
    }
  }, []);

  const handleLogout = async () => {
    clearTokens();
    await clearCookies();
    router.push("/");
    router.refresh();
  };

  const displayUser = profile ?? clientUser;

  const isActive = (href: string) => {
    if (href === "/home") return pathname === "/home";
    return pathname.startsWith(href);
  };

  return (
    <>
      <ProfilePanel />
      <ChatDrawer />
      <PublicProfilePanel myId={clientUser?.id} />

      <div className="dashboard-layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-top">
            <div className="logo-container">
              <span className="logo-text">
                <span className="text-purple">Chess</span>Skyscraper
              </span>
            </div>

            <nav className="sidebar-nav">
              <Link href="/home" className={`nav-link ${isActive("/home") ? "active" : ""}`}>
                <Home size={18} />
                <span className="nav-text">HOME</span>
              </Link>

              <Link href="/live" className={`nav-link ${isActive("/live") ? "active" : ""}`} style={{ position: 'relative' }}>
                <Radio size={18} />
                <span className="nav-text">LIVE MATCHES</span>
                <span className="live-dot" />
              </Link>

              <Link href="/ranks" className={`nav-link ${isActive("/ranks") ? "active" : ""}`}>
                <Trophy size={18} />
                <span className="nav-text">GLOBAL RANKS</span>
              </Link>

              <Link href="/tournaments" className={`nav-link ${isActive("/tournaments") ? "active" : ""}`}>
                <Swords size={18} />
                <span className="nav-text">TOURNAMENTS</span>
              </Link>

              <Link href="/archives" className={`nav-link ${isActive("/archives") ? "active" : ""}`}>
                <History size={18} />
                <span className="nav-text">ARCHIVES</span>
              </Link>

              <Link href="/friends" className={`nav-link ${isActive("/friends") ? "active" : ""}`} style={{ position: 'relative' }}>
                <Users size={18} />
                <span className="nav-text">FRIENDS</span>
                {pendingCount > 0 && (
                  <span className="nav-badge">{pendingCount > 9 ? '9+' : pendingCount}</span>
                )}
              </Link>

              <Link href="/play-bot" className={`nav-link ${isActive("/play-bot") ? "active" : ""}`} style={{ position: 'relative' }}>
                <Bot size={18} />
                <span className="nav-text">PLAY VS BOT</span>
                <span className="nav-ai-tag">AI</span>
              </Link>

              <button
                onClick={() => openChat('', '')}
                className="nav-link"
                style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', position: 'relative' }}
              >
                <MessageCircle size={18} />
                <span className="nav-text">MESSAGES</span>
                {totalUnread > 0 && (
                  <span className="nav-badge-purple">{totalUnread > 9 ? '9+' : totalUnread}</span>
                )}
              </button>
            </nav>
          </div>

          <div className="sidebar-footer">
            <Link href="/settings" className={`nav-link ${isActive("/settings") ? "active" : ""}`}>
              <Settings size={18} />
              <span className="nav-text">SETTINGS</span>
            </Link>
            <button
              onClick={handleLogout}
              className="nav-link logout-btn"
              style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <LogOut size={18} />
              <span className="nav-text logout-text">TERMINATE SESSION</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="main-area">
          <header className="top-header">
            <nav className="top-nav">
              <Link href="/home" className={`top-nav-item ${isActive("/home") ? "active" : ""}`}>SANCTUARY</Link>
              <Link href="/archives" className={`top-nav-item ${isActive("/archives") ? "active" : ""}`}>ARCHIVES</Link>
            </nav>

            <div className="header-right">
              <div className="elo-badge">
                <span className="elo-label">ELO </span>
                <ClientOnly fallback={<span className="elo-value">1200</span>}>
                  <span className="elo-value">{displayUser?.eloBlitz || 1200}</span>
                </ClientOnly>
              </div>

              <button className="bell-btn">
                <Bell size={20} />
                <span className="bell-indicator"></span>
              </button>

              <button
                id="profile-avatar-btn"
                className="avatar-container avatar-btn"
                onClick={openProfile}
                title="View Profile"
              >
                <div className="avatar-inner">
                  <ClientOnly fallback={<User size={24} color="#a855f7" />}>
                    {displayUser?.avatarUrl ? (
                      <img src={displayUser.avatarUrl} alt="User" />
                    ) : (
                      <User size={24} color="#a855f7" />
                    )}
                  </ClientOnly>
                </div>
              </button>
            </div>
          </header>

          <div className="content-scroll">
            {children}
          </div>

          <div className="footer-info">
            <span>The Protocol</span>
            <span>Privacy</span>
            <span>Fair Play</span>
            <span>Legals</span>
          </div>
        </main>
      </div>
    </>
  );
}
