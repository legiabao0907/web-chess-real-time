"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, ChevronLeft, MessageCircle, WifiOff } from "lucide-react";
import { useChatStore, ChatRoom } from "@/store/useChatStore";
import { getUser } from "@/lib/auth";

export default function ChatDrawer() {
  const user = getUser();
  const {
    isOpen,
    closeChat,
    rooms,
    activeRoomId,
    setActiveRoom,
    _sendMessage,
    _sendTyping,
    _sendDirectMessage,
  } = useChatStore();

  const [input, setInput] = useState("");
  const [view, setView] = useState<"list" | "chat">("list");
  const [sendError, setSendError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeRoom = activeRoomId ? rooms[activeRoomId] : null;

  // ── Scroll xuống cuối khi có tin nhắn mới ──────────────────────────────
  useEffect(() => {
    if (activeRoom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeRoom?.messages?.length]);

  // ── Chuyển sang chat view khi có room được chọn ──────────────────────────
  useEffect(() => {
    if (activeRoomId) {
      setView("chat");
      // Focus input sau khi chuyển view
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [activeRoomId]);

  // ── Reset khi đóng drawer ────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      setView("list");
      setInput("");
      setSendError(null);
    }
  }, [isOpen]);

  // ── Xóa error sau 3 giây ─────────────────────────────────────────────────
  useEffect(() => {
    if (sendError) {
      const t = setTimeout(() => setSendError(null), 3000);
      return () => clearTimeout(t);
    }
  }, [sendError]);

  // ── Hàm gửi tin nhắn (ưu tiên room-based, fallback sang direct) ──────────
  const handleSend = useCallback(() => {
    if (!activeRoomId || !input.trim()) return;
    const content = input.trim();

    if (_sendMessage) {
      // Phương thức 1: room-based (send_dm) — dùng khi đã join room
      _sendMessage(activeRoomId, content);
    } else if (_sendDirectMessage && activeRoom) {
      // Phương thức 2: Redis-based routing (send_direct_message) — fallback
      _sendDirectMessage(activeRoom.friendId, content);
    } else {
      setSendError("Mất kết nối. Vui lòng thử lại.");
      return;
    }

    setInput("");
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    _sendTyping?.(activeRoomId, false);
    // Focus lại input sau khi gửi
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [activeRoomId, activeRoom, input, _sendMessage, _sendTyping, _sendDirectMessage]);

  // ── Gửi bằng Enter (không dùng Shift+Enter) ──────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Typing indicator ──────────────────────────────────────────────────────
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (!activeRoomId) return;

    _sendTyping?.(activeRoomId, true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      _sendTyping?.(activeRoomId, false);
    }, 2000);
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const roomList = Object.values(rooms);

  if (!isOpen) return null;

  const isConnected = Boolean(_sendMessage || _sendDirectMessage);

  return (
    <>
      {/* Backdrop */}
      <div
        className="chat-backdrop"
        onClick={closeChat}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.3)",
          zIndex: 998,
          backdropFilter: "blur(2px)",
        }}
      />

      {/* Drawer */}
      <div
        className="chat-drawer"
        style={{
          position: "fixed",
          right: 0,
          top: 0,
          bottom: 0,
          width: "360px",
          background: "linear-gradient(180deg, #0d0d1a 0%, #13111c 100%)",
          borderLeft: "1px solid rgba(168,85,247,0.2)",
          zIndex: 999,
          display: "flex",
          flexDirection: "column",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.6)",
          animation: "slideInRight 0.2s ease-out",
        }}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid rgba(168,85,247,0.15)",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            background: "rgba(168,85,247,0.05)",
          }}
        >
          {view === "chat" && (
            <button
              onClick={() => setView("list")}
              style={{
                background: "none",
                border: "none",
                color: "#a855f7",
                cursor: "pointer",
                padding: "4px",
                display: "flex",
                alignItems: "center",
                borderRadius: "6px",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.background = "rgba(168,85,247,0.15)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.background = "transparent")
              }
              title="Quay lại danh sách"
            >
              <ChevronLeft size={20} />
            </button>
          )}

          <div style={{ flex: 1 }}>
            {view === "list" ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <MessageCircle size={18} color="#a855f7" />
                  <span style={{ color: "white", fontWeight: 700, fontSize: "15px" }}>
                    Messages
                  </span>
                  {!isConnected && (
                    <WifiOff size={14} color="#f87171" />
                  )}
                </div>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", margin: 0 }}>
                  {roomList.length} cuộc hội thoại
                </p>
              </>
            ) : (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  {/* Avatar nhỏ */}
                  <div
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      overflow: "hidden",
                      border: "1.5px solid rgba(168,85,247,0.5)",
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${activeRoom?.friendUsername}`}
                      alt={activeRoom?.friendUsername}
                      style={{ width: "100%", height: "100%" }}
                    />
                  </div>
                  <div>
                    <div style={{ color: "white", fontWeight: 700, fontSize: "14px" }}>
                      {activeRoom?.friendUsername}
                    </div>
                    {activeRoom?.isTyping && (
                      <p style={{ color: "#a855f7", fontSize: "11px", margin: 0 }}>
                        đang nhập...
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <button
            onClick={closeChat}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.6)",
              cursor: "pointer",
              padding: "6px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)";
              (e.currentTarget as HTMLElement).style.color = "white";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
              (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.6)";
            }}
            title="Đóng"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {view === "list" ? (
            // ── Danh sách cuộc hội thoại ─────────────────────────────────
            <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
              {roomList.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "40px 20px",
                    color: "rgba(255,255,255,0.3)",
                  }}
                >
                  <MessageCircle size={40} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
                  <p style={{ fontSize: "14px" }}>Chưa có cuộc hội thoại nào</p>
                  <p style={{ fontSize: "12px", marginTop: "4px" }}>
                    Mở profile bạn bè để bắt đầu nhắn tin
                  </p>
                </div>
              ) : (
                roomList.map((room) => (
                  <RoomItem
                    key={room.roomId}
                    room={room}
                    currentUserId={user?.id ?? ""}
                    isActive={activeRoomId === room.roomId}
                    onClick={() => setActiveRoom(room.roomId)}
                  />
                ))
              )}
            </div>
          ) : (
            // ── Chat View ────────────────────────────────────────────────
            <>
              {/* Vùng tin nhắn */}
              <div
                id="chat-messages-container"
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                {activeRoom?.messages.length === 0 && (
                  <div
                    style={{
                      textAlign: "center",
                      color: "rgba(255,255,255,0.3)",
                      fontSize: "13px",
                      marginTop: "20px",
                    }}
                  >
                    Hãy bắt đầu cuộc trò chuyện với{" "}
                    <strong style={{ color: "rgba(255,255,255,0.5)" }}>
                      {activeRoom?.friendUsername}
                    </strong>
                    !
                  </div>
                )}

                {activeRoom?.messages.map((msg, i) => {
                  const isMe = msg.senderId === user?.id;
                  return (
                    <MessageBubble
                      key={msg.id || `msg-${i}`}
                      msg={msg}
                      isMe={isMe}
                      formatTime={formatTime}
                    />
                  );
                })}

                {/* Typing indicator */}
                {activeRoom?.isTyping && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div
                      style={{
                        background: "rgba(255,255,255,0.07)",
                        borderRadius: "12px 12px 12px 0",
                        padding: "10px 14px",
                        color: "rgba(255,255,255,0.5)",
                        fontSize: "12px",
                      }}
                    >
                      <span className="typing-dots">● ● ●</span>
                    </div>
                  </div>
                )}

                {/* Anchor để scroll xuống */}
                <div ref={messagesEndRef} />
              </div>

              {/* ── Khu vực nhập liệu ─────────────────────────────────── */}
              <div
                style={{
                  padding: "12px 16px",
                  borderTop: "1px solid rgba(168,85,247,0.15)",
                  background: "rgba(0,0,0,0.2)",
                }}
              >
                {/* Thông báo lỗi */}
                {sendError && (
                  <div
                    style={{
                      background: "rgba(239,68,68,0.15)",
                      border: "1px solid rgba(239,68,68,0.3)",
                      borderRadius: "8px",
                      padding: "8px 12px",
                      marginBottom: "8px",
                      color: "#f87171",
                      fontSize: "12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <WifiOff size={12} />
                    {sendError}
                  </div>
                )}

                {/* Cảnh báo mất kết nối */}
                {!isConnected && (
                  <div
                    style={{
                      background: "rgba(245,158,11,0.1)",
                      border: "1px solid rgba(245,158,11,0.25)",
                      borderRadius: "8px",
                      padding: "8px 12px",
                      marginBottom: "8px",
                      color: "#fbbf24",
                      fontSize: "11px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <WifiOff size={11} />
                    Đang kết nối lại...
                  </div>
                )}

                {/* Input + nút Gửi */}
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input
                    ref={inputRef}
                    id="chat-message-input"
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      isConnected ? "Nhập tin nhắn... (Enter để gửi)" : "Đang kết nối..."
                    }
                    disabled={!isConnected}
                    autoComplete="off"
                    style={{
                      flex: 1,
                      background: isConnected
                        ? "rgba(255,255,255,0.07)"
                        : "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(168,85,247,0.2)",
                      borderRadius: "10px",
                      color: "white",
                      padding: "10px 14px",
                      fontSize: "14px",
                      outline: "none",
                      transition: "border-color 0.2s, background 0.2s",
                      cursor: isConnected ? "text" : "not-allowed",
                    }}
                    onFocus={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor =
                        "rgba(168,85,247,0.5)";
                    }}
                    onBlur={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor =
                        "rgba(168,85,247,0.2)";
                    }}
                  />

                  <button
                    id="chat-send-button"
                    onClick={handleSend}
                    disabled={!input.trim() || !isConnected}
                    title="Gửi (Enter)"
                    style={{
                      background:
                        input.trim() && isConnected
                          ? "linear-gradient(135deg, #a855f7, #7c3aed)"
                          : "rgba(168,85,247,0.15)",
                      border: "none",
                      borderRadius: "10px",
                      color: input.trim() && isConnected ? "white" : "rgba(255,255,255,0.3)",
                      cursor: input.trim() && isConnected ? "pointer" : "not-allowed",
                      padding: "10px 14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.2s",
                      flexShrink: 0,
                      boxShadow:
                        input.trim() && isConnected
                          ? "0 2px 12px rgba(168,85,247,0.4)"
                          : "none",
                    }}
                    onMouseEnter={(e) => {
                      if (input.trim() && isConnected) {
                        (e.currentTarget as HTMLElement).style.transform = "scale(1.05)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.transform = "scale(1)";
                    }}
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        .typing-dots {
          animation: blink 1.2s infinite;
          letter-spacing: 4px;
        }
        @keyframes blink {
          0%, 100% { opacity: 0.3; }
          50%       { opacity: 1;   }
        }
        /* Custom scrollbar cho chat */
        #chat-messages-container::-webkit-scrollbar {
          width: 4px;
        }
        #chat-messages-container::-webkit-scrollbar-track {
          background: transparent;
        }
        #chat-messages-container::-webkit-scrollbar-thumb {
          background: rgba(168,85,247,0.3);
          border-radius: 4px;
        }
        #chat-message-input::placeholder {
          color: rgba(255,255,255,0.25);
        }
      `}</style>
    </>
  );
}

