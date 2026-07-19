#!/usr/bin/env bash
# Deploy the display/archive site to Vercel.
#
# This script temporarily writes .env.production so Next.js inlines
# the archive env vars at build time. The file is removed after deploy
# (and is NOT committed to git).

set -euo pipefail
cd "$(dirname "$0")/.."

BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "master" ]; then
  echo "ERROR: Must deploy from master branch (currently on $BRANCH)"
  exit 1
fi

ENVFILE=".env.production"
VERCEL_BAK=".vercel/project.json.bak"

# Guard: never leave .env.production behind
cleanup() {
  rm -f "$ENVFILE"
  [ -f "$VERCEL_BAK" ] && cp "$VERCEL_BAK" .vercel/project.json && rm -f "$VERCEL_BAK"
}
trap cleanup EXIT

# Source the real Supabase credentials from .env.local
SUPABASE_URL=$(grep NEXT_PUBLIC_SUPABASE_URL .env.local | cut -d= -f2)
ANON_KEY=$(grep NEXT_PUBLIC_SUPABASE_ANON_KEY .env.local | cut -d= -f2)
SERVICE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d= -f2)

# Write temporary .env.production for Next.js build-time inlining
cat > "$ENVFILE" <<EOF
NEXT_PUBLIC_PRODUCT_MODE=world_cup_2026_archive
PRODUCT_MODE=world_cup_2026_archive
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY
WC_ARCHIVE_COMPETITION_ID=1a4448e5-a178-45ab-b819-a0dfab370306
WC_ARCHIVE_DEMO_USER_ID=8c7e2e1b-0564-4d86-93e2-85ecf00f1e00
EOF

echo "Wrote $ENVFILE"

# Switch to display project
cp .vercel/project.json "$VERCEL_BAK"
vercel link --project predictsport-display --yes 2>&1 | tail -1

# Deploy
vercel deploy --prod \
  --env PRODUCT_MODE=world_cup_2026_archive \
  --env "SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY" \
  --env "NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL" \
  --env "NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY" \
  --env WC_ARCHIVE_COMPETITION_ID=1a4448e5-a178-45ab-b819-a0dfab370306 \
  --env WC_ARCHIVE_DEMO_USER_ID=8c7e2e1b-0564-4d86-93e2-85ecf00f1e00

echo "Deploy complete. .env.production cleaned up by trap."
