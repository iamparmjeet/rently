#!/usr/bin/env bash
set -euo pipefail

: "${SOURCE_DATABASE_URL:?Set SOURCE_DATABASE_URL to the Neon database URL to clone.}"

LOCAL_DATABASE_URL="${LOCAL_DATABASE_URL:-postgresql://rently_db_user:rently_db_password@localhost:5432/rently_dev}"
LOCAL_ADMIN_DATABASE_URL="${LOCAL_ADMIN_DATABASE_URL:-postgresql://rently_db_user:rently_db_password@localhost:5432/rently_db}"

case "$LOCAL_DATABASE_URL" in
  *"@localhost:5432/rently_dev" | *"@127.0.0.1:5432/rently_dev") ;;
  *)
    echo "Refusing to replace a database other than local rently_dev." >&2
    exit 1
    ;;
esac

dump_file="$(mktemp --suffix=.dump)"
trap 'rm -f "$dump_file"' EXIT

pg_dump --format=custom --no-owner --no-privileges --dbname="$SOURCE_DATABASE_URL" >"$dump_file"

psql "$LOCAL_ADMIN_DATABASE_URL" --set=ON_ERROR_STOP=1 <<'SQL'
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'rently_dev' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS rently_dev;
CREATE DATABASE rently_dev;
SQL

pg_restore --exit-on-error --no-owner --no-privileges --dbname="$LOCAL_DATABASE_URL" "$dump_file"
psql "$LOCAL_DATABASE_URL" --tuples-only --no-align --command 'SELECT current_database();'
