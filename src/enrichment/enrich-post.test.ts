import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Pool } from "pg";
import { enrichPost } from "./enrich-post.js";
import type { PersistibleTweet } from "../ingestion/types.js";

vi.mock("./resolve-and-insert.js", () => ({
  resolveAsset: vi.fn(),
}));
vi.mock("./asset-resolver.js", () => ({
  getCoinGeckoId: vi.fn(),
}));
vi.mock("./price-snapshot.js", () => ({
  getCurrentPriceUsd: vi.fn(),
}));

const { resolveAsset } = await import("./resolve-and-insert.js");
const { getCoinGeckoId } = await import("./asset-resolver.js");
const { getCurrentPriceUsd } = await import("./price-snapshot.js");

describe("enrich-post", () => {
  let pool: Pool;
  const tweet: PersistibleTweet = {
    id: "100",
    author_id: "200",
    handle: "bob",
    text: "$SOL moon",
    created_at: "2026-03-09T12:00:00.000Z",
    raw: {
      data: { entities: { symbols: [{ tag: "SOL" }] } },
      includes: { users: [{ id: "200", public_metrics: { followers_count: 100 } }] },
    },
  };

  beforeEach(() => {
    pool = { query: vi.fn().mockResolvedValue({ rowCount: 1 }) } as unknown as Pool;
    vi.mocked(resolveAsset).mockReset().mockResolvedValue(1);
    vi.mocked(getCoinGeckoId).mockReset().mockReturnValue("solana");
    vi.mocked(getCurrentPriceUsd).mockReset().mockResolvedValue(142.5);
  });

  it("updates post with asset_id and price_t0, updates account metadata", async () => {
    await enrichPost(pool, tweet);
    expect(resolveAsset).toHaveBeenCalledWith(pool, "SOL");
    expect(getCurrentPriceUsd).toHaveBeenCalledWith("solana");
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE posts SET asset_id"),
      [1, 142.5, "bullish", "100"]
    );
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE accounts SET metadata"),
      [expect.any(String), "200"]
    );
  });

  it("does nothing for asset when no symbols in raw, but still sets sentiment", async () => {
    await enrichPost(pool, { ...tweet, raw: { data: {} } });
    expect(resolveAsset).not.toHaveBeenCalled();
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE posts SET sentiment"),
      ["bullish", "100"]
    );
  });

  it("updates post only when asset resolved, skips account metadata when empty", async () => {
    vi.mocked(resolveAsset).mockResolvedValue(2);
    await enrichPost(pool, { ...tweet, raw: { data: { entities: { symbols: [{ tag: "BTC" }] } } } });
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE posts"),
      [2, expect.any(Number), "bullish", "100"]
    );
  });
});
