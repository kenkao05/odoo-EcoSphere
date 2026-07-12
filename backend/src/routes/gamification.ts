import { Router } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db } from "../db";
import {
  challenges, challengeParticipation, employees, rewards, rewardRedemptions, kudos, departments,
} from "../db/schema";
import { requireAuth, requireAdmin, type AuthedRequest } from "../middleware/auth";
import { challengeInsert, challengeUpdate, kudosInsert } from "../lib/validation";
import { notify } from "../lib/socket";
import { checkAndAwardBadges } from "../lib/badgeEngine";

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

router.get("/challenge-participation", requireAuth, requireAdmin, async (_req, res) => {
  res.json(await db.select().from(challengeParticipation));
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
  const xpAwarded = decision === "approved" ? challenge.xp : 0;

  const [row] = await db.update(challengeParticipation)
    .set({ approvalStatus: decision, xpAwarded, progress: decision === "approved" ? 100 : participation.progress })
    .where(eq(challengeParticipation.id, participation.id))
    .returning();

  if (decision === "approved") {
    const [employee] = await db.select().from(employees).where(eq(employees.id, participation.employeeId));
    await db.update(employees)
      .set({ xpTotal: employee.xpTotal + xpAwarded })
      .where(eq(employees.id, participation.employeeId));
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

/* ---- Leaderboard: XP ranking, optional department scope ("Eco-Wars") ---- */
router.get("/leaderboard", requireAuth, async (req, res) => {
  const scope = req.query.department as string | undefined;
  const rows = await db
    .select({
      employeeId: employees.id,
      name: employees.name,
      departmentId: employees.departmentId,
      departmentName: departments.name,
      xpTotal: employees.xpTotal,
    })
    .from(employees)
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .orderBy(desc(employees.xpTotal))
    .limit(50);

  const filtered = scope ? rows.filter((r) => String(r.departmentId) === scope) : rows;
  res.json(filtered.map((r, i) => ({ rank: i + 1, ...r })));
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

/* ---- Kudos: peer-to-peer recognition, fixed 5pt amount, no admin approval ---- */
router.post("/kudos", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = kudosInsert.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });
  if (parsed.data.toEmployeeId === req.user!.id) {
    return res.status(400).json({ error: "You can't give kudos to yourself" });
  }

  const [row] = await db.insert(kudos).values({
    fromEmployeeId: req.user!.id,
    toEmployeeId: parsed.data.toEmployeeId,
    message: parsed.data.message,
  }).returning();

  const [receiver] = await db.select().from(employees).where(eq(employees.id, parsed.data.toEmployeeId));
  await db.update(employees).set({ pointsBalance: receiver.pointsBalance + 5 }).where(eq(employees.id, receiver.id));

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
