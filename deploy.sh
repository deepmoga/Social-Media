#!/bin/bash
set -e

cd /var/www/odm-scheduler

echo "[deploy] Pulling latest code..."
git fetch origin
git reset --hard origin/main

echo "[deploy] Building frontend..."
cd frontend
npm ci --prefer-offline
npm run build
cd ..

echo "[deploy] Fixing nginx config for large uploads..."
NGINX_CONF=$(grep -rl "posting.officialaiagent.in" /etc/nginx/ 2>/dev/null | head -1)
if [ -n "$NGINX_CONF" ]; then
  grep -q 'client_max_body_size' "$NGINX_CONF" && \
    sed -i 's/client_max_body_size .*/client_max_body_size 500M;/' "$NGINX_CONF" || \
    sed -i '/location \/api\//a\        client_max_body_size 500M;' "$NGINX_CONF"
  grep -q 'client_body_timeout' "$NGINX_CONF" || \
    sed -i '/client_max_body_size/a\        client_body_timeout 300s;' "$NGINX_CONF"
  grep -q 'proxy_request_buffering' "$NGINX_CONF" || \
    sed -i '/client_body_timeout/a\        proxy_request_buffering off;' "$NGINX_CONF"
  grep -q 'proxy_send_timeout' "$NGINX_CONF" || \
    sed -i '/proxy_read_timeout/a\        proxy_send_timeout 300s;' "$NGINX_CONF"
  nginx -t && nginx -s reload && echo "[deploy] Nginx reloaded with updated timeouts"
fi

echo "[deploy] Restarting backend..."
pm2 restart odm-backend

echo "[deploy] Done!"
