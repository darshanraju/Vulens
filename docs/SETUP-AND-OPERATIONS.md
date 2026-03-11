# Vu Layer 1 — Setup & Operations

This document covers environment variables, deployment to Railway, running the services, backfilling, and monitoring.

---

## 1. Environment variables

Create a `.env` file (or set these in Railway’s dashboard). Copy from `.env.example` and fill in values.

| Variable               | Required   | Description                                                                                                                           |
| ---------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **DATABASE_URL**       | **Yes**    | Postgres connection string, e.g. `postgresql://user:password@host:5432/dbname`. Railway provides this when you add a Postgres plugin. |
| **X_API_BEARER_TOKEN** | For worker | X (Twitter) API v2 Bearer Token for the Filtered Stream. If unset, the worker starts but ingestion is disabled (logs a warning).      |
| **CASHTAG_RULES**      | No         | Comma-separated cashtag symbols to track, e.g. `SOL,BTC,ETH`. Default: `SOL,BTC,ETH`.                                                 |
| **COINGECKO_API_KEY**  | No         | CoinGecko API key (e.g. demo key). Used for historical price at tweet time and at outcome windows. Without it, price lookups can hit rate limits or fail.  |
| **PORT**               | No         | HTTP port for the API. Default: `3000`. Railway sets this automatically.                                                              |

**Notes:**

- **API service** only needs `DATABASE_URL` and `PORT` (Railway sets `PORT`).
- **Worker** needs `DATABASE_URL` and should have `X_API_BEARER_TOKEN` for live ingestion; `COINGECKO_API_KEY` is recommended for enrichment and outcome tracking.
- `.env` is not committed; use Railway’s **Variables** (or a `.env` file locally).

---

## 2. Deploy to Railway

### Prerequisites

