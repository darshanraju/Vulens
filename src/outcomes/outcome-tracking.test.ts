import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Pool } from "pg";
import {
  windowToInterval,
  addIntervalToPostedAt,
  computePctDelta,
  getPostsDueForOutcome,
  runOutcomeTrackingForWindow,
  runOutcomeTracking,
} from "./outcome-tracking.js";

vi.mock("../enrichment/price-snapshot.js", () => ({
  getPriceAtTimeUsd: vi.fn(),
}));

const { getPriceAtTimeUsd } = await import("../enrichment/price-snapshot.js");

describe("outcome-tracking", () => {
  describe("windowToInterval", () => {
    it("maps 1h to 1 hour", () => {
      expect(windowToInterval("1h")).toBe("1 hour");
    });
    it("maps 4h to 4 hours", () => {
      expect(windowToInterval("4h")).toBe("4 hours");
    });
    it("maps 12h to 12 hours", () => {
      expect(windowToInterval("12h")).toBe("12 hours");
    });
    it("maps 24h to 24 hours", () => {
      expect(windowToInterval("24h")).toBe("24 hours");
    });
  });

  describe("addIntervalToPostedAt", () => {
    it("adds 1 hour to posted_at", () => {
      const posted = new Date("2024-06-15T10:00:00.000Z");
      expect(addIntervalToPostedAt(posted, "1h")).toEqual(new Date("2024-06-15T11:00:00.000Z"));
    });
  });

  describe("computePctDelta", () => {
    it("returns 0 when price_t0 is 0", () => {
      expect(computePctDelta(0, 100)).toBe(0);
    });
    it("computes positive delta", () => {
      expect(computePctDelta(100, 110)).toBe(10);
    });
    it("computes negative delta", () => {
      expect(computePctDelta(100, 90)).toBe(-10);
    });
    it("rounds to 4 decimal places", () => {
      expect(computePctDelta(100, 100.1234)).toBe(0.1234);
    });
  });

  describe("getPostsDueForOutcome", () => {
    it("returns due posts with asset, coingecko_id, and posted_at", async () => {
      const postedAt = new Date("2024-06-15T09:00:00.000Z");
      const pool = {
        query: vi.fn().mockResolvedValue({
          rows: [
            {
              post_id: 101,
              asset_id: 1,
              posted_at: postedAt,
              price_t0: "42.5",
              coingecko_id: "solana",
            },
          ],
        }),
      } as unknown as Pool;
      const result = await getPostsDueForOutcome(pool, "1h");
      expect(result).toHaveLength(1);
      expect(result[0].post_id).toBe(101);
      expect(result[0].asset_id).toBe(1);
      expect(result[0].price_t0).toBe("42.5");
      expect(result[0].coingecko_id).toBe("solana");
      expect(new Date(result[0].posted_at).getTime()).toBe(postedAt.getTime());
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("posted_at +"),
        ["1 hour", "1h"]
      );
    });
  });

  describe("runOutcomeTrackingForWindow", () => {
    let pool: Pool;
    const postedAt = new Date("2024-06-15T09:00:00.000Z");
    const targetTime1h = new Date("2024-06-15T10:00:00.000Z");

    beforeEach(() => {
      pool = {
        query: vi.fn()
          .mockResolvedValueOnce({
            rows: [
              {
                post_id: 1,
                asset_id: 1,
                posted_at: postedAt,
                price_t0: "100",
                coingecko_id: "bitcoin",
              },
            ],
          })
          .mockResolvedValue({ rowCount: 1 }),
      } as unknown as Pool;
      vi.mocked(getPriceAtTimeUsd).mockReset().mockResolvedValue(105);
    });

    it("fetches price at posted_at + window, computes pct_delta, inserts outcome", async () => {
      const { processed, errors } = await runOutcomeTrackingForWindow(pool, "1h");
      expect(processed).toBe(1);
      expect(errors).toBe(0);
      expect(getPriceAtTimeUsd).toHaveBeenCalledWith("bitcoin", targetTime1h);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO outcomes"),
        [1, "1h", 105, 5]
      );
    });

    it("uses ON CONFLICT DO NOTHING for idempotency", async () => {
      await runOutcomeTrackingForWindow(pool, "1h");
      const insertCall = vi.mocked(pool.query).mock.calls.find((c) =>
        String(c[0]).includes("INSERT INTO outcomes")
      );
      expect(insertCall?.[0]).toMatch(/ON CONFLICT \(post_id, "window"\) DO NOTHING/);
    });

    it("counts errors when coingecko_id is null", async () => {
      pool = {
        query: vi.fn()
          .mockResolvedValueOnce({
            rows: [
              {
                post_id: 2,
                asset_id: 2,
                posted_at: new Date(),
                price_t0: "1",
                coingecko_id: null,
              },
            ],
          })
          .mockResolvedValue({ rowCount: 1 }),
      } as unknown as Pool;
      const { processed, errors } = await runOutcomeTrackingForWindow(pool, "4h");
      expect(processed).toBe(0);
      expect(errors).toBe(1);
    });

    it("counts errors when getPriceAtTimeUsd returns null", async () => {
      vi.mocked(getPriceAtTimeUsd).mockResolvedValue(null);
      const { processed, errors } = await runOutcomeTrackingForWindow(pool, "1h");
      expect(processed).toBe(0);
      expect(errors).toBe(1);
    });
  });

  describe("runOutcomeTracking", () => {
    it("runs for all four windows (1h, 4h, 12h, 24h)", async () => {
      const pool = { query: vi.fn().mockResolvedValue({ rows: [] }) } as unknown as Pool;
      await runOutcomeTracking(pool);
      expect(pool.query).toHaveBeenCalled();
      const intervals = vi.mocked(pool.query).mock.calls
        .filter((c) => String(c[0]).includes("posted_at +"))
        .map((c) => c[1][0]);
      expect(intervals).toEqual(["1 hour", "4 hours", "12 hours", "24 hours"]);
    });
  });
});
