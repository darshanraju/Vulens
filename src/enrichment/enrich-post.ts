import type { Pool } from "pg";
import type { PersistibleTweet } from "../ingestion/types.js";
import { getCoinGeckoId } from "./asset-resolver.js";
import { resolveAsset } from "./resolve-and-insert.js";
import { getCurrentPriceUsd } from "./price-snapshot.js";
import { extractAccountMetadata } from "./account-metadata.js";
import { classifySentiment } from "../sentiment/classify.js";

/**
 * Enrich a post after ingestion: resolve asset, set price_t0, update account metadata.
 * Run in same process as ingestion (single worker).
 */
export async function enrichPost(pool: Pool, tweet: PersistibleTweet): Promise<void> {
  const sentiment = classifySentiment(tweet.text);
  const raw = tweet.raw as { data?: { entities?: { symbols?: Array<{ tag: string }> } } };
  const symbols = raw?.data?.entities?.symbols?.map((s) => s.tag) ?? [];
  const symbol = symbols[0];

  if (symbol) {
    const assetId = await resolveAsset(pool, symbol);
    if (assetId !== null) {
      const coingeckoId = getCoinGeckoId(symbol);
      let priceT0: number | null = null;
      if (coingeckoId) {
        priceT0 = await getCurrentPriceUsd(coingeckoId);
      }
      await pool.query(
        `UPDATE posts SET asset_id = $1, price_t0 = $2, sentiment = $3, created_at = NOW() WHERE id = $4`,
        [assetId, priceT0, sentiment, tweet.id]
      );
    } else {
      await pool.query(
        `UPDATE posts SET sentiment = $1, created_at = NOW() WHERE id = $2`,
        [sentiment, tweet.id]
      );
    }
  } else {
    await pool.query(
      `UPDATE posts SET sentiment = $1, created_at = NOW() WHERE id = $2`,
      [sentiment, tweet.id]
    );
  }

  const meta = extractAccountMetadata(tweet.raw, tweet.author_id);
  if (Object.keys(meta).length > 0) {
    await pool.query(
      `UPDATE accounts SET metadata = COALESCE(metadata, '{}') || $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(meta), tweet.author_id]
    );
  }
}
