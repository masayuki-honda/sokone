/**
 * Apply the migration to add scraped_leaflet_id to uploaded_images.
 * Uses WebSocket adapter to avoid TCP 5432 blockage on Neon free tier.
 *
 * Usage: npx tsx --env-file=.env prisma/migrations/add-scraped-leaflet-id.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig, neon } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const sql = neon(process.env.DATABASE_URL!);

async function run() {
  console.log("Running migration: add scraped_leaflet_id to uploaded_images...");

  // Add column (idempotent via IF NOT EXISTS)
  await sql`
    ALTER TABLE uploaded_images
    ADD COLUMN IF NOT EXISTS scraped_leaflet_id TEXT
    REFERENCES scraped_leaflets(id) ON DELETE SET NULL
  `;
  console.log("  ✓ Column added");

  // Add index for performance
  await sql`
    CREATE INDEX IF NOT EXISTS idx_uploaded_images_scraped_leaflet_id
    ON uploaded_images(scraped_leaflet_id)
  `;
  console.log("  ✓ Index created");

  console.log("Migration complete.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
