#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

: "${MYSQL_HOST:?Set MYSQL_HOST to the MySQL server hostname}"
: "${MYSQL_USER:?Set MYSQL_USER to a MySQL user with permission to create the database and table}"

MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_ARGS=(
  --protocol=tcp
  --host="$MYSQL_HOST"
  --port="$MYSQL_PORT"
  --user="$MYSQL_USER"
)

if [[ -n "${MYSQL_PASSWORD:-}" ]]; then
  # MYSQL_PWD avoids putting the password in the mysql command arguments.
  MYSQL_PWD="$MYSQL_PASSWORD" mysql "${MYSQL_ARGS[@]}" < "$SCRIPT_DIR/create_daily_sales_database.sql"
else
  echo "MYSQL_PASSWORD is not set; the mysql client will prompt for it." >&2
  mysql "${MYSQL_ARGS[@]}" < "$SCRIPT_DIR/create_daily_sales_database.sql"
fi

echo "Daily Sales integration database and table are ready."
