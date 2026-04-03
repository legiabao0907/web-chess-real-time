import React from "react";
import Link from "next/link";
import { 
  Home, 
  Swords, 
  BrainCircuit, 
  Trophy, 
  History, 
  Settings, 
  HelpCircle,
  Bell
} from "lucide-react";
import "./dashboard.css";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
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
            <p className="sidebar-title">Grandmaster Status</p>
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
          <Link href="/support" className="nav-link">
            <HelpCircle size={18} />
            <span className="nav-text">SUPPORT</span>
          </Link>
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
              <span className="elo-value">2840</span>
            </div>
            
            <button className="bell-btn">
              <Bell size={20} />
              <span className="bell-indicator"></span>
            </button>
            
            <div className="avatar-container">
              <div className="avatar-inner">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=Felix`} alt="User" />
              </div>
            </div>
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
  );
}
