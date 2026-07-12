import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import {
  csrActivities, employeeParticipation, employees, esgConfiguration, departments,
} from "../db/schema";
import { requireAuth, requireAdmin, type AuthedRequest } from "../middleware/auth";
import { csrActivityInsert, csrActivityUpdate } from "../lib/validation";
import { notify } from "../lib/socket";
import { recalculateDepartmentScore } from "../lib/scoring";
import { upload, toPublicUrl, handleUploadError } from "../middleware/upload";

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

/* ---- Employee (or admin on their behalf) attaches proof ----
   Real file upload via multer, local disk storage (see middleware/upload.ts).
   Frontend sends multipart/form-data with a single field named "file";
   this stores it under backend/uploads/ and writes the served path back
   onto the participation row. handleUploadError catches wrong-type/too-large
   before it ever reaches this handler. */
router.put(
  "/participation/:id/proof",
  requireAuth,
  upload.single("file"),
  handleUploadError,
  async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ error: "A file is required (field name: file)" });

    const [existing] = await db.select().from(employeeParticipation)
      .where(eq(employeeParticipation.id, Number(req.params.id)));
    if (!existing) return res.status(404).json({ error: "Participation record not found" });

    const [row] = await db.update(employeeParticipation)
      .set({ proofUrl: toPublicUrl(req.file.filename) })
      .where(eq(employeeParticipation.id, existing.id))
      .returning();
    res.json(row);
  },
);

/* ---- Admin approval queue ---- */
router.get("/participation", requireAuth, requireAdmin, async (_req, res) => {
  res.json(await db.select().from(employeeParticipation));
});

// Employee-scoped view of their own submissions. Without this, an employee
// has no way to discover the participation row ID they need to PUT proof
// against — /participation above is admin-only. Joins in the activity title
// so the frontend doesn't need a second lookup per row.
router.get("/participation/mine", requireAuth, async (req: AuthedRequest, res) => {
  const rows = await db
    .select({
      id: employeeParticipation.id,
      csrActivityId: employeeParticipation.csrActivityId,
      activityTitle: csrActivities.name,
      evidenceRequired: csrActivities.evidenceRequired,
      proofUrl: employeeParticipation.proofUrl,
      approvalStatus: employeeParticipation.approvalStatus,
      pointsEarned: employeeParticipation.pointsEarned,
    })
    .from(employeeParticipation)
    .leftJoin(csrActivities, eq(employeeParticipation.csrActivityId, csrActivities.id))
    .where(eq(employeeParticipation.employeeId, req.user!.id));
  res.json(rows);
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
    // v3 fix: was read-then-write via the currentBalance() helper below --
    // same lost-update race fixed in gamification.ts's challenge-XP and
    // kudos endpoints this version. currentBalance() is removed; the read
    // now happens inside the transaction that also does the write.
    await db.transaction(async (tx) => {
      const [employee] = await tx.select().from(employees).where(eq(employees.id, participation.employeeId));
      await tx.update(employees)
        .set({ pointsBalance: employee.pointsBalance + (points ?? 10) })
        .where(eq(employees.id, participation.employeeId));
    });
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

export default router;