/**
 * Price at T=0 (post time). MVP: CoinGecko simple/price (current price).
 * For true T=0 historical price, use market_chart or Birdeye later.
 */
const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

export async function getCurrentPriceUsd(coinGeckoId: string): Promise<number | null> {
  const url = new URL(`${COINGECKO_BASE}/simple/price`);
  url.searchParams.set("ids", coinGeckoId);
  url.searchParams.set("vs_currencies", "usd");

  const key = process.env.COINGECKO_API_KEY;
  const headers: Record<string, string> = {};
  if (key) headers["x-cg-demo-api-key"] = key;

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) return null;

  const data = (await res.json()) as Record<string, { usd?: number }>;
  const price = data[coinGeckoId]?.usd;
  return typeof price === "number" ? price : null;
}
