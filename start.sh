#!/bin/sh
set -eu

cd "$(dirname "$0")"

trap 'docker compose stop' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

docker compose up --build --detach --wait

url=$(docker compose exec -T app node -p '
  const { APP_URL } = process.env;
  const url = URL.canParse(APP_URL) && new URL(APP_URL);
  url && ["http:", "https:"].includes(url.protocol) ? url.origin : "http://localhost:5000"
')
printf '\nCRM is ready at %s\nPress Ctrl+C to stop the CRM.\n\n' "$url"

docker compose logs --follow --tail 0
