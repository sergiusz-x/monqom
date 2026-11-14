#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
project="monqom-screenshots-$$"
compose=(docker compose -p "$project" -f docker-compose.screenshots.yml)
target=frontend/public/marketing/screenshots
backup="${target}.backup-$$"
next="${target}.next-$$"
scenarios=(dashboard transactions transaction-form budgets goals help-goals help-plan help-review help-budget-guide help-transaction-guide help-plan-details)
if [ "${1:-}" = "--" ]; then shift; fi

if [ "$#" -gt 0 ]; then
  for requested in "$@"; do
    case " ${scenarios[*]} " in
      *" $requested "*) ;;
      *)
        echo "Unknown screenshot scenario: $requested" >&2
        echo "Available scenarios: ${scenarios[*]}" >&2
        exit 2
        ;;
    esac
  done
  grep_pattern="@($(IFS='|'; echo "${*// /|}"))"
else
  grep_pattern='@(dashboard|transactions|transaction-form|budgets|goals|help-goals|help-plan|help-review|help-budget-guide|help-transaction-guide|help-plan-details)'
fi
staging=$(mktemp -d "${TMPDIR:-/tmp}/monqom-screenshots.XXXXXXXX")

cleanup() {
  status=$?
  trap - EXIT
  if [ "$status" -ne 0 ]; then
    "${compose[@]}" logs --no-color --tail=100 >&2 || true
  fi
  "${compose[@]}" down --volumes --remove-orphans || true
  if [ -d "$backup" ]; then
    if [ ! -d "$target" ]; then mv "$backup" "$target"; else rm -rf "$backup"; fi
  fi
  if ! rm -rf "$staging" "$next" 2>/dev/null; then
    if [ -d "$staging" ]; then
      docker run --pull=never --rm \
        --volume "$staging:/screenshots" \
        --entrypoint sh \
        mcr.microsoft.com/playwright:v1.62.0-noble \
        -c 'chmod -R a+rwX /screenshots' >/dev/null 2>&1 || true
    fi
    rm -rf "$staging" "$next" || true
  fi
  exit "$status"
}
trap cleanup EXIT
"${compose[@]}" up -d --build --wait --wait-timeout 180
docker run --rm \
  --user "$(id -u):$(id -g)" \
  --network "${project}_default" \
  --volume "$PWD:/app" \
  --volume "$staging:/screenshots" \
  --workdir /app \
  --env SCREENSHOT_OUTPUT=/screenshots \
  --env SCREENSHOT_BASE_URL=http://frontend:5173 \
  --env HOME=/tmp \
  mcr.microsoft.com/playwright:v1.62.0-noble \
  node frontend/node_modules/@playwright/test/cli.js test \
  --config frontend/playwright.screenshots.config.ts \
  --grep "$grep_pattern"
rm -rf "$staging/.playwright-output"
# Stage next to the destination so renames work even when /tmp is another filesystem.
mkdir -p "$next"
if [ -d "$target" ]; then cp -R "$target"/. "$next"/; fi
cp -R "$staging"/. "$next"/
if [ -d "$target" ]; then mv "$target" "$backup"; fi
if ! mv "$next" "$target"; then rm -rf "$next"; exit 1; fi
