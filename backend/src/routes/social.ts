import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import {
  csrActivities, employeeParticipation, employees, esgConfiguration, departments,
} from "../db/schema";
import { requireAuth, requireAdmin, type AuthedRequest } from "../middleware/auth";
import { csrActivityInsert, csrActivityUpdate } from "../lib/validation";
import { notify } from "../lib/socket";
import { recalculateDepartmentScore } from "../lib/scoring";

const router = Router();

/* ---- CSR Activities (simple CRUD, admin creates/edits) ---- */
router.get("/csr-activities", requireAuth, async (_req, res) => {
  res.json(await db.select().from(csrActivities));
});
router.post("/csr-activities", requireAuth, requireAdmin, async (req, res) => {
  const parsed = csrActivityInsert.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });
  const [row] = await db.insert(csrActivities).values(parsed.data).returning();
  res.status(201).json(row);
});

/* ---- Employee joins an activity: creates a pending participation row ---- */
router.post("/csr-activities/:id/join", requireAuth, async (req: AuthedRequest, res) => {
  const [row] = await db.insert(employeeParticipation).values({
    employeeId: req.user!.id,
    csrActivityId: Number(req.params.id),
    approvalStatus: "pending",
  }).returning();
  res.status(201).json(row);
});

/* ---- Employee (or admin on their behalf) attaches proof ---- */
router.put("/participation/:id/proof", requireAuth, async (req, res) => {
  const { proofUrl } = req.body ?? {};
  if (!proofUrl) return res.status(400).json({ error: "proofUrl is required" });
  const [row] = await db.update(employeeParticipation)
    .set({ proofUrl })
    .where(eq(employeeParticipation.id, Number(req.params.id)))
    .returning();
  res.json(row);
});

/* ---- Admin approval queue ---- */
router.get("/participation", requireAuth, requireAdmin, async (_req, res) => {
  res.json(await db.select().from(employeeParticipation));
});

// PDF Section 8: "Evidence Requirement -- when enabled, participation cannot
// be marked Approved without an attached proof file." Enforced here, not just
// hidden in the UI, so the rule holds even if someone calls the API directly.
router.put("/participation/:id/decision", requireAuth, requireAdmin, async (req, res) => {
  const { decision, points } = req.body ?? {}; // decision: "approved" | "rejected"
  if (!["approved", "rejected"].includes(decision)) {
    return res.status(400).json({ error: "decision must be 'approved' or 'rejected'" });
  }

  const [participation] = await db.select().from(employeeParticipation)
    .where(eq(employeeParticipation.id, Number(req.params.id)));
  if (!participation) return res.status(404).json({ error: "Not found" });

  const [activity] = await db.select().from(csrActivities).where(eq(csrActivities.id, participation.csrActivityId));
  const [config] = await db.select().from(esgConfiguration);
  const evidenceRequired = config?.evidenceRequiredForCsr && activity?.evidenceRequired;

  if (decision === "approved" && evidenceRequired && !participation.proofUrl) {
    return res.status(422).json({ error: "This activity requires proof before it can be approved" });
  }

  const [row] = await db.update(employeeParticipation)
    .set({
      approvalStatus: decision,
      pointsEarned: decision === "approved" ? (points ?? 10) : 0,
      completionDate: decision === "approved" ? new Date().toISOString().slice(0, 10) : null,
    })
    .where(eq(employeeParticipation.id, participation.id))
    .returning();

  if (decision === "approved") {
    await db.update(employees)
      .set({ pointsBalance: (await currentBalance(participation.employeeId)) + (points ?? 10) })
      .where(eq(employees.id, participation.employeeId));
  }

  await notify({
    employeeId: participation.employeeId,
    type: "approval_decision",
    message: `Your CSR activity submission was ${decision}`,
    relatedEntityType: "employee_participation",
    relatedEntityId: row.id,
  });

  const [employee] = await db.select().from(employees).where(eq(employees.id, participation.employeeId));
  if (employee?.departmentId) await recalculateDepartmentScore(employee.departmentId);

  res.json(row);
});

async function currentBalance(employeeId: number) {
  const [e] = await db.select().from(employees).where(eq(employees.id, employeeId));
  return e?.pointsBalance ?? 0;
}

export default router;
