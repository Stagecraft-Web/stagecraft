#!/usr/bin/env bash
# Open a psql session against $DATABASE_URL.
#
# Defaults: loads DATABASE_URL from packages/db/.env if not already set in
# the shell, so `npm run db:psql` lands you on the local Docker DB without
# extra config.
#
# To target Neon (or any other DB), pass DATABASE_URL inline:
#
#   DATABASE_URL='postgresql://neondb_owner:...@ep-xxx.neon.tech/neondb?sslmode=require' npm run db:psql
#
# Use the *direct* (unpooled) Neon URL — psql + pgbouncer transaction-mode
# pooling doesn't support multi-statement transactions or prepared
# statements cleanly.
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ] && [ -f packages/db/.env ]; then
  set -a
  # shellcheck disable=SC1091
  source packages/db/.env
  set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set. Either populate packages/db/.env or export it inline:" >&2
  echo "  DATABASE_URL='postgresql://...' npm run db:psql" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found. Install with: brew install libpq && brew link --force libpq" >&2
  exit 1
fi

exec psql "$DATABASE_URL"
