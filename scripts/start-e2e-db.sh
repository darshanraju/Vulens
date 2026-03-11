#!/usr/bin/env bash
# Start a Postgres container for E2E tests: correct schema (migrations), port 5433.
# Usage: ./scripts/start-e2e-db.sh
# Then:  DATABASE_URL='postgresql://vu_test:vu_test@localhost:5433/vu_test' npm run test:e2e

set -e

CONTAINER_NAME="${E2E_CONTAINER_NAME:-vu_e2e_postgres}"
PORT="${E2E_DB_PORT:-5433}"
USER="${E2E_DB_USER:-vu_test}"
PASS="${E2E_DB_PASSWORD:-vu_test}"
DB="${E2E_DB_NAME:-vu_test}"
MIGRATIONS_DIR="$(cd "$(dirname "$0")/../migrations" && pwd)"

if ! docker info &>/dev/null; then
  echo "Docker is not running. Start Docker and try again."
  exit 1
fi

if docker inspect "$CONTAINER_NAME" &>/dev/null; then
  RUNNING=$(docker inspect -f '{{.State.Running}}' "$CONTAINER_NAME" 2>/dev/null || true)
  if [[ "$RUNNING" == "true" ]]; then
    echo "Container $CONTAINER_NAME is already running on port $PORT."
    echo "DATABASE_URL='postgresql://$USER:$PASS@localhost:$PORT/$DB'"
    exit 0
  fi
  echo "Removing stopped container $CONTAINER_NAME..."
  docker rm -f "$CONTAINER_NAME" &>/dev/null || true
fi

echo "Starting Postgres for E2E (schema from migrations) on port $PORT..."
docker run -d \
  --name "$CONTAINER_NAME" \
  -e POSTGRES_USER="$USER" \
  -e POSTGRES_PASSWORD="$PASS" \
  -e POSTGRES_DB="$DB" \
  -p "$PORT:5432" \
  -v "$MIGRATIONS_DIR:/docker-entrypoint-initdb.d:ro" \
  postgres:16-alpine

echo "Waiting for Postgres to be ready..."
for i in {1..30}; do
  if docker exec "$CONTAINER_NAME" pg_isready -U "$USER" -d "$DB" &>/dev/null; then
    echo "Postgres is ready."
    echo ""
    echo "DATABASE_URL='postgresql://$USER:$PASS@localhost:$PORT/$DB'"
    echo ""
    echo "Run E2E:  DATABASE_URL='postgresql://$USER:$PASS@localhost:$PORT/$DB' npm run test:e2e"
    exit 0
  fi
  sleep 0.5
done

echo "Timed out waiting for Postgres."
docker logs "$CONTAINER_NAME" 2>&1 | tail -20
exit 1
