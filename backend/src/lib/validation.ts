import { z } from "zod";

export const departmentInsert = z.object({
  name: z.string().min(1).max(120),
  code: z.string().min(1).max(20),
  head: z.string().max(120).optional(),
  parentDepartmentId: z.number().int().positive().optional().nullable(),
  status: z.enum(["active", "inactive"]).optional(),
});
export const departmentUpdate = departmentInsert.partial();

export const categoryInsert = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["csr_activity", "challenge"]),
  status: z.enum(["active", "inactive"]).optional(),
});
export const categoryUpdate = categoryInsert.partial();

export const emissionFactorInsert = z.object({
  name: z.string().min(1).max(150),
  scope: z.enum(["scope_1", "scope_2", "scope_3"]),
  activityType: z.string().min(1).max(100),
  unit: z.string().min(1).max(30),
  co2ePerUnit: z.number().positive(),
  source: z.string().max(150).optional(),
});
export const emissionFactorUpdate = emissionFactorInsert.partial();

export const productEsgProfileInsert = z.object({
  name: z.string().min(1).max(150),
  sku: z.string().min(1).max(60),
  footprintPerUnitKgCo2e: z.number().nonnegative().optional(),
  sustainableSourcing: z.boolean().optional(),
  recyclablePackaging: z.boolean().optional(),
  notes: z.string().optional(),
});
export const productEsgProfileUpdate = productEsgProfileInsert.partial();

export const environmentalGoalInsert = z.object({
  name: z.string().min(1).max(150),
  departmentId: z.number().int().positive(),
  targetCo2: z.number().positive(),
  currentCo2: z.number().nonnegative().optional(),
  deadline: z.string(), // ISO date
  status: z.enum(["active", "on_track", "at_risk", "completed"]).optional(),
});
export const environmentalGoalUpdate = environmentalGoalInsert.partial();

export const esgPolicyInsert = z.object({
  title: z.string().min(1).max(150),
  category: z.enum(["environmental", "social", "governance"]),
  version: z.string().max(20).optional(),
  effectiveDate: z.string(),
  documentUrl: z.string().url().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});
export const esgPolicyUpdate = esgPolicyInsert.partial();

export const badgeInsert = z.object({
  name: z.string().min(1).max(80),
  description: z.string().optional(),
  unlockRuleType: z.enum(["xp_threshold", "challenges_completed"]),
  unlockRuleValue: z.number().int().positive(),
  icon: z.string().max(50).optional(),
});
export const badgeUpdate = badgeInsert.partial();

export const rewardInsert = z.object({
  name: z.string().min(1).max(120),
  description: z.string().optional(),
  pointsRequired: z.number().int().positive(),
  stock: z.number().int().nonnegative(),
  status: z.enum(["active", "inactive"]).optional(),
});
export const rewardUpdate = rewardInsert.partial();

export const auditInsert = z.object({
  title: z.string().min(1).max(150),
  departmentId: z.number().int().positive(),
  auditor: z.string().min(1).max(120),
  date: z.string(),
  findings: z.string().optional(),
  status: z.enum(["scheduled", "under_review", "completed"]).optional(),
});
export const auditUpdate = auditInsert.partial();

// Compliance Issue: Owner + Due Date are required at the schema level, not just
// the UI level -- this is what makes the PDF's "not optional" rule enforceable.
export const complianceIssueInsert = z.object({
  auditId: z.number().int().positive().optional(),
  title: z.string().min(1).max(150),
  description: z.string().optional(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  departmentId: z.number().int().positive(),
  ownerId: z.number().int().positive(),
  dueDate: z.string(),
});
export const complianceIssueUpdate = complianceIssueInsert.partial().extend({
  status: z.enum(["open", "resolved"]).optional(),
});

export const csrActivityInsert = z.object({
  categoryId: z.number().int().positive(),
  name: z.string().min(1).max(150),
  description: z.string().optional(),
  evidenceRequired: z.boolean().optional(),
  date: z.string(),
  departmentId: z.number().int().positive().optional(),
});
export const csrActivityUpdate = csrActivityInsert.partial();

export const challengeInsert = z.object({
  categoryId: z.number().int().positive(),
  title: z.string().min(1).max(150),
  description: z.string().optional(),
  xp: z.number().int().positive(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  evidenceRequired: z.boolean().optional(),
  deadline: z.string(),
  status: z.enum(["draft", "active", "under_review", "completed", "archived"]).optional(),
});
export const challengeUpdate = challengeInsert.partial();

export const kudosInsert = z.object({
  toEmployeeId: z.number().int().positive(),
  message: z.string().min(1).max(200),
});

export const whistleblowerInsert = z.object({
  category: z.enum(["ethics", "safety", "financial", "harassment", "other"]),
  description: z.string().min(10).max(4000),
  departmentId: z.number().int().positive().optional(),
});

// Employee accounts. Not in masterData's makeCrudRouter list because creation
// needs a bcrypt hash step the generic factory doesn't know how to do — see
// routes/employees.ts. gender/ageBand/salaryBand are optional and only ever
// surfaced in aggregate on the D&I dashboard (socialInsights.ts).
export const employeeInsert = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  role: z.enum(["admin", "employee"]).optional(),
  departmentId: z.number().int().positive().optional().nullable(),
  gender: z.enum(["male", "female", "non_binary", "undisclosed"]).optional(),
  ageBand: z.enum(["20-29", "30-39", "40-49", "50+"]).optional(),
  salaryBand: z.string().max(20).optional(),
});
export const employeeUpdate = employeeInsert.partial().omit({ password: true }).extend({
  status: z.enum(["active", "inactive"]).optional(),
});