#!/usr/bin/env bash
# ─── Create R2 folder structure for all landing pages ───
# R2 doesn't have real folders. This script uploads a tiny .gitkeep
# placeholder into each expected folder so they appear in the
# Cloudflare dashboard. Replace these with real images later.
#
# Usage:  bash scripts/create-r2-folders.sh

set -euo pipefail

BUCKET="fwg-landing"

# All page slugs that call getPageImages(SLUG)
PAGE_SLUGS=(
  commercial-vehicle-wraps
  vehicle-lettering-graphics
  fleet-wraps
  get-quote
  ppf
  ppf-pricing
  ppf-tesla
  ppf-luxury
)

# Per-page folders: hero + up to 4 service cards
PAGE_FOLDERS=(hero service-1 service-2 service-3 service-4)

# Shared before-after folders (wraps pages)
WRAPS_BA_FOLDERS=(
  before-after/before-1
  before-after/after-1
  before-after/before-2
  before-after/after-2
  before-after/before-3
  before-after/after-3
)

# Shared before-after folders (PPF pages)
PPF_BA_FOLDERS=(
  ppf-before-after/before-1
  ppf-before-after/after-1
  ppf-before-after/before-2
  ppf-before-after/after-2
  ppf-before-after/before-3
  ppf-before-after/after-3
)

PLACEHOLDER=$(mktemp)
echo "placeholder" > "$PLACEHOLDER"

echo "Creating R2 folder structure in bucket: $BUCKET"
echo ""

# Create per-page folders
for slug in "${PAGE_SLUGS[@]}"; do
  for folder in "${PAGE_FOLDERS[@]}"; do
    key="${slug}/${folder}/.gitkeep"
    echo "  → ${slug}/${folder}/"
    npx wrangler r2 object put "${BUCKET}/${key}" --file="$PLACEHOLDER" --content-type="text/plain" --remote 2>/dev/null
  done
done

echo ""

# Create shared wraps before-after folders
for folder in "${WRAPS_BA_FOLDERS[@]}"; do
  key="${folder}/.gitkeep"
  echo "  → ${folder}/"
  npx wrangler r2 object put "${BUCKET}/${key}" --file="$PLACEHOLDER" --content-type="text/plain" --remote 2>/dev/null
done

echo ""

# Create shared PPF before-after folders
for folder in "${PPF_BA_FOLDERS[@]}"; do
  key="${folder}/.gitkeep"
  echo "  → ${folder}/"
  npx wrangler r2 object put "${BUCKET}/${key}" --file="$PLACEHOLDER" --content-type="text/plain" --remote 2>/dev/null
done

rm -f "$PLACEHOLDER"

echo ""
echo "Done! All folders are now visible in the Cloudflare R2 dashboard."
echo "Go to: https://dash.cloudflare.com → R2 → fwg-landing"
echo "Drop your real images into each folder — the code picks up whatever file is there."
