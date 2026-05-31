export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderUsername: string;
  content: string;
  createdAt: number; // timestamp ms
}

export interface ChatRoom {
  id: string;
  type: 'private' | 'game';
  friendId?: string;
  friendUsername?: string;
  lastMessage?: string;
  lastMessageAt?: number;
  unreadCount?: number;
}

export interface JoinRoomDto {
  userId: string;
  username: string;
  friendId: string;
  friendUsername: string;
}

export interface SendDmDto {
  roomId: string;
  senderId: string;
  senderUsername: string;
  content: string;
}

export interface GetHistoryDto {
  roomId: string;
  limit?: number;
}

/** DTO dùng cho event send_direct_message (Redis-based routing) */
export interface SendDirectMessageDto {
  toUserId: string;
  message: string;
}

/** Payload trả về trong event receive_direct_message */
export interface DirectMessagePayload {
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  message: string;
  roomId: string;
  messageId: string;
  createdAt: number;
}
