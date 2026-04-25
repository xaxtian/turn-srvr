#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# setup-coturn.sh — Instala y configura coturn en Ubuntu/Debian (VPS sin Docker)
#
# Uso:
#   chmod +x setup-coturn.sh
#   sudo ./setup-coturn.sh
#
# Variables que debes editar antes de ejecutar:
TURN_DOMAIN="turn.tudominio.com"
TURN_SECRET="$(openssl rand -hex 32)"   # también debe ir en .env del turn-service
PUBLIC_IP=$(curl -s ifconfig.me)         # auto-detecta la IP pública del VPS
# ─────────────────────────────────────────────────────────────────────────────

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Instalando coturn"
echo "  Dominio : $TURN_DOMAIN"
echo "  IP      : $PUBLIC_IP"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. Instalar coturn y certbot
apt-get update -q
apt-get install -y coturn certbot

# 2. Habilitar el daemon
sed -i 's/#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn

# 3. Obtener certificado SSL
# El dominio debe apuntar ya a esta IP
certbot certonly --standalone \
  --non-interactive \
  --agree-tos \
  --email admin@${TURN_DOMAIN} \
  -d ${TURN_DOMAIN}

# Renovación automática
echo "0 3 * * * root certbot renew --quiet && systemctl reload coturn" \
  > /etc/cron.d/certbot-coturn

# 4. Generar configuración
cat > /etc/turnserver.conf << EOF
external-ip=${PUBLIC_IP}
listening-ip=0.0.0.0
listening-port=3478
tls-listening-port=5349
min-port=49152
max-port=65535
realm=${TURN_DOMAIN}
server-name=${TURN_DOMAIN}
use-auth-secret
static-auth-secret=${TURN_SECRET}
cert=/etc/letsencrypt/live/${TURN_DOMAIN}/fullchain.pem
pkey=/etc/letsencrypt/live/${TURN_DOMAIN}/privkey.pem
no-loopback-peers
no-multicast-peers
no-auth
no-cli
log-file=/var/log/turnserver.log
new-log-timestamp
simple-log
EOF

# 5. Abrir puertos en el firewall
ufw allow 3478/udp
ufw allow 3478/tcp
ufw allow 5349/udp
ufw allow 5349/tcp
ufw allow 49152:65535/udp

# 6. Arrancar coturn
systemctl enable coturn
systemctl restart coturn

echo ""
echo "✅ coturn instalado y corriendo"
echo ""
echo "⚠️  IMPORTANTE — copia este secreto al .env del turn-service:"
echo "   TURN_SECRET=${TURN_SECRET}"
echo ""
echo "   Prueba la conexión TURN con:"
echo "   https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/"
echo "   Server: turn:${TURN_DOMAIN}:3478"
echo "   Username: (cualquiera)"   # Solo para prueba, en prod usa credenciales HMAC
