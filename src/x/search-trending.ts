import type { Pool } from "pg";

export interface XTweet {
  id: string;
  text: string;
  created_at: string;
  author_id: string;
}

interface XSearchResponse {
  data?: Array<{
    id: string;
    text: string;
    created_at: string;
    author_id: string;
  }>;
  includes?: {
    users?: Array<{
      id: string;
      username: string;
      verified?: boolean;
      verified_type?: string | null;
    }>;
  };
  meta?: {
    next_token?: string;
  };
}

const X_SEARCH_URL = "https://api.twitter.com/2/tweets/search/recent";

export async function searchVerifiedTweetsForSymbol(
  symbol: string,
  windowStart: Date,
  windowEnd: Date,
  limitPerAsset: number
): Promise<XSearchResponse[]> {
  const bearer = process.env.X_API_BEARER_TOKEN;
  if (!bearer) throw new Error("X_API_BEARER_TOKEN is required for search");

  const query = `$${symbol.toUpperCase()} lang:en -is:retweet is:verified`;
  const headers = {
    Authorization: `Bearer ${bearer}`,
    "Content-Type": "application/json",
  };

  const results: XSearchResponse[] = [];
  let nextToken: string | undefined;
  let collected = 0;

  console.log(
    `[X] Fetching tweets for $${symbol} (window ${windowStart.toISOString()} – ${windowEnd.toISOString()}, limit ${limitPerAsset})`
  );

  while (collected < limitPerAsset) {
    const url = new URL(X_SEARCH_URL);
    url.searchParams.set("query", query);
    url.searchParams.set("max_results", "100");
    url.searchParams.set("start_time", windowStart.toISOString());
    url.searchParams.set("end_time", windowEnd.toISOString());
    url.searchParams.set(
      "tweet.fields",
      "created_at,author_id"
    );
    url.searchParams.set("expansions", "author_id");
    url.searchParams.set("user.fields", "username,verified,verified_type");
    if (nextToken) url.searchParams.set("next_token", nextToken);

    const res = await fetch(url.toString(), { headers });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`X search failed ${res.status}: ${text}`);
    }
    const data = (await res.json()) as XSearchResponse;
    const batchCount = data.data?.length ?? 0;
    if (batchCount > 0) {
      console.log(`[X] $${symbol}: received ${batchCount} tweets (total collected: ${collected + batchCount})`);
    }
    if (batchCount === 0) break;
    results.push(data);
    collected += batchCount;
    nextToken = data.meta?.next_token;
    if (!nextToken) break;
  }

  console.log(`[X] $${symbol}: fetch complete, ${collected} tweets in ${results.length} batch(es)`);
  return results;
}

export async function ingestTrendingTweetsForAsset(
  pool: Pool,
  assetId: number,
  symbol: string,
  windowStart: Date,
  windowEnd: Date,
  limitPerAsset: number
): Promise<number> {
  const responses = await searchVerifiedTweetsForSymbol(
    symbol,
    windowStart,
    windowEnd,
    limitPerAsset
  );
  let inserted = 0;

  for (const resp of responses) {
    const users = resp.includes?.users ?? [];
    const data = resp.data ?? [];
    for (const t of data) {
      const user = users.find((u) => u.id === t.author_id);
      const handle = user?.username ?? "";
      const verified =
        user?.verified === true ||
        (user?.verified_type && user.verified_type !== "none");

      await pool.query(
        `INSERT INTO accounts (id, handle, metadata, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (id) DO UPDATE SET
           handle = COALESCE(EXCLUDED.handle, accounts.handle),
           metadata = COALESCE(accounts.metadata, '{}'::jsonb) || EXCLUDED.metadata,
           updated_at = NOW()`,
        [
          t.author_id,
          handle,
          JSON.stringify({ verified }),
        ]
      );

      await pool.query(
        `INSERT INTO posts (id, account_id, asset_id, content_snippet, posted_at, raw_json, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [
          t.id,
          t.author_id,
          assetId,
          t.text.slice(0, 500),
          new Date(t.created_at),
          JSON.stringify(t),
        ]
      );
      inserted++;
    }
  }

  console.log(`[X] $${symbol}: ingested ${inserted} posts (asset_id=${assetId})`);
  return inserted;
}

