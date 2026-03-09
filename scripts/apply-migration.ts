/**
 * Apply migration via Neon WebSocket (TCP port 5432 is blocked on Neon free tier)
 * Usage: npx tsx scripts/apply-migration.ts
 */
import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";

dotenv.config();

const sql = neon(process.env.DATABASE_URL!);

async function run() {
  console.log("Applying migration: 20260304000000_add_watch_keywords");

  // Check if already applied
  const existing = await sql`
    SELECT id FROM "_prisma_migrations"
    WHERE migration_name = '20260304000000_add_watch_keywords'
    LIMIT 1
  `;

  // Check if table actually exists
  const tableExists = await sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'watch_keywords'
    LIMIT 1
  `;

  if (existing.length > 0 && tableExists.length > 0) {
    console.log("Migration already fully applied. Skipping.");
    return;
  }

  try {
    if (tableExists.length === 0) {
      // 1. Create table
      await sql`
        CREATE TABLE "watch_keywords" (
          "id" TEXT NOT NULL,
          "user_id" TEXT NOT NULL,
          "keyword" TEXT NOT NULL,
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "watch_keywords_pkey" PRIMARY KEY ("id")
        )
      `;

      // 2. Create unique index
      await sql`
        CREATE UNIQUE INDEX "watch_keywords_user_id_keyword_key"
        ON "watch_keywords"("user_id", "keyword")
      `;

      // 3. Add foreign key
      await sql`
        ALTER TABLE "watch_keywords"
        ADD CONSTRAINT "watch_keywords_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
      `;
    } else {
      console.log("Table already exists (partial migration), skipping DDL.");
    }

    // 4. Record in Prisma migrations table (if not already there)
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
