/**
 * Phase 1d — Scoring: call score (directionally correct), rolling weighted average, VuScore 0–100.
 * Updates accounts.vu_score and score_updated_at via scheduler.
 */
import type { Pool } from "pg";

/** Call score: 1 if avg pct_delta across outcomes > 0, 0.5 if === 0, 0 if < 0. */
export function callScoreFromPctDeltas(pctDeltas: number[]): number {
  if (pctDeltas.length === 0) return 0.5; // no data = neutral
  const avg = pctDeltas.reduce((a, b) => a + b, 0) / pctDeltas.length;
  if (avg > 0) return 1;
  if (avg < 0) return 0;
  return 0.5;
}

/** Weight for recency: 2 for last 30 days, 1 for 31–90 days. */
export function recencyWeight(postedAt: Date, now: Date): number {
  const days = (now.getTime() - postedAt.getTime()) / (24 * 60 * 60 * 1000);
  return days <= 30 ? 2 : 1;
}

/**
 * VuScore 0–100 from weighted call score (clamped, 2 decimal places).
 */
export function vuScoreFromWeightedAccuracy(weightedSum: number, weightTotal: number): number | null {
  if (weightTotal === 0) return null;
  const raw = (weightedSum / weightTotal) * 100;
  const clamped = Math.max(0, Math.min(100, raw));
  return Number(clamped.toFixed(2));
}

export interface AccountScoreRow {
  account_id: string;
  posted_at: Date;
  pct_deltas: number[];
}

/**
 * For each account, get posts in last 90 days with their outcome pct_deltas (one array per post).
 */
export async function getAccountOutcomesLast90Days(pool: Pool): Promise<Map<string, AccountScoreRow[]>> {
  const q = `
    SELECT p.account_id::text AS account_id, p.posted_at,
           array_agg(o.pct_delta) FILTER (WHERE o.pct_delta IS NOT NULL) AS pct_deltas
    FROM posts p
    JOIN outcomes o ON o.post_id = p.id
    JOIN asset_trending at ON at.asset_id = p.asset_id
    WHERE p.posted_at >= NOW() - INTERVAL '90 days'
    GROUP BY p.account_id, p.id, p.posted_at
  `;
  const r = await pool.query(q);
  const byAccount = new Map<string, AccountScoreRow[]>();
  for (const row of r.rows as (AccountScoreRow & { pct_deltas: unknown })[]) {
    const deltas = Array.isArray(row.pct_deltas) ? (row.pct_deltas as number[]) : [];
    const list = byAccount.get(row.account_id) ?? [];
    list.push({
      account_id: row.account_id,
      posted_at: new Date(row.posted_at),
      pct_deltas: deltas,
    });
    byAccount.set(row.account_id, list);
  }
  return byAccount;
}

/**
 * Compute VuScore for one account from its post/outcome rows. Returns null if no data.
 */
export function computeVuScoreForAccount(
  rows: AccountScoreRow[],
  now: Date = new Date()
): number | null {
  let weightedSum = 0;
  let weightTotal = 0;
  for (const r of rows) {
    const score = callScoreFromPctDeltas(r.pct_deltas);
    const w = recencyWeight(r.posted_at, now);
    weightedSum += score * w;
    weightTotal += w;
  }
  return vuScoreFromWeightedAccuracy(weightedSum, weightTotal);
}

/**
 * Run scoring: compute VuScore for all accounts with outcomes in last 90 days; update accounts table.
 */
export async function runScoring(pool: Pool): Promise<{ updated: number }> {
  const byAccount = await getAccountOutcomesLast90Days(pool);
  let updated = 0;
  const now = new Date();

  for (const [accountId, rows] of byAccount) {
    const vuScore = computeVuScoreForAccount(rows, now);
    if (vuScore == null) continue;
    await pool.query(
      `UPDATE accounts SET vu_score = $1, score_updated_at = NOW(), updated_at = NOW() WHERE id = $2`,
      [vuScore, accountId]
    );
    updated++;
  }

  if (updated > 0) {
    console.log("Scoring: updated", updated, "accounts");
  }
  return { updated };
}
