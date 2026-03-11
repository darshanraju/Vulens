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
import { getPriceAtTimeUsd } from "./enrichment/price-snapshot.js";
import { runOutcomeTracking } from "./outcomes/outcome-tracking.js";
import { runScoring } from "./scoring/compute-account-score.js";

const DEFAULT_TWEET_LIMIT_PER_ASSET = Number(process.env.TRENDING_BATCH_LIMIT_PER_ASSET || "500");

/** Delay in ms between CoinGecko API calls to avoid rate limits (default 2s). */
const COINGECKO_DELAY_MS = Number(process.env.COINGECKO_DELAY_MS || "2000");

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runDailyTrendingBatch(
  windowStart: Date,
  windowEnd: Date
): Promise<void> {
  const pool = getPool();
  const trending = await fetchTrendingAssets();
  console.log("Fetched trending assets from CoinGecko:", trending.map((t) => t.symbol).join(", "));

  await upsertTrendingAssets(pool, trending, windowStart, windowEnd);

  // Reload with asset_ids (exclude BTC, ETH, SOL from tweet ingestion)
  const res = await pool.query(
    `SELECT at.asset_id, a.symbol
     FROM asset_trending at
     JOIN assets a ON a.id = at.asset_id
     WHERE at.window_start = $1 AND at.window_end = $2
       AND a.symbol NOT IN ('BTC', 'ETH', 'SOL')`,
    [windowStart, windowEnd]
  );

  for (const row of res.rows as Array<{ asset_id: number; symbol: string }>) {
    console.log("Ingesting tweets for trending asset", row.symbol, "(", row.asset_id, ")");
    try {
      const inserted = await ingestTrendingTweetsForAsset(
        pool,
        row.asset_id,
        row.symbol,
        windowStart,
        windowEnd,
        DEFAULT_TWEET_LIMIT_PER_ASSET
      );
      console.log("Inserted tweets for", row.symbol, ":", inserted);
    } catch (err) {
      console.error("Ingestion failed for", row.symbol, ":", err instanceof Error ? err.message : err);
      if (err instanceof Error && err.stack) console.error(err.stack);
    }
  }

  // Set price_t0 for newly ingested posts (price at tweet time; required for outcome tracking)
  const postsWithoutPrice = await pool.query(
    `SELECT p.id, p.asset_id, p.posted_at, a.coingecko_id
     FROM posts p
     JOIN assets a ON a.id = p.asset_id
     WHERE p.price_t0 IS NULL AND a.coingecko_id IS NOT NULL`
  );
  const numWithoutPrice = (postsWithoutPrice.rows as unknown[]).length;
  console.log("Starting price_t0 backfill for", numWithoutPrice, "posts (delay", COINGECKO_DELAY_MS, "ms between requests)");
  for (const row of postsWithoutPrice.rows as Array<{ id: string; asset_id: number; posted_at: Date; coingecko_id: string }>) {
    const postedAt = new Date(row.posted_at);
    const price = await getPriceAtTimeUsd(row.coingecko_id, postedAt);
    if (price != null && price > 0) {
      await pool.query("UPDATE posts SET price_t0 = $1 WHERE id = $2", [price, row.id]);
    }
    await sleep(COINGECKO_DELAY_MS);
  }

  console.log("Starting outcome tracking");
  await runOutcomeTracking(pool);

  console.log("Starting scoring");
  await runScoring(pool);

  console.log("Daily trending batch complete.");
}

async function main() {
  const pool = getPool();
  const r = await pool.query("SELECT 1");
  console.log("Worker (daily) connected to DB, rows:", r.rowCount);

  const now = new Date();
  const windowEnd = new Date(now.getTime() - 30 * 1000); // X API requires end_time ≥ 10s in the past
  const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  console.log("Trending window:", windowStart.toISOString(), "→", windowEnd.toISOString());

  await runDailyTrendingBatch(windowStart, windowEnd);
}

// Only run main when this file is executed as the entrypoint (e.g. node worker-daily.js), not when imported by tests
const isEntrypoint =
  typeof process !== "undefined" &&
  process.argv[1] != null &&
  process.argv[1].includes("worker-daily");
if (isEntrypoint) {
  main().catch((e) => {
    console.error("Worker failed:", e instanceof Error ? e.stack : e);
    process.exit(1);
  });
}

