/**
 * Apply migration via Neon WebSocket (TCP port 5432 is blocked on Neon free tier)
 * Usage: npx tsx scripts/apply-migration.ts
 */
import { neon } from "@neondatabase/serverless";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const sql = neon(process.env.DATABASE_URL!);

const migrationFile = path.join(
  process.cwd(),
  "prisma/migrations/20260304000000_add_watch_keywords/migration.sql"
);

const migrationSql = fs.readFileSync(migrationFile, "utf-8");

async function run() {
  console.log("Applying migration: 20260304000000_add_watch_keywords");
  try {
    // Execute all statements in the migration file
    await sql.unsafe(migrationSql);

    // Record in Prisma migrations table (only if not already recorded)
    const existing = await sql`
      SELECT id FROM "_prisma_migrations"
      WHERE migration_name = '20260304000000_add_watch_keywords'
      LIMIT 1
    `;
    if (existing.length === 0) {
      await sql`
        INSERT INTO "_prisma_migrations" (
          id, checksum, finished_at, migration_name, logs,
          rolled_back_at, started_at, applied_steps_count
        ) VALUES (
          gen_random_uuid()::text,
          'manual',
          now(),
          '20260304000000_add_watch_keywords',
          NULL,
          NULL,
          now(),
          1
        )
      `;
    }

    console.log("Migration applied successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

run();
