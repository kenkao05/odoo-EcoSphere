import { Router, type Request, type Response } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db } from "../db";
import {
  challenges, challengeParticipation, employees, rewards, rewardRedemptions, kudos, departments,
} from "../db/schema";
import { requireAuth, requireAdmin, type AuthedRequest } from "../middleware/auth";
import { challengeInsert, challengeUpdate, kudosInsert } from "../lib/validation";
import { notify } from "../lib/socket";
import { checkAndAwardBadges } from "../lib/badgeEngine";
import { upload, toPublicUrl, handleUploadError } from "../middleware/upload";

const router = Router();

/* ---- Challenges (lifecycle: draft -> active -> under_review -> completed | archived) ---- */
router.get("/challenges", requireAuth, async (_req, res) => {
  res.json(await db.select().from(challenges));
});
router.post("/challenges", requireAuth, requireAdmin, async (req, res) => {
  const parsed = challengeInsert.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });
  const [row] = await db.insert(challenges).values(parsed.data).returning();
  res.status(201).json(row);
});
router.put("/challenges/:id", requireAuth, requireAdmin, async (req, res) => {
  const parsed = challengeUpdate.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });
  const [row] = await db.update(challenges).set(parsed.data)
    .where(eq(challenges.id, Number(req.params.id))).returning();
  res.json(row);
});

router.post("/challenges/:id/join", requireAuth, async (req: AuthedRequest, res) => {
  const [row] = await db.insert(challengeParticipation).values({
    challengeId: Number(req.params.id),
    employeeId: req.user!.id,
    approvalStatus: "pending",
  }).returning();
  res.status(201).json(row);
});

/* ---- Attach proof to a challenge submission ----
   Same real multer flow as social.ts's CSR proof endpoint -- this route
   previously did not exist at all, so evidenceRequired challenges had no
   way to actually receive evidence. */
router.put(
  "/challenge-participation/:id/proof",
  requireAuth,
  upload.single("file"),
  handleUploadError,
  async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ error: "A file is required (field name: file)" });

    const [existing] = await db.select().from(challengeParticipation)
      .where(eq(challengeParticipation.id, Number(req.params.id)));
    if (!existing) return res.status(404).json({ error: "Participation record not found" });

    const [row] = await db.update(challengeParticipation)
      .set({ proofUrl: toPublicUrl(req.file.filename) })
      .where(eq(challengeParticipation.id, existing.id))
      .returning();
    res.json(row);
  },
);

router.get("/challenge-participation", requireAuth, requireAdmin, async (_req, res) => {
  res.json(await db.select().from(challengeParticipation));
});

// Employee-scoped view, same reasoning as social.ts's /participation/mine —
// an employee needs their own participation row IDs to attach proof to.
router.get("/challenge-participation/mine", requireAuth, async (req: AuthedRequest, res) => {
  const rows = await db
    .select({
      id: challengeParticipation.id,
      challengeId: challengeParticipation.challengeId,
      challengeTitle: challenges.title,
      evidenceRequired: challenges.evidenceRequired,
      proofUrl: challengeParticipation.proofUrl,
      progress: challengeParticipation.progress,
      approvalStatus: challengeParticipation.approvalStatus,
      xpAwarded: challengeParticipation.xpAwarded,
    })
    .from(challengeParticipation)
    .leftJoin(challenges, eq(challengeParticipation.challengeId, challenges.id))
    .where(eq(challengeParticipation.employeeId, req.user!.id));
  res.json(rows);
});

// Approving a challenge: awards XP, updates employee.xpTotal, then runs the
// badge engine (which checks Settings > auto_award_badges internally).
router.put("/challenge-participation/:id/decision", requireAuth, requireAdmin, async (req, res) => {
  const { decision } = req.body ?? {};
  if (!["approved", "rejected"].includes(decision)) {
    return res.status(400).json({ error: "decision must be 'approved' or 'rejected'" });
  }
  const [participation] = await db.select().from(challengeParticipation)
    .where(eq(challengeParticipation.id, Number(req.params.id)));
  if (!participation) return res.status(404).json({ error: "Not found" });

  const [challenge] = await db.select().from(challenges).where(eq(challenges.id, participation.challengeId));

  // Same "not optional" rule as CSR activities (PDF Section 8): a challenge
  // flagged evidenceRequired cannot be approved without an attached proof
  // file. This check was previously missing from this endpoint entirely.
  if (decision === "approved" && challenge.evidenceRequired && !participation.proofUrl) {
    return res.status(422).json({ error: "This challenge requires proof before it can be approved" });
  }

  const xpAwarded = decision === "approved" ? challenge.xp : 0;

  const [row] = await db.update(challengeParticipation)
    .set({
      approvalStatus: decision, xpAwarded,
      progress: decision === "approved" ? 100 : participation.progress,
      respondedAt: new Date(), // v3: backs the Recent Activity feed's sort order
    })
    .where(eq(challengeParticipation.id, participation.id))
    .returning();

  if (decision === "approved") {
    // v3 fix: was a plain read-then-write (select xpTotal, then update to
    // xpTotal + xpAwarded) -- the same lost-update race that reward
    // redemption was deliberately wrapped in a transaction to avoid,
    // just left unfixed here. Two approvals landing close together for the
    // same employee could silently drop one award. Now atomic.
    await db.transaction(async (tx) => {
      const [employee] = await tx.select().from(employees).where(eq(employees.id, participation.employeeId));
      await tx.update(employees)
        .set({ xpTotal: employee.xpTotal + xpAwarded })
        .where(eq(employees.id, participation.employeeId));
    });
    await checkAndAwardBadges(participation.employeeId);
  }

  await notify({
    employeeId: participation.employeeId,
    type: "approval_decision",
    message: `Your challenge submission was ${decision}${xpAwarded ? ` (+${xpAwarded} XP)` : ""}`,
    relatedEntityType: "challenge_participation",
    relatedEntityId: row.id,
  });

  res.json(row);
});

