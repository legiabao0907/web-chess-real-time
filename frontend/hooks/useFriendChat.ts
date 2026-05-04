"use client";

import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useChatStore, ChatMessage, ChatRoom } from "@/store/useChatStore";

const SOCKET_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8080";

interface UseFriendChatOptions {
  userId: string;
  username: string;
  enabled?: boolean;
}

export function useFriendChat({ userId, username, enabled = true }: UseFriendChatOptions) {
  const socketRef = useRef<Socket | null>(null);
  const {
    addRoom,
    addMessage,
    setHistory,
    setTyping,
    setUserOnline,
    pendingFriend,
    setPendingFriend,
    registerSendFns,
  } = useChatStore();

  useEffect(() => {
    if (!userId || !enabled) return;

    const socket = io(`${SOCKET_URL}/chat`, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("💬 Chat socket connected:", socket.id);
      // Identify ourselves
      socket.emit("identify", { userId, username });
    });

    socket.on("identified", () => {
      console.log("💬 Chat socket identified");
    });

    socket.on("disconnect", () => {
      console.log("💬 Chat socket disconnected");
    });

    // DM room joined: receive roomId + history
    socket.on("dm_joined", (data: { roomId: string; friendId: string; friendUsername: string; history: ChatMessage[] }) => {
      const room: ChatRoom = {
        roomId: data.roomId,
        friendId: data.friendId,
        friendUsername: data.friendUsername,
        messages: data.history,
        unreadCount: 0,
      };
      addRoom(room);
      setPendingFriend(null);
    });

    // Incoming DM message
    socket.on("dm_message", (msg: ChatMessage) => {
      addMessage(msg.roomId, msg);
    });

    // History loaded
    socket.on("dm_history", (data: { roomId: string; history: ChatMessage[] }) => {
      setHistory(data.roomId, data.history);
    });

    // Typing indicator
    socket.on("user_typing", (data: { userId: string; username: string; isTyping: boolean }) => {
      // Find room with this user
      const roomEntry = Object.values(useChatStore.getState().rooms).find(
        (r) => r.friendId === data.userId,
      );
      if (roomEntry) {
        setTyping(roomEntry.roomId, data.isTyping);
      }
    });

    // Online/offline status
    socket.on("user_status", (data: { userId: string; username: string; isOnline: boolean }) => {
      setUserOnline(data.userId, data.isOnline);
    });

    return () => {
      socket.disconnect();
    };
  }, [userId, enabled]);

  // When pendingFriend changes (user clicked "Message" on a friend), join DM
  useEffect(() => {
    if (!pendingFriend || !socketRef.current?.connected) return;
    socketRef.current.emit("join_dm", {
      userId,
      username,
      friendId: pendingFriend.friendId,
      friendUsername: pendingFriend.friendUsername,
    });
  }, [pendingFriend, userId, username]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    (roomId: string, content: string) => {
      if (!socketRef.current?.connected || !content.trim()) return;
      socketRef.current.emit("send_dm", {
        roomId,
        senderId: userId,
        senderUsername: username,
        content: content.trim(),
      });
    },
    [userId, username],
  );

  const sendTyping = useCallback(
    (roomId: string, isTyping: boolean) => {
      socketRef.current?.emit("typing", { roomId, userId, username, isTyping });
    },
    [userId, username],
  );

  const openDm = useCallback(
    (friendId: string, friendUsername: string) => {
      if (!socketRef.current?.connected) return;
      socketRef.current.emit("join_dm", { userId, username, friendId, friendUsername });
    },
    [userId, username],
  );

  // Register send functions into the store so ChatDrawer can use them
  // without creating its own socket connection
  useEffect(() => {
    registerSendFns(sendMessage, sendTyping);
  }, [sendMessage, sendTyping, registerSendFns]);

  return { openDm, sendMessage, sendTyping, socket: socketRef };
}
