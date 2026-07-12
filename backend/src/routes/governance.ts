import { Router } from "express";
import { eq, and, isNull } from "drizzle-orm";
import { db } from "../db";
import { policyAcknowledgements, esgPolicies, employees } from "../db/schema";
import { requireAuth, requireAdmin, type AuthedRequest } from "../middleware/auth";
import { notify } from "../lib/socket";
import { recalculateDepartmentScore } from "../lib/scoring";

const router = Router();

// Admin view: every policy x every employee, showing who has/hasn't acknowledged.
// Built as a left join rather than only returning existing rows, since an
// employee who has NEVER acknowledged a policy has no row at all yet.
router.get("/policy-acknowledgements", requireAuth, requireAdmin, async (_req, res) => {
  const rows = await db
    .select({
      id: policyAcknowledgements.id,
      policyId: esgPolicies.id,
      policyTitle: esgPolicies.title,
      employeeId: employees.id,
      employeeName: employees.name,
      acknowledgedAt: policyAcknowledgements.acknowledgedAt,
    })
    .from(esgPolicies)
    .leftJoin(employees, eq(employees.status, "active"))
    .leftJoin(
      policyAcknowledgements,
      and(eq(policyAcknowledgements.policyId, esgPolicies.id), eq(policyAcknowledgements.employeeId, employees.id)),
    );
  res.json(rows);
});

// Employee-facing: policies THEY haven't acknowledged yet (drives a "Pending
// Acknowledgement" banner/list on their view of Governance).
router.get("/policy-acknowledgements/pending", requireAuth, async (req: AuthedRequest, res) => {
  const acked = await db.select().from(policyAcknowledgements)
    .where(and(eq(policyAcknowledgements.employeeId, req.user!.id), eq(policyAcknowledgements.acknowledgedAt as any, null)));
  const ackedPolicyIds = new Set(
    (await db.select().from(policyAcknowledgements).where(eq(policyAcknowledgements.employeeId, req.user!.id)))
      .filter((a) => a.acknowledgedAt)
      .map((a) => a.policyId),
  );
  const allPolicies = await db.select().from(esgPolicies).where(eq(esgPolicies.status, "active"));
  res.json(allPolicies.filter((p) => !ackedPolicyIds.has(p.id)));
});

// Employee acknowledges a policy — upsert so re-acknowledging (e.g. after a
// policy version bump) doesn't create duplicate rows; the unique index on
// (policyId, employeeId) in schema.ts is what makes onConflictDoUpdate safe here.
router.post("/policy-acknowledgements/:policyId", requireAuth, async (req: AuthedRequest, res) => {
  const policyId = Number(req.params.policyId);
  const [row] = await db
    .insert(policyAcknowledgements)
    .values({ policyId, employeeId: req.user!.id, acknowledgedAt: new Date() })
    .onConflictDoUpdate({
      target: [policyAcknowledgements.policyId, policyAcknowledgements.employeeId],
      set: { acknowledgedAt: new Date() },
    })
    .returning();

  const [employee] = await db.select().from(employees).where(eq(employees.id, req.user!.id));
  if (employee?.departmentId) await recalculateDepartmentScore(employee.departmentId);
  res.status(201).json(row);
});

// Manual trigger for "policy acknowledgement reminders" (PDF Section 8
// notification list). Not on an automatic schedule for the hackathon build —
// an admin clicks "Send Reminders" in Settings; wiring it to a cron job is a
// one-line addition (see server.ts's setInterval pattern for compliance
// overdue checks) if you want it automatic post-hackathon.
router.post("/policy-acknowledgements/:policyId/remind", requireAuth, requireAdmin, async (req, res) => {
  const policyId = Number(req.params.policyId);
  const [policy] = await db.select().from(esgPolicies).where(eq(esgPolicies.id, policyId));
  if (!policy) return res.status(404).json({ error: "Policy not found" });

  const acked = await db.select().from(policyAcknowledgements).where(eq(policyAcknowledgements.policyId, policyId));
  const ackedIds = new Set(acked.filter((a) => a.acknowledgedAt).map((a) => a.employeeId));
  const allEmployees = await db.select().from(employees).where(eq(employees.status, "active"));
  const pending = allEmployees.filter((e) => !ackedIds.has(e.id));

  for (const e of pending) {
    await notify({
      employeeId: e.id,
      type: "policy_reminder",
      message: `Reminder: please acknowledge "${policy.title}"`,
      relatedEntityType: "esg_policy",
      relatedEntityId: policy.id,
    });
  }
  res.json({ remindersSent: pending.length });
});

export default router;