/* ---- Leaderboard: XP ranking, optional department scope ("Eco-Wars") ----
   v3 fix: previously did .orderBy(xp desc).limit(50) across the WHOLE org,
   then filtered to a department in JS afterward -- a department whose
   members weren't in the org-wide top 50 could show incomplete or empty
   results even with real XP. Department filter is now a SQL WHERE, applied
   before ORDER BY/LIMIT, so a department-scoped query sees all of that
   department's employees ranked among themselves, not a leftover slice of
   an unrelated global ranking. */
router.get("/leaderboard", requireAuth, async (req, res) => {
  const scope = req.query.department as string | undefined;

  const base = db
    .select({
      employeeId: employees.id,
      name: employees.name,
      departmentId: employees.departmentId,
      departmentName: departments.name,
      xpTotal: employees.xpTotal,
    })
    .from(employees)
    .leftJoin(departments, eq(employees.departmentId, departments.id));

  const rows = scope
    ? await base.where(eq(employees.departmentId, Number(scope))).orderBy(desc(employees.xpTotal)).limit(50)
    : await base.orderBy(desc(employees.xpTotal)).limit(50);

  res.json(rows.map((r, i) => ({ rank: i + 1, ...r })));
});

/* ---- Rewards catalog + redemption (transactional: stock and points move together) ---- */
router.get("/rewards", requireAuth, async (_req, res) => {
  res.json(await db.select().from(rewards));
});

router.post("/rewards/:id/redeem", requireAuth, async (req: AuthedRequest, res) => {
  const rewardId = Number(req.params.id);

  // Wrapped in a transaction: a failed insert must not leave stock decremented
  // (or vice versa) -- this is the "stock deduction" business rule from PDF
  // Section 8, made atomic instead of two separate queries that could race.
  try {
    const result = await db.transaction(async (tx) => {
      const [reward] = await tx.select().from(rewards).where(eq(rewards.id, rewardId));
      if (!reward) throw new Error("NOT_FOUND");
      if (reward.stock < 1) throw new Error("OUT_OF_STOCK");

      const [employee] = await tx.select().from(employees).where(eq(employees.id, req.user!.id));
      if (employee.pointsBalance < reward.pointsRequired) throw new Error("INSUFFICIENT_POINTS");

      await tx.update(rewards).set({ stock: reward.stock - 1 }).where(eq(rewards.id, rewardId));
      await tx.update(employees)
        .set({ pointsBalance: employee.pointsBalance - reward.pointsRequired })
        .where(eq(employees.id, employee.id));

      const [redemption] = await tx.insert(rewardRedemptions).values({
        employeeId: employee.id, rewardId, pointsSpent: reward.pointsRequired,
      }).returning();
      return redemption;
    });
    res.status(201).json(result);
  } catch (e: any) {
    const map: Record<string, [number, string]> = {
      NOT_FOUND: [404, "Reward not found"],
      OUT_OF_STOCK: [409, "This reward is out of stock"],
      INSUFFICIENT_POINTS: [402, "Not enough points to redeem this reward"],
    };
    const [status, message] = map[e.message] ?? [500, "Redemption failed"];
    res.status(status).json({ error: message });
  }
});

/* ---- Kudos: peer-to-peer recognition, fixed 5pt amount, no admin approval ----
   Frontend (added v3): "Kudos" tab in Gamification/index.jsx -- pick a
   colleague, send a message, see the feed. v2 built this endpoint with no
   way to reach it from the UI at all. */
router.post("/kudos", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = kudosInsert.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });
  if (parsed.data.toEmployeeId === req.user!.id) {
    return res.status(400).json({ error: "You can't give kudos to yourself" });
  }

  // v3 fix: points award is now atomic with the kudos row, same reasoning
  // as the challenge-XP fix above -- was read-then-write before.
  const row = await db.transaction(async (tx) => {
    const [inserted] = await tx.insert(kudos).values({
      fromEmployeeId: req.user!.id,
      toEmployeeId: parsed.data.toEmployeeId,
      message: parsed.data.message,
    }).returning();

    const [receiver] = await tx.select().from(employees).where(eq(employees.id, parsed.data.toEmployeeId));
    await tx.update(employees).set({ pointsBalance: receiver.pointsBalance + 5 }).where(eq(employees.id, receiver.id));
    return inserted;
  });

  await notify({
    employeeId: parsed.data.toEmployeeId,
    type: "kudos_received",
    message: `You received kudos: "${parsed.data.message}"`,
    relatedEntityType: "kudos",
    relatedEntityId: row.id,
  });

  res.status(201).json(row);
});

router.get("/kudos/feed", requireAuth, async (_req, res) => {
  res.json(await db.select().from(kudos).orderBy(desc(kudos.createdAt)).limit(30));
});

export default router;