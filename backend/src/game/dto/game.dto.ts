// DTO cho chess game events

/** Verbose move object from chess.js `history({ verbose: true })` */
export interface VerboseMove {
  color: 'w' | 'b';
  from: string;
  to: string;
  piece: string;
  captured?: string;
  promotion?: string;
  flags: string;
  san: string;
  lan?: string;
  before: string;
  after: string;
}
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

export interface StartBotGameDto {
  userId: string;
  username: string;
  difficulty: 'easy' | 'medium' | 'hard';
  side?: 'white' | 'black'; // player's side
  timeControl?: string;
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
  verboseMoves: VerboseMove[];  // full verbose history for replay
  createdAt: number;
  // Bot game fields
  isBot?: boolean;
  botDifficulty?: 'easy' | 'medium' | 'hard';
  botColor?: 'w' | 'b'; // which color the BOT plays
}

export interface MatchmakingEntry {
  userId: string;
  username: string;
  socketId: string;
  timeControl: string;
  rating: number;
  joinedAt: number;
}

export const BOT_USER_ID = 'BOT';
export const BOT_USERNAME = 'Chess Bot';
