/**
 * Backfill sentiment for posts that have NULL sentiment (e.g. ingested before Phase 1e).
 */
import type { Pool } from "pg";
import { classifySentiment } from "./classify.js";

export async function backfillSentiment(pool: Pool, batchSize = 500): Promise<{ updated: number }> {
  const r = await pool.query(
    `SELECT id, content_snippet, raw_json FROM posts WHERE sentiment IS NULL LIMIT $1`,
    [batchSize]
  );
  let updated = 0;
  for (const row of r.rows as { id: string; content_snippet: string | null; raw_json: unknown }[]) {
    const text =
      row.content_snippet ??
      (typeof row.raw_json === "object" && row.raw_json !== null && "data" in row.raw_json
        ? String((row.raw_json as { data?: { text?: string } }).data?.text ?? "")
        : "");
    const sentiment = classifySentiment(text);
    await pool.query(`UPDATE posts SET sentiment = $1 WHERE id = $2`, [sentiment, row.id]);
    updated++;
  }
  if (updated > 0) {
    console.log("Sentiment backfill: updated", updated, "posts");
  }
  return { updated };
}
