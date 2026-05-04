"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, ChevronLeft, MessageCircle } from "lucide-react";
import { useChatStore, ChatRoom } from "@/store/useChatStore";
import { getUser } from "@/lib/auth";

export default function ChatDrawer() {
  const user = getUser();
  const {
    isOpen, closeChat, rooms, activeRoomId, setActiveRoom,
    _sendMessage, _sendTyping,
  } = useChatStore();

  // Use send functions registered by the layout-level useFriendChat
  const sendMessage = useCallback(
    (roomId: string, content: string) => {
      _sendMessage?.(roomId, content);
    },
    [_sendMessage],
  );
  const sendTyping = useCallback(
    (roomId: string, isTyping: boolean) => {
      _sendTyping?.(roomId, isTyping);
    },
    [_sendTyping],
  );

  const [input, setInput] = useState("");
  const [view, setView] = useState<"list" | "chat">("list");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRoom = activeRoomId ? rooms[activeRoomId] : null;

  // Scroll to bottom on new messages
  useEffect(() => {
    if (activeRoom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeRoom?.messages?.length]);

  // Switch to chat view when room is selected
  useEffect(() => {
    if (activeRoomId) setView("chat");
  }, [activeRoomId]);

  // Reset to list when drawer closes
  useEffect(() => {
    if (!isOpen) {
      setView("list");
      setInput("");
    }
  }, [isOpen]);

  const handleSend = useCallback(() => {
    if (!activeRoomId || !input.trim()) return;
    sendMessage(activeRoomId, input.trim());
    setInput("");
    sendTyping(activeRoomId, false);
  }, [activeRoomId, input, sendMessage, sendTyping]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (!activeRoomId) return;

    sendTyping(activeRoomId, true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      sendTyping(activeRoomId, false);
    }, 2000);
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const roomList = Object.values(rooms);

  if (!isOpen) return null;

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
        {/* Header */}
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
              onClick={() => { setView("list"); setActiveRoom(activeRoomId!); }}
              style={{
                background: "none",
                border: "none",
                color: "#a855f7",
                cursor: "pointer",
                padding: "4px",
                display: "flex",
                alignItems: "center",
              }}
            >
              <ChevronLeft size={20} />
            </button>
          )}

          <div style={{ flex: 1 }}>
            {view === "list" ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <MessageCircle size={18} color="#a855f7" />
                  <span style={{ color: "white", fontWeight: 700, fontSize: "15px" }}>Messages</span>
                </div>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", margin: 0 }}>
                  {roomList.length} conversation{roomList.length !== 1 ? "s" : ""}
                </p>
              </>
            ) : (
              <>
                <div style={{ color: "white", fontWeight: 700, fontSize: "15px" }}>
                  {activeRoom?.friendUsername}
                </div>
                {activeRoom?.isTyping && (
                  <p style={{ color: "#a855f7", fontSize: "12px", margin: 0 }}>typing...</p>
                )}
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
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {view === "list" ? (
            // ── Room List ────────────────────────────────────────────────
            <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
              {roomList.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "rgba(255,255,255,0.3)" }}>
                  <MessageCircle size={40} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
                  <p style={{ fontSize: "14px" }}>No conversations yet</p>
                  <p style={{ fontSize: "12px", marginTop: "4px" }}>
                    Open a friend's profile to start chatting
                  </p>
                </div>
              ) : (
                roomList.map((room) => (
                  <RoomItem
                    key={room.roomId}
                    room={room}
                    currentUserId={user?.id ?? ""}
                    onClick={() => setActiveRoom(room.roomId)}
                  />
                ))
              )}
            </div>
          ) : (
            // ── Chat View ─────────────────────────────────────────────────
            <>
              <div
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
                  <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: "13px", marginTop: "20px" }}>
                    Start the conversation with {activeRoom?.friendUsername}!
                  </div>
                )}
                {activeRoom?.messages.map((msg, i) => {
                  const isMe = msg.senderId === user?.id;
                  return (
                    <MessageBubble key={msg.id ?? i} msg={msg} isMe={isMe} formatTime={formatTime} />
                  );
                })}
                {activeRoom?.isTyping && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{
                      background: "rgba(255,255,255,0.07)",
                      borderRadius: "12px 12px 12px 0",
                      padding: "8px 14px",
                      color: "rgba(255,255,255,0.5)",
                      fontSize: "12px",
                    }}>
                      <span className="typing-dots">●●●</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div
                style={{
                  padding: "12px 16px",
                  borderTop: "1px solid rgba(168,85,247,0.15)",
                  display: "flex",
                  gap: "8px",
                  background: "rgba(0,0,0,0.2)",
                }}
              >
                <input
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  style={{
                    flex: 1,
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(168,85,247,0.2)",
                    borderRadius: "10px",
                    color: "white",
                    padding: "10px 14px",
                    fontSize: "14px",
                    outline: "none",
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  style={{
                    background: input.trim() ? "#a855f7" : "rgba(168,85,247,0.2)",
                    border: "none",
                    borderRadius: "10px",
                    color: "white",
                    cursor: input.trim() ? "pointer" : "not-allowed",
                    padding: "10px 14px",
                    display: "flex",
                    alignItems: "center",
                    transition: "all 0.2s",
                  }}
                >
                  <Send size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .typing-dots {
          animation: blink 1.2s infinite;
          letter-spacing: 4px;
        }
        @keyframes blink {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </>
  );
}

function RoomItem({
  room,
  currentUserId,
  onClick,
}: {
  room: ChatRoom;
  currentUserId: string;
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
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "12px",
        cursor: "pointer",
        textAlign: "left",
        marginBottom: "8px",
        transition: "all 0.2s",
        color: "white",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = "rgba(168,85,247,0.1)";
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(168,85,247,0.3)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)";
      }}
    >
      {/* Avatar */}
      <div style={{
        width: "40px",
        height: "40px",
        borderRadius: "50%",
        overflow: "hidden",
        flexShrink: 0,
        border: "2px solid rgba(168,85,247,0.3)",
      }}>
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
            <span style={{
              background: "#a855f7",
              color: "white",
              borderRadius: "12px",
              padding: "2px 7px",
              fontSize: "11px",
              fontWeight: 700,
            }}>
              {room.unreadCount}
            </span>
          )}
        </div>
        {room.lastMessage && (
          <p style={{
            color: "rgba(255,255,255,0.4)",
            fontSize: "12px",
            margin: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {room.lastMessage}
          </p>
        )}
      </div>
    </button>
  );
}

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
    <div style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start" }}>
      <div style={{ maxWidth: "75%" }}>
        <div
          style={{
            background: isMe
              ? "linear-gradient(135deg, #a855f7, #7c3aed)"
              : "rgba(255,255,255,0.08)",
            borderRadius: isMe ? "14px 14px 0 14px" : "14px 14px 14px 0",
            padding: "10px 14px",
            color: "white",
            fontSize: "14px",
            lineHeight: "1.4",
            boxShadow: isMe ? "0 2px 12px rgba(168,85,247,0.3)" : "none",
          }}
        >
          {msg.content}
        </div>
        <div style={{
          fontSize: "11px",
          color: "rgba(255,255,255,0.3)",
          marginTop: "3px",
          textAlign: isMe ? "right" : "left",
        }}>
          {formatTime(msg.createdAt)}
        </div>
      </div>
    </div>
  );
}