// ── Sub-component: Room Item ───────────────────────────────────────────────
function RoomItem({
  room,
  currentUserId,
  isActive,
  onClick,
}: {
  room: ChatRoom;
  currentUserId: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        width: "100%",
        padding: "12px",
        background: isActive ? "rgba(168,85,247,0.12)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${isActive ? "rgba(168,85,247,0.4)" : "rgba(255,255,255,0.06)"}`,
        borderRadius: "12px",
        cursor: "pointer",
        textAlign: "left",
        marginBottom: "8px",
        transition: "all 0.2s",
        color: "white",
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLElement).style.background = "rgba(168,85,247,0.08)";
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(168,85,247,0.25)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)";
        }
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: "42px",
          height: "42px",
          borderRadius: "50%",
          overflow: "hidden",
          flexShrink: 0,
          border: "2px solid rgba(168,85,247,0.35)",
          position: "relative",
        }}
      >
        <img
          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${room.friendUsername}`}
          alt={room.friendUsername}
          style={{ width: "100%", height: "100%" }}
        />
      </div>

      <div style={{ flex: 1, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 600, fontSize: "14px" }}>{room.friendUsername}</span>
          {room.unreadCount > 0 && (
            <span
              style={{
                background: "linear-gradient(135deg, #a855f7, #7c3aed)",
                color: "white",
                borderRadius: "12px",
                padding: "2px 8px",
                fontSize: "11px",
                fontWeight: 700,
                boxShadow: "0 2px 8px rgba(168,85,247,0.4)",
              }}
            >
              {room.unreadCount > 99 ? "99+" : room.unreadCount}
            </span>
          )}
        </div>
        {room.lastMessage && (
          <p
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: "12px",
              margin: "2px 0 0",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {room.lastMessage}
          </p>
        )}
      </div>
    </button>
  );
}

// ── Sub-component: Message Bubble ─────────────────────────────────────────
function MessageBubble({
  msg,
  isMe,
  formatTime,
}: {
  msg: { senderId: string; senderUsername: string; content: string; createdAt: number };
  isMe: boolean;
  formatTime: (ts: number) => string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: isMe ? "flex-end" : "flex-start",
        animation: "fadeInMsg 0.15s ease-out",
      }}
    >
      <div style={{ maxWidth: "78%" }}>
        {/* Tên người gửi (chỉ hiện phía nhận) */}
        {!isMe && (
          <div
            style={{
              fontSize: "11px",
              color: "rgba(255,255,255,0.35)",
              marginBottom: "3px",
              paddingLeft: "4px",
            }}
          >
            {msg.senderUsername}
          </div>
        )}

        <div
          style={{
            background: isMe
              ? "linear-gradient(135deg, #a855f7, #7c3aed)"
              : "rgba(255,255,255,0.08)",
            borderRadius: isMe ? "14px 14px 0 14px" : "14px 14px 14px 0",
            padding: "10px 14px",
            color: "white",
            fontSize: "14px",
            lineHeight: "1.5",
            boxShadow: isMe ? "0 2px 12px rgba(168,85,247,0.3)" : "none",
            wordBreak: "break-word",
          }}
        >
          {msg.content}
        </div>

        <div
          style={{
            fontSize: "11px",
            color: "rgba(255,255,255,0.28)",
            marginTop: "3px",
            textAlign: isMe ? "right" : "left",
            paddingLeft: isMe ? "0" : "4px",
            paddingRight: isMe ? "4px" : "0",
          }}
        >
          {formatTime(msg.createdAt)}
        </div>
      </div>
    </div>
  );
}
