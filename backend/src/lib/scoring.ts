import { eq, and, sql, gte, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  departments, environmentalGoals, carbonTransactions, employeeParticipation,
  policyAcknowledgements, employees, complianceIssues, departmentScores, esgConfiguration,
} from "../db/schema";

// Call this after: a carbon transaction is logged, a CSR participation is
// approved/rejected, a policy is acknowledged, or a compliance issue changes
// status. It is intentionally synchronous and called inline (not queued) --
// at this data volume a recalculation is milliseconds, and "always current"
// is simpler to reason about in an 8-hour build than eventual consistency.
export async function recalculateDepartmentScore(departmentId: number) {
  const period = new Date().toISOString().slice(0, 7); // "2026-07"

  // --- Environmental: goal progress ratio, averaged ---
  const goals = await db.select().from(environmentalGoals).where(eq(environmentalGoals.departmentId, departmentId));
  const envScore = goals.length
    ? Math.min(100, (goals.reduce((sum, g) => {
        const target = Number(g.targetCo2);
        const current = Number(g.currentCo2);
        const progress = target > 0 ? Math.max(0, 1 - current / target) : 0;
        return sum + progress * 100;
      }, 0) / goals.length))
    : 100; // no goals set yet -> don't penalize

  // --- Social: CSR approval rate + policy acknowledgement rate ---
  const deptEmployees = await db.select().from(employees).where(eq(employees.departmentId, departmentId));
  const employeeIds = deptEmployees.map((e) => e.id);

  let csrRate = 100;
  if (employeeIds.length) {
    const [{ total, approved }] = await db
      .select({
        total: sql<number>`count(*)`,
        approved: sql<number>`count(*) filter (where ${employeeParticipation.approvalStatus} = 'approved')`,
      })
      .from(employeeParticipation)
      .where(inArray(employeeParticipation.employeeId, employeeIds));
    csrRate = Number(total) > 0 ? (Number(approved) / Number(total)) * 100 : 100;
  }

  let ackRate = 100;
  if (employeeIds.length) {
    const [{ total, acked }] = await db
      .select({
        total: sql<number>`count(*)`,
        acked: sql<number>`count(*) filter (where ${policyAcknowledgements.acknowledgedAt} is not null)`,
      })
      .from(policyAcknowledgements)
      .where(inArray(policyAcknowledgements.employeeId, employeeIds));
    ackRate = Number(total) > 0 ? (Number(acked) / Number(total)) * 100 : 100;
  }
  const socialScore = (csrRate + ackRate) / 2;

  // --- Governance: resolved vs open compliance issues, overdue penalized double ---
  const issues = await db.select().from(complianceIssues).where(eq(complianceIssues.departmentId, departmentId));
  let govScore = 100;
  if (issues.length) {
    const today = new Date().toISOString().slice(0, 10);
    const penalty = issues.reduce((sum, i) => {
      if (i.status === "resolved") return sum;
      const overdue = i.dueDate < today;
      return sum + (overdue ? 20 : 10); // overdue-while-open weighted 2x, per PDF Section 8
    }, 0);
    govScore = Math.max(0, 100 - penalty);
  }

  // --- Overall: org-configurable weighting, default 40/30/30 ---
  const [config] = await db.select().from(esgConfiguration);
  const w = {
    env: Number(config?.environmentalWeight ?? 40) / 100,
    soc: Number(config?.socialWeight ?? 30) / 100,
    gov: Number(config?.governanceWeight ?? 30) / 100,
  };
  const totalScore = envScore * w.env + socialScore * w.soc + govScore * w.gov;

  await db
    .insert(departmentScores)
    .values({
      departmentId, period,
      environmentalScore: envScore.toFixed(2),
      socialScore: socialScore.toFixed(2),
      governanceScore: govScore.toFixed(2),
      totalScore: totalScore.toFixed(2),
    })
    .onConflictDoUpdate({
      target: [departmentScores.departmentId, departmentScores.period],
      set: {
        environmentalScore: envScore.toFixed(2),
        socialScore: socialScore.toFixed(2),
        governanceScore: govScore.toFixed(2),
        totalScore: totalScore.toFixed(2),
        updatedAt: new Date(),
      },
    });
}

// Overall org-wide score for the Dashboard's 4 KPI tiles: average of every
// department's latest-period score, then re-weighted the same way.
export async function getOrgScores() {
  const period = new Date().toISOString().slice(0, 7);
  const rows = await db.select().from(departmentScores).where(eq(departmentScores.period, period));
  if (!rows.length) return { environmental: 0, social: 0, governance: 0, overall: 0 };

  const avg = (key: "environmentalScore" | "socialScore" | "governanceScore" | "totalScore") =>
    rows.reduce((s, r) => s + Number(r[key]), 0) / rows.length;

  return {
    environmental: Math.round(avg("environmentalScore")),
    social: Math.round(avg("socialScore")),
    governance: Math.round(avg("governanceScore")),
    overall: Math.round(avg("totalScore")),
  };
}