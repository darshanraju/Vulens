import type { Pool } from "pg";

/**
 * Resolve symbol to asset_id. Upserts into assets table; returns id.
 * Uses static CoinGecko id map for MVP.
 */
import { getCoinGeckoId } from "./asset-resolver.js";

export async function resolveAsset(pool: Pool, symbol: string): Promise<number | null> {
  const coingeckoId = getCoinGeckoId(symbol);
  const sym = symbol.toUpperCase().trim();

  const existing = await pool.query(
    "SELECT id FROM assets WHERE symbol = $1",
    [sym]
  );
  if (existing.rowCount && existing.rows[0]) {
    return (existing.rows[0] as { id: number }).id;
  }

  if (!coingeckoId) {
    return null;
  }

  const insert = await pool.query(
    `INSERT INTO assets (symbol, coingecko_id, created_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (symbol) DO UPDATE SET coingecko_id = COALESCE(assets.coingecko_id, EXCLUDED.coingecko_id)
     RETURNING id`,
    [sym, coingeckoId]
  );
  const row = insert.rows[0] as { id: number } | undefined;
  return row?.id ?? null;
}
