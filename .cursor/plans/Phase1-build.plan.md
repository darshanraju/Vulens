---
name: Phase1 Layer 1 — Build Plan
overview: Executable plan to build Vu Layer 1 MVP (ingestion, enrichment, outcome tracking, scoring, API) per the Phase1 architecture; run Build to implement all phases.
todos:
  - id: setup-infra
    content: Set up project skeleton, Postgres schema (posts, accounts, assets, outcomes, asset_price_series tables per Phase1 §4), and Railway config (railway.json / env template) for 1 API + 1 worker
    status: completed
  - id: phase-1a-ingestion
    content: "Implement Phase 1a — Ingestion: X API Filtered Stream ($CASHTAG), persist raw post to Postgres (posts.raw_json), scraper fallback in same process. Deliverable: cashtag mentions stored with timestamp and account_id"
    status: completed
  - id: phase-1b-enrichment
    content: "Implement Phase 1b — Enrichment: Asset Resolver ($TICKER → asset), Price Snapshot at T=0, Account Metadata; run in same process as ingestion. Deliverable: post has resolved_asset_id, price_t0, account metadata"
    status: completed
  - id: phase-1c-outcome-tracking
    content: "Implement Phase 1c — Outcome tracking: scheduler cron finds posts due for T+1h/4h/24h/7d, fetch price, write outcomes (post_id, window, price_at_window, pct_delta). Idempotency per (post_id, window)"
    status: completed
  - id: phase-1d-scoring
    content: "Implement Phase 1d — Scoring: call score (directionally correct), rolling weighted average, VuScore 0–100; scheduler cron updates accounts table. Deliverable: VuScore per account persisted"
    status: completed
  - id: phase-1e-sentiment
    content: "Implement Phase 1e — NLP sentiment: classifier (bullish/bearish/neutral), store on posts; run on ingestion or async. Deliverable: sentiment on new posts and backfill plan"
    status: completed
  - id: phase-1f-backfill
    content: "Implement Phase 1f — Historical backfill: strategy for assets/time range and rate limits; batch outcome and score computation. Deliverable: historical coverage for priority assets/accounts"
    status: completed
  - id: api-and-observability
    content: "Implement internal REST API for Layer 2 (read posts, accounts, assets, time-series) and health/ready endpoint; application logs. Per principal-engineer minimal MVP: 1 API service + 1 worker"
    status: completed
isProject: false
---

# Phase1 Layer 1 — Build Plan

This plan is the **executable build** for Vu Layer 1 MVP. When you run **Build**, complete each todo in dependency order; each todo maps to one phase or infra step. Full architecture and data model are in the Phase1 architecture doc (`.cursor/plans/phase1_layer1_plan_document_aed9dce0.plan.md`) and in `prd.md`.

**Architecture and schemas:** See Phase1 Layer 1 plan — Railway 1 API + 1 worker (single process: ingestion, enrichment, and scheduler cron), Postgres only, no Redis/queues/TimescaleDB/S3 for MVP.

---

## setup-infra

- Create project skeleton (repo structure, package.json or equivalent, env template).
- Postgres schema: `posts`, `accounts`, `assets`, `outcomes`, `asset_price_series` tables per Phase1 §4 Data stores (e.g. `posts.raw_json` JSONB, outcomes with post_id/window/price_at_window/pct_delta).
- Railway config: `railway.json` or Nixpacks config for 1 API service + 1 worker (single process runs ingestion, enrichment, and scheduler cron). Env template for DB URL(s).
- Deliverable: project boots, DB migrations apply, Railway can deploy. See Phase1 §2.6, §4.

---

## phase-1a-ingestion

- X API Filtered Stream v2 for $CASHTAG mentions; persist raw payload to `posts` (e.g. `raw_json` JSONB).
- Scraper fallback (Playwright/Puppeteer) in same process; trigger on API failure or rate limit.
- Deliverable: every cashtag mention stored with timestamp, account_id. See Phase1 §3 Phase 1a.
- Add relavent Unit tests

---

## phase-1b-enrichment

- Asset Resolver: map $TICKER to canonical asset (CoinGecko ID / contract); handle ambiguities.
- Price Snapshot: at post time T=0, fetch and store price per resolved asset.
- Account Metadata: followers, verification; store or link to accounts table.
- Run in same process as ingestion (single worker). Deliverable: each post has resolved_asset_id, price_t0, account metadata. See Phase1 §3 Phase 1b, §2.5.
- Add relavent Unit tests

---

## phase-1c-outcome-tracking

- Scheduler cron (same process as ingestion+enrichment): find posts due for T+1h, T+4h, T+24h, T+7d; fetch price at each window; write to `outcomes` (post_id, window, price_at_window, pct_delta).
- Idempotency per (post_id, window) so re-runs do not duplicate.
- Deliverable: outcomes table populated for all relevant posts and windows. See Phase1 §3 Phase 1c, §4.
- Add relavent Unit tests

---

## phase-1d-scoring

- Call score: directionally correct across windows; weighting (recency, volume).
- Account accuracy: rolling weighted average (e.g. last 90 days 2×); VuScore 0–100 normalization.
- Scheduler cron (same process) updates `accounts.vu_score` (and score_metadata). Deliverable: VuScore per account persisted and queryable. See Phase1 §3 Phase 1d, §2.3.
- Add relavent Unit tests

---

## phase-1e-sentiment

- Sentiment classifier (bullish/bearish/neutral) for post text; OpenAI API or self-hosted for MVP.
- Run on ingestion or async; store result on `posts.sentiment`.
- Deliverable: sentiment on new posts; backfill plan for existing. See Phase1 §3 Phase 1e.
- Add relavent Unit tests

---

## phase-1f-backfill

- Backfill strategy: which assets/time range; respect rate limits for X and price APIs.
- Batch jobs: write posts and outcomes for historical range; run scoring on batch.
- Deliverable: historical coverage for priority assets/accounts. See Phase1 §3 Phase 1f.
- Add relavent Unit tests

---

## api-and-observability

- Internal REST API for Layer 2: read endpoints for posts, accounts, assets, time-series (e.g. leaderboard, VuScore lookup, asset sentiment).
- Health/ready HTTP endpoint (e.g. checks DB connectivity).
- Application logs. No WebSocket required for MVP.
- Deploy as 1 API service + 1 worker (single process: ingestion, enrichment, and scheduler cron) per principal-engineer minimal MVP. See Phase1 §6 Definition of done
- Add relavent Unit tests
