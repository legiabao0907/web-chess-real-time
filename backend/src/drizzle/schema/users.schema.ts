import { pgTable, uuid, varchar, integer, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  // Primary Key, tự động sinh chuỗi UUID khi có user mới
  id: uuid('id').defaultRandom().primaryKey(),
  
  // Thông tin đăng nhập (Bắt buộc & Duy nhất)
  username: varchar('username', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  
  // Điểm số ELO (Khởi tạo mặc định là 1200)
  eloBlitz: integer('elo_blitz').default(1200).notNull(),
  eloRapid: integer('elo_rapid').default(1200).notNull(),
  
  // Avatar có thể null nếu user chưa cập nhật
  avatarUrl: varchar('avatar_url', { length: 1024 }),
  
  // Tự động lấy thời gian hiện tại khi tạo/cập nhật
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
