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

echo "[deploy] Fixing nginx upload limit..."
NGINX_CONF=$(grep -rl "posting.officialaiagent.in" /etc/nginx/ 2>/dev/null | head -1)
if [ -n "$NGINX_CONF" ]; then
  if ! grep -q "client_max_body_size" "$NGINX_CONF"; then
    sed -i 's/server_name posting.officialaiagent.in/server_name posting.officialaiagent.in;\n    client_max_body_size 500M/' "$NGINX_CONF"
    echo "[deploy] Added client_max_body_size 500M to $NGINX_CONF"
  else
    sed -i 's/client_max_body_size .*/client_max_body_size 500M;/' "$NGINX_CONF"
    echo "[deploy] Updated client_max_body_size in $NGINX_CONF"
  fi
  nginx -t && nginx -s reload && echo "[deploy] Nginx reloaded"
fi

echo "[deploy] Restarting backend..."
pm2 restart odm-backend

echo "[deploy] Done!"
