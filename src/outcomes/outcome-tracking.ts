/**
 * Phase 1c — Outcome tracking: T+1h, T+4h, T+24h, T+7d.
 * Finds posts due for each window, fetches current price, writes outcomes with idempotency.
 */
import type { Pool } from "pg";
import { getCurrentPriceUsd } from "../enrichment/price-snapshot.js";

export const OUTCOME_WINDOWS = ["1h", "4h", "24h"] as const;
export type OutcomeWindow = (typeof OUTCOME_WINDOWS)[number];

const WINDOW_TO_INTERVAL: Record<OutcomeWindow, string> = {
  "1h": "1 hour",
  "4h": "4 hours",
  "24h": "24 hours",
};

export function windowToInterval(window: OutcomeWindow): string {
  return WINDOW_TO_INTERVAL[window];
}

export interface PostDueForOutcome {
  post_id: number;
  asset_id: number;
  price_t0: string;
  coingecko_id: string | null;
}

/**
 * Posts that are past (posted_at + window) and have no outcome row for that window.
 * Requires asset_id and price_t0 to be set.
 */
export async function getPostsDueForOutcome(
  pool: Pool,
  window: OutcomeWindow
): Promise<PostDueForOutcome[]> {
  const interval = windowToInterval(window);
  const q = `
    SELECT p.id AS post_id, p.asset_id, p.price_t0::text AS price_t0, a.coingecko_id
    FROM posts p
    JOIN assets a ON a.id = p.asset_id
    WHERE p.asset_id IS NOT NULL
      AND p.price_t0 IS NOT NULL
      AND p.posted_at + ($1::interval) <= NOW()
      AND NOT EXISTS (
        SELECT 1 FROM outcomes o WHERE o.post_id = p.id AND o."window" = $2
      )
  `;
  const r = await pool.query(q, [interval, window]);
  return r.rows as PostDueForOutcome[];
}

/**
 * Compute pct_delta: ((price_at_window - price_t0) / price_t0) * 100.
 */
export function computePctDelta(priceT0: number, priceAtWindow: number): number {
  if (priceT0 === 0) return 0;
  return Number((((priceAtWindow - priceT0) / priceT0) * 100).toFixed(4));
}

/**
 * Process one window: fetch price for each due post, insert outcome (idempotent).
 */
export async function runOutcomeTrackingForWindow(
  pool: Pool,
  window: OutcomeWindow
): Promise<{ processed: number; errors: number }> {
  const due = await getPostsDueForOutcome(pool, window);
  let processed = 0;
  let errors = 0;

  for (const row of due) {
    if (!row.coingecko_id) {
      errors++;
      continue;
    }
    const priceAtWindow = await getCurrentPriceUsd(row.coingecko_id);
    if (priceAtWindow == null) {
      errors++;
      continue;
    }
    const priceT0 = Number(row.price_t0);
    const pctDelta = computePctDelta(priceT0, priceAtWindow);

    try {
      await pool.query(
        `INSERT INTO outcomes (post_id, "window", price_at_window, pct_delta)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (post_id, "window") DO NOTHING`,
        [row.post_id, window, priceAtWindow, pctDelta]
      );
      processed++;
    } catch {
      errors++;
    }
  }

  return { processed, errors };
}

/**
 * Run outcome tracking for all windows. Call from scheduler cron.
 */
export async function runOutcomeTracking(pool: Pool): Promise<void> {
  for (const w of OUTCOME_WINDOWS) {
    const { processed, errors } = await runOutcomeTrackingForWindow(pool, w);
    if (processed > 0 || errors > 0) {
      console.log(`Outcome tracking [${w}]: processed=${processed} errors=${errors}`);
    }
  }
}
