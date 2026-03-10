/**
 * Phase 1f — Historical backfill: run outcome tracking and scoring in batch.
 * Strategy: process all due outcomes (respecting rate limits via delay), then run scoring.
 * Can be run as one-off (e.g. npm run backfill) or from worker on a schedule.
 */
import type { Pool } from "pg";
import { runOutcomeTracking } from "../outcomes/outcome-tracking.js";
import { runScoring } from "../scoring/compute-account-score.js";
import { backfillSentiment } from "../sentiment/backfill-sentiment.js";

export interface BackfillOptions {
  /** Delay in ms between outcome windows (CoinGecko rate limit). Default 2000. */
  outcomeWindowDelayMs?: number;
  /** Run sentiment backfill for posts with NULL sentiment. Default true. */
  sentiment?: boolean;
  /** Max posts per sentiment backfill batch. Default 500. */
  sentimentBatchSize?: number;
}

/**
 * Run full backfill: outcomes (with delay between windows) → scoring → optional sentiment.
 */
export async function runBackfill(
  pool: Pool,
  options: BackfillOptions = {}
): Promise<{ outcomesDone: boolean; scoringUpdated: number; sentimentUpdated: number }> {
  const {
    outcomeWindowDelayMs = 2000,
    sentiment = true,
    sentimentBatchSize = 500,
  } = options;

  await runOutcomeTracking(pool);
  for (let i = 0; i < 3; i++) {
    await new Promise((r) => setTimeout(r, outcomeWindowDelayMs));
    await runOutcomeTracking(pool);
  }
  const { updated: scoringUpdated } = await runScoring(pool);

  let sentimentUpdated = 0;
  if (sentiment) {
    let n: number;
    do {
      const r = await backfillSentiment(pool, sentimentBatchSize);
      n = r.updated;
      sentimentUpdated += n;
    } while (n > 0);
  }

  return { outcomesDone: true, scoringUpdated, sentimentUpdated };
}
