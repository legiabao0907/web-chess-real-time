import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../drizzle/schema/schema';
import { users, friends } from '../drizzle/schema/users.schema';
import { profileInfo } from '../drizzle/schema/profileInfo.schema';
import { eq, and, sql } from 'drizzle-orm';
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

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get profile metadata (bio, country, avatarUrl)
    const [profile] = await this.db
      .select()
      .from(profileInfo)
      .where(eq(profileInfo.userId, userId))
      .limit(1);

    const meta = (profile?.metadata as Record<string, unknown>) ?? {};

    // Get friends list
    const friendRows = await this.db
      .select({
        id: users.id,
        username: users.username,
        eloBlitz: users.blitzRating,
      })
      .from(friends)
      .innerJoin(users, eq(users.id, friends.user2Id))
      .where(
        and(eq(friends.user1Id, userId), eq(friends.status, 'Accepted')),
      );

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
    // Validate username uniqueness if changing
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

    // Update profile metadata (upsert)
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
}
