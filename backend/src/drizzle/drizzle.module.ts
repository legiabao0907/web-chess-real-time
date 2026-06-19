import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as fs from 'fs';
import * as path from 'path';
export const DRIZZLE = Symbol('drizzle-connection');
import * as schema from './schema/schema';

@Module({
  providers: [
    {
      provide: DRIZZLE,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const databaseURL = configService.get<string>('DATABASE_URL');
        const pool = new Pool({
          connectionString: databaseURL,
          ssl: (databaseURL.includes('localhost') || databaseURL.includes('@postgres'))
            ? false
            : { rejectUnauthorized: false },
        });

        // ─── Auto-run migrations on startup ─────────────────────────────
        // In Docker: dist/src/drizzle/ → ../../.. → /app/drizzle/
        // In local dev: dist/src/drizzle/ → ../../drizzle/ → drizzle/
        const candidatePaths = [
          path.join(__dirname, '..', '..', '..', 'drizzle', '0000_fearless_betty_brant.sql'),
          path.join(__dirname, '..', '..', 'drizzle', '0000_fearless_betty_brant.sql'),
        ];
        const migrationPath = candidatePaths.find((p) => fs.existsSync(p)) || candidatePaths[0];
        if (fs.existsSync(migrationPath)) {
          const sql = fs.readFileSync(migrationPath, 'utf-8');
          // Split by statement breakpoint marker (Drizzle convention)
          const statements = sql
            .split('--> statement-breakpoint')
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
          for (const stmt of statements) {
            try {
              await pool.query(stmt);
            } catch (err: any) {
              // Ignore "already exists" errors (idempotent CREATE IF NOT EXISTS)
              if (!err.message?.includes('already exists') && !err.message?.includes('duplicate')) {
                console.warn('[AutoMigrate] ⚠️  Skipped:', err.message?.slice(0, 100));
              }
            }
          }
          console.log('[AutoMigrate] ✅ Database schema up-to-date');
        } else {
          console.warn('[AutoMigrate] ⚠️  Migration file not found at:', migrationPath);
        }

        return drizzle(pool, { schema }) as NodePgDatabase<typeof schema>;
      },
    },
  ],
  exports: [DRIZZLE],
})
export class DrizzleModule {}
