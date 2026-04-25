import { Router, Request, Response } from "express";
import { requireApiKey } from "../middleware/apiKey.middleware";
import { buildIceServers } from "../lib/credentials";

const router = Router();

/**
 * POST /api/ice-servers
 *
 * Body: { userId: string }
 * Header: Authorization: Bearer <SERVICE_API_KEY>
 *
 * Devuelve credenciales TURN temporales firmadas con HMAC-SHA1.
 * El userId se incluye en el username para auditoría en los logs de coturn.
 */
router.post("/", requireApiKey, (req: Request, res: Response) => {
  const userId = (req.body?.userId as string | undefined) ?? "anonymous";
  const payload = buildIceServers(userId);
  res.json(payload);
});

export default router;
