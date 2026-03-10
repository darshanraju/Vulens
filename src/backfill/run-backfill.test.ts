import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Pool } from "pg";
import { runBackfill } from "./run-backfill.js";

vi.mock("../outcomes/outcome-tracking.js", () => ({ runOutcomeTracking: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../scoring/compute-account-score.js", () => ({ runScoring: vi.fn().mockResolvedValue({ updated: 2 }) }));
vi.mock("../sentiment/backfill-sentiment.js", () => ({ backfillSentiment: vi.fn().mockResolvedValue({ updated: 0 }) }));

describe("run-backfill", () => {
  let pool: Pool;

  beforeEach(() => {
    pool = { query: vi.fn().mockResolvedValue({ rows: [] }) } as unknown as Pool;
    vi.clearAllMocks();
  });

  it("runs outcome tracking, scoring, and sentiment backfill", async () => {
    const { runOutcomeTracking } = await import("../outcomes/outcome-tracking.js");
    const { runScoring } = await import("../scoring/compute-account-score.js");
    const { backfillSentiment } = await import("../sentiment/backfill-sentiment.js");
    vi.mocked(backfillSentiment).mockResolvedValueOnce({ updated: 5 }).mockResolvedValueOnce({ updated: 0 });

    const result = await runBackfill(pool, { outcomeWindowDelayMs: 0, sentiment: true });

    expect(result.outcomesDone).toBe(true);
    expect(result.scoringUpdated).toBe(2);
    expect(result.sentimentUpdated).toBe(5);
    expect(runOutcomeTracking).toHaveBeenCalled();
    expect(runScoring).toHaveBeenCalledWith(pool);
    expect(backfillSentiment).toHaveBeenCalledWith(pool, 500);
  });

  it("skips sentiment when option is false", async () => {
    const { backfillSentiment } = await import("../sentiment/backfill-sentiment.js");
    vi.mocked(backfillSentiment).mockClear();

    const result = await runBackfill(pool, { outcomeWindowDelayMs: 0, sentiment: false });

    expect(result.sentimentUpdated).toBe(0);
    expect(backfillSentiment).not.toHaveBeenCalled();
  });
});
