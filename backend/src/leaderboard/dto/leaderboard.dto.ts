export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  gamesPlayed: number;
  winRate: number;
  trend: 'up' | 'down' | 'stable'; // rank change direction
  eloChange?: number; // last elo change
}

export interface LeaderboardUpdate {
  category: LeaderboardCategory;
  entries: LeaderboardEntry[];
  updatedAt: number;
  totalPlayers: number;
}

export type LeaderboardCategory = 'blitz' | 'bullet' | 'rapid';

export interface UpdateEloDto {
  userId: string;
  username: string;
  category: LeaderboardCategory;
  newElo: number;
  eloDelta: number;
  wins?: number;
  losses?: number;
  draws?: number;
}
