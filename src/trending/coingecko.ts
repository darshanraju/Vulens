import type { Pool } from "pg";

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

export interface TrendingAsset {
  symbol: string;
  coingeckoId: string;
}

interface CoinGeckoTrendingResponse {
  coins: Array<{
    item: {
      id: string;
      symbol: string;
    };
  }>;
}

export async function fetchTrendingAssets(): Promise<TrendingAsset[]> {
  const url = new URL(`${COINGECKO_BASE}/search/trending`);
  const key = process.env.COINGECKO_API_KEY;
  const headers: Record<string, string> = {};
  if (key) headers["x-cg-demo-api-key"] = key;

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CoinGecko trending failed ${res.status}: ${text}`);
  }

  const data = (await res.json()) as CoinGeckoTrendingResponse;
  return data.coins.map((c) => ({
    symbol: c.item.symbol.toUpperCase(),
    coingeckoId: c.item.id,
  }));
}

export async function upsertTrendingAssets(
  pool: Pool,
  assets: TrendingAsset[],
  windowStart: Date,
  windowEnd: Date
): Promise<void> {
  for (const a of assets) {
    const assetRow = await pool.query(
      `INSERT INTO assets (symbol, coingecko_id, created_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (symbol) DO UPDATE SET
         coingecko_id = COALESCE(assets.coingecko_id, EXCLUDED.coingecko_id)
       RETURNING id`,
      [a.symbol, a.coingeckoId]
    );
    const assetId = (assetRow.rows[0] as { id: number }).id;
    await pool.query(
      `INSERT INTO asset_trending (asset_id, window_start, window_end, source)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (asset_id, window_start) DO NOTHING`,
      [assetId, windowStart, windowEnd, "coingecko-trending"]
    );
  }
}

