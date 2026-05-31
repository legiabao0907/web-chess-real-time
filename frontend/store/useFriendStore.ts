"use client";

import { create } from "zustand";
import { apiFetch } from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Friend {
  id: string;
  username: string;
  eloBlitz: number;
  avatarUrl?: string | null;
  isOnline?: boolean;
}

export interface PendingRequest {
  id: string;
  username: string;
  eloBlitz: number;
  createdAt: string;
}

export type FriendshipStatus =
  | "none"
  | "pending_sent"
  | "pending_received"
  | "friends"
  | "self";

// ─── Store interface ──────────────────────────────────────────────────────────

interface FriendStore {
  friends: Friend[];
  pendingRequests: PendingRequest[];
  isLoadingFriends: boolean;
  isLoadingRequests: boolean;
  /** Per-userId loading state for action buttons */
  actionLoading: Record<string, boolean>;
  /** Cache to avoid repeated /friendship API calls */
  friendshipCache: Record<string, FriendshipStatus>;

  // ── Actions ──
  loadFriends: () => Promise<void>;
  loadPendingRequests: () => Promise<void>;
  sendFriendRequest: (targetId: string) => Promise<void>;
  acceptRequest: (requesterId: string) => Promise<void>;
  declineRequest: (requesterId: string) => Promise<void>;
  removeFriend: (friendId: string) => Promise<void>;
  checkFriendship: (targetId: string) => Promise<FriendshipStatus>;
  invalidateFriendship: (targetId: string) => void;
  setFriendOnline: (userId: string, isOnline: boolean) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useFriendStore = create<FriendStore>((set, get) => ({
  friends: [],
  pendingRequests: [],
  isLoadingFriends: false,
  isLoadingRequests: false,
  actionLoading: {},
  friendshipCache: {},

  // ── Load friends list from /user/me ──────────────────────────────────────
  loadFriends: async () => {
    set({ isLoadingFriends: true });
    try {
      const data = await apiFetch<{ friends: Friend[] }>("/user/me");
      set({ friends: data.friends ?? [], isLoadingFriends: false });
    } catch {
      set({ isLoadingFriends: false });
    }
  },

  // ── Load pending incoming requests ────────────────────────────────────────
  loadPendingRequests: async () => {
    set({ isLoadingRequests: true });
    try {
      const data = await apiFetch<PendingRequest[]>("/user/friend-requests");
      set({ pendingRequests: data ?? [], isLoadingRequests: false });
    } catch {
      set({ isLoadingRequests: false });
    }
  },

  // ── Send friend request ───────────────────────────────────────────────────
  sendFriendRequest: async (targetId: string) => {
    set((s) => ({ actionLoading: { ...s.actionLoading, [targetId]: true } }));
    try {
      await apiFetch(`/user/${targetId}/friend-request`, { method: "POST" });
      set((s) => ({
        friendshipCache: { ...s.friendshipCache, [targetId]: "pending_sent" },
        actionLoading: { ...s.actionLoading, [targetId]: false },
      }));
    } catch {
      set((s) => ({ actionLoading: { ...s.actionLoading, [targetId]: false } }));
    }
  },

  // ── Accept incoming friend request ────────────────────────────────────────
  acceptRequest: async (requesterId: string) => {
    set((s) => ({ actionLoading: { ...s.actionLoading, [requesterId]: true } }));
    try {
      await apiFetch(`/user/${requesterId}/accept-friend`, { method: "POST" });
      set((s) => ({
        pendingRequests: s.pendingRequests.filter((r) => r.id !== requesterId),
        friendshipCache: { ...s.friendshipCache, [requesterId]: "friends" },
        actionLoading: { ...s.actionLoading, [requesterId]: false },
      }));
      // Refresh friends list to show the newly accepted friend
      get().loadFriends();
    } catch {
      set((s) => ({ actionLoading: { ...s.actionLoading, [requesterId]: false } }));
    }
  },

  // ── Decline / cancel friend request ──────────────────────────────────────
  declineRequest: async (requesterId: string) => {
    set((s) => ({ actionLoading: { ...s.actionLoading, [requesterId]: true } }));
    try {
      await apiFetch(`/user/${requesterId}/friend`, { method: "DELETE" });
      set((s) => ({
        pendingRequests: s.pendingRequests.filter((r) => r.id !== requesterId),
        friendshipCache: { ...s.friendshipCache, [requesterId]: "none" },
        actionLoading: { ...s.actionLoading, [requesterId]: false },
      }));
    } catch {
      set((s) => ({ actionLoading: { ...s.actionLoading, [requesterId]: false } }));
    }
  },

  // ── Remove friend ─────────────────────────────────────────────────────────
  removeFriend: async (friendId: string) => {
    set((s) => ({ actionLoading: { ...s.actionLoading, [friendId]: true } }));
    try {
      await apiFetch(`/user/${friendId}/friend`, { method: "DELETE" });
      set((s) => ({
        friends: s.friends.filter((f) => f.id !== friendId),
        friendshipCache: { ...s.friendshipCache, [friendId]: "none" },
        actionLoading: { ...s.actionLoading, [friendId]: false },
      }));
    } catch {
      set((s) => ({ actionLoading: { ...s.actionLoading, [friendId]: false } }));
    }
  },

  // ── Check & cache friendship status ──────────────────────────────────────
  checkFriendship: async (targetId: string): Promise<FriendshipStatus> => {
    const cached = get().friendshipCache[targetId];
    if (cached) return cached;

    try {
      const data = await apiFetch<{ status: FriendshipStatus }>(
        `/user/${targetId}/friendship`,
      );
      const status = data.status ?? "none";
      set((s) => ({
        friendshipCache: { ...s.friendshipCache, [targetId]: status },
      }));
      return status;
    } catch {
      return "none";
    }
  },

  // ── Invalidate cached friendship status ───────────────────────────────────
  invalidateFriendship: (targetId: string) => {
    set((s) => {
      const newCache = { ...s.friendshipCache };
      delete newCache[targetId];
      return { friendshipCache: newCache };
    });
  },

  // ── Update online status of a friend ─────────────────────────────────────
  setFriendOnline: (userId: string, isOnline: boolean) => {
    set((s) => ({
      friends: s.friends.map((f) =>
        f.id === userId ? { ...f, isOnline } : f,
      ),
    }));
  },
}));
