import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import { carbonTransactions, emissionFactors, esgConfiguration, environmentalGoals } from "../db/schema";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { environmentalGoalInsert, environmentalGoalUpdate } from "../lib/validation";
import { recalculateDepartmentScore } from "../lib/scoring";

const router = Router();

/* ---- Environmental Goals (simple CRUD, kept hand-written only because it
   triggers a score recalc on write -- otherwise identical to the factory) ---- */
router.get("/goals", requireAuth, async (_req, res) => {
  res.json(await db.select().from(environmentalGoals));
});
router.post("/goals", requireAuth, requireAdmin, async (req, res) => {
  const parsed = environmentalGoalInsert.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });
  const [row] = await db.insert(environmentalGoals).values(parsed.data).returning();
  await recalculateDepartmentScore(row.departmentId);
  res.status(201).json(row);
});
router.put("/goals/:id", requireAuth, requireAdmin, async (req, res) => {
  const parsed = environmentalGoalUpdate.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });
  const [row] = await db.update(environmentalGoals).set(parsed.data)
    .where(eq(environmentalGoals.id, Number(req.params.id))).returning();
  await recalculateDepartmentScore(row.departmentId);
  res.json(row);
});
router.delete("/goals/:id", requireAuth, requireAdmin, async (req, res) => {
  await db.delete(environmentalGoals).where(eq(environmentalGoals.id, Number(req.params.id)));
  res.status(204).send();
});

/* ---- Carbon Transactions ----
   PDF Section 8: "Auto Emission Calculation -- when enabled, Carbon
   Transactions are calculated automatically from linked Purchase/
   Manufacturing/Expense/Fleet records ... no manual entry required."
   Your stack has no separate Purchase/Manufacturing/Fleet/Expense modules
   (those are ERP modules you aren't building), so "linked record" here means
   whatever your team decides logs a transaction -- e.g. a Fleet mock table,
   or simply this manual-entry endpoint used consistently. Document whichever
   you pick in the demo script; don't claim "automatic" if a human is
   choosing every row, that's the same overclaiming issue as the Odoo
   feature list. */
router.get("/carbon-transactions", requireAuth, async (_req, res) => {
  res.json(await db.select().from(carbonTransactions).orderBy(desc(carbonTransactions.transactionDate)).limit(200));
});

router.post("/carbon-transactions", requireAuth, async (req, res) => {
  const { departmentId, emissionFactorId, sourceType, quantity, transactionDate } = req.body ?? {};
  if (!departmentId || !emissionFactorId || !sourceType || !quantity || !transactionDate) {
    return res.status(422).json({ error: "departmentId, emissionFactorId, sourceType, quantity, transactionDate are required" });
  }

  const [factor] = await db.select().from(emissionFactors).where(eq(emissionFactors.id, emissionFactorId));
  if (!factor) return res.status(404).json({ error: "Unknown emission factor" });

  // co2eAmount is ALWAYS computed server-side from quantity * factor -- never
  // trust a client-supplied co2eAmount, or the "auto calculation" toggle
  // becomes meaningless (anyone could just post a fabricated number).
  const co2eAmount = (Number(quantity) * Number(factor.co2ePerUnit)).toFixed(3);

  const [row] = await db.insert(carbonTransactions).values({
    departmentId, emissionFactorId, sourceType, quantity, co2eAmount, transactionDate,
  }).returning();

  res.status(201).json(row);
});

/* ---- 12-month emissions trend, for the Dashboard chart + forecast line ---- */
router.get("/emissions-trend", requireAuth, async (_req, res) => {
  const rows = await db.execute<{ month: string; total: string }>(`
    select to_char(date_trunc('month', transaction_date), 'YYYY-MM') as month,
           sum(co2e_amount) as total
    from carbon_transactions
    where transaction_date >= (current_date - interval '12 months')
    group by 1 order by 1
  `);
  res.json(rows.rows);
});

export default router;
