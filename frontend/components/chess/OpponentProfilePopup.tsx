"use client";

import React, { useState, useEffect, useCallback } from "react";
import { X, UserPlus, UserCheck, Clock, Trophy, Shield } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useChatStore } from "@/store/useChatStore";

interface OpponentProfile {
  id: string;
  username: string;
  eloBlitz?: number;
  eloRapid?: number;
  eloBullet?: number;
  bio?: string | null;
  country?: string | null;
  avatarUrl?: string | null;
  totalGames?: number;
  wins?: number;
  losses?: number;
  draws?: number;
}

type FriendshipStatus = "none" | "pending_sent" | "pending_received" | "friends" | "loading";

interface OpponentProfilePopupProps {
  opponentId: string;
  opponentUsername: string;
  isOnline: boolean;
  onClose: () => void;
}

export default function OpponentProfilePopup({
  opponentId,
  opponentUsername,
  isOnline,
  onClose,
}: OpponentProfilePopupProps) {
  const [profile, setProfile] = useState<OpponentProfile | null>(null);
  const [friendStatus, setFriendStatus] = useState<FriendshipStatus>("loading");
  const [actionLoading, setActionLoading] = useState(false);
  const { openChat } = useChatStore();

  useEffect(() => {
    // Load public profile
    apiFetch<OpponentProfile>(`/user/${opponentId}`)
      .then(setProfile)
      .catch(() => setProfile({ id: opponentId, username: opponentUsername }));

    // Load friendship status
    apiFetch<{ status: FriendshipStatus }>(`/user/${opponentId}/friendship`)
      .then((r) => setFriendStatus(r.status))
      .catch(() => setFriendStatus("none"));
  }, [opponentId]);

  const handleFriendAction = useCallback(async () => {
    setActionLoading(true);
    try {
      if (friendStatus === "none") {
        await apiFetch(`/user/${opponentId}/friend-request`, { method: "POST" });
        setFriendStatus("pending_sent");
      } else if (friendStatus === "pending_received") {
        await apiFetch(`/user/${opponentId}/accept-friend`, { method: "POST" });
        setFriendStatus("friends");
      } else if (friendStatus === "friends") {
        await apiFetch(`/user/${opponentId}/friend`, { method: "DELETE" });
        setFriendStatus("none");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  }, [friendStatus, opponentId]);

  const winRate = profile && profile.totalGames
    ? Math.round(((profile.wins ?? 0) / profile.totalGames) * 100)
    : 0;

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, backdropFilter: "blur(4px)" }}
      />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        width: "360px", zIndex: 1001,
        background: "linear-gradient(135deg, #0f0f1a 0%, #1a1025 100%)",
        border: "1px solid rgba(168,85,247,0.3)", borderRadius: "20px",
        boxShadow: "0 24px 80px rgba(0,0,0,0.7), 0 0 60px rgba(168,85,247,0.1)",
        overflow: "hidden",
      }}>
        {/* Header gradient */}
        <div style={{
          background: "linear-gradient(135deg, rgba(168,85,247,0.2), rgba(124,58,237,0.1))",
          padding: "24px 24px 20px", position: "relative",
          borderBottom: "1px solid rgba(168,85,247,0.15)",
        }}>
          <button onClick={onClose} style={{
            position: "absolute", top: "12px", right: "12px",
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "8px", color: "rgba(255,255,255,0.6)", cursor: "pointer",
            padding: "4px", display: "flex",
          }}>
            <X size={14} />
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ position: "relative" }}>
              <div style={{
                width: "60px", height: "60px", borderRadius: "50%", overflow: "hidden",
                border: "3px solid rgba(168,85,247,0.5)",
              }}>
                <img
                  src={profile?.avatarUrl ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${opponentUsername}`}
                  alt={opponentUsername} style={{ width: "100%", height: "100%" }}
                />
              </div>
              <div style={{
                position: "absolute", bottom: "2px", right: "2px",
                width: "12px", height: "12px", borderRadius: "50%",
                background: isOnline ? "#22c55e" : "#6b7280",
                border: "2px solid #0f0f1a",
              }} />
            </div>
            <div>
              <h3 style={{ color: "white", fontWeight: 700, fontSize: "18px", margin: 0 }}>
                {opponentUsername}
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                <div style={{
                  width: "7px", height: "7px", borderRadius: "50%",
                  background: isOnline ? "#22c55e" : "#6b7280",
                }} />
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px" }}>
                  {isOnline ? "Online" : "Offline"}
                </span>
                {profile?.country && (
                  <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px" }}>
                    · {profile.country}
                  </span>
                )}
              </div>
              {profile?.bio && (
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", marginTop: "6px", fontStyle: "italic" }}>
                  "{profile.bio}"
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ELO Stats */}
        <div style={{ padding: "16px 24px", display: "flex", gap: "8px" }}>
          {[
            { label: "Blitz", value: profile?.eloBlitz ?? 1200, color: "#f59e0b" },
            { label: "Rapid", value: profile?.eloRapid ?? 1200, color: "#3b82f6" },
            { label: "Bullet", value: profile?.eloBullet ?? 1200, color: "#ef4444" },
          ].map((s) => (
            <div key={s.label} style={{
              flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "10px",
              padding: "10px 8px", textAlign: "center",
              border: "1px solid rgba(255,255,255,0.06)",
            }}>
              <div style={{ fontSize: "16px", fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", marginTop: "2px" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Game Stats */}
        {profile?.totalGames != null && profile.totalGames > 0 && (
          <div style={{ padding: "0 24px 16px", display: "flex", gap: "8px", alignItems: "center" }}>
            <Trophy size={12} color="#a855f7" />
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>
              {profile.totalGames} games · {profile.wins}W {profile.losses}L {profile.draws}D · {winRate}% win
            </span>
          </div>
        )}

        {/* Actions */}
        <div style={{ padding: "0 24px 24px", display: "flex", gap: "8px", flexDirection: "column" }}>
          <button
            onClick={handleFriendAction}
            disabled={actionLoading || friendStatus === "loading" || friendStatus === "pending_sent"}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              padding: "10px 16px", borderRadius: "10px", fontWeight: 600, fontSize: "13px",
              cursor: (actionLoading || friendStatus === "pending_sent") ? "not-allowed" : "pointer",
              border: "none", transition: "all 0.2s",
              background: friendStatus === "friends"
                ? "rgba(239,68,68,0.15)"
                : friendStatus === "pending_sent"
                  ? "rgba(255,255,255,0.07)"
                  : "linear-gradient(135deg, #a855f7, #7c3aed)",
              color: friendStatus === "friends" ? "#ef4444"
                : friendStatus === "pending_sent" ? "rgba(255,255,255,0.4)" : "white",
            }}
          >
            {friendStatus === "friends" ? <><UserCheck size={14} /> Friends (Remove)</> :
             friendStatus === "pending_sent" ? <><Clock size={14} /> Request Sent</> :
             friendStatus === "pending_received" ? <><UserPlus size={14} /> Accept Request</> :
             friendStatus === "loading" ? "Loading..." :
             <><UserPlus size={14} /> Add Friend</>}
          </button>

          <button
            onClick={() => { openChat(opponentId, opponentUsername); onClose(); }}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              padding: "10px 16px", borderRadius: "10px", fontWeight: 600, fontSize: "13px",
              cursor: "pointer", border: "1px solid rgba(168,85,247,0.3)",
              background: "rgba(168,85,247,0.1)", color: "#a855f7", transition: "all 0.2s",
            }}
          >
            Message
          </button>
        </div>
      </div>
    </>
  );
}
