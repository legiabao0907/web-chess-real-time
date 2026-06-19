import { Injectable, Logger } from '@nestjs/common';
import { Chess, Move } from 'chess.js';

export type Difficulty = 'easy' | 'medium' | 'hard';

// ─── Piece values (centipawns) ───────────────────────────────────────────────
const PIECE_VALUE: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// ─── Piece-Square Tables (from White's perspective, rank 8→1) ────────────────
// fmt: off
const PST_PAWN = [
   0,  0,  0,  0,  0,  0,  0,  0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
   5,  5, 10, 25, 25, 10,  5,  5,
   0,  0,  0, 20, 20,  0,  0,  0,
   5, -5,-10,  0,  0,-10, -5,  5,
   5, 10, 10,-20,-20, 10, 10,  5,
   0,  0,  0,  0,  0,  0,  0,  0,
];
const PST_KNIGHT = [
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20,  0,  0,  0,  0,-20,-40,
  -30,  0, 10, 15, 15, 10,  0,-30,
  -30,  5, 15, 20, 20, 15,  5,-30,
  -30,  0, 15, 20, 20, 15,  0,-30,
  -30,  5, 10, 15, 15, 10,  5,-30,
  -40,-20,  0,  5,  5,  0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50,
];
const PST_BISHOP = [
  -20,-10,-10,-10,-10,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5, 10, 10,  5,  0,-10,
  -10,  5,  5, 10, 10,  5,  5,-10,
  -10,  0, 10, 10, 10, 10,  0,-10,
  -10, 10, 10, 10, 10, 10, 10,-10,
  -10,  5,  0,  0,  0,  0,  5,-10,
  -20,-10,-10,-10,-10,-10,-10,-20,
];
const PST_ROOK = [
   0,  0,  0,  0,  0,  0,  0,  0,
   5, 10, 10, 10, 10, 10, 10,  5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
   0,  0,  0,  5,  5,  0,  0,  0,
];
const PST_QUEEN = [
  -20,-10,-10, -5, -5,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5,  5,  5,  5,  0,-10,
   -5,  0,  5,  5,  5,  5,  0, -5,
    0,  0,  5,  5,  5,  5,  0, -5,
  -10,  5,  5,  5,  5,  5,  0,-10,
  -10,  0,  5,  0,  0,  0,  0,-10,
  -20,-10,-10, -5, -5,-10,-10,-20,
];
const PST_KING_MID = [
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -20,-30,-30,-40,-40,-30,-30,-20,
  -10,-20,-20,-20,-20,-20,-20,-10,
   20, 20,  0,  0,  0,  0, 20, 20,
   20, 30, 10,  0,  0, 10, 30, 20,
];
// fmt: on

const PST_MAP: Record<string, number[]> = {
  p: PST_PAWN,
  n: PST_KNIGHT,
  b: PST_BISHOP,
  r: PST_ROOK,
  q: PST_QUEEN,
  k: PST_KING_MID,
};

const DEPTH_MAP: Record<Difficulty, number> = {
  easy: 1,
  medium: 3,
  hard: 5,
};

// Time limits (milliseconds) per difficulty for iterative deepening
const TIME_LIMIT_MAP: Record<Difficulty, number> = {
  easy: 500,
  medium: 1500,
  hard: 3500,
};

