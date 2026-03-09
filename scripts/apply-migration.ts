/**
 * Apply pending Prisma migrations via Neon HTTP driver.
 * TCP port 5432 is blocked on Neon free tier, so we use the serverless HTTP driver.
 * Usage: npx tsx scripts/apply-migration.ts
 */
import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

const sql = neon(process.env.DATABASE_URL!);
const migrationsDir = path.join(__dirname, "..", "prisma", "migrations");

async function run() {
  // Find all migration directories (sorted by name = chronological order)
  const dirs = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== "migration_lock.toml")
    .map((d) => d.name)
    .sort();

  let applied = 0;

  for (const migrationName of dirs) {
    const sqlFile = path.join(migrationsDir, migrationName, "migration.sql");
    if (!fs.existsSync(sqlFile)) continue;

    // Check if already applied
    const existing = await sql`
      SELECT id FROM "_prisma_migrations"
      WHERE migration_name = ${migrationName}
      LIMIT 1
    `;

    if (existing.length > 0) {
      continue; // Already applied
    }

    console.log(`Applying migration: ${migrationName}`);

    const sqlContent = fs.readFileSync(sqlFile, "utf-8");

    // Split into individual statements (split on semicolons, skip empty)
    const statements = sqlContent
      .split(";")
      .map((s) => s.trim())
      .filter((s) => {
        // Remove comment-only lines, keep actual SQL
        const withoutComments = s.replace(/--.*$/gm, "").trim();
        return withoutComments.length > 0;
      });

    try {
      for (const stmt of statements) {
        // neon() only supports tagged template calls; simulate one for dynamic SQL
        const tsa = Object.assign([stmt], { raw: [stmt] }) as TemplateStringsArray;
        try {
          await sql(tsa);
        } catch (stmtErr: unknown) {
          // Skip "already exists" errors (42P07=relation, 42710=constraint)
          // This handles partially applied migrations
          const code = (stmtErr as { code?: string }).code;
          if (code === "42P07" || code === "42710") {
            console.log(`  ⚠ Skipped (already exists): ${stmt.slice(0, 60)}...`);
          } else {
            throw stmtErr;
          }
        }
      }

      // Record in _prisma_migrations
      await sql`
        INSERT INTO "_prisma_migrations" (
          id, checksum, finished_at, migration_name, logs,
          rolled_back_at, started_at, applied_steps_count
        ) VALUES (
          gen_random_uuid()::text,
          'manual',
          now(),
          ${migrationName},
          NULL,
          NULL,
          now(),
          1
        )
      `;

      console.log(`  ✔ Applied successfully (${statements.length} statements)`);
      applied++;
    } catch (err) {
      console.error(`  ✖ Migration failed:`, err);
      process.exit(1);
    }
  }

  if (applied === 0) {
    console.log("All migrations are up to date.");
  } else {
    console.log(`\nDone: ${applied} migration(s) applied.`);
  }
}

run();
