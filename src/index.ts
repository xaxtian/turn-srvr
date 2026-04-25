import "express-async-errors";
import express from "express";
import cors from "cors";
import { config } from "./config";
import iceRoutes from "./routes/ice.routes";

const app = express();

app.use(cors({
  origin: (origin, cb) => {
    // Permitir peticiones sin origin (server-to-server) y los orígenes configurados
    if (!origin || config.allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origen no permitido — ${origin}`));
  },
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());

// ── Rutas ─────────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "turn-credentials",
    turn: `${config.turn.host}:${config.turn.port}`,
    env: config.nodeEnv,
  });
});

app.use("/api/ice-servers", iceRoutes);

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.message);
  res.status(500).json({ error: err.message });
});

app.listen(config.port, () => {
  console.log(`\n🔑 turn-service corriendo en http://localhost:${config.port}`);
  console.log(`   TURN host : ${config.turn.host}:${config.turn.port}`);
  console.log(`   TURNS host: ${config.turn.host}:${config.turn.tlsPort}`);
  console.log(`   TTL       : ${config.turn.ttl}s\n`);
});
