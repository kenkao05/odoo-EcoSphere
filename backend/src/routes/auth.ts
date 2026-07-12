import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { employees } from "../db/schema";
import { requireAuth, type AuthedRequest } from "../middleware/auth";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// No public /register — per PRD decision, accounts are seeded (see
// db/seed.ts) or created by an admin via POST /api/employees. Building a
// real signup flow (email verification, password reset, etc.) was
// deliberately cut from the 8-hour scope; two seeded demo accounts
// (admin@ecosphere.demo / employee@ecosphere.demo) are enough to demo every
// role-gated feature.
router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  const [employee] = await db.select().from(employees).where(eq(employees.email, parsed.data.email));
  if (!employee) return res.status(401).json({ error: "Invalid email or password" });

  const valid = await bcrypt.compare(parsed.data.password, employee.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid email or password" });

  const token = jwt.sign(
    { id: employee.id, role: employee.role, departmentId: employee.departmentId },
    process.env.JWT_SECRET as string,
    { expiresIn: "12h" }, // long enough to cover a demo slot without re-login
  );

  // Never send passwordHash back, even hashed — no reason for the client to have it.
  const { passwordHash, ...safeEmployee } = employee;
  res.json({ token, employee: safeEmployee });
});

router.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const [employee] = await db.select().from(employees).where(eq(employees.id, req.user!.id));
  if (!employee) return res.status(404).json({ error: "Not found" });
  const { passwordHash, ...safeEmployee } = employee;
  res.json(safeEmployee);
});

export default router;
