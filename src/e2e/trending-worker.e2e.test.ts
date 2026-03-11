import { describe, it, beforeAll, beforeEach, expect, vi } from "vitest";
import { applyMigrations, resetDatabase, isE2EDatabaseAvailable } from "../test-utils/db.js";
import { installMockFetch, resetMockFetch, mockCoinGeckoTrending, mockCoinGeckoPrice, mockXSearch } from "../test-utils/mock-fetch.js";
import { runDailyTrendingBatch } from "../worker-daily.js";
import { getPool } from "../db/index.js";

const USE_REAL_X = process.env.USE_REAL_X === "true";

describe.skipIf(!isE2EDatabaseAvailable())("E2E: worker-daily", () => {
  beforeAll(async () => {
    await applyMigrations();
    if (!USE_REAL_X) {
      installMockFetch();
    }
  });

  beforeEach(async () => {
    await resetDatabase();
    if (!USE_REAL_X) {
      resetMockFetch();
    }
  });

  it("runs happy path with one trending asset and tweets (mocked X)", async () => {
    if (USE_REAL_X) {
      // In real-X mode we skip strict assertions here because external data is non-deterministic.
      return;
    }

    const windowEnd = new Date("2026-03-10T12:00:00.000Z");
    const windowStart = new Date(windowEnd.getTime() - 24 * 60 * 60 * 1000);

    // Mock CoinGecko trending and price
    mockCoinGeckoTrending({
      coins: [
        { item: { id: "pepe", symbol: "pepe" } },
      ],
    });
    mockCoinGeckoPrice({
      pepe: { usd: 1.0 },
    });

    // Mock X search: two verified tweets for $PEPE
    mockXSearch({
      PEPE: {
        data: [
          {
            id: "1000",
            text: "$PEPE to the moon",
            created_at: "2026-03-10T10:00:00.000Z",
            author_id: "200",
          },
          {
            id: "1001",
            text: "Still bullish on $PEPE",
            created_at: "2026-03-10T09:00:00.000Z",
            author_id: "201",
          },
        ],
        includes: {
          users: [
            { id: "200", username: "alice", verified: true },
            { id: "201", username: "bob", verified: true },
          ],
        },
        meta: {},
      },
    });

    // Stub getPriceAtTimeUsd: price at tweet time = 1.0, at window times = 1.1 so pct_delta > 0
    const priceSnapshot = await import("../enrichment/price-snapshot.js");
    vi.spyOn(priceSnapshot, "getPriceAtTimeUsd").mockImplementation(
      async (_id: string, at: Date) => {
        const t = at.getTime();
        const tweetTimes = [
          new Date("2026-03-10T09:00:00.000Z").getTime(),
          new Date("2026-03-10T10:00:00.000Z").getTime(),
        ];
        const isTweetTime = tweetTimes.some((t0) => Math.abs(t - t0) < 60 * 1000);
        return isTweetTime ? 1.0 : 1.1;
      }
    );

    await runDailyTrendingBatch(windowStart, windowEnd);

    const pool = getPool();
    const assets = await pool.query("SELECT * FROM assets");
    expect(assets.rows).toHaveLength(1);
    expect(assets.rows[0].symbol).toBe("PEPE");

    const trending = await pool.query("SELECT * FROM asset_trending");
    expect(trending.rows).toHaveLength(1);

    const accounts = await pool.query("SELECT * FROM accounts ORDER BY id");
    expect(accounts.rows).toHaveLength(2);

    const posts = await pool.query("SELECT * FROM posts ORDER BY id");
    expect(posts.rows).toHaveLength(2);

    const outcomes = await pool.query('SELECT * FROM outcomes ORDER BY post_id, "window"');
    expect(outcomes.rows.length).toBeGreaterThanOrEqual(2); // at least 1 window per post
  });
});

