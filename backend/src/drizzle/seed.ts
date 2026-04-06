import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { users, posts, chatRooms, games, chatRoomMembers } from './schema/schema';
import 'dotenv/config';
import { faker } from '@faker-js/faker';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const db = drizzle(pool, { schema: { users, posts, chatRooms, games, chatRoomMembers } });

async function main() {
  const userIds = await Promise.all(
    Array(50)
      .fill('')
      .map(async () => {
        const user = await db
          .insert(users)
          .values({
            username: faker.internet.userName().slice(0, 20),
            email: faker.internet.email(),
            passwordHash: '$2b$12$placeholder_hash_for_seeding_only',
          })
          .returning();
        return user[0].id;
      }),
  );

  const postIds = await Promise.all(
    Array(50)
      .fill('')
      .map(async () => {
        const post = await db
          .insert(__dirname + '/schema/posts.schema.ts' as any  )
          .values({
            content: faker.lorem.paragraph(),
            title: faker.lorem.sentence(),
            authorId: faker.helpers.arrayElement(userIds),
          })
          .returning();
        return post[0].id;
      }),
  );

  await Promise.all(
    Array(50)
      .fill('')
      .map(async () => {
        const comment = await db
          .insert(chatRooms)
          .values({
            text: faker.lorem.sentence(),
            authorId: faker.helpers.arrayElement(userIds),
            postId: faker.helpers.arrayElement(postIds),
          })
          .returning();
        return comment[0].id;
      }),
  );

  const insertedGroups = await db
    .insert(games)
    .values([
      {
        name: 'JS',
      },
      {
        name: 'TS',
      },
    ])
    .returning();

  const groupIds = insertedGroups.map((group) => group.id);

  await Promise.all(
    userIds.map(async (userId) => {
      return await db
        .insert(chatRoomMembers)
        .values({
          userId,
          groupId: faker.helpers.arrayElement(groupIds),
        })
        .returning();
    }),
  );
}

main()
  .then(() => {
    console.log('Seeding finished successfully!');
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
