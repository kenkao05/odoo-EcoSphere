import { eq, and, sql } from "drizzle-orm";
import { db } from "../db";
import { badges, employees, challengeParticipation, esgConfiguration, employeeBadges } from "../db/schema";
import { notify } from "./socket";

// Call this after ANY event that changes an employee's XP or completed-challenge
// count: challenge approval, CSR activity approval. Settings toggle
// (auto_award_badges) is checked once here so callers don't have to remember to.
export async function checkAndAwardBadges(employeeId: number) {
  const [config] = await db.select().from(esgConfiguration);
  if (config && !config.autoAwardBadges) return [];

  const [employee] = await db.select().from(employees).where(eq(employees.id, employeeId));
  if (!employee) return [];

  const [{ completedCount }] = await db
    .select({ completedCount: sql<number>`count(*)` })
    .from(challengeParticipation)
    .where(and(
      eq(challengeParticipation.employeeId, employeeId),
      eq(challengeParticipation.approvalStatus, "approved"),
    ));

  const allBadges = await db.select().from(badges);
  const alreadyHave = await db.select().from(employeeBadges).where(eq(employeeBadges.employeeId, employeeId));
  const haveIds = new Set(alreadyHave.map((b) => b.badgeId));

  const newlyAwarded: typeof allBadges = [];
  for (const badge of allBadges) {
    if (haveIds.has(badge.id)) continue;
    const metric = badge.unlockRuleType === "xp_threshold" ? employee.xpTotal : Number(completedCount);
    if (metric >= badge.unlockRuleValue) {
      await db.insert(employeeBadges).values({ employeeId, badgeId: badge.id });
      newlyAwarded.push(badge);
      await notify({
        employeeId,
        type: "badge_unlock",
        message: `You unlocked the "${badge.name}" badge!`,
        relatedEntityType: "badge",
        relatedEntityId: badge.id,
      });
    }
  }
  return newlyAwarded;
}