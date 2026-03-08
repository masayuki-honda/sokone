import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
dotenv.config();

async function run() {
  const sql = neon(process.env.DATABASE_URL!);
  const rows = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='watch_keywords'`;
  console.log("watch_keywords table exists:", rows.length > 0);
  if (rows.length > 0) {
    const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name='watch_keywords' ORDER BY ordinal_position`;
    console.log("columns:", cols.map((c: Record<string, unknown>) => c.column_name));
  }
}
run();
