#!/usr/bin/env bash
# Start local dev: fresh Docker Postgres (E2E), API, and frontend.
# Run from repo root. Requires Docker and Node.
# Usage: ./scripts/run-local-dev.sh

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export DATABASE_URL="${DATABASE_URL:-postgresql://vu_test:vu_test@localhost:5433/vu_test}"

echo "==> Stopping and removing E2E Postgres (empty data)..."
docker compose -f docker-compose.e2e.yml down -v 2>/dev/null || true

echo "==> Starting fresh E2E Postgres on port 5433..."
docker compose -f docker-compose.e2e.yml up -d

echo "==> Waiting for Postgres..."
for i in {1..30}; do
  if docker exec vu_e2e_postgres pg_isready -U vu_test -d vu_test &>/dev/null; then
    break
  fi
  sleep 0.5
done
if ! docker exec vu_e2e_postgres pg_isready -U vu_test -d vu_test &>/dev/null; then
  echo "Postgres failed to become ready."
  exit 1
fi
echo "Postgres is ready."

echo "==> Starting API on port 3000 (background)..."
npx tsx watch src/server.ts &
API_PID=$!
sleep 2

echo "==> Starting frontend on port 5173..."
cd frontend && npm run dev &
FRONT_PID=$!

echo ""
echo "Ready. Open http://localhost:5173"
echo "Click \"Run worker (populate DB)\" to run the worker, then \"Refresh data\" or reload the page to see results."
echo "Ensure .env has COINGECKO_API_KEY and X_API_BEARER_TOKEN for the worker to fetch real data."
echo "Stop with Ctrl+C (stops frontend and API); then run: docker compose -f docker-compose.e2e.yml down"
echo ""

wait $FRONT_PID 2>/dev/null || true
kill $API_PID 2>/dev/null || true
