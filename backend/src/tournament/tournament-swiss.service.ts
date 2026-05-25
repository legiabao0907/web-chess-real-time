import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../drizzle/schema/schema';
import { tournaments, tournamentParticipants } from '../drizzle/schema/tournament.schema';
import { games } from '../drizzle/schema/game.schema';
import { users } from '../drizzle/schema/users.schema';
import { eq, and, or, desc } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { v4 as uuidv4 } from 'uuid';

// ─── Domain Interfaces ────────────────────────────────────────────────────────

/**
 * Đại diện cho một kỳ thủ trong giải đấu với toàn bộ thống kê cần thiết
 * để thuật toán Hệ Thụy Sĩ ra quyết định.
 */
export interface SwissPlayer {
  userId: string;
  username: string;
  /** Điểm giải đấu hiện tại (1 = thắng, 0.5 = hòa, 0 = thua, 1 = bye) */
  tournamentPoints: number;
  /** Rating của người dùng (blitz/rapid/bullet tùy format giải đấu) */
  rating: number;
  /** Số ván đã cầm quân Trắng trong giải đấu này */
  whitesPlayed: number;
  /** Số ván đã cầm quân Đen trong giải đấu này */
  blacksPlayed: number;
  /** Lịch sử màu quân: 'w' | 'b' | 'bye' theo thứ tự vòng */
  colorHistory: Array<'w' | 'b' | 'bye'>;
  /** Đã từng nhận Bye chưa */
  hadBye: boolean;
}

/**
 * Đại diện một trận đấu đã diễn ra (dùng để kiểm tra lịch sử ghép cặp)
 */
export interface SwissPastMatch {
  whiteId: string;
  blackId: string;
  /** null = bye game */
  result: 'white' | 'black' | 'draw' | null;
}

/**
 * Output: một cặp đấu được tạo bởi thuật toán
 */
export interface SwissPairing {
  gameId: string;
  tournamentId: string;
  round: number;
  whiteId: string;
  whiteUsername: string;
  blackId: string;
  blackUsername: string;
  /** 'bye' khi blackId = 'BYE' */
  type: 'regular' | 'bye';
}

/**
 * Output tổng hợp của một vòng mới
 */
