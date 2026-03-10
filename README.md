# Vu Layer 1 — Data Moat

Ingestion, enrichment, outcome tracking, and scoring for Vu (per [Phase1-build plan](.cursor/plans/Phase1-build.plan.md)).

## Stack

- **Runtime**: Node.js 20+, TypeScript
- **API**: Express (REST + `/health`, `/ready`)
- **Worker**: Single process (ingestion + enrichment + scheduler cron)
- **DB**: PostgreSQL (Railway Postgres or Supabase); schema in `migrations/`

## Local dev

```bash
cp .env.example .env
# Set DATABASE_URL to a local or remote Postgres

npm install
npm run build
npm run db:migrate

# Terminal 1 — API
npm run dev:api

# Terminal 2 — Worker
npm run dev:worker
```

## Railway (1 API + 1 worker)

1. Create a Railway project; add Postgres (or use Supabase and add `DATABASE_URL`).
2. Create **two services** from this repo:
   - **API**: Build command `npm run build`, start command `npm run api`. Expose port (e.g. 3000).
   - **Worker**: Build command `npm run build`, start command `npm run worker`. No public port.
3. Set `DATABASE_URL` (and any X/CoinGecko/OpenAI keys) in variables.
4. Run migrations once (e.g. from API service shell: `npm run db:migrate`).

`railway.json` and `nixpacks.toml` define the build; the start command is set per service in the dashboard.

## Scripts

| Script        | Description                    |
|---------------|--------------------------------|
| `npm run api` | Start REST API                 |
| `npm run worker` | Start worker (ingest + cron) |
| `npm run db:migrate` | Apply `migrations/001_initial.sql` |
