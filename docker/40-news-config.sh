#!/bin/sh
set -eu

# Encode values so quotes, backslashes, or line breaks cannot change the script.
encode() {
  printf '%s' "$1" | base64 | tr -d '\n'
}

cat > /usr/share/nginx/html/config.js <<EOF
window.__NEWS_CONFIG__ = {
  VITE_NEWS_API_KEY: atob("$(encode "${VITE_NEWS_API_KEY:-}")"),
  VITE_GUARDIAN_API_KEY: atob("$(encode "${VITE_GUARDIAN_API_KEY:-}")"),
  VITE_NYT_API_KEY: atob("$(encode "${VITE_NYT_API_KEY:-}")")
};
EOF
