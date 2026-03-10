/**
 * One-off backfill script. Usage: npm run backfill
 */
import "dotenv/config";
import { getPool } from "../db/index.js";
import { runBackfill } from "./run-backfill.js";

async function main() {
  const pool = getPool();
  console.log("Starting backfill...");
  const result = await runBackfill(pool, {
    outcomeWindowDelayMs: 1500,
    sentiment: true,
  });
  console.log("Backfill done:", result);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
