#!/usr/bin/env bash
# Tests supabase/schema.sql on a throwaway local PostgreSQL (16 by default):
#   1. initdb + start a private cluster (unix socket only) in a temp dir
#   2. load supabase/tests/stubs.sql (a minimal emulation of Supabase's auth/storage/realtime objects)
#   3. run supabase/schema.sql twice (it must be idempotent), each run as one transaction like the SQL editor
#   4. run supabase/tests/rls.sql, which impersonates users and asserts the security rules
# Exits non-zero on the first failure. Usage: scripts/test-db.sh   (PGBIN / TEST_PGPORT override the defaults)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
PORT="${TEST_PGPORT:-54329}"
DB=ect_test

if [ ! -x "$PGBIN/initdb" ]; then
  echo "PostgreSQL binaries not found in $PGBIN (set PGBIN)" >&2
  exit 2
fi

# PostgreSQL refuses to run as root: run the server tools as the "postgres" OS user in that case.
if [ "$(id -u)" = 0 ]; then
  as_pg() { runuser -u postgres -- "$@"; }
else
  as_pg() { "$@"; }
fi

WORK="$(mktemp -d /tmp/ect-pgtest.XXXXXX)"
DATA="$WORK/data"
LOG="$WORK/server.log"
[ "$(id -u)" = 0 ] && chown postgres "$WORK"

cleanup() {
  as_pg "$PGBIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

as_pg "$PGBIN/initdb" -D "$DATA" -U postgres --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null
as_pg "$PGBIN/pg_ctl" -D "$DATA" -l "$LOG" -w \
  -o "-p $PORT -k $WORK -c listen_addresses='' -c fsync=off -c wal_level=logical" start >/dev/null

# SQL files are streamed through stdin so the postgres OS user does not need read access to the repo.
psql_file() {
  local file="$1"
  shift
  as_pg env PGOPTIONS="-c client_min_messages=${MIN_MESSAGES:-warning}" \
    "$PGBIN/psql" -h "$WORK" -p "$PORT" -U postgres -d "$DB" -X -q -v ON_ERROR_STOP=1 "$@" -f - <"$file"
}

as_pg "$PGBIN/createdb" -h "$WORK" -p "$PORT" -U postgres "$DB"

step() { printf '\n== %s\n' "$*"; }

step "stubs (Supabase emulation)"
psql_file "$ROOT/supabase/tests/stubs.sql" >/dev/null

step "schema.sql, first run"
psql_file "$ROOT/supabase/schema.sql" --single-transaction -P pager=off

step "schema.sql, second run (idempotency)"
psql_file "$ROOT/supabase/schema.sql" --single-transaction -P pager=off

step "rls.sql"
OUT="$WORK/rls.out"
if ! MIN_MESSAGES=notice psql_file "$ROOT/supabase/tests/rls.sql" -P pager=off >"$OUT" 2>&1; then
  grep -E 'PASS|ERROR|FAIL|CONTEXT|LINE' "$OUT" | sed 's/^psql:[^ ]* //' | tail -40
  printf '\nFAILED (see the first ERROR above)\n' >&2
  exit 1
fi
grep -E 'NOTICE: +PASS' "$OUT" | sed -E 's/^.*NOTICE: +//'
PASSES="$(grep -cE 'NOTICE: +PASS' "$OUT" || true)"
printf '\nPASS: schema applied twice and %s security checks passed\n' "$PASSES"
