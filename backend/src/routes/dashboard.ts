import { Router } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db } from "../db";
import { notifications, departmentScores, departments, carbonTransactions } from "../db/schema";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { getOrgScores } from "../lib/scoring";

const router = Router();

/* ---- Recent Activity (v3) ----
   The original wireframe's Dashboard has a "Recent Activity" feed (challenge
   completions, compliance issues, carbon transactions, policy
   acknowledgements) that v2 never built and never flagged as cut. This
   unions the four most recent event types into one feed sorted by time,
   read-only, capped at 10 rows -- deliberately simple (one UNION query, no
   new table) rather than introducing a generic "activity log" table this
   late, which would be new schema for a cosmetic feature. */
router.get("/recent-activity", requireAuth, async (_req, res) => {
  const rows = await db.execute<{ kind: string; label: string; happened_at: string }>(sql`
    (select 'challenge_completed' as kind,
            e.name || ' completed a challenge (+' || cp.xp_awarded || ' XP)' as label,
            cp.id::text as happened_at
     from challenge_participation cp
     join employees e on e.id = cp.employee_id
     where cp.approval_status = 'approved'
     order by cp.id desc limit 5)
    union all
    (select 'compliance_issue' as kind,
            'New compliance issue: ' || ci.title as label,
            ci.created_at::text as happened_at
     from compliance_issues ci
     order by ci.created_at desc limit 5)
    union all
    (select 'carbon_transaction' as kind,
            ct.co2e_amount || ' kg CO2e logged (' || ct.source_type || ')' as label,
            ct.created_at::text as happened_at
     from carbon_transactions ct
     order by ct.created_at desc limit 5)
    union all
    (select 'policy_ack' as kind,
            e.name || ' acknowledged "' || p.title || '"' as label,
            pa.acknowledged_at::text as happened_at
     from policy_acknowledgements pa
     join employees e on e.id = pa.employee_id
     join esg_policies p on p.id = pa.policy_id
     where pa.acknowledged_at is not null
     order by pa.acknowledged_at desc limit 5)
    order by happened_at desc nulls last limit 10
  `);
  res.json(rows.rows);
});

router.get("/notifications", requireAuth, async (req: AuthedRequest, res) => {
  const rows = await db.select().from(notifications)
    .where(eq(notifications.employeeId, req.user!.id))
    .orderBy(desc(notifications.createdAt))
    .limit(50);
  res.json(rows);
});

router.put("/notifications/:id/read", requireAuth, async (req, res) => {
  const [row] = await db.update(notifications).set({ read: true })
    .where(eq(notifications.id, Number(req.params.id))).returning();
  res.json(row);
});

/* ---- Dashboard: 4 KPI tiles + department ranking bar chart ---- */
router.get("/summary", requireAuth, async (_req, res) => {
  const scores = await getOrgScores();
  const period = new Date().toISOString().slice(0, 7);
  const ranking = await db
    .select({ department: departments.name, score: departmentScores.totalScore })
    .from(departmentScores)
    .leftJoin(departments, eq(departmentScores.departmentId, departments.id))
    .where(eq(departmentScores.period, period));
  res.json({ scores, departmentRanking: ranking });
});

/* ---- Predictive ESG Forecasting, simplified honestly ----
   This is ordinary least-squares linear regression over the last 6 months of
   emissions, extrapolated 1 quarter forward. It is NOT a trained ML model --
   labeling it "AI-powered" in the pitch would be the same overclaiming
   problem flagged for the Odoo features. Call it "Projected trend" in the UI. */
router.get("/emissions-forecast", requireAuth, async (_req, res) => {
  const rows = await db.execute<{ month: string; total: string }>(sql`
    select to_char(date_trunc('month', transaction_date), 'YYYY-MM') as month, sum(co2e_amount) as total
    from carbon_transactions
    where transaction_date >= (current_date - interval '6 months')
    group by 1 order by 1
  `);
  const points = rows.rows.map((r, i) => ({ x: i, y: Number(r.total) }));
  if (points.length < 2) return res.json({ projected: [], note: "Not enough history to project a trend yet." });

  const n = points.length;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX || 1);
  const intercept = (sumY - slope * sumX) / n;

  const projected = [1, 2, 3].map((step) => ({
    monthsAhead: step,
    projectedCo2e: Math.max(0, Number((intercept + slope * (n - 1 + step)).toFixed(2))),
  }));

  res.json({ projected, method: "linear_regression_ols", basis: `${n} months of history` });
});

export default router;