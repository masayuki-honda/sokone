/**
 * Apply pending migration SQL via Neon WebSocket (works when TCP port 5432 is blocked).
 * Run with: npx tsx prisma/apply-migration.ts
 */
import { neon, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log("Applying migration: 20260306000000_add_file_hash");
  try {
    await sql`ALTER TABLE "uploaded_images" ADD COLUMN IF NOT EXISTS "file_hash" TEXT`;
    console.log("✓ Column added");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("already exists") || message.includes("duplicate")) {
      console.log("  Column already exists, skipping");
    } else {
      console.error("✗ Failed to add column:", message);
      process.exit(1);
    }
  }

  try {
    await sql`CREATE INDEX IF NOT EXISTS "uploaded_images_file_hash_idx" ON "uploaded_images"("user_id", "file_hash")`;
    console.log("✓ Index created");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("already exists") || message.includes("duplicate")) {
      console.log("  Index already exists, skipping");
    } else {
      console.error("✗ Failed to create index:", message);
      process.exit(1);
    }
  }

  console.log("Migration complete.");
}

main();
