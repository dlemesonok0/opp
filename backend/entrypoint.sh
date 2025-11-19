#!/usr/bin/env bash
set -e

cd /app

echo ">>> Using DATABASE_URL=${DATABASE_URL}"

if [ -z "$DATABASE_URL" ]; then
  echo "!!! ERROR: DATABASE_URL is not set"
  exit 1
fi

echo ">>> Waiting for database via alembic..."

RETRIES=0
MAX_RETRIES=30

while true; do
  set +e
  OUTPUT=$(alembic -c alembic.ini current 2>&1)
  EXIT_CODE=$?
  set -e

  if [ $EXIT_CODE -eq 0 ]; then
    echo ">>> DB is reachable."
    break
  fi

  RETRIES=$((RETRIES + 1))
  echo "DB not ready yet (try ${RETRIES}/${MAX_RETRIES})..."
  echo "$OUTPUT"

  if [ $RETRIES -ge $MAX_RETRIES ]; then
    echo "!!! ERROR: DB is still not reachable after ${MAX_RETRIES} attempts. Giving up."
    exit 1
  fi

  sleep 2
done

echo ">>> Generating migrations (alembic revision --autogenerate)…"

MIGRATION_MSG="auto_$(date +%Y%m%d_%H%M%S)"

set +e
REVISION_OUTPUT=$(alembic -c alembic.ini revision --autogenerate -m "$MIGRATION_MSG" 2>&1)
REVISION_EXIT_CODE=$?
set -e

if echo "$REVISION_OUTPUT" | grep -q "No changes detected"; then
    echo ">>> No schema changes. Skipping migration file."
else
    echo ">>> Migration created: $MIGRATION_MSG"
fi

echo ">>> Applying migrations (alembic upgrade head)…"
alembic -c alembic.ini upgrade head

echo ">>> Starting application..."
exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --reload \
    --reload-dir /app
