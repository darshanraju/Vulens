import { describe, it, expect, vi } from "vitest";
import type { Pool } from "pg";
import {
  callScoreFromPctDeltas,
  recencyWeight,
  vuScoreFromWeightedAccuracy,
  computeVuScoreForAccount,
  runScoring,
  type AccountScoreRow,
} from "./compute-account-score.js";

describe("scoring", () => {
  describe("callScoreFromPctDeltas", () => {
    it("returns 1 when average is positive", () => {
      expect(callScoreFromPctDeltas([1, 2, 3])).toBe(1);
      expect(callScoreFromPctDeltas([0.1])).toBe(1);
    });
    it("returns 0 when average is negative", () => {
      expect(callScoreFromPctDeltas([-1, -2])).toBe(0);
      expect(callScoreFromPctDeltas([-0.1])).toBe(0);
    });
    it("returns 0.5 when average is zero or no data", () => {
      expect(callScoreFromPctDeltas([0, 0])).toBe(0.5);
      expect(callScoreFromPctDeltas([])).toBe(0.5);
    });
  });

  describe("recencyWeight", () => {
    it("returns 2 for last 30 days", () => {
      const now = new Date("2026-03-09T12:00:00Z");
      const posted = new Date("2026-03-01T12:00:00Z");
      expect(recencyWeight(posted, now)).toBe(2);
    });
    it("returns 1 for 31–90 days", () => {
      const now = new Date("2026-03-09T12:00:00Z");
      const posted = new Date("2026-01-01T12:00:00Z");
      expect(recencyWeight(posted, now)).toBe(1);
    });
  });

  describe("vuScoreFromWeightedAccuracy", () => {
    it("returns null when weightTotal is 0", () => {
      expect(vuScoreFromWeightedAccuracy(0, 0)).toBeNull();
    });
    it("returns 100 when weighted sum equals total", () => {
      expect(vuScoreFromWeightedAccuracy(10, 10)).toBe(100);
    });
    it("clamps to 0–100", () => {
      expect(vuScoreFromWeightedAccuracy(-1, 1)).toBe(0);
      expect(vuScoreFromWeightedAccuracy(2, 1)).toBe(100);
    });
    it("rounds to 2 decimals", () => {
      expect(vuScoreFromWeightedAccuracy(33.333, 100)).toBe(33.33);
    });
  });

  describe("computeVuScoreForAccount", () => {
    it("returns null for empty rows", () => {
      expect(computeVuScoreForAccount([])).toBeNull();
    });
    it("computes from weighted call scores", () => {
      const now = new Date("2026-03-09T12:00:00Z");
      const rows: AccountScoreRow[] = [
        { account_id: "1", posted_at: new Date("2026-03-01T12:00:00Z"), pct_deltas: [5, 10] }, // score 1, weight 2
        { account_id: "1", posted_at: new Date("2026-01-01T12:00:00Z"), pct_deltas: [-1] },   // score 0, weight 1
      ];
      const score = computeVuScoreForAccount(rows, now);
      expect(score).toBe(66.67); // (1*2 + 0*1) / 3 * 100
    });
  });

  describe("runScoring", () => {
    it("updates accounts with VuScore", async () => {
      const pool = {
        query: vi.fn()
          .mockResolvedValueOnce({
            rows: [
              { account_id: "100", posted_at: new Date(), pct_deltas: [1, 2] },
            ],
          })
          .mockResolvedValue({ rowCount: 1 }),
      } as unknown as Pool;
      const result = await runScoring(pool);
      expect(result.updated).toBe(1);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE accounts SET vu_score"),
        [expect.any(Number), "100"]
      );
    });
    it("updates no accounts when no outcome data", async () => {
      const pool = { query: vi.fn().mockResolvedValue({ rows: [] }) } as unknown as Pool;
      const result = await runScoring(pool);
      expect(result.updated).toBe(0);
      expect(pool.query).toHaveBeenCalledTimes(1); // only SELECT
    });
  });
});
