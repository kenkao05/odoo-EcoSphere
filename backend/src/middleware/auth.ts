import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthedRequest extends Request {
  user?: { id: number; role: "admin" | "employee"; departmentId: number | null };
}

// Every protected route calls this first. Reads "Authorization: Bearer <token>",
// verifies it against JWT_SECRET, and attaches the decoded payload to req.user
// so downstream handlers can do req.user!.id without re-verifying anything.
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed Authorization header" });
  }
  const token = header.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as AuthedRequest["user"];
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Chain AFTER requireAuth on any route that should be admin-only (all writes
// to master data, approval decisions, compliance issue creation, settings).
// Kept as a separate middleware rather than folded into requireAuth so
// employee-readable GETs don't need two near-identical auth functions.
export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}
