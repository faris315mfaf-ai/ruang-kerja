#!/usr/bin/env bash
# Lighthouse (mobile, simulated 4G) for the Absensi page, signed in as a demo
# account — Sprint 10 acceptance "Lighthouse ≥ 90 untuk halaman Absensi di ponsel".
#
# Needs: a production build (`npm run build`), APP_ENV=local with
# DEMO_LOGIN_ENABLED=true, Google Chrome, and two terminals:
#   1. PHP_CLI_SERVER_WORKERS=4 php artisan serve --port=8795
#   2. node scripts/lighthouse-proxy.mjs 8797 8795   # gzip like Caddy `encode`
# Then: scripts/lighthouse-absensi.sh [label] [email]
# Reports: storage/app/lighthouse/<label>.report.{html,json} (git-ignored).
set -euo pipefail

LABEL=${1:-absensi}
EMAIL=${2:-anggota@demo.test}
APP=${APP:-http://127.0.0.1:8795}
PROXY=${PROXY:-http://127.0.0.1:8797}
OUT=storage/app/lighthouse
CHROME_PATH=${CHROME_PATH:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}
export CHROME_PATH

mkdir -p "$OUT"
JAR=$(mktemp)
trap 'rm -f "$JAR"' EXIT

# Demo login (POST /login/demo) to get a session cookie.
curl -s -c "$JAR" -b "$JAR" "$APP/login" -o /dev/null
XSRF=$(awk '$6 == "XSRF-TOKEN" { print $7 }' "$JAR" | python3 -c 'import sys, urllib.parse; print(urllib.parse.unquote(sys.stdin.read().strip()))')
curl -s -c "$JAR" -b "$JAR" -X POST "$APP/login/demo" -H "X-XSRF-TOKEN: $XSRF" --data-urlencode "email=$EMAIL" -o /dev/null
COOKIE=$(sed 's/^#HttpOnly_//' "$JAR" | awk 'NF >= 7 && $1 !~ /^#/ { printf "%s=%s; ", $6, $7 }')
HEADERS=$(python3 -c 'import json, sys; print(json.dumps({"Cookie": sys.argv[1]}))' "$COOKIE")

npx -y lighthouse@12 "$PROXY/absensi" --quiet \
    --output=json --output=html --output-path="$OUT/$LABEL" \
    --extra-headers="$HEADERS" \
    --chrome-flags="--headless=new --no-first-run" \
    --only-categories=performance,accessibility,best-practices,seo

python3 - "$OUT/$LABEL.report.json" <<'PY'
import json, sys
report = json.load(open(sys.argv[1]))
print({key: round(cat["score"] * 100) for key, cat in report["categories"].items()})
for audit in ["first-contentful-paint", "largest-contentful-paint", "total-blocking-time", "cumulative-layout-shift", "speed-index"]:
    print(f"  {audit}: {report['audits'][audit]['displayValue']}")
PY
