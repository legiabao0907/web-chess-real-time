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
    upsertRoomForDirect,
  } = useChatStore();

  useEffect(() => {
    if (!userId || !enabled) return;

    const socket = io(`${SOCKET_URL}/chat`, {
      transports: ["polling", "websocket"],
      upgrade: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    // ── Kết nối thành công ──────────────────────────────────────────────────
    socket.on("connect", () => {
      console.log("💬 Chat socket connected:", socket.id);
      // Xác thực danh tính ngay khi kết nối để lưu vào Redis chess:online_users
      socket.emit("identify", { userId, username });
    });

    socket.on("identified", () => {
      console.log("💬 Chat socket identified — saved to Redis online_users");
    });

    socket.on("disconnect", () => {
      console.log("💬 Chat socket disconnected");
    });

    socket.on("connect_error", (err) => {
      console.error("💬 Chat socket connection error:", err.message);
    });

    // ── DM room joined: nhận roomId + lịch sử ─────────────────────────────
    socket.on("dm_joined", (data: {
      roomId: string;
      friendId: string;
      friendUsername: string;
      history: ChatMessage[];
    }) => {
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

    // ── Tin nhắn DM mới (room-based: send_dm → dm_message) ─────────────────
    socket.on("dm_message", (msg: ChatMessage) => {
      addMessage(msg.roomId, msg);
    });

    // ── Tin nhắn DM trực tiếp (Redis-based: send_direct_message → receive_direct_message) ──
    socket.on(
      "receive_direct_message",
      (payload: {
        fromUserId: string;
        fromUsername: string;
        toUserId: string;
        message: string;
        roomId: string;
        messageId: string;
        createdAt: number;
      }) => {
        console.log("📩 receive_direct_message:", payload);

        // Xây dựng ChatMessage để đẩy vào store
        const msg: ChatMessage = {
          id: payload.messageId,
          roomId: payload.roomId,
          senderId: payload.fromUserId,
          senderUsername: payload.fromUsername,
          content: payload.message,
          createdAt: payload.createdAt,
        };

        // Nếu room chưa tồn tại trong store (người nhận online nhưng chưa mở chat),
        // tạo room tạm để hiển thị unread badge
        upsertRoomForDirect({
          roomId: payload.roomId,
          friendId: payload.fromUserId === userId ? payload.toUserId : payload.fromUserId,
          friendUsername: payload.fromUserId === userId ? "" : payload.fromUsername,
          message: msg,
        });
      },
    );

    // ── Lỗi từ server ──────────────────────────────────────────────────────
    socket.on("dm_error", (data: { error: string }) => {
      console.error("💬 DM Error:", data.error);
    });

    // ── Lịch sử tin nhắn ──────────────────────────────────────────────────
    socket.on("dm_history", (data: { roomId: string; history: ChatMessage[] }) => {
      setHistory(data.roomId, data.history);
    });

    // ── Typing indicator ───────────────────────────────────────────────────
    socket.on("user_typing", (data: { userId: string; username: string; isTyping: boolean }) => {
      const roomEntry = Object.values(useChatStore.getState().rooms).find(
        (r) => r.friendId === data.userId,
      );
      if (roomEntry) {
        setTyping(roomEntry.roomId, data.isTyping);
      }
    });

    // ── Online/offline status ──────────────────────────────────────────────
    socket.on("user_status", (data: { userId: string; username: string; isOnline: boolean }) => {
      setUserOnline(data.userId, data.isOnline);
    });

    return () => {
      socket.disconnect();
    };
  }, [userId, enabled]);

  // Khi pendingFriend thay đổi (user click "Message" trên profile bạn bè), join DM room
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

  /**
   * Gửi tin nhắn theo phương thức room-based (cần join_dm trước)
   */
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

  /**
   * Gửi tin nhắn theo phương thức Redis-based routing (send_direct_message)
   * Không cần join room trước — server tự tra cứu socketId từ Redis
   */
  const sendDirectMessage = useCallback(
    (toUserId: string, message: string) => {
      if (!socketRef.current?.connected || !message.trim()) {
        console.warn("💬 sendDirectMessage: socket not connected or message empty");
        return;
      }
      socketRef.current.emit("send_direct_message", {
        toUserId,
        message: message.trim(),
      });
    },
    [],
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

  // Đăng ký send functions vào store để ChatDrawer có thể gọi mà không cần socket riêng
  useEffect(() => {
    registerSendFns(sendMessage, sendTyping, sendDirectMessage);
  }, [sendMessage, sendTyping, sendDirectMessage, registerSendFns]);

  return { openDm, sendMessage, sendDirectMessage, sendTyping, socket: socketRef };
}
