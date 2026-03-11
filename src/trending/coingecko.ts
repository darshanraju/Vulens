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

type CoinGeckoMarket = {
  id: string;
  symbol: string;
  market_cap: number | null;
};

const MAX_MARKET_CAP_USD = 30_000_000;

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
  const trending = data.coins.map((c) => ({
    symbol: c.item.symbol.toUpperCase(),
    coingeckoId: c.item.id,
  }));

  // CoinGecko "trending" doesn't include market cap; fetch markets data for filtering.
  const marketsUrl = new URL(`${COINGECKO_BASE}/coins/markets`);
  marketsUrl.searchParams.set("vs_currency", "usd");
  marketsUrl.searchParams.set("ids", trending.map((t) => t.coingeckoId).join(","));
  marketsUrl.searchParams.set("order", "market_cap_desc");
  marketsUrl.searchParams.set("per_page", "250");
  marketsUrl.searchParams.set("page", "1");
  marketsUrl.searchParams.set("sparkline", "false");

  const marketsRes = await fetch(marketsUrl.toString(), { headers });
  if (!marketsRes.ok) {
    const text = await marketsRes.text();
    throw new Error(`CoinGecko markets failed ${marketsRes.status}: ${text}`);
  }
  const markets = (await marketsRes.json()) as CoinGeckoMarket[];
  const marketCapById = new Map<string, number | null>();
  for (const m of markets) {
    marketCapById.set(m.id, m.market_cap ?? null);
  }

  return trending.filter((t) => {
    const mc = marketCapById.get(t.coingeckoId);
    return typeof mc === "number" && mc > 0 && mc < MAX_MARKET_CAP_USD;
  });
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

