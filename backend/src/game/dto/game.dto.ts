// DTO cho chess game events
export interface JoinGameDto {
  gameId: string;
  userId: string;
  username: string;
  timeControl?: string; // e.g. "5+0", "10+0", "3+2"
}

export interface MakeMoveDto {
  gameId: string;
  userId: string;
  move: {
    from: string;
    to: string;
    promotion?: string;
  };
}

export interface CreateGameDto {
  userId: string;
  username: string;
  timeControl: string; // "blitz_5", "rapid_10", "bullet_1"
  side?: 'white' | 'black' | 'random';
}

export interface GameState {
  id: string;
  fen: string;
  pgn: string;
  whiteId: string;
  blackId: string;
  whiteUsername: string;
  blackUsername: string;
  status: 'waiting' | 'active' | 'finished' | 'draw' | 'resigned' | 'aborted';
  timeControl: string;
  whiteTimeMs: number;
  blackTimeMs: number;
  turn: 'w' | 'b';
  lastMoveAt?: number;
  winner?: 'white' | 'black' | 'draw';
  moveHistory: string[];
  createdAt: number;
}

export interface MatchmakingEntry {
  userId: string;
  username: string;
  socketId: string;
  timeControl: string;
  rating: number;
  joinedAt: number;
}
