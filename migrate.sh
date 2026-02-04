#!/bin/bash

# Load environment variables from .env.local
set -a
source .env.local
set +a

# Run the migration
npx tsx app/scripts/migrate-legacy-config.ts