export interface SwissRoundResult {
  tournamentId: string;
  round: number;
  pairings: SwissPairing[];
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class TournamentSwissService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  // ══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Hàm chính: sinh cặp đấu cho vòng tiếp theo của giải đấu.
   *
   * Flow:
   * 1. Lấy danh sách participants từ DB (với rating)
   * 2. Lấy lịch sử tất cả các trận đã đấu (từ bảng `games`)
   * 3. Tính toán thống kê màu quân cho từng kỳ thủ
   * 4. Chạy thuật toán Swiss pairing
   * 5. Trả về danh sách cặp đấu (KHÔNG ghi vào DB — caller tự lưu)
   *
   * @param tournamentId  UUID của giải đấu
   * @param nextRound     Số thứ tự vòng cần tạo (1-indexed)
   */
  async generateNextRoundPairs(
    tournamentId: string,
    nextRound: number,
  ): Promise<SwissRoundResult> {
    // 1. Kiểm tra giải đấu tồn tại
    const [tournament] = await this.db
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, tournamentId))
      .limit(1);

    if (!tournament) throw new NotFoundException('Tournament not found');
    if (tournament.status !== 'ongoing')
      throw new ForbiddenException('Tournament is not ongoing');

    // 2. Lấy participants + rating từ bảng users
    const participantRows = await this.db
      .select({
        userId: tournamentParticipants.userId,
        username: users.username,
        points: tournamentParticipants.points,
        blitzRating: users.blitzRating,
        rapidRating: users.rapidRating,
        bulletRating: users.bulletRating,
      })
      .from(tournamentParticipants)
      .leftJoin(users, eq(users.id, tournamentParticipants.userId))
      .where(eq(tournamentParticipants.tournamentId, tournamentId));

    if (participantRows.length < 2) {
      throw new ForbiddenException('Need at least 2 players');
    }

    // 3. Lấy lịch sử trận đấu trong giải này (từ bảng games)
    const pastGames = await this.db
      .select({
        whiteId: games.whiteId,
        blackId: games.blackId,
        winnerId: games.winnerId,
        status: games.status,
      })
      .from(games)
      .where(eq(games.tournamentId, tournamentId));

    // 4. Chuyển đổi pastGames → SwissPastMatch[]
    const pastMatches: SwissPastMatch[] = pastGames.map((g) => ({
      whiteId: g.whiteId ?? '',
      blackId: g.blackId ?? 'BYE',
      result: this.resolveResult(g.whiteId, g.blackId, g.winnerId, g.status),
    }));

    // 5. Xây dựng SwissPlayer[] với thống kê màu quân
    const players = this.buildPlayerStats(participantRows, pastMatches, tournament.timeControl);

    // 6. Chạy thuật toán
    const pairings = this.runSwissPairing(players, pastMatches, tournamentId, nextRound);

    return { tournamentId, round: nextRound, pairings };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PRIVATE: Data preparation
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Giải mã kết quả trận đấu từ DB về kiểu SwissPastMatch['result']
   */
  private resolveResult(
    whiteId: string | null,
    blackId: string | null,
    winnerId: string | null,
    status: string | null,
  ): 'white' | 'black' | 'draw' | null {
    if (!blackId || blackId === 'BYE') return null; // bye
    if (status !== 'finished' && status !== 'completed') return null;
    if (!winnerId) return 'draw';
    if (winnerId === whiteId) return 'white';
    if (winnerId === blackId) return 'black';
    return 'draw';
  }

  /**
   * Từ danh sách participants & lịch sử trận, xây dựng SwissPlayer[]
   * với thống kê whitesPlayed / blacksPlayed / colorHistory / hadBye.
   */
  private buildPlayerStats(
    participantRows: Array<{
      userId: string | null;
      username: string | null;
      points: number | null;
      blitzRating: number | null;
      rapidRating: number | null;
      bulletRating: number | null;
    }>,
    pastMatches: SwissPastMatch[],
    timeControl: string | null,
  ): SwissPlayer[] {
    // Tính rating theo format
    const getRating = (row: (typeof participantRows)[0]) => {
      const tc = timeControl ?? 'blitz_5';
      if (tc.startsWith('bullet')) return row.bulletRating ?? 1200;
      if (tc.startsWith('rapid')) return row.rapidRating ?? 1200;
      return row.blitzRating ?? 1200;
    };

    const players: SwissPlayer[] = participantRows.map((p) => ({
      userId: p.userId ?? '',
      username: p.username ?? 'Unknown',
      tournamentPoints: p.points ?? 0,
      rating: getRating(p),
      whitesPlayed: 0,
      blacksPlayed: 0,
      colorHistory: [],
      hadBye: false,
    }));

    // Tổng hợp lịch sử màu quân từ pastMatches
    // Lưu ý: pastMatches không có thông tin round order nên colorHistory
    // ở đây chỉ phục vụ đếm số lần trắng/đen và cờ hadBye.
    for (const match of pastMatches) {
      const whitePlayer = players.find((p) => p.userId === match.whiteId);
      const blackPlayer = players.find((p) => p.userId === match.blackId);

      if (match.blackId === 'BYE') {
        if (whitePlayer) {
          whitePlayer.hadBye = true;
          whitePlayer.colorHistory.push('bye');
        }
      } else {
        if (whitePlayer) {
          whitePlayer.whitesPlayed++;
          whitePlayer.colorHistory.push('w');
        }
        if (blackPlayer) {
          blackPlayer.blacksPlayed++;
          blackPlayer.colorHistory.push('b');
        }
      }
    }

    return players;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PRIVATE: Swiss Pairing Algorithm
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Thuật toán Hệ Thụy Sĩ:
   *
   * 1. Sắp xếp kỳ thủ: điểm giảm → rating giảm
   * 2. Nhóm theo Score Group
   * 3. Xử lý Bye nếu số lẻ (kỳ thủ điểm thấp nhất chưa từng bye)
   * 4. Ghép cặp từng nhóm (ghép "nửa trên" với "nửa dưới" trong nhóm)
   *    với fallback sang nhóm liền kề nếu nhóm bị lẻ
   * 5. Phân màu quân theo quy tắc cân bằng màu
   */
  private runSwissPairing(
    players: SwissPlayer[],
    pastMatches: SwissPastMatch[],
    tournamentId: string,
    round: number,
  ): SwissPairing[] {
    // Build tập hợp cặp đã đấu để tra nhanh O(1)
    const pairedSet = new Set<string>();
    for (const m of pastMatches) {
      if (m.blackId !== 'BYE') {
        pairedSet.add(this.pairKey(m.whiteId, m.blackId));
      }
    }

    // Sắp xếp: điểm giảm → rating giảm
    const sorted = [...players].sort(
      (a, b) =>
        b.tournamentPoints - a.tournamentPoints ||
        b.rating - a.rating,
    );

    const pairings: SwissPairing[] = [];
    const paired = new Set<string>();

    // ── Bước 1: Xử lý Bye (nếu số lẻ) ───────────────────────────────────────
    if (sorted.length % 2 !== 0) {
      // Tìm kỳ thủ điểm thấp nhất chưa từng nhận bye
      const byeCandidate = [...sorted]
        .reverse()
        .find((p) => !p.hadBye);

      if (byeCandidate) {
        pairings.push({
          gameId: uuidv4(),
          tournamentId,
          round,
          whiteId: byeCandidate.userId,
          whiteUsername: byeCandidate.username,
          blackId: 'BYE',
          blackUsername: 'BYE',
          type: 'bye',
        });
        paired.add(byeCandidate.userId);
      }
      // Trường hợp mọi người đều đã nhận bye: cho người điểm thấp nhất nhận lại
      else {
        const fallback = sorted[sorted.length - 1];
        pairings.push({
          gameId: uuidv4(),
          tournamentId,
          round,
          whiteId: fallback.userId,
          whiteUsername: fallback.username,
          blackId: 'BYE',
          blackUsername: 'BYE',
          type: 'bye',
        });
        paired.add(fallback.userId);
      }
    }

    // ── Bước 2: Tạo Score Groups ──────────────────────────────────────────────
    const unpaired = sorted.filter((p) => !paired.has(p.userId));
    const scoreGroups = this.buildScoreGroups(unpaired);

    // ── Bước 3: Ghép cặp theo từng nhóm ──────────────────────────────────────
    // "Floaters" là những người chưa ghép được từ nhóm trên, được đưa xuống nhóm dưới
    let floaters: SwissPlayer[] = [];

    for (const group of scoreGroups) {
      const pool = [...floaters, ...group];
      floaters = [];

      const groupPaired = new Set<string>();

      // Thuật toán "fold": chia pool làm đôi, ghép top[i] với bottom[i]
      // Nếu đã đấu rồi → thử hoán vị trong bottom
      const newPairings = this.pairGroup(
        pool,
        pairedSet,
        groupPaired,
        tournamentId,
        round,
      );

      pairings.push(...newPairings.paired);
      floaters.push(...newPairings.leftover);
    }

    // Nếu sau tất cả các nhóm vẫn còn floater (không ghép được) → force pair
    if (floaters.length >= 2) {
      for (let i = 0; i < floaters.length - 1; i += 2) {
        const { white, black } = this.assignColor(floaters[i], floaters[i + 1]);
        pairings.push({
          gameId: uuidv4(),
          tournamentId,
          round,
          whiteId: white.userId,
          whiteUsername: white.username,
          blackId: black.userId,
          blackUsername: black.username,
          type: 'regular',
        });
      }
    }

    return pairings;
  }

  /**
   * Nhóm các kỳ thủ theo điểm số (Score Group).
   * Trả về mảng mảng, nhóm cao điểm nhất ở đầu.
   */
  private buildScoreGroups(players: SwissPlayer[]): SwissPlayer[][] {
    const map = new Map<number, SwissPlayer[]>();
    for (const p of players) {
      const key = p.tournamentPoints;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    // Sắp xếp nhóm: điểm cao nhất trước
    return [...map.entries()]
      .sort(([a], [b]) => b - a)
      .map(([, group]) => group);
  }

  /**
   * Ghép cặp trong một pool (nhóm + floaters từ nhóm trên).
   * Trả về { paired: SwissPairing[], leftover: SwissPlayer[] }
   *
   * Thuật toán: Fold — chia pool thành top-half và bottom-half,
   * ghép top[0] với bottom[0], top[1] với bottom[1], ...
   * Nếu gặp cặp đã đấu nhau, backtrack bằng cách hoán vị trong bottom-half.
   */
  private pairGroup(
    pool: SwissPlayer[],
    pairedSet: Set<string>,
    groupPaired: Set<string>,
    tournamentId: string,
    round: number,
  ): { paired: SwissPairing[]; leftover: SwissPlayer[] } {
    const result: SwissPairing[] = [];
    const localPaired = new Set<string>();

    // Nếu pool lẻ, kỳ thủ cuối sẽ là floater sang nhóm tiếp theo
    const hasFloater = pool.length % 2 !== 0;
    let floater: SwissPlayer | null = null;

    const workPool = [...pool];

    if (hasFloater) {
      // Float kỳ thủ cuối (điểm thấp nhất trong pool) xuống nhóm dưới
      floater = workPool.pop()!;
    }

    const mid = workPool.length / 2;
    const topHalf = workPool.slice(0, mid);
    const bottomHalf = workPool.slice(mid);

    // Thử ghép với backtracking trên bottom-half
    const bottomPermutations = this.generatePermutations(bottomHalf);

    let bestBottom = bottomHalf;
    let matched = false;

    for (const perm of bottomPermutations) {
      let valid = true;
      for (let i = 0; i < topHalf.length; i++) {
        if (
          localPaired.has(topHalf[i].userId) ||
          localPaired.has(perm[i].userId)
        ) {
          valid = false;
          break;
        }
        const key = this.pairKey(topHalf[i].userId, perm[i].userId);
        if (pairedSet.has(key)) {
          valid = false;
          break;
        }
      }
      if (valid) {
        bestBottom = perm;
        matched = true;
        break;
      }
    }

    // Nếu không tìm được permutation hợp lệ, dùng bottom gốc (rematch buộc phải chấp nhận)
    if (!matched) {
      bestBottom = bottomHalf;
    }

    // Tạo các cặp
    for (let i = 0; i < topHalf.length; i++) {
      const playerA = topHalf[i];
      const playerB = bestBottom[i];
      const { white, black } = this.assignColor(playerA, playerB);

      result.push({
        gameId: uuidv4(),
        tournamentId,
        round,
        whiteId: white.userId,
        whiteUsername: white.username,
        blackId: black.userId,
        blackUsername: black.username,
        type: 'regular',
      });

      localPaired.add(playerA.userId);
      localPaired.add(playerB.userId);
    }

    return {
      paired: result,
      leftover: floater ? [floater] : [],
    };
  }

  /**
   * Quy tắc phân màu quân theo Hệ Thụy Sĩ:
   *
   * 1. Ai có hiệu số (whites - blacks) nhỏ hơn → cầm Trắng (ưu tiên cân bằng)
   * 2. Nếu bằng nhau → ai cầm Đen nhiều vòng liên tiếp gần nhất → cầm Trắng
   * 3. Tuyệt đối tránh cầm cùng màu 3 lần liên tiếp (nếu có thể)
   */
  private assignColor(
    playerA: SwissPlayer,
    playerB: SwissPlayer,
  ): { white: SwissPlayer; black: SwissPlayer } {
    const diffA = playerA.whitesPlayed - playerA.blacksPlayed;
    const diffB = playerB.whitesPlayed - playerB.blacksPlayed;

    // Ai đang "nợ" trắng nhiều hơn → cầm Trắng
    if (diffA < diffB) return { white: playerA, black: playerB };
    if (diffB < diffA) return { white: playerB, black: playerA };

    // Nếu hiệu số bằng nhau, xét chuỗi màu liên tiếp cuối cùng
    const lastColorA = this.lastConsecutiveColor(playerA.colorHistory);
    const lastColorB = this.lastConsecutiveColor(playerB.colorHistory);

    // Ai vừa cầm Đen nhiều lần liên tiếp hơn → cầm Trắng
    if (lastColorA.color === 'b' && lastColorB.color === 'w')
      return { white: playerA, black: playerB };
    if (lastColorB.color === 'b' && lastColorA.color === 'w')
      return { white: playerB, black: playerA };

    // Ai cầm trắng cuối gần nhất liên tiếp nhiều hơn → nhường Đen
    if (lastColorA.color === 'w' && lastColorA.count >= lastColorB.count)
      return { white: playerB, black: playerA };

    // Fallback: kỳ thủ rating cao hơn cầm Trắng
    return playerA.rating >= playerB.rating
      ? { white: playerA, black: playerB }
      : { white: playerB, black: playerA };
  }

  /**
   * Tính chuỗi màu liên tiếp cuối cùng trong lịch sử màu của một kỳ thủ.
   * Ví dụ: ['w','w','b','b','b'] → { color: 'b', count: 3 }
   */
  private lastConsecutiveColor(
    history: Array<'w' | 'b' | 'bye'>,
  ): { color: 'w' | 'b' | 'none'; count: number } {
    if (history.length === 0) return { color: 'none', count: 0 };

    const last = history[history.length - 1];
    if (last === 'bye') return { color: 'none', count: 0 };

    let count = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i] === last) count++;
      else break;
    }
    return { color: last as 'w' | 'b', count };
  }

  /**
   * Tạo key duy nhất cho một cặp (không phân biệt trắng/đen)
   */
  private pairKey(id1: string, id2: string): string {
    return [id1, id2].sort().join(':');
  }

  /**
   * Sinh hoán vị của một mảng nhỏ (dùng cho backtracking bottom-half).
   * Giới hạn tối đa 5040 hoán vị (7!) để tránh quá tải với nhóm lớn.
   * Với nhóm lớn hơn 7 → chỉ thử các rotation.
   */
  private generatePermutations<T>(arr: T[]): T[][] {
    if (arr.length <= 1) return [arr];
    if (arr.length > 7) {
      // Thay vì full permutation, thử rotation (đơn giản hóa)
      return Array.from({ length: arr.length }, (_, i) => [
        ...arr.slice(i),
        ...arr.slice(0, i),
      ]);
    }

    const result: T[][] = [];
    const permute = (current: T[], remaining: T[]) => {
      if (remaining.length === 0) {
        result.push(current);
        return;
      }
      for (let i = 0; i < remaining.length; i++) {
        permute(
          [...current, remaining[i]],
          [...remaining.slice(0, i), ...remaining.slice(i + 1)],
        );
      }
    };
    permute([], arr);
    return result;
  }
}
