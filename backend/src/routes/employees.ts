import { Router } from "express";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { employees, departments } from "../db/schema";
import { requireAuth, requireAdmin, type AuthedRequest } from "../middleware/auth";
import { employeeInsert, employeeUpdate } from "../lib/validation";

const router = Router();

function strip(e: typeof employees.$inferSelect) {
  const { passwordHash, ...safe } = e;
  return safe;
}

// List employees — used by the admin approval queues (Social, Gamification)
// to show names instead of raw IDs, and by Settings > Departments detail.
router.get("/", requireAuth, requireAdmin, async (_req, res) => {
  const rows = await db.select().from(employees);
  res.json(rows.map(strip));
});

router.post("/", requireAuth, requireAdmin, async (req, res) => {
  const parsed = employeeInsert.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  const existing = await db.select().from(employees).where(eq(employees.email, parsed.data.email));
  if (existing.length) return res.status(409).json({ error: "An employee with this email already exists" });

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const { password, ...rest } = parsed.data;
  const [row] = await db.insert(employees).values({ ...rest, passwordHash }).returning();

  if (row.departmentId) {
    await db.update(departments)
      .set({ employeeCount: (await deptCount(row.departmentId)) })
      .where(eq(departments.id, row.departmentId));
  }
  res.status(201).json(strip(row));
});

router.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  const parsed = employeeUpdate.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });
  const [row] = await db.update(employees).set(parsed.data)
    .where(eq(employees.id, Number(req.params.id))).returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(strip(row));
});

router.get("/:id", requireAuth, async (req, res) => {
  const [row] = await db.select().from(employees).where(eq(employees.id, Number(req.params.id)));
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(strip(row));
});

async function deptCount(departmentId: number) {
  const rows = await db.select().from(employees).where(eq(employees.departmentId, departmentId));
  return rows.length;
}

export default router;
