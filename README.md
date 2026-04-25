# turn-service

Microservicio independiente que genera **credenciales TURN temporales firmadas con HMAC-SHA1** para WebRTC.

Está diseñado para desplegarse en **Render** (la parte HTTP/API) mientras que **coturn** (el relay UDP de vídeo) corre en un VPS propio.

---

## ¿Por qué un servicio separado?

| Componente | Protocolo | Dónde corre |
|-----------|-----------|-------------|
| **turn-service** (este repo) | HTTPS / REST API | Render (PaaS) |
| **coturn** | UDP + TCP | VPS propio (Hetzner, DigitalOcean…) |
| **chat-server** | HTTPS + WSS | Render o VPS |

El chat-server llama a turn-service para obtener credenciales TURN justo antes de iniciar una videollamada. Nunca expone la `SERVICE_API_KEY` ni el `TURN_SECRET` al browser.

```
Browser → chat-server → turn-service → [ devuelve ICE servers ]
                                 ↓
Browser ←────────── ICE servers (credenciales HMAC, TTL 24h)
   │
   └──WebRTC P2P──────────────────────────────→ coturn (relay UDP)
```

---

## Estructura del proyecto

```
turn-service/
├── src/
│   ├── index.ts                  # Entry point Express
│   ├── config.ts                 # Variables de entorno tipadas
│   ├── lib/
│   │   └── credentials.ts        # Generación HMAC-SHA1 de credenciales TURN
│   ├── middleware/
│   │   └── apiKey.middleware.ts  # Valida SERVICE_API_KEY
│   └── routes/
│       └── ice.routes.ts         # POST /api/ice-servers
├── coturn/
│   ├── turnserver.conf.template  # Plantilla de configuración de coturn
│   ├── turnserver.conf           # Config generada (no commiteada con secretos)
│   ├── generate-conf.sh          # Script: genera conf desde .env
│   └── setup-coturn.sh           # Script: instala coturn en Ubuntu VPS
├── Dockerfile                    # Para Render o Docker
├── docker-compose.yml            # coturn + turn-service juntos en VPS
├── .env.example
└── README.md
```

---

## API

### `GET /health`

Comprueba que el servicio está vivo. No requiere autenticación.

```json
{
  "status": "ok",
  "service": "turn-credentials",
  "turn": "turn.tudominio.com:3478",
  "env": "production"
}
```

### `POST /api/ice-servers`

Devuelve la configuración ICE con credenciales TURN temporales.

**Headers:**
```
Authorization: Bearer <SERVICE_API_KEY>
Content-Type: application/json
```

**Body:**
```json
{ "userId": "uuid-del-usuario" }
```

**Respuesta `200`:**
```json
{
  "ttl": 86400,
  "iceServers": [
    { "urls": "stun:stun.l.google.com:19302" },
    { "urls": "stun:stun1.l.google.com:19302" },
    {
      "urls": [
        "turn:turn.tudominio.com:3478?transport=udp",
        "turn:turn.tudominio.com:3478?transport=tcp",
        "turns:turn.tudominio.com:5349"
      ],
      "username": "1745000000:uuid-del-usuario",
      "credential": "abc123base64=="
    }
  ]
}
```

**Errores:**
- `401` — Falta el header `Authorization`
- `403` — API key incorrecta

---

## Despliegue

### Opción A — Render (recomendado para la API)

1. **Fork / push** este directorio como repositorio independiente en GitHub, o apunta Render al monorepo con **Root Directory** = `turn-service`.

2. En Render → **New Web Service**:
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `node dist/index.js`
   - **Root Directory**: `turn-service` (si es monorepo)

3. **Variables de entorno** en Render → Environment:

   | Variable | Valor |
   |----------|-------|
   | `NODE_ENV` | `production` |
   | `SERVICE_API_KEY` | `openssl rand -hex 32` |
   | `TURN_SERVER_HOST` | `turn.tudominio.com` |
   | `TURN_PORT` | `3478` |
   | `TURNS_PORT` | `5349` |
   | `TURN_SECRET` | `openssl rand -hex 32` ← **mismo que coturn** |
   | `TURN_TTL` | `86400` |
   | `ALLOWED_ORIGINS` | `https://tu-chat-server.onrender.com` |

4. Render te dará una URL como `https://turn-service-xxxx.onrender.com`. Anótala para configurar el chat-server.

---

### Opción B — Docker Compose en VPS (coturn + turn-service juntos)

