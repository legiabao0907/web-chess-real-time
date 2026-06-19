import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../drizzle/schema/schema';
import { users, friends } from '../drizzle/schema/users.schema';
import { profileInfo } from '../drizzle/schema/profileInfo.schema';
import { eq, and, sql, or, ilike, ne } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UserService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  // ─── GET /user/me ──────────────────────────────────────────────────────────
  async getMe(userId: string) {
    const [user] = await this.db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        eloBlitz: users.blitzRating,
        eloRapid: users.rapidRating,
        eloBullet: users.bulletRating,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) throw new NotFoundException('User not found');

    const [profile] = await this.db
      .select()
      .from(profileInfo)
      .where(eq(profileInfo.userId, userId))
      .limit(1);

    const meta = (profile?.metadata as Record<string, unknown>) ?? {};

    const friendRows = await this.db
      .select({
        id: users.id,
        username: users.username,
        eloBlitz: users.blitzRating,
      })
      .from(friends)
      .innerJoin(users, eq(users.id, friends.user2Id))
      .where(and(eq(friends.user1Id, userId), eq(friends.status, 'Accepted')));

    return {
      ...user,
      bio: meta.bio ?? null,
      country: meta.country ?? null,
      avatarUrl: meta.avatarUrl ?? null,
      totalGames: meta.totalGames ?? 0,
      wins: meta.wins ?? 0,
      losses: meta.losses ?? 0,
      draws: meta.draws ?? 0,
      friends: friendRows.map((f) => ({
        id: f.id,
        username: f.username,
        eloBlitz: f.eloBlitz ?? 1200,
        avatarUrl: null,
        isOnline: false,
      })),
    };
  }

  // ─── PATCH /user/me ────────────────────────────────────────────────────────
  async updateMe(userId: string, dto: UpdateProfileDto) {
    if (dto.username) {
      const [existing] = await this.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, dto.username))
        .limit(1);

      if (existing && existing.id !== userId) {
        throw new ConflictException('Username already taken');
      }

      await this.db
        .update(users)
        .set({ username: dto.username })
        .where(eq(users.id, userId));
    }

    const [existing] = await this.db
      .select()
      .from(profileInfo)
      .where(eq(profileInfo.userId, userId))
      .limit(1);

    const currentMeta = (existing?.metadata as Record<string, unknown>) ?? {};
    const newMeta = {
      ...currentMeta,
      ...(dto.bio !== undefined && { bio: dto.bio }),
      ...(dto.country !== undefined && { country: dto.country }),
      ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
    };

    if (existing) {
      await (this.db as any)
        .update(profileInfo)
        .set({ metadata: sql`${JSON.stringify(newMeta)}::jsonb` })
        .where(eq(profileInfo.userId, userId));
    } else {
      await (this.db as any)
        .insert(profileInfo)
        .values([{ userId, metadata: newMeta }]);
    }

    return this.getMe(userId);
  }

  // ─── GET /user/:id (public profile) ───────────────────────────────────────
  async getPublicProfile(targetId: string) {
    const [user] = await this.db
      .select({
        id: users.id,
        username: users.username,
        eloBlitz: users.blitzRating,
        eloRapid: users.rapidRating,
        eloBullet: users.bulletRating,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, targetId))
      .limit(1);

    if (!user) throw new NotFoundException('User not found');

    const [profile] = await this.db
      .select()
      .from(profileInfo)
      .where(eq(profileInfo.userId, targetId))
      .limit(1);

    const meta = (profile?.metadata as Record<string, unknown>) ?? {};

    return {
      ...user,
      bio: meta.bio ?? null,
      country: meta.country ?? null,
      avatarUrl: meta.avatarUrl ?? null,
      totalGames: meta.totalGames ?? 0,
      wins: meta.wins ?? 0,
      losses: meta.losses ?? 0,
      draws: meta.draws ?? 0,
    };
  }

  // ─── GET friendship status ─────────────────────────────────────────────────
  async getFriendshipStatus(myId: string, targetId: string): Promise<{
    status: 'none' | 'pending_sent' | 'pending_received' | 'friends';
  }> {
    const [sent] = await this.db
      .select({ status: friends.status })
      .from(friends)
      .where(and(eq(friends.user1Id, myId), eq(friends.user2Id, targetId)))
      .limit(1);

    if (sent) {
      return { status: sent.status === 'Accepted' ? 'friends' : 'pending_sent' };
    }

    const [received] = await this.db
      .select({ status: friends.status })
      .from(friends)
      .where(and(eq(friends.user1Id, targetId), eq(friends.user2Id, myId)))
      .limit(1);

    if (received) {
      return { status: received.status === 'Accepted' ? 'friends' : 'pending_received' };
    }

    return { status: 'none' };
  }

  // ─── POST /user/:id/friend-request ────────────────────────────────────────
  async sendFriendRequest(myId: string, targetId: string) {
    if (myId === targetId) throw new BadRequestException('Cannot friend yourself');

    const { status } = await this.getFriendshipStatus(myId, targetId);
    if (status === 'friends') throw new ConflictException('Already friends');
    if (status === 'pending_sent') throw new ConflictException('Request already sent');

    // Auto-accept if they already sent us a request
    if (status === 'pending_received') {
      return this.acceptFriendRequest(myId, targetId);
    }

    await (this.db as any)
      .insert(friends)
      .values({ user1Id: myId, user2Id: targetId, status: 'Pending' });
    return { message: 'Friend request sent' };
  }

  // ─── POST /user/:id/accept-friend ─────────────────────────────────────────
  async acceptFriendRequest(myId: string, requesterId: string) {
    await this.db
      .update(friends)
      .set({ status: 'Accepted' })
      .where(and(eq(friends.user1Id, requesterId), eq(friends.user2Id, myId)));

    // Add reverse record for bidirectional lookup
    const [existing] = await this.db
      .select()
      .from(friends)
      .where(and(eq(friends.user1Id, myId), eq(friends.user2Id, requesterId)))
      .limit(1);

    if (!existing) {
      await (this.db as any)
        .insert(friends)
        .values({ user1Id: myId, user2Id: requesterId, status: 'Accepted' });
    } else {
      await this.db
        .update(friends)
        .set({ status: 'Accepted' })
        .where(and(eq(friends.user1Id, myId), eq(friends.user2Id, requesterId)));
    }

    return { message: 'Friend request accepted' };
  }

  // ─── DELETE /user/:id/friend ───────────────────────────────────────────────
  async removeFriend(myId: string, targetId: string) {
    await this.db.delete(friends).where(
      or(
        and(eq(friends.user1Id, myId), eq(friends.user2Id, targetId)),
        and(eq(friends.user1Id, targetId), eq(friends.user2Id, myId)),
      ),
    );
    return { message: 'Friend removed' };
  }

  // ─── GET pending friend requests ──────────────────────────────────────────
  async getPendingRequests(myId: string) {
    const rows = await this.db
      .select({
        id: users.id,
        username: users.username,
        eloBlitz: users.blitzRating,
        createdAt: users.createdAt,
      })
      .from(friends)
      .innerJoin(users, eq(users.id, friends.user1Id))
      .where(and(eq(friends.user2Id, myId), eq(friends.status, 'Pending')));

    return rows;
  }

  // ─── GET /user/search?q=... ───────────────────────────────────────────────
  async searchUsers(query: string, excludeUserId: string) {
    if (!query || query.trim().length < 1) return [];

    const term = `%${query.trim()}%`;
    const rows = await this.db
      .select({
        id: users.id,
        username: users.username,
        eloBlitz: users.blitzRating,
        eloRapid: users.rapidRating,
        eloBullet: users.bulletRating,
      })
      .from(users)
      .where(
        and(
          ilike(users.username, term),
          ne(users.id, excludeUserId),
        ),
      )
      .orderBy(users.username)
      .limit(10);

    return rows;
  }
}
