#!/bin/bash
# Genera turnserver.conf a partir del .env antes de levantar Docker Compose.
# Uso: ./coturn/generate-conf.sh

set -e
source .env

sed \
  -e "s/TURN_PUBLIC_IP_PLACEHOLDER/${TURN_PUBLIC_IP}/g" \
  -e "s/TURN_SERVER_HOST_PLACEHOLDER/${TURN_SERVER_HOST}/g" \
  -e "s/TURN_SECRET_PLACEHOLDER/${TURN_SECRET}/g" \
  coturn/turnserver.conf.template > coturn/turnserver.conf

echo "✅ coturn/turnserver.conf generado"