// Max nodes per search (safety net)
const MAX_NODES = 5_000_000;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private nodesSearched = 0;
  private searchStartTime = 0;
  private timeLimit = 0;
  private timedOut = false;

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Calculate the best move using iterative deepening with time limit.
   * Searches depth 1→maxDepth, stopping if time budget exceeded.
   * Falls back to the best move from the last completed depth.
   */
  getBestMove(
    fen: string,
    difficulty: Difficulty = 'medium',
    botColor: 'w' | 'b' = 'b',
  ): { from: string; to: string; promotion?: string } | null {
    const chess = new Chess(fen);

    // Easy: 35% chance of random move
    if (difficulty === 'easy' && Math.random() < 0.35) {
      return this.getRandomMove(chess);
    }

    const maxDepth = DEPTH_MAP[difficulty];
    this.timeLimit = TIME_LIMIT_MAP[difficulty];
    this.searchStartTime = Date.now();
    this.nodesSearched = 0;
    this.timedOut = false;

    const maximizing = botColor === 'w';
    const allMoves = this.orderMoves(chess.moves({ verbose: true }) as Move[], chess);

    if (allMoves.length === 0) return null;
    if (allMoves.length === 1) {
      return { from: allMoves[0].from, to: allMoves[0].to, promotion: allMoves[0].promotion };
    }

    // Iterative deepening: try each depth, keep best move from deepest completed
    let bestMove: Move = allMoves[0];
    let completedDepth = 0;

    for (let currentDepth = 1; currentDepth <= maxDepth; currentDepth++) {
      if (this.timedOut) break;

      let bestScore = maximizing ? -Infinity : Infinity;
      let currentBestMove: Move | null = null;
      let alpha = -Infinity;
      let beta = Infinity;

      for (const move of allMoves) {
        if (this.timedOut) break;
        if (this.nodesSearched > MAX_NODES) { this.timedOut = true; break; }

        chess.move(move);
        const score = this.minimax(chess, currentDepth - 1, alpha, beta, !maximizing);
        chess.undo();

        if (maximizing) {
          if (score > bestScore) { bestScore = score; currentBestMove = move; }
          alpha = Math.max(alpha, bestScore);
        } else {
          if (score < bestScore) { bestScore = score; currentBestMove = move; }
          beta = Math.min(beta, bestScore);
        }
      }

      if (!this.timedOut && currentBestMove) {
        bestMove = currentBestMove;
        completedDepth = currentDepth;
      }
    }

    this.logger.log(
      `Bot (${difficulty}) chose move after depth ${completedDepth}/${maxDepth}, ` +
      `${this.nodesSearched} nodes, ${Date.now() - this.searchStartTime}ms`,
    );

    return {
      from: bestMove.from,
      to: bestMove.to,
      promotion: bestMove.promotion,
    };
  }

  /**
   * Evaluate the current position from White's perspective.
   * Returns centipawn score (positive = white advantage).
   * Returns ±Infinity for checkmate.
   */
  evaluatePosition(fen: string): number {
    const chess = new Chess(fen);
    if (chess.isCheckmate()) {
      return chess.turn() === 'w' ? -99999 : 99999;
    }
    if (chess.isDraw() || chess.isStalemate()) return 0;
    return this.evaluate(chess);
  }

  // ─── Minimax with Alpha-Beta Pruning ───────────────────────────────────────

  private minimax(
    chess: Chess,
    depth: number,
    alpha: number,
    beta: number,
    maximizing: boolean,
  ): number {
    this.nodesSearched++;

    // Timeout / node limit checks
    if (this.nodesSearched % 10000 === 0) {
      if (Date.now() - this.searchStartTime > this.timeLimit) {
        this.timedOut = true;
      }
      if (this.nodesSearched > MAX_NODES) {
        this.timedOut = true;
      }
    }
    if (this.timedOut) return maximizing ? -99999 : 99999;

    if (depth === 0 || chess.isGameOver()) {
      return this.quiescence(chess, alpha, beta, maximizing, 2);
    }

    const moves = this.orderMoves(chess.moves({ verbose: true }) as Move[], chess);

    // No legal moves = checkmate or stalemate
    if (moves.length === 0) {
      if (chess.isCheck()) return maximizing ? -99999 + (5 - depth) : 99999 - (5 - depth);
      return 0; // stalemate
    }

    if (maximizing) {
      let maxEval = -Infinity;
      for (const move of moves) {
        if (this.timedOut) break;
        chess.move(move);
        const evalScore = this.minimax(chess, depth - 1, alpha, beta, false);
        chess.undo();
        maxEval = Math.max(maxEval, evalScore);
        alpha = Math.max(alpha, evalScore);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of moves) {
        if (this.timedOut) break;
        chess.move(move);
        const evalScore = this.minimax(chess, depth - 1, alpha, beta, true);
        chess.undo();
        minEval = Math.min(minEval, evalScore);
        beta = Math.min(beta, evalScore);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  /**
   * Quiescence search: shallow search for captures to avoid horizon effect.
   * Reduced from depth 3→2 to keep performance under control.
   */
  private quiescence(
    chess: Chess,
    alpha: number,
    beta: number,
    maximizing: boolean,
    depth = 2,
  ): number {
    this.nodesSearched++;
    if (this.nodesSearched % 5000 === 0 && Date.now() - this.searchStartTime > this.timeLimit) {
      this.timedOut = true;
    }
    if (this.timedOut) return maximizing ? -99999 : 99999;

    const standPat = this.evaluate(chess);

    if (chess.isGameOver()) {
      if (chess.isCheckmate()) return maximizing ? -99999 : 99999;
      return 0;
    }

    if (depth === 0) return standPat;

    if (maximizing) {
      if (standPat >= beta) return beta;
      alpha = Math.max(alpha, standPat);
    } else {
      if (standPat <= alpha) return alpha;
      beta = Math.min(beta, standPat);
    }

    const captures = (chess.moves({ verbose: true }) as Move[]).filter(
      (m) => m.captured || m.flags.includes('e'),
    );

    for (const move of captures) {
      if (this.timedOut) break;
      chess.move(move);
      const score = this.quiescence(chess, alpha, beta, !maximizing, depth - 1);
      chess.undo();

      if (maximizing) {
        alpha = Math.max(alpha, score);
        if (beta <= alpha) break;
      } else {
        beta = Math.min(beta, score);
        if (beta <= alpha) break;
      }
    }

    return maximizing ? alpha : beta;
  }

  // ─── Static Evaluation ─────────────────────────────────────────────────────

  private evaluate(chess: Chess): number {
    if (chess.isCheckmate()) {
      return chess.turn() === 'w' ? -99999 : 99999;
    }
    if (chess.isDraw() || chess.isStalemate() || chess.isInsufficientMaterial()) return 0;

    let score = 0;
    const board = chess.board();

    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = board[rank][file];
        if (!piece) continue;

        const type = piece.type; // 'p','n','b','r','q','k'
        const color = piece.color; // 'w' or 'b'
        const pstIdx = color === 'w' ? rank * 8 + file : (7 - rank) * 8 + file;
        const pst = PST_MAP[type] ?? [];
        const positional = pst[pstIdx] ?? 0;
        const value = PIECE_VALUE[type] + positional;

        score += color === 'w' ? value : -value;
      }
    }

    // Mobility bonus
    const mobilityBonus = chess.moves().length * (chess.turn() === 'w' ? 5 : -5);
    score += mobilityBonus;

    return score;
  }

  // ─── Move Ordering (captures first, then quiet moves) ─────────────────────

  private orderMoves(moves: Move[], chess: Chess): Move[] {
    return moves.sort((a, b) => {
      const scoreA = this.moveScore(a);
      const scoreB = this.moveScore(b);
      return scoreB - scoreA;
    });
  }

  private moveScore(move: Move): number {
    let score = 0;
    if (move.captured) {
      // MVV-LVA: Most Valuable Victim - Least Valuable Attacker
      score += 10 * (PIECE_VALUE[move.captured] ?? 0) - (PIECE_VALUE[move.piece] ?? 0);
    }
    if (move.promotion) score += PIECE_VALUE[move.promotion] ?? 0;
    if (move.flags.includes('k') || move.flags.includes('q')) score += 30; // castling
    return score;
  }

  // ─── Random move (for easy mode) ──────────────────────────────────────────

  private getRandomMove(
    chess: Chess,
  ): { from: string; to: string; promotion?: string } | null {
    const moves = chess.moves({ verbose: true }) as Move[];
    if (!moves.length) return null;
    const m = moves[Math.floor(Math.random() * moves.length)];
    return { from: m.from, to: m.to, promotion: m.promotion };
  }
}