Útil si ya tienes un VPS y quieres tenerlo todo junto.

#### Prerrequisitos

- Ubuntu 22.04 / 24.04
- Docker y Docker Compose instalados
- Dominio `turn.tudominio.com` apuntando a la IP del VPS
- Puertos abiertos: `3478/udp`, `3478/tcp`, `5349/udp`, `5349/tcp`, `49152-65535/udp`, `3001/tcp`

#### Pasos

```bash
# 1. Clonar el repositorio en el VPS
git clone https://github.com/tu-usuario/chat.git
cd chat/turn-service

# 2. Crear el .env
cp .env.example .env
nano .env   # rellenar todos los valores

# 3. Obtener certificados SSL con certbot (coturn necesita TLS)
apt install -y certbot
certbot certonly --standalone -d turn.tudominio.com

# 4. Copiar los certificados donde Docker los espera
mkdir -p certs
cp /etc/letsencrypt/live/turn.tudominio.com/fullchain.pem certs/
cp /etc/letsencrypt/live/turn.tudominio.com/privkey.pem certs/

# 5. Generar turnserver.conf desde la plantilla
chmod +x coturn/generate-conf.sh
./coturn/generate-conf.sh

# 6. Levantar los servicios
docker-compose up -d

# 7. Verificar
docker-compose logs -f
curl http://localhost:3001/health
```

#### Renovación automática de certificados

```bash
# Cron para renovar y recargar coturn
echo "0 3 * * * root certbot renew --quiet && docker-compose -f /ruta/turn-service/docker-compose.yml restart coturn" \
  > /etc/cron.d/certbot-turn
```

---

### Opción C — coturn nativo en VPS (sin Docker)

```bash
chmod +x coturn/setup-coturn.sh
# Edita las variables al inicio del script antes de ejecutar
sudo ./coturn/setup-coturn.sh
```

El script instala coturn, obtiene el certificado SSL, configura el firewall y arranca el servicio. Luego despliega el turn-service en Render (Opción A).

---

## Variables de entorno

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `SERVICE_API_KEY` | ✅ | Clave secreta que envía el chat-server |
| `TURN_SERVER_HOST` | ✅ | Dominio del servidor coturn |
| `TURN_SECRET` | ✅ | Secreto compartido con coturn (HMAC) |
| `ALLOWED_ORIGINS` | ✅ | URLs del chat-server separadas por coma |
| `PORT` | — | Puerto HTTP (default: 3001) |
| `TURN_PORT` | — | Puerto UDP/TCP del TURN (default: 3478) |
| `TURNS_PORT` | — | Puerto TLS del TURN (default: 5349) |
| `TURN_TTL` | — | Validez de credenciales en segundos (default: 86400) |

> **Seguridad:** `TURN_SECRET` debe ser idéntico en este servicio y en `turnserver.conf` de coturn. Genera uno con `openssl rand -hex 32` y nunca lo compartas.

---

## Cómo consume el servicio el chat-server

El chat-server añade una ruta protegida `/api/webrtc/ice-servers` que:
1. Verifica que el usuario esté autenticado (JWT)
2. Llama a este servicio con la `SERVICE_API_KEY`
3. Devuelve los ICE servers al browser

El browser **nunca** ve la `SERVICE_API_KEY` ni el `TURN_SECRET`.

Variables de entorno necesarias en el **chat-server**:

```env
TURN_SERVICE_URL=https://turn-service-xxxx.onrender.com
TURN_SERVICE_API_KEY=la_misma_service_api_key
```

---

## Verificar que coturn funciona

Usa la herramienta online de WebRTC:
1. Ve a `https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/`
2. Añade un servidor:
   - **TURN URI**: `turn:turn.tudominio.com:3478?transport=udp`
   - **TURN username**: obtén uno con `POST /api/ice-servers`
   - **TURN password**: el credential del response
3. Haz clic en **Gather candidates** — debes ver candidatos de tipo `relay`

Si ves candidatos `relay`, el TURN está funcionando correctamente.

---

## Desarrollo local

```bash
cp .env.example .env
# Edita .env con valores de prueba (puedes dejar TURN_SERVER_HOST=localhost para pruebas)

npm install
npm run dev
# Servidor en http://localhost:3001

# Probar el endpoint
curl -X POST http://localhost:3001/api/ice-servers \
  -H "Authorization: Bearer tu_service_api_key" \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user-123"}'
```
