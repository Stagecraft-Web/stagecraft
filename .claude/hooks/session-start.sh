#!/usr/bin/env bash
# session-start.sh
#
# Runs at the start of every Claude Code session. Idempotent: skips
# work that's already been done. Designed primarily for cloud sessions,
# where the container starts fresh — local sessions usually no-op
# after the first run.
#
# What it does:
#   1. Ensures the musician-site template's Playwright Chromium binary
#      is installed (with system deps), so the `capture-pr-screenshots`
#      skill can run without a manual setup step.
#
# Failures are non-fatal — the hook prints a warning and exits 0 so a
# missing browser doesn't block the rest of the session. The skill
# itself surfaces a clear error if Chromium is still unavailable when
# it tries to capture.
set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SENTINEL="${REPO_ROOT}/.claude/.cache/playwright-chromium-installed"
TEMPLATE_DIR="${REPO_ROOT}/templates/musician-site"

mkdir -p "$(dirname "$SENTINEL")"

if [[ -f "$SENTINEL" ]]; then
  exit 0
fi

if [[ ! -d "$TEMPLATE_DIR/node_modules/playwright" ]]; then
  # Dependencies not installed yet — nothing we can do here. The skill
  # will install deps on demand if it's invoked.
  exit 0
fi

# `--with-deps` requires apt; fall back to a plain install if it fails
# (e.g. running outside a Debian/Ubuntu container).
if (cd "$TEMPLATE_DIR" && npx --no-install playwright install --with-deps chromium) >/dev/null 2>&1; then
  touch "$SENTINEL"
  exit 0
fi

if (cd "$TEMPLATE_DIR" && npx --no-install playwright install chromium) >/dev/null 2>&1; then
  touch "$SENTINEL"
  exit 0
fi

echo "[session-start] warning: could not install Playwright Chromium; capture-pr-screenshots skill will fail until this is resolved" >&2
exit 0
