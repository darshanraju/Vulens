#!/usr/bin/env bash
# Same as run-local-dev but with USE_MOCK_X=true: mock CoinGecko + X (no API keys needed).
# Usage: ./scripts/run-local-dev-mock.sh  or  npm run dev:local-mock

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export DATABASE_URL="${DATABASE_URL:-postgresql://vu_test:vu_test@localhost:5433/vu_test}"
export USE_MOCK_X=true
# So the X module doesn't throw before fetch is invoked (fetch is then mocked)
export X_API_BEARER_TOKEN="${X_API_BEARER_TOKEN:-mock-token-for-local-mock}"

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

echo "==> Starting API on port 3000 (mock X + CoinGecko, background)..."
npx tsx watch src/server-mock.ts &
API_PID=$!
sleep 2

echo "==> Starting frontend on port 5173..."
cd frontend && npm run dev &
FRONT_PID=$!

echo ""
echo "Ready (MOCK mode). Open http://localhost:5173"
echo "Click \"Run worker (populate DB)\" — uses mock tweets for trending coins (no X or CoinGecko keys needed)."
echo "Then \"Refresh data\" or reload the page to see results."
echo "Stop with Ctrl+C; then: docker compose -f docker-compose.e2e.yml down"
echo ""

wait $FRONT_PID 2>/dev/null || true
kill $API_PID 2>/dev/null || true
