import { describe, it, beforeAll, beforeEach, expect, vi } from "vitest";
import request from "supertest";
import { app } from "../api.js";
import { applyMigrations, resetDatabase, isE2EDatabaseAvailable } from "../test-utils/db.js";
import { installMockFetch, resetMockFetch, mockCoinGeckoTrending, mockCoinGeckoPrice, mockXSearch } from "../test-utils/mock-fetch.js";
import { runDailyTrendingBatch } from "../worker-daily.js";
import { getPool } from "../db/index.js";

const USE_REAL_X = process.env.USE_REAL_X === "true";

describe.skipIf(!isE2EDatabaseAvailable())("E2E: trending API", () => {
  beforeAll(async () => {
    await applyMigrations();
    if (!USE_REAL_X) {
      installMockFetch();
      const priceSnapshot = await import("../enrichment/price-snapshot.js");
      vi.spyOn(priceSnapshot, "getPriceAtTimeUsd").mockImplementation(
        async (_id: string, at: Date) => {
          const t = at.getTime();
          const tweetTime = new Date("2026-03-10T10:00:00.000Z").getTime();
          return Math.abs(t - tweetTime) < 60 * 1000 ? 1.0 : 1.1;
        }
      );
    }
  });

  beforeEach(async () => {
    await resetDatabase();
    if (!USE_REAL_X) {
      resetMockFetch();
    }
  });

  async function seedWithMockedBatch() {
    const windowEnd = new Date("2026-03-10T12:00:00.000Z");
    const windowStart = new Date(windowEnd.getTime() - 24 * 60 * 60 * 1000);

    mockCoinGeckoTrending({
      coins: [
        { item: { id: "pepe", symbol: "pepe" } },
        { item: { id: "dogwifhat", symbol: "wif" } },
      ],
    });
    mockCoinGeckoPrice({
      pepe: { usd: 1.0 },
      dogwifhat: { usd: 2.0 },
    });

    mockXSearch({
      PEPE: {
        data: [
          {
            id: "2000",
            text: "$PEPE alpha",
            created_at: "2026-03-10T10:00:00.000Z",
            author_id: "300",
          },
        ],
        includes: {
          users: [{ id: "300", username: "alpha", verified: true }],
        },
        meta: {},
      },
      WIF: {
        data: [],
        includes: { users: [] },
        meta: {},
      },
    });

    await runDailyTrendingBatch(windowStart, windowEnd);
  }

  it("GET /trending-assets lists trending assets", async () => {
    if (USE_REAL_X) return;
    await seedWithMockedBatch();
    const res = await request(app).get("/trending-assets");
    expect(res.status).toBe(200);
    const symbols = res.body.trending.map((t: any) => t.symbol).sort();
    expect(symbols).toEqual(["PEPE", "WIF"]);
  });

  it("GET /trending-assets/:id/posts returns posts with outcomes", async () => {
    if (USE_REAL_X) return;
    await seedWithMockedBatch();
    const pool = getPool();
    const assetRes = await pool.query("SELECT id FROM assets WHERE symbol = 'PEPE'");
    const assetId = assetRes.rows[0].id;

    const res = await request(app).get(`/trending-assets/${assetId}/posts?limit=10`);
    expect(res.status).toBe(200);
    expect(res.body.posts).toHaveLength(1);
    const post = res.body.posts[0];
    expect(post.handle).toBe("alpha");
    expect(post.outcomes).toBeDefined();
  });

  it("GET /trending-assets/:id/leaderboard ranks accounts for that asset", async () => {
    if (USE_REAL_X) return;
    await seedWithMockedBatch();
    const pool = getPool();
    const assetRes = await pool.query("SELECT id FROM assets WHERE symbol = 'PEPE'");
    const assetId = assetRes.rows[0].id;

    const res = await request(app).get(`/trending-assets/${assetId}/leaderboard?limit=10`);
    expect(res.status).toBe(200);
    expect(res.body.leaderboard.length).toBeGreaterThanOrEqual(1);
  });

  it("GET /leaderboard returns global trending influence", async () => {
    if (USE_REAL_X) return;
    await seedWithMockedBatch();
    const res = await request(app).get("/leaderboard?limit=5");
    expect(res.status).toBe(200);
    expect(res.body.leaderboard.length).toBeGreaterThanOrEqual(1);
  });
});

