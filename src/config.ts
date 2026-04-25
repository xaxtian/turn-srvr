import "dotenv/config";

function require(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Variable de entorno requerida: ${name}`);
  return val;
}

export const config = {
  port: Number(process.env.PORT ?? 3001),
  nodeEnv: process.env.NODE_ENV ?? "development",

  // Clave que deben enviar los consumidores del servicio
  serviceApiKey: require("SERVICE_API_KEY"),

  // CORS
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? "http://localhost:4000")
    .split(",")
    .map((o) => o.trim()),

  turn: {
    host: require("TURN_SERVER_HOST"),
    port: Number(process.env.TURN_PORT ?? 3478),
    tlsPort: Number(process.env.TURNS_PORT ?? 5349),
    secret: require("TURN_SECRET"),
    ttl: Number(process.env.TURN_TTL ?? 86400),
  },
};
