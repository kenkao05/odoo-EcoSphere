import { Router } from "express";
import { eq, and, lt, ne } from "drizzle-orm";
import { db } from "../db";
import { complianceIssues, audits } from "../db/schema";
import { requireAuth, requireAdmin, type AuthedRequest } from "../middleware/auth";
import { complianceIssueInsert, complianceIssueUpdate } from "../lib/validation";
import { notify } from "../lib/socket";
import { recalculateDepartmentScore } from "../lib/scoring";

const router = Router();

router.get("/", requireAuth, async (_req, res) => {
  res.json(await db.select().from(complianceIssues));
});

// POST -- creating an issue always requires ownerId + dueDate (enforced by
// zod, see validation.ts) and always notifies the owner immediately.
router.post("/", requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const parsed = complianceIssueInsert.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  const [row] = await db.insert(complianceIssues).values(parsed.data).returning();

  await notify({
    employeeId: row.ownerId,
    type: "compliance_issue_raised",
    message: `New compliance issue assigned to you: "${row.title}" (due ${row.dueDate})`,
    relatedEntityType: "compliance_issue",
    relatedEntityId: row.id,
  });
  await recalculateDepartmentScore(row.departmentId);
  res.status(201).json(row);
});

router.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  const parsed = complianceIssueUpdate.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  const [row] = await db
    .update(complianceIssues)
    .set(parsed.data)
    .where(eq(complianceIssues.id, Number(req.params.id)))
    .returning();
  if (!row) return res.status(404).json({ error: "Not found" });

  await recalculateDepartmentScore(row.departmentId);
  res.json(row);
});

// Run on a schedule (see server.ts -- a setInterval every 6h is enough for a
// demo; a real deployment would use a cron job or Railway's cron plugin).
// Flags every open issue whose due date has passed and notifies its owner.
// PDF Section 8: "issues that pass their Due Date while still Open should be
// flagged (feeds the Notification System)."
export async function flagOverdueIssues() {
  const today = new Date().toISOString().slice(0, 10);
  const overdue = await db
    .select()
    .from(complianceIssues)
    .where(and(eq(complianceIssues.status, "open"), lt(complianceIssues.dueDate, today)));

  for (const issue of overdue) {
    await notify({
      employeeId: issue.ownerId,
      type: "compliance_issue_overdue",
      message: `Overdue: "${issue.title}" was due ${issue.dueDate} and is still open`,
      relatedEntityType: "compliance_issue",
      relatedEntityId: issue.id,
    });
  }
  return overdue.length;
}

export default router;