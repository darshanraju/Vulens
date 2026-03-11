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
import { getCurrentPriceUsd } from "./enrichment/price-snapshot.js";
import { runOutcomeTracking } from "./outcomes/outcome-tracking.js";
import { runScoring } from "./scoring/compute-account-score.js";

const DEFAULT_TWEET_LIMIT_PER_ASSET = Number(process.env.TRENDING_BATCH_LIMIT_PER_ASSET || "500");

export async function runDailyTrendingBatch(
  windowStart: Date,
  windowEnd: Date
): Promise<void> {
  const pool = getPool();
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

  // Set price_t0 for newly ingested posts (required for outcome tracking)
  const postsWithoutPrice = await pool.query(
    `SELECT p.id, p.asset_id, a.coingecko_id
     FROM posts p
     JOIN assets a ON a.id = p.asset_id
     WHERE p.price_t0 IS NULL AND a.coingecko_id IS NOT NULL`
  );
  const priceByAsset = new Map<number, number>();
  for (const row of postsWithoutPrice.rows as Array<{ id: string; asset_id: number; coingecko_id: string }>) {
    let price = priceByAsset.get(row.asset_id);
    if (price === undefined) {
      price = (await getCurrentPriceUsd(row.coingecko_id)) ?? 0;
      priceByAsset.set(row.asset_id, price);
    }
    if (price > 0) {
      await pool.query("UPDATE posts SET price_t0 = $1 WHERE id = $2", [price, row.id]);
    }
  }

  await runOutcomeTracking(pool);
  await runScoring(pool);

  console.log("Daily trending batch complete.");
}

async function main() {
  const pool = getPool();
  const r = await pool.query("SELECT 1");
  console.log("Worker (daily) connected to DB, rows:", r.rowCount);

  const now = new Date();
  const windowEnd = now;
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
    console.error(e);
    process.exit(1);
  });
}

