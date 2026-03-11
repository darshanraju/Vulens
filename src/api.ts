import "dotenv/config";
import express from "express";
import { getPool, healthCheck } from "./db/index.js";

export const app = express();

app.use(express.json());

// Request logging
app.use((req, _res, next) => {
  console.log(new Date().toISOString(), req.method, req.path);
  next();
});

app.get("/health", async (_req, res) => {
  const ok = await healthCheck();
  res.status(ok ? 200 : 503).json({ status: ok ? "ok" : "unhealthy", db: ok });
});

app.get("/ready", async (_req, res) => {
  const ok = await healthCheck();
  res.status(ok ? 200 : 503).json({ ready: ok });
});

// --- Trending-focused API ---

app.get("/trending-assets", async (_req, res) => {
  try {
    const pool = getPool();
    const r = await pool.query(
      `SELECT at.asset_id, a.symbol, a.coingecko_id, at.window_start, at.window_end
       FROM asset_trending at
       JOIN assets a ON a.id = at.asset_id
       ORDER BY at.window_start DESC, a.symbol`
    );
    res.json({ trending: r.rows });
  } catch (e) {
    console.error("GET /trending-assets", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/trending-assets/:id/posts", async (req, res) => {
  try {
    const pool = getPool();
    const assetId = Number(req.params.id);
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const r = await pool.query(
      `SELECT p.id, p.account_id, a.handle, p.content_snippet, p.posted_at, p.price_t0
       FROM posts p
       JOIN accounts a ON a.id = p.account_id
       WHERE p.asset_id = $1
       ORDER BY p.posted_at DESC
       LIMIT $2`,
      [assetId, limit]
    );
    const posts = r.rows;
    const outcomeRows = await pool.query(
      'SELECT post_id, "window", price_at_window, pct_delta FROM outcomes WHERE post_id = ANY($1::bigint[])',
      [posts.map((p) => p.id)]
    );
    const byPost: Record<string, unknown[]> = {};
    for (const row of outcomeRows.rows) {
      const key = String(row.post_id);
      (byPost[key] ??= []).push({
        window: row.window,
        price_at_window: row.price_at_window,
        pct_delta: row.pct_delta,
      });
    }
    const withOutcomes = posts.map((p) => ({
      ...p,
      outcomes: byPost[String(p.id)] ?? [],
    }));
    res.json({ posts: withOutcomes });
  } catch (e) {
    console.error("GET /trending-assets/:id/posts", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/trending-assets/:id/leaderboard", async (req, res) => {
  try {
    const pool = getPool();
    const assetId = Number(req.params.id);
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const r = await pool.query(
      `SELECT a.id, a.handle, a.vu_score, a.score_updated_at
       FROM accounts a
       JOIN posts p ON p.account_id = a.id
       WHERE p.asset_id = $1 AND a.vu_score IS NOT NULL
       GROUP BY a.id
       ORDER BY a.vu_score DESC
       LIMIT $2`,
      [assetId, limit]
    );
    res.json({ leaderboard: r.rows });
  } catch (e) {
    console.error("GET /trending-assets/:id/leaderboard", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/leaderboard", async (req, res) => {
  try {
    const pool = getPool();
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const r = await pool.query(
      "SELECT id, handle, vu_score, score_updated_at FROM accounts WHERE vu_score IS NOT NULL ORDER BY vu_score DESC LIMIT $1",
      [limit]
    );
    res.json({ leaderboard: r.rows });
  } catch (e) {
    console.error("GET /leaderboard", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Backwards-compatible raw posts endpoint (can be trimmed later if not needed)
app.get("/posts", async (req, res) => {
  try {
    const pool = getPool();
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Number(req.query.offset) || 0;
    const accountId = req.query.account_id as string | undefined;
    const assetId = req.query.asset_id as string | undefined;
    let q = "SELECT id, account_id, asset_id, content_snippet, posted_at, price_t0, sentiment FROM posts WHERE 1=1";
    const params: unknown[] = [];
    let i = 1;
    if (accountId) {
      q += ` AND account_id = $${i++}`;
      params.push(accountId);
    }
    if (assetId) {
      q += ` AND asset_id = $${i++}`;
      params.push(assetId);
    }
    q += ` ORDER BY posted_at DESC LIMIT $${i++} OFFSET $${i}`;
    params.push(limit, offset);
    const r = await pool.query(q, params);
    res.json({ posts: r.rows });
  } catch (e) {
    console.error("GET /posts", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/posts/:id", async (req, res) => {
  try {
    const pool = getPool();
    const r = await pool.query(
      "SELECT id, account_id, asset_id, content_snippet, posted_at, price_t0, sentiment, engagement FROM posts WHERE id = $1",
      [req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: "Not found" });
    const post = r.rows[0];
    const outcomes = await pool.query('SELECT "window", price_at_window, pct_delta FROM outcomes WHERE post_id = $1', [req.params.id]);
    res.json({ ...post, outcomes: outcomes.rows });
  } catch (e) {
    console.error("GET /posts/:id", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// time-series endpoints removed in trending-only design
