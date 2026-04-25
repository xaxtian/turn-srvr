import { Request, Response, NextFunction } from "express";
import { config } from "../config";

/**
 * Valida la API key enviada en el header Authorization: Bearer <key>
 * Solo los servicios autorizados (chat-server) pueden obtener credenciales TURN.
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "API key requerida" });
    return;
  }

  const key = header.slice(7);
  if (key !== config.serviceApiKey) {
    res.status(403).json({ error: "API key inválida" });
    return;
  }

  next();
}
