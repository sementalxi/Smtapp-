#!/bin/sh
# Runs on every build: creates/updates the database tables and adds the default
# templates. Uses the direct (unpooled) connection when Neon provides one.
set -e
if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is missing. In Vercel: Storage → Create Database → Neon, connect it to this project, then redeploy." >&2
  exit 1
fi
export DATABASE_URL="${DATABASE_URL_UNPOOLED:-$DATABASE_URL}"
npx prisma db push --skip-generate
npx tsx prisma/seed.ts
