/**
 * Dev-only: patch global fetch to return mock CoinGecko + X data when USE_MOCK_X=true.
 * Load this before the server so the worker sees mocked requests.
 */
if (process.env.USE_MOCK_X !== "true") {
  throw new Error("dev-mock-fetch must only be loaded when USE_MOCK_X=true");
}

const originalFetch = globalThis.fetch;

const MOCK_TRENDING = {
  coins: [
    { item: { id: "pepe", symbol: "pepe" } },
    { item: { id: "dogwifhat", symbol: "wif" } },
    { item: { id: "bitcoin", symbol: "btc" } },
  ],
};

const MOCK_SYMBOLS = ["PEPE", "WIF", "BTC"] as const;
function symbolIndex(symbol: string): number {
  const i = MOCK_SYMBOLS.indexOf(symbol.toUpperCase() as (typeof MOCK_SYMBOLS)[number]);
  return i >= 0 ? i : 0;
}

function mockTweetsForSymbol(symbol: string, count = 3): { data: unknown[]; includes: { users: unknown[] }; meta: object } {
  const now = new Date();
  const symIndex = symbolIndex(symbol);
  const data = [];
  const users = [];
  for (let i = 0; i < count; i++) {
    const authorId = String(900000 + symIndex * 20 + i);
    const id = String(800000 + symIndex * 20 + i);
    data.push({
      id,
      text: `$${symbol} mock tweet #${i + 1} — to the moon 🚀`,
      created_at: new Date(now.getTime() - (count - i) * 3600 * 1000).toISOString(),
      author_id: authorId,
    });
    users.push({
      id: authorId,
      username: `mock_${symbol.toLowerCase()}_${i}`,
      verified: true,
      verified_type: "blue",
    });
  }
  return { data, includes: { users }, meta: {} };
}

globalThis.fetch = async function mockFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const url = typeof input === "string" ? input : (input as URL).toString();
  const urlObj = new URL(url);

  // CoinGecko trending
  if (urlObj.hostname.includes("api.coingecko.com") && url.includes("/search/trending")) {
    return new Response(JSON.stringify(MOCK_TRENDING), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // CoinGecko market_chart/range (historical price)
  if (urlObj.hostname.includes("api.coingecko.com") && url.includes("/market_chart/range")) {
    const from = urlObj.searchParams.get("from");
    const ts = from ? Number(from) * 1000 : Date.now();
    return new Response(
      JSON.stringify({
        prices: [[ts, 1.0], [ts + 3600000, 1.1]],
        market_caps: [],
        total_volumes: [],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // X (Twitter) search recent
  if (urlObj.hostname.includes("api.twitter.com") && urlObj.pathname.includes("/2/tweets/search/recent")) {
    const query = urlObj.searchParams.get("query") ?? "";
    const symbolMatch = /\$([A-Z0-9]+)/i.exec(query);
    const symbol = symbolMatch ? symbolMatch[1].toUpperCase() : "PEPE";
    const body = mockTweetsForSymbol(symbol);
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return originalFetch.call(globalThis, input, init);
};

console.log("[dev-mock] USE_MOCK_X: fetch patched for CoinGecko + X (mock tweets per symbol).");
