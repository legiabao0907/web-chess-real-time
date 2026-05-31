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

  // Socket send functions — được đăng ký bởi useFriendChat ở layout
  // để ChatDrawer có thể gọi mà không cần tạo socket riêng
  _sendMessage: ((roomId: string, content: string) => void) | null;
  _sendTyping: ((roomId: string, isTyping: boolean) => void) | null;
  _sendDirectMessage: ((toUserId: string, message: string) => void) | null;

  registerSendFns: (
    sendMessage: (roomId: string, content: string) => void,
    sendTyping: (roomId: string, isTyping: boolean) => void,
    sendDirectMessage: (toUserId: string, message: string) => void,
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

  /**
   * Upsert room khi nhận receive_direct_message:
   * - Nếu room đã tồn tại → thêm tin nhắn vào
   * - Nếu chưa → tạo room mới tạm thời với tin nhắn đó (hiện unread badge)
   */
  upsertRoomForDirect: (params: {
    roomId: string;
    friendId: string;
    friendUsername: string;
    message: ChatMessage;
  }) => void;

  // Pending: track bạn bè muốn mở chat (trước khi có roomId)
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
  _sendDirectMessage: null,

  registerSendFns: (sendMessage, sendTyping, sendDirectMessage) => {
    set({
      _sendMessage: sendMessage,
      _sendTyping: sendTyping,
      _sendDirectMessage: sendDirectMessage,
    });
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

  upsertRoomForDirect: ({ roomId, friendId, friendUsername, message }) => {
    set((state) => {
      const existing = state.rooms[roomId];
      const isActive = state.activeRoomId === roomId && state.isOpen;

      if (existing) {
        // Room đã tồn tại — append tin nhắn, tăng unread nếu không active
        return {
          rooms: {
            ...state.rooms,
            [roomId]: {
              ...existing,
              messages: [...existing.messages, message],
              lastMessage: message.content,
              lastMessageAt: message.createdAt,
              unreadCount: isActive ? 0 : existing.unreadCount + 1,
              isTyping: false,
            },
          },
        };
      }

      // Room chưa tồn tại — tạo mới (người nhận online nhưng chưa mở chat)
      const newRoom: ChatRoom = {
        roomId,
        friendId,
        friendUsername: friendUsername || 'Unknown',
        messages: [message],
        unreadCount: isActive ? 0 : 1,
        lastMessage: message.content,
        lastMessageAt: message.createdAt,
      };
      return {
        rooms: { ...state.rooms, [roomId]: newRoom },
      };
    });
  },

  setPendingFriend: (friend) => set({ pendingFriend: friend }),
}));

// Helper: tổng số unread
export const useTotalUnread = () =>
  useChatStore((state) =>
    Object.values(state.rooms).reduce((sum, r) => sum + r.unreadCount, 0),
  );
