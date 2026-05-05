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

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Calculate the best move for the current position.
   * Returns move in {from, to, promotion} shape.
   */
  getBestMove(
    fen: string,
    difficulty: Difficulty = 'medium',
    botColor: 'w' | 'b' = 'b',
  ): { from: string; to: string; promotion?: string } | null {
    const chess = new Chess(fen);

    // Easy: 30% chance of random move
    if (difficulty === 'easy' && Math.random() < 0.35) {
      return this.getRandomMove(chess);
    }

    const depth = DEPTH_MAP[difficulty];
    const maximizing = botColor === 'w';

    let bestMove: Move | null = null;
    let bestScore = maximizing ? -Infinity : Infinity;
    let alpha = -Infinity;
    let beta = Infinity;

    const moves = this.orderMoves(chess.moves({ verbose: true }) as Move[], chess);

    for (const move of moves) {
      chess.move(move);
      const score = this.minimax(chess, depth - 1, alpha, beta, !maximizing);
      chess.undo();

      if (maximizing) {
        if (score > bestScore) { bestScore = score; bestMove = move; }
        alpha = Math.max(alpha, bestScore);
      } else {
        if (score < bestScore) { bestScore = score; bestMove = move; }
        beta = Math.min(beta, bestScore);
      }
    }

    if (!bestMove) return null;
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
    if (depth === 0 || chess.isGameOver()) {
      return this.quiescence(chess, alpha, beta, maximizing);
    }

    const moves = this.orderMoves(chess.moves({ verbose: true }) as Move[], chess);

    if (maximizing) {
      let maxEval = -Infinity;
      for (const move of moves) {
        chess.move(move);
        const evalScore = this.minimax(chess, depth - 1, alpha, beta, false);
        chess.undo();
        maxEval = Math.max(maxEval, evalScore);
        alpha = Math.max(alpha, evalScore);
        if (beta <= alpha) break; // β cut-off
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of moves) {
        chess.move(move);
        const evalScore = this.minimax(chess, depth - 1, alpha, beta, true);
        chess.undo();
        minEval = Math.min(minEval, evalScore);
        beta = Math.min(beta, evalScore);
        if (beta <= alpha) break; // α cut-off
      }
      return minEval;
    }
  }

  /**
   * Quiescence search: continue searching captures to avoid horizon effect.
   */
  private quiescence(
    chess: Chess,
    alpha: number,
    beta: number,
    maximizing: boolean,
    depth = 3,
  ): number {
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
      (m) => m.captured || m.flags.includes('e'), // captures + en-passant
    );

    for (const move of captures) {
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
