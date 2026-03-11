/**
 * Price at T=0 (post time). Uses CoinGecko historical market_chart/range for true T=0 and T+window prices.
 */
const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

/** Response from /coins/{id}/market_chart/range — prices are [timestamp_ms, price] */
interface MarketChartRangeResponse {
  prices?: Array<[number, number]>;
}

/**
 * Get USD price at a specific time via CoinGecko market_chart/range.
 * Returns the price from the point closest to `at` within a narrow range, or null on error/empty.
 */
export async function getPriceAtTimeUsd(
  coinGeckoId: string,
  at: Date
): Promise<number | null> {
  const atMs = at.getTime();
  const windowMs = 60 * 60 * 1000; // ±1 hour
  const from = Math.floor((atMs - windowMs) / 1000);
  const to = Math.ceil((atMs + windowMs) / 1000);

  const url = new URL(`${COINGECKO_BASE}/coins/${encodeURIComponent(coinGeckoId)}/market_chart/range`);
  url.searchParams.set("vs_currency", "usd");
  url.searchParams.set("from", String(from));
  url.searchParams.set("to", String(to));

  const key = process.env.COINGECKO_API_KEY;
  const headers: Record<string, string> = {};
  if (key) headers["x-cg-demo-api-key"] = key;

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) return null;

  const data = (await res.json()) as MarketChartRangeResponse;
  const prices = data.prices;
  if (!Array.isArray(prices) || prices.length === 0) return null;

  let best: [number, number] = prices[0];
  let bestDiff = Math.abs(prices[0][0] - atMs);
  for (let i = 1; i < prices.length; i++) {
    const diff = Math.abs(prices[i][0] - atMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = prices[i];
    }
  }
  return typeof best[1] === "number" ? best[1] : null;
}
