#!/usr/bin/env bash
# Creates the local-only rently_dev + rently_test databases when missing.
# Idempotent: existing databases are left untouched. Local Docker only —
# refuses any admin URL that is not localhost:5432.
set -euo pipefail

cd "$(dirname "$0")/.."

ADMIN_URL="${LOCAL_ADMIN_DATABASE_URL:-postgresql://rently_db_user:rently_db_password@localhost:5432/rently_db}"

case "$ADMIN_URL" in
*"@localhost:5432/"* | *"@127.0.0.1:5432/"*) ;;
*)
	echo "Refusing: bootstrap targets local Docker Postgres only." >&2
	exit 1
	;;
esac

for db in rently_dev rently_test; do
	psql "$ADMIN_URL" --set=ON_ERROR_STOP=1 -v db="$db" <<'SQL'
SELECT format('CREATE DATABASE %I OWNER rently_db_user', :'db')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'db')
\gexec
SQL
done

# Fresh clones have no apps/server/.env.test (untracked, holds real secrets
# locally). Seed it from the committed deterministic template, never overwrite.
if [ ! -f apps/server/.env.test ]; then
	cp apps/server/.env.test.example apps/server/.env.test
	echo "Created apps/server/.env.test from .env.test.example."
fi

psql "$ADMIN_URL" --tuples-only --command "SELECT datname FROM pg_database WHERE datname IN ('rently_dev','rently_test') ORDER BY 1;"
