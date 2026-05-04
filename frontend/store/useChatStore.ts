"use client";

import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderUsername: string;
  content: string;
  createdAt: number;
}

export interface ChatRoom {
  roomId: string;
  friendId: string;
  friendUsername: string;
  messages: ChatMessage[];
  unreadCount: number;
  lastMessage?: string;
  lastMessageAt?: number;
  isTyping?: boolean;
}

interface ChatState {
  isOpen: boolean;
  rooms: Record<string, ChatRoom>; // roomId -> ChatRoom
  activeRoomId: string | null;
  onlineUsers: Set<string>; // Set of userIds online

  // Socket send functions — registered by useFriendChat in layout so ChatDrawer can use them
  _sendMessage: ((roomId: string, content: string) => void) | null;
  _sendTyping: ((roomId: string, isTyping: boolean) => void) | null;
  registerSendFns: (
    sendMessage: (roomId: string, content: string) => void,
    sendTyping: (roomId: string, isTyping: boolean) => void,
  ) => void;

  // Actions
  openChat: (friendId: string, friendUsername: string) => void;
  closeChat: () => void;
  setActiveRoom: (roomId: string) => void;
  addRoom: (room: ChatRoom) => void;
  addMessage: (roomId: string, message: ChatMessage) => void;
  setHistory: (roomId: string, messages: ChatMessage[]) => void;
  markRead: (roomId: string) => void;
  setTyping: (roomId: string, isTyping: boolean) => void;
  setUserOnline: (userId: string, isOnline: boolean) => void;

  // Pending: track which friend we want to open chat with (before roomId is known)
  pendingFriend: { friendId: string; friendUsername: string } | null;
  setPendingFriend: (friend: { friendId: string; friendUsername: string } | null) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  isOpen: false,
  rooms: {},
  activeRoomId: null,
  onlineUsers: new Set(),
  pendingFriend: null,
  _sendMessage: null,
  _sendTyping: null,

  registerSendFns: (sendMessage, sendTyping) => {
    set({ _sendMessage: sendMessage, _sendTyping: sendTyping });
  },

  openChat: (friendId, friendUsername) => {
    set({ isOpen: true, pendingFriend: { friendId, friendUsername } });
  },

  closeChat: () => set({ isOpen: false, activeRoomId: null }),

  setActiveRoom: (roomId) => {
    set({ activeRoomId: roomId });
    get().markRead(roomId);
  },

  addRoom: (room) => {
    set((state) => ({
      rooms: { ...state.rooms, [room.roomId]: room },
      activeRoomId: room.roomId,
    }));
  },

  addMessage: (roomId, message) => {
    set((state) => {
      const room = state.rooms[roomId];
      if (!room) return state;

      const isActive = state.activeRoomId === roomId && state.isOpen;
      return {
        rooms: {
          ...state.rooms,
          [roomId]: {
            ...room,
            messages: [...room.messages, message],
            lastMessage: message.content,
            lastMessageAt: message.createdAt,
            unreadCount: isActive ? 0 : room.unreadCount + 1,
            isTyping: false,
          },
        },
      };
    });
  },

  setHistory: (roomId, messages) => {
    set((state) => {
      const room = state.rooms[roomId];
      if (!room) return state;
      return {
        rooms: {
          ...state.rooms,
          [roomId]: { ...room, messages },
        },
      };
    });
  },

  markRead: (roomId) => {
    set((state) => {
      const room = state.rooms[roomId];
      if (!room) return state;
      return {
        rooms: { ...state.rooms, [roomId]: { ...room, unreadCount: 0 } },
      };
    });
  },

  setTyping: (roomId, isTyping) => {
    set((state) => {
      const room = state.rooms[roomId];
      if (!room) return state;
      return {
        rooms: { ...state.rooms, [roomId]: { ...room, isTyping } },
      };
    });
  },

  setUserOnline: (userId, isOnline) => {
    set((state) => {
      const updated = new Set(state.onlineUsers);
      if (isOnline) updated.add(userId);
      else updated.delete(userId);
      return { onlineUsers: updated };
    });
  },

  setPendingFriend: (friend) => set({ pendingFriend: friend }),
}));

// Total unread count helper
export const useTotalUnread = () =>
  useChatStore((state) =>
    Object.values(state.rooms).reduce((sum, r) => sum + r.unreadCount, 0),
  );
