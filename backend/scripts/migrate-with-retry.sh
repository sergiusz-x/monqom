#!/bin/sh
set -eu

attempt=1
max_attempts=10

while [ "$attempt" -le "$max_attempts" ]; do
  if npm run migrate:deploy; then
    exit 0
  fi

  if [ "$attempt" -eq "$max_attempts" ]; then
    echo "Database migration failed after $max_attempts attempts." >&2
    exit 1
  fi

  echo "Database is not ready; retrying migration in 3 seconds (attempt $attempt/$max_attempts)." >&2
  attempt=$((attempt + 1))
  sleep 3
done
