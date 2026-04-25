import { createHmac } from "crypto";
import { config } from "../config";

export interface TurnCredentials {
  username: string;
  credential: string;
  ttl: number;
}

/**
 * Genera credenciales TURN temporales usando HMAC-SHA1.
 *
 * Mecanismo REST API de coturn (use-auth-secret):
 *   username  = "<expiry_timestamp>:<userId>"
 *   credential = HMAC-SHA1(TURN_SECRET, username) en base64
 *
 * coturn verifica la firma usando el mismo secreto compartido,
 * y rechaza credenciales cuyo timestamp ya expiró.
 */
export function generateTurnCredentials(userId: string): TurnCredentials {
  const { secret, ttl } = config.turn;
  const expiry = Math.floor(Date.now() / 1000) + ttl;
  const username = `${expiry}:${userId}`;
  const credential = createHmac("sha1", secret).update(username).digest("base64");
  return { username, credential, ttl };
}

/**
 * Construye la lista de ICE servers lista para pasar a RTCPeerConnection / SimplePeer.
 */
export function buildIceServers(userId: string) {
  const { host, port, tlsPort } = config.turn;
  const { username, credential, ttl } = generateTurnCredentials(userId);

  return {
    ttl,
    iceServers: [
      // STUN público de Google como fallback gratuito
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      // TURN propio — TCP y UDP, con y sin TLS
      {
        urls: [
          `turn:${host}:${port}?transport=udp`,
          `turn:${host}:${port}?transport=tcp`,
          `turns:${host}:${tlsPort}`,
        ],
        username,
        credential,
      },
    ],
  };
}
