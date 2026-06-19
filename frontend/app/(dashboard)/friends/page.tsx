"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Users,
  Bell,
  MessageCircle,
  Eye,
  Check,
  X,
  Loader2,
  UserPlus,
  RefreshCw,
  Swords,
  Search,
} from "lucide-react";
import { useFriendStore, Friend, PendingRequest } from "@/store/useFriendStore";
import { useChatStore } from "@/store/useChatStore";
import { useProfileStore } from "@/store/useProfileStore";
import { getUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import PublicProfilePanel from "@/components/common/PublicProfilePanel";
import "./friends.css";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function eloColor(elo: number): string {
  if (elo >= 2000) return "#f59e0b";
  if (elo >= 1600) return "#8b5cf6";
  if (elo >= 1300) return "#3b82f6";
  return "#6b7280";
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonItem() {
  return (
    <div className="friend-skeleton">
      <div className="skel-circle" />
      <div className="skel-lines">
        <div className="skel-line" />
        <div className="skel-line short" />
      </div>
    </div>
  );
}

// ─── Pending Request Card ─────────────────────────────────────────────────────

function PendingCard({ req, onAccept, onDecline, isLoading }: {
  req: PendingRequest;
  onAccept: () => void;
  onDecline: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="friend-item" style={{ cursor: "default" }}>
      <div className="friend-avatar">
        <img
          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${req.username}`}
          alt={req.username}
        />
      </div>
      <div className="friend-info">
        <div className="friend-name">{req.username}</div>
        <div className="friend-elo" style={{ color: eloColor(req.eloBlitz) }}>
          {req.eloBlitz} Blitz
        </div>
      </div>
      <div className="friend-actions">
        <button
          className="fi-btn fi-btn-accept"
          onClick={onAccept}
          disabled={isLoading}
          title="Accept friend request"
        >
          {isLoading ? <Loader2 size={12} className="spin-icon" /> : <Check size={12} />}
        </button>
        <button
          className="fi-btn fi-btn-decline"
          onClick={onDecline}
          disabled={isLoading}
          title="Decline friend request"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}

// ─── Friend Card ──────────────────────────────────────────────────────────────

function FriendCard({ friend, isActive, onView, onMessage }: {
  friend: Friend;
  isActive: boolean;
  onView: () => void;
  onMessage: () => void;
}) {
  const { onlineUsers } = useChatStore();
  const isOnline = onlineUsers.has(friend.id);

  return (
    <div
      className={`friend-item ${isActive ? "active" : ""}`}
      onClick={onView}
    >
      <div className="friend-avatar">
        <img
          src={
            friend.avatarUrl ||
            `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.username}`
          }
          alt={friend.username}
        />
        <span className={`friend-online-dot ${isOnline ? "online" : "offline"}`} />
      </div>

      <div className="friend-info">
        <div className="friend-name">{friend.username}</div>
        <div className="friend-elo" style={{ color: eloColor(friend.eloBlitz) }}>
          {friend.eloBlitz} Blitz
        </div>
        <div className="friend-status-text">{isOnline ? "● Online" : "○ Offline"}</div>
      </div>

      <div className="friend-actions" onClick={(e) => e.stopPropagation()}>
        <button
          className="fi-btn fi-btn-view"
          onClick={onView}
          title="View profile"
        >
          <Eye size={12} />
        </button>
        <button
          className="fi-btn fi-btn-message"
          onClick={onMessage}
          title="Send message"
        >
          <MessageCircle size={12} />
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FriendsPage() {
  const {
    friends,
    pendingRequests,
    isLoadingFriends,
    isLoadingRequests,
    actionLoading,
    loadFriends,
    loadPendingRequests,
    acceptRequest,
    declineRequest,
  } = useFriendStore();

  const { openChat } = useChatStore();
  const { openPublicProfile } = useProfileStore();

  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [myId, setMyId] = useState<string | undefined>(undefined);

  // ─── Search state ──────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [addLoading, setAddLoading] = useState<Record<string, boolean>>({});
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Close search dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSearch = useCallback(async (q: string) => {
    setSearchQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const data = await apiFetch<any[]>(`/user/search?q=${encodeURIComponent(q.trim())}`);
        setSearchResults(data ?? []);
        setSearchOpen(true);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  }, []);

  const handleAddFriend = async (targetId: string) => {
    setAddLoading((s) => ({ ...s, [targetId]: true }));
    try {
      await useFriendStore.getState().sendFriendRequest(targetId);
      setSearchResults((prev) =>
        prev.map((u) => (u.id === targetId ? { ...u, _sent: true } : u))
      );
    } catch {
      // ignore
    } finally {
      setAddLoading((s) => ({ ...s, [targetId]: false }));
    }
  };

  // Load data on mount
  useEffect(() => {
    const user = getUser();
    setMyId(user?.id);
    loadFriends();
    loadPendingRequests();
  }, []);

  const handleViewProfile = (friendId: string) => {
    setSelectedFriendId(friendId);
    openPublicProfile(friendId);
  };

  const handleMessage = (friend: Friend) => {
    openChat(friend.id, friend.username);
  };

  const handleRefresh = () => {
    loadFriends();
    loadPendingRequests();
  };

  const onlineFriends = friends.filter((f) => f.isOnline);
  const offlineFriends = friends.filter((f) => !f.isOnline);
  const sortedFriends = [...onlineFriends, ...offlineFriends];

  return (
    <>
      {/* Public Profile Panel (slide-in) */}
      <PublicProfilePanel myId={myId} />

      <div className="friends-page">
        {/* Page header */}
        <div className="friends-header">
          <div className="friends-title-group">
            <Users size={28} className="friends-icon" />
            <div>
              <h1 className="friends-title">MY FRIENDS</h1>
              <p className="friends-subtitle">
                {friends.length} friend{friends.length !== 1 ? "s" : ""}
                {pendingRequests.length > 0 &&
                  ` · ${pendingRequests.length} pending`}
              </p>
            </div>
          </div>

          <button
            onClick={handleRefresh}
            style={{
              background: "rgba(168,85,247,0.1)",
              border: "1px solid rgba(168,85,247,0.25)",
              borderRadius: "10px",
              color: "#a855f7",
              padding: "8px 14px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>

        {/* Two-column layout */}
        <div className="friends-layout">
          {/* ── Left column: Search + lists ── */}
          <div className="friends-left">

            {/* ── Search bar ── */}
            <div className="friends-search-wrap" ref={searchRef}>
              <div className="friends-search-bar">
                <Search size={14} className="friends-search-icon" />
                <input
                  type="text"
                  placeholder="Find players by username..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  onFocus={() => { if (searchResults.length > 0) setSearchOpen(true); }}
                  className="friends-search-input"
                />
                {searchLoading && <Loader2 size={14} className="spin-icon friends-search-icon" />}
              </div>
              {searchOpen && searchResults.length > 0 && (
                <div className="friends-search-dropdown">
                  {searchResults.map((u: any) => (
                    <div key={u.id} className="friends-search-item">
                      <div className="friends-search-item-avatar">
                        <img
                          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`}
                          alt={u.username}
                        />
                      </div>
                      <div className="friends-search-item-info">
                        <span className="friends-search-item-name">{u.username}</span>
                        <span className="friends-search-item-elo">
                          {u.eloBlitz} Blitz &middot; {u.eloRapid} Rapid
                        </span>
                      </div>
                      {u._sent ? (
                        <span className="friends-search-sent">✓ Sent</span>
                      ) : (
                        <button
                          className="fi-btn fi-btn-add"
                          onClick={() => handleAddFriend(u.id)}
                          disabled={addLoading[u.id]}
                        >
                          {addLoading[u.id] ? (
                            <Loader2 size={12} className="spin-icon" />
                          ) : (
                            <UserPlus size={12} />
                          )}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {searchOpen && searchQuery.trim() && searchResults.length === 0 && !searchLoading && (
                <div className="friends-search-dropdown">
                  <div className="friends-search-empty">No players found</div>
                </div>
              )}
            </div>

            {/* Pending requests */}
            {(isLoadingRequests || pendingRequests.length > 0) && (
              <div className="friends-card">
                <div className="friends-card-header">
                  <span className="friends-card-title">
                    <Bell size={12} />
                    Pending Requests
                  </span>
                  <span className="friends-badge friends-badge-red">
                    {pendingRequests.length}
                  </span>
                </div>
                <div className="friends-card-list">
                  {isLoadingRequests ? (
                    Array.from({ length: 2 }).map((_, i) => <SkeletonItem key={i} />)
                  ) : (
                    pendingRequests.map((req) => (
                      <PendingCard
                        key={req.id}
                        req={req}
                        isLoading={!!actionLoading[req.id]}
                        onAccept={() => acceptRequest(req.id)}
                        onDecline={() => declineRequest(req.id)}
                      />
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Friends list */}
            <div className="friends-card">
              <div className="friends-card-header">
                <span className="friends-card-title">
                  <Users size={12} />
                  Friends
                </span>
                <span className="friends-badge">{friends.length}</span>
              </div>
              <div className="friends-card-list">
                {isLoadingFriends ? (
                  Array.from({ length: 4 }).map((_, i) => <SkeletonItem key={i} />)
                ) : sortedFriends.length === 0 ? (
                  <div className="friends-empty">
                    <Users size={28} />
                    <p>No friends yet</p>
                    <p style={{ fontSize: "11px", opacity: 0.6 }}>
                      Add friends by clicking their profile
                    </p>
                  </div>
                ) : (
                  sortedFriends.map((f) => (
                    <FriendCard
                      key={f.id}
                      friend={f}
                      isActive={selectedFriendId === f.id}
                      onView={() => handleViewProfile(f.id)}
                      onMessage={() => handleMessage(f)}
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* ── Right column: placeholder or profile details ── */}
          <div className="friends-right">
            {!selectedFriendId ? (
              <div className="friends-right-placeholder">
                <Swords size={48} />
                <p>Select a friend to view their profile</p>
                <p style={{ fontSize: "11px" }}>
                  See their stats, history, and head-to-head record
                </p>
              </div>
            ) : (
              <div style={{ padding: "1.5rem", width: "100%", color: "rgba(255,255,255,0.4)", textAlign: "center", fontSize: "13px" }}>
                Profile panel open →
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
