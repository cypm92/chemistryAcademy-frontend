#!/bin/sh
set -eu

image=${1:-chemistry-academy-frontend:ci}
container=$(docker run -d --rm --add-host backend:127.0.0.1 -p 127.0.0.1::80 "$image")
trap 'docker stop "$container" >/dev/null 2>&1 || true' EXIT
port=$(docker port "$container" 80/tcp | sed 's/.*://')
worker=$(docker exec "$container" sh -c 'for f in /usr/share/nginx/html/assets/pdf.worker*.mjs; do test -f "$f" && basename "$f" && exit 0; done; exit 1')
javascript=$(docker exec "$container" sh -c 'for f in /usr/share/nginx/html/assets/*.js; do test -f "$f" && basename "$f" && exit 0; done; exit 1')
css=$(docker exec "$container" sh -c 'for f in /usr/share/nginx/html/assets/*.css; do test -f "$f" && basename "$f" && exit 0; done; exit 1')

check_type() {
  path=$1
  expected=$2
  actual=$(curl -fsSI "http://127.0.0.1:$port$path" | tr -d '\r' | sed -n 's/^[Cc]ontent-[Tt]ype: //p')
  case "$actual" in
    "$expected"|"$expected;"*) printf 'OK %s: %s\n' "$path" "$actual" ;;
    *) printf 'FAIL %s: expected %s, got %s\n' "$path" "$expected" "$actual" >&2; exit 1 ;;
  esac
}

check_type "/assets/$worker" application/javascript
check_type "/assets/$javascript" application/javascript
check_type "/assets/$css" text/css
check_type /index.html text/html
