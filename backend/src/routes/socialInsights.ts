import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { employees, whistleblowerReports } from "../db/schema";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { whistleblowerInsert } from "../lib/validation";

const router = Router();

/* ---- Diversity Dashboard ----
   PDF only names "Diversity Metrics, Training Completion" with no fields --
   this endpoint returns AGGREGATE COUNTS ONLY, never a per-employee row with
   gender/salary attached, and suppresses any bucket with fewer than 5 people
   so a small department's individual isn't identifiable by elimination.
   Training Completion is not built -- there's no LMS/training data source
   anywhere in the schema, and inventing one wasn't worth the scope for an
   already-tight build. Flagged, not silently dropped. */
router.get("/diversity", requireAuth, requireAdmin, async (_req, res) => {
  const MIN_BUCKET = 5;

  const genderRows = await db.execute<{ gender: string; count: string }>(sql`
    select gender, count(*) from employees where gender is not null group by gender
  `);
  const ageRows = await db.execute<{ age_band: string; count: string }>(sql`
    select age_band, count(*) from employees where age_band is not null group by age_band
  `);
  const genderByDept = await db.execute<{ department_id: number; gender: string; count: string }>(sql`
    select department_id, gender, count(*) from employees
    where gender is not null and department_id is not null
    group by department_id, gender
  `);

  const suppress = (rows: { count: string }[]) =>
    rows.filter((r) => Number(r.count) >= MIN_BUCKET);

  res.json({
    genderDistribution: suppress(genderRows.rows),
    ageDistribution: suppress(ageRows.rows),
    genderByDepartment: suppress(genderByDept.rows),
    note: "Buckets with fewer than 5 employees are suppressed to prevent re-identification. Pay parity by gender is listed in the PRD as a cut feature -- computing it correctly needs salary-band, not exact-salary, data and a defensible statistical method (median ratio, not mean), which wasn't scoped for this build.",
  });
});

/* ---- Whistleblower Portal ----
   No auth required to submit -- forcing login would attach an identity to
   every report via the session, which defeats the point. Admin queue IS
   auth-gated (read access is restricted, submission is not). */
router.post("/whistleblower", async (req, res) => {
  const parsed = whistleblowerInsert.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });
  const [row] = await db.insert(whistleblowerReports).values(parsed.data).returning();
  res.status(201).json({ id: row.id, status: "submitted" }); // don't echo back the full row -- no reason to
});

router.get("/whistleblower", requireAuth, requireAdmin, async (_req, res) => {
  res.json(await db.select().from(whistleblowerReports));
});

router.put("/whistleblower/:id/status", requireAuth, requireAdmin, async (req, res) => {
  const { status } = req.body ?? {};
  if (!["open", "resolved"].includes(status)) return res.status(400).json({ error: "invalid status" });
  const [row] = await db.update(whistleblowerReports)
    .set({ status })
    .where(sql`id = ${Number(req.params.id)}`)
    .returning();
  res.json(row);
});

export default router;
