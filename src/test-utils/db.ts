import { readFileSync } from "fs";
import { join } from "path";
import { getPool } from "../db/index.js";

/**
 * True when E2E tests should run (local/test DB available).
 * Skips when DATABASE_URL is missing or points at Railway (not reachable from local/CI).
 */
export function isE2EDatabaseAvailable(): boolean {
  const url = process.env.DATABASE_URL;
  if (!url) return false;
  if (url.includes("railway.internal") || url.includes("railway.app")) return false;
  return true;
}

/**
 * Apply all SQL migrations to the current DATABASE_URL.
 * Intended for E2E tests using a dedicated Docker Postgres instance.
 */
export async function applyMigrations(): Promise<void> {
  const pool = getPool();
  const migrationFiles = ["001_initial.sql", "002_asset_trending.sql", "003_outcome_windows_12h.sql"];
  for (const file of migrationFiles) {
    const sql = readFileSync(join(process.cwd(), "migrations", file), "utf-8");
    await pool.query(sql);
  }
}

/**
 * Truncate all tables and reset identity counters.
 * Safe to call between E2E tests to get a clean DB.
 */
export async function resetDatabase(): Promise<void> {
  const pool = getPool();
  // Order matters due to FK constraints.
  await pool.query(
    `
    TRUNCATE TABLE
      outcomes,
      posts,
      asset_trending,
      assets,
      accounts
    RESTART IDENTITY CASCADE;
    `
  );
}

