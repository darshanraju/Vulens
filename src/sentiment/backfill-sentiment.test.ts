import { describe, it, expect, vi } from "vitest";
import type { Pool } from "pg";
import { backfillSentiment } from "./backfill-sentiment.js";

vi.mock("./classify.js", () => ({
  classifySentiment: vi.fn((t: string) => (t.includes("moon") ? "bullish" : "neutral")),
}));

describe("backfill-sentiment", () => {
  it("updates posts with null sentiment from content_snippet", async () => {
    const pool = {
      query: vi.fn()
        .mockResolvedValueOnce({
          rows: [
            { id: "1", content_snippet: "to the moon", raw_json: null },
            { id: "2", content_snippet: "hello", raw_json: null },
          ],
        })
        .mockResolvedValue({ rowCount: 1 }),
    } as unknown as Pool;
    const { updated } = await backfillSentiment(pool, 500);
    expect(updated).toBe(2);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE posts SET sentiment"),
      ["bullish", "1"]
    );
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE posts SET sentiment"),
      ["neutral", "2"]
    );
  });
});
