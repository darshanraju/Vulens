/**
 * Daily worker entrypoint:
 * - Fetch CoinGecko trending assets for the last 24h window.
 * - Ingest verified-only tweets about those symbols via X search.
 * - Run outcome tracking and scoring.
 */
import "dotenv/config";
import { getPool } from "./db/index.js";
import { fetchTrendingAssets, upsertTrendingAssets } from "./trending/coingecko.js";
import { ingestTrendingTweetsForAsset } from "./x/search-trending.js";
import { runOutcomeTracking } from "./outcomes/outcome-tracking.js";
import { runScoring } from "./scoring/compute-account-score.js";

const DEFAULT_TWEET_LIMIT_PER_ASSET = Number(process.env.TRENDING_BATCH_LIMIT_PER_ASSET || "500");

async function main() {
  const pool = getPool();
  const r = await pool.query("SELECT 1");
  console.log("Worker (daily) connected to DB, rows:", r.rowCount);

  const now = new Date();
  const windowEnd = now;
  const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  console.log("Trending window:", windowStart.toISOString(), "→", windowEnd.toISOString());

  const trending = await fetchTrendingAssets();
  console.log("Fetched trending assets from CoinGecko:", trending.map((t) => t.symbol).join(", "));

  await upsertTrendingAssets(pool, trending, windowStart, windowEnd);

  // Reload with asset_ids
  const res = await pool.query(
    `SELECT at.asset_id, a.symbol
     FROM asset_trending at
     JOIN assets a ON a.id = at.asset_id
     WHERE at.window_start = $1 AND at.window_end = $2`,
    [windowStart, windowEnd]
  );

  for (const row of res.rows as Array<{ asset_id: number; symbol: string }>) {
    console.log("Ingesting tweets for trending asset", row.symbol, "(", row.asset_id, ")");
    const inserted = await ingestTrendingTweetsForAsset(
      pool,
      row.asset_id,
      row.symbol,
      windowStart,
      windowEnd,
      DEFAULT_TWEET_LIMIT_PER_ASSET
    );
    console.log("Inserted tweets for", row.symbol, ":", inserted);
  }

  await runOutcomeTracking(pool);
  await runScoring(pool);

  console.log("Daily trending batch complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