- [Railway account](https://railway.app)
- GitHub repo connected to Railway (or use Railway CLI)

### Steps

1. **Create a new project** in Railway and add a **Postgres** plugin. Note the `DATABASE_URL` (or `POSTGRES_URL`) from the Postgres service variables.

2. **Add two services** from the same repo (one for the API, one for the worker):
   - **Service 1 — API**: Web service that serves HTTP.
   - **Service 2 — Worker**: Background process that runs ingestion, enrichment, and the scheduler.

3. **Configure build** (same for both):
   - **Build command:** `npm run build` (or leave default if Nixpacks runs it via `nixpacks.toml`).
   - **Root directory:** repo root (where `package.json` and `nixpacks.toml` are).

4. **Configure start command** per service:
   - **API service:** `node dist/server.js`  
     (or set **Start Command** to `npm run api`).
   - **Worker service:** `node dist/worker.js`  
     (or set **Start Command** to `npm run worker`).

5. **Set variables** for both services:
   - **DATABASE_URL**: From the Postgres plugin (link the variable or copy the connection string).
   - **API:** `PORT` is usually set by Railway.
   - **Worker:** Add `X_API_BEARER_TOKEN` and optionally `CASHTAG_RULES`, `COINGECKO_API_KEY`.

6. **Run migrations** once after first deploy:
   - In Railway, open a shell for the API (or Worker) service, or run locally with `DATABASE_URL` pointing at Railway Postgres:
   - `npm run db:migrate`
   - Or: `npx tsx src/db/migrate.ts` (with `DATABASE_URL` set).

7. **Expose the API** (optional): In the API service, use **Settings → Networking → Generate Domain** to get a public URL.

**Reference:** `railway.json` and `nixpacks.toml` in the repo define build and deploy behavior (Nixpacks, restart policy, etc.).

---

## 3. How to start the process

### Local

- **API (HTTP):**  
  `npm run api`  
  Or with watch: `npm run dev:api`  
  Listens on `PORT` or 3000.

- **Worker (ingestion + enrichment + scheduler):**  
  `npm run worker`  
  Or with watch: `npm run dev:worker`  
  Requires `DATABASE_URL`; optional `X_API_BEARER_TOKEN`, `CASHTAG_RULES`, `COINGECKO_API_KEY`.

Run migrations once before first run:

```bash
npm run db:migrate
```

### Railway

- **API:** Started automatically with `node dist/server.js` (or `npm run api`). Railway assigns `PORT`.
- **Worker:** Started automatically with `node dist/worker.js` (or `npm run worker`). Same env vars as above; ensure `DATABASE_URL` and (for ingestion) `X_API_BEARER_TOKEN` are set.

The worker does three things in one process:

1. **Ingestion** — Connects to X Filtered Stream for `$CASHTAG` tweets and persists them.
2. **Enrichment** — For each new tweet: resolve asset, set T=0 price (at tweet time), set sentiment.
3. **Scheduler (every 5 minutes)** — Outcome tracking (T+1h, 4h, 12h, 24h) then VuScore updates for accounts.

---

## 4. Backfill: how to run it and how it works

### How to run

One-off backfill (e.g. after loading historical data or to catch up):

```bash
npm run backfill
```

Uses `DATABASE_URL` from `.env`. For Railway, run this in a shell that has the same variables as your worker (or point `DATABASE_URL` at your DB and run locally).

### How backfilling works

The backfill script runs three steps in order:

1. **Outcome tracking** (multiple passes with delay)
   - Finds posts that are **past** their outcome windows (T+1h, T+4h, T+12h, T+24h) and don’t yet have an outcome row for that window.
   - For each such (post, window): loads the post’s asset and T=0 price (at tweet time), fetches price at (posted_at + window) from CoinGecko historical API, computes `pct_delta`, and inserts into `outcomes` with `ON CONFLICT (post_id, window) DO NOTHING` (idempotent).
   - Runs **four** full passes of outcome tracking, with a **2 second** delay between passes (to reduce CoinGecko rate-limit issues). You can change this in code via `outcomeWindowDelayMs`.

2. **Scoring**
   - For each account that has posts with outcomes in the last 90 days: computes a **call score** (directionally correct from average `pct_delta`), applies a **recency weight** (e.g. 2× for last 30 days), then a **VuScore** 0–100.
   - Writes `accounts.vu_score` and `score_updated_at`.

3. **Sentiment backfill**
   - Selects posts where `sentiment IS NULL` in batches (default 500).
   - For each post: derives text from `content_snippet` or `raw_json`, runs the keyword-based sentiment classifier (bullish/bearish/neutral), and updates `posts.sentiment`.
   - Repeats until no more rows need updating.

**Summary:** Backfill does not fetch new tweets from X; it only fills in **outcomes**, **VuScores**, and **sentiment** for data already in the DB. For truly historical tweets you’d need to ingest them first (e.g. via a separate historical ingest or manual load), then run backfill.

---

## 5. Monitoring that data is being pulled correctly

### Health and readiness

- **GET /health** — Returns `{ status: "ok", db: true }` when the app and DB are healthy (200), or 503 when DB check fails.
- **GET /ready** — Same DB check; returns `{ ready: true }` (200) or 503.

Use these for Railway health checks and load balancers.

### Internal REST API (Layer 2)

Call these to confirm data is present and up to date (replace `BASE` with your API URL, e.g. `https://your-app.railway.app`):

| Endpoint                              | Purpose                                                               |
| ------------------------------------- | --------------------------------------------------------------------- |
| **GET /posts?limit=10**               | Recent posts (ids, account_id, asset_id, posted_at, sentiment, etc.). |
| **GET /posts/:id**                    | Single post plus its outcomes (window, price_at_window, pct_delta).   |
| **GET /accounts?limit=20**            | Accounts with VuScore (ordered by score).                             |
| **GET /leaderboard?limit=50**         | Top accounts by VuScore.                                              |
| **GET /assets**                       | Resolved assets (symbol, coingecko_id).                               |
| **GET /time-series/price?asset_id=1** | Price series for an asset (if you write to `asset_price_series`).     |

### What to check

1. **Ingestion**
   - `GET /posts?limit=5` — New tweets should appear with recent `posted_at`. Check logs for “Persisted and enriched tweet” (worker).

2. **Enrichment**
   - `GET /posts/:id` for a recent post — Should have `asset_id`, `price_t0`, `sentiment` when the symbol was resolved and price/sentiment ran.

3. **Outcomes**
   - `GET /posts/:id` — `outcomes` array should get rows for 1h, 4h, 12h, 24h as time passes after `posted_at`. Scheduler runs every 5 minutes.

4. **Scoring**
   - `GET /leaderboard` — Accounts with recent posts and outcomes should have `vu_score` and `score_updated_at` updated after each scheduler run.

5. **Logs**
   - **API:** Request log lines (method + path).
   - **Worker:** “Persisted and enriched tweet”, “Outcome tracking [1h]: processed=…”, “Scoring: updated N accounts”, “Sentiment backfill: updated N posts”.

If `/health` or `/ready` returns 503, the DB is unreachable (check `DATABASE_URL` and Postgres status). If posts never appear, check `X_API_BEARER_TOKEN` and stream rules (e.g. `CASHTAG_RULES`).
