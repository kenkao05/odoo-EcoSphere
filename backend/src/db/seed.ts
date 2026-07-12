import "dotenv/config";
import bcrypt from "bcrypt";
import { db, pool } from "./index";
import {
  departments, categories, emissionFactors, employees, badges, rewards,
  esgPolicies, challenges, esgConfiguration, notificationSettings,
} from "./schema";
import { recalculateDepartmentScore } from "../lib/scoring";

// Run once before the demo: `npm run seed`. Idempotent-ish (safe to re-run on
// a fresh db); NOT safe to re-run against a db that already has this data,
// since departments.code and employees.email are unique and will conflict.
// If you need to re-seed mid-hackathon, drop and re-migrate first.
async function seed() {
  console.log("Seeding EcoSphere demo data...");

  const [mfg] = await db.insert(departments).values({ name: "Manufacturing", code: "MFG", head: "S. Nair", employeeCount: 0 }).returning();
  const [logi] = await db.insert(departments).values({ name: "Logistics", code: "LOG", head: "R. Iyer", parentDepartmentId: mfg.id, employeeCount: 0 }).returning();
  const [corp] = await db.insert(departments).values({ name: "Corporate", code: "COR", head: "A. Mehta", employeeCount: 0 }).returning();

  const [csrCat] = await db.insert(categories).values({ name: "Environmental CSR", type: "csr_activity" }).returning();
  await db.insert(categories).values({ name: "Sustainability Challenge", type: "challenge" });

  await db.insert(emissionFactors).values([
    { name: "Diesel Combustion", scope: "scope_1", activityType: "fuel_combustion", unit: "liter", co2ePerUnit: "2.68", source: "GHG Protocol 2025" },
    { name: "Grid Electricity", scope: "scope_2", activityType: "purchased_electricity", unit: "kWh", co2ePerUnit: "0.71", source: "GHG Protocol 2025" },
  ]);

  const adminHash = await bcrypt.hash("admin1234", 10);
  const empHash = await bcrypt.hash("employee1234", 10);
  const [admin] = await db.insert(employees).values({
    name: "Admin User", email: "admin@ecosphere.demo", passwordHash: adminHash,
    role: "admin", departmentId: corp.id,
  }).returning();
  const [emp1] = await db.insert(employees).values({
    name: "Aditi Rao", email: "employee@ecosphere.demo", passwordHash: empHash,
    role: "employee", departmentId: mfg.id, gender: "female", ageBand: "20-29", xpTotal: 120, pointsBalance: 40,
  }).returning();
  await db.insert(employees).values({
    name: "Karan Shah", email: "karan@ecosphere.demo", passwordHash: empHash,
    role: "employee", departmentId: logi.id, gender: "male", ageBand: "30-39", xpTotal: 80, pointsBalance: 20,
  });

  await db.insert(badges).values([
    { name: "Green Beginner", description: "Awarded at 50 XP", unlockRuleType: "xp_threshold", unlockRuleValue: 50, icon: "sprout" },
    { name: "Sustainability Champion", description: "Awarded at 500 XP", unlockRuleType: "xp_threshold", unlockRuleValue: 500, icon: "trophy" },
    { name: "Team Player", description: "3 completed challenges", unlockRuleType: "challenges_completed", unlockRuleValue: 3, icon: "users" },
  ]);

  await db.insert(rewards).values([
    { name: "Eco-Friendly Tote Bag", pointsRequired: 30, stock: 25 },
    { name: "Tree Plantation Certificate", pointsRequired: 50, stock: 100 },
    { name: "₹500 Voucher", pointsRequired: 200, stock: 10 },
  ]);

  await db.insert(esgPolicies).values({
    title: "Anti-Corruption Policy", category: "governance", effectiveDate: "2026-01-01",
  });

  await db.insert(challenges).values({
    categoryId: 2, title: "Zero Waste Week", xp: 100, difficulty: "medium",
    deadline: "2026-08-01", status: "active",
  });

  // Singleton config rows — id defaults to 1 in schema, but Postgres serial
  // still needs an explicit insert once.
  await db.insert(esgConfiguration).values({});
  await db.insert(notificationSettings).values({});

  // v3 fix: without this, department_scores has zero rows for the current
  // period until some admin action triggers a recalc, which means the
  // Dashboard's 4 KPI tiles and department ranking chart show all zeros the
  // moment you log in right after seeding — the exact opposite of demo
  // script step 1 ("show the Dashboard: 4 live KPI tiles"). Recalculating
  // all three departments here means the dashboard is populated immediately.
  await recalculateDepartmentScore(mfg.id);
  await recalculateDepartmentScore(logi.id);
  await recalculateDepartmentScore(corp.id);

  console.log("Seed complete. Demo logins:");
  console.log("  admin@ecosphere.demo / admin1234");
  console.log("  employee@ecosphere.demo / employee1234");
  await pool.end();
}

seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});