import {
  pgTable, serial, varchar, text, integer, numeric, boolean, timestamp,
  date, pgEnum, uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/* ============================================================
   ENUMS
   ============================================================ */
export const roleEnum = pgEnum("role", ["admin", "employee"]);
export const statusEnum = pgEnum("status", ["active", "inactive"]);
export const categoryTypeEnum = pgEnum("category_type", ["csr_activity", "challenge"]);
export const approvalStatusEnum = pgEnum("approval_status", ["pending", "approved", "rejected"]);
export const challengeStatusEnum = pgEnum("challenge_status", [
  "draft", "active", "under_review", "completed", "archived",
]);
export const severityEnum = pgEnum("severity", ["low", "medium", "high", "critical"]);
export const issueStatusEnum = pgEnum("issue_status", ["open", "resolved"]);
export const auditStatusEnum = pgEnum("audit_status", ["scheduled", "under_review", "completed"]);
export const emissionScopeEnum = pgEnum("emission_scope", ["scope_1", "scope_2", "scope_3"]);
export const sourceTypeEnum = pgEnum("source_type", [
  "purchase", "manufacturing", "fleet", "expense", "manual",
]);
export const notificationTypeEnum = pgEnum("notification_type", [
  "compliance_issue_raised", "compliance_issue_overdue", "approval_decision",
  "policy_reminder", "badge_unlock", "kudos_received",
]);
export const genderEnum = pgEnum("gender", ["male", "female", "non_binary", "undisclosed"]);

/* ============================================================
   MASTER DATA
   ============================================================ */

export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  head: varchar("head", { length: 120 }),
  parentDepartmentId: integer("parent_department_id"),
  employeeCount: integer("employee_count").default(0).notNull(),
  status: statusEnum("status").default("active").notNull(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  type: categoryTypeEnum("type").notNull(),
  status: statusEnum("status").default("active").notNull(),
});

// Key Fields undefined in the source PDF ("-"). Filled using GHG Protocol
// Scope 1/2/3 classification, the industry-standard schema for this model.
export const emissionFactors = pgTable("emission_factors", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 150 }).notNull(),
  scope: emissionScopeEnum("scope").notNull(),
  activityType: varchar("activity_type", { length: 100 }).notNull(), // e.g. "fuel_combustion", "purchased_electricity"
  unit: varchar("unit", { length: 30 }).notNull(), // e.g. "liter", "kWh", "kg"
  co2ePerUnit: numeric("co2e_per_unit", { precision: 12, scale: 6 }).notNull(), // kgCO2e per unit
  source: varchar("source", { length: 150 }), // e.g. "GHG Protocol / DEFRA 2025"
});

// Key Fields undefined in source PDF. Filled with a minimal, defensible schema.
export const productEsgProfiles = pgTable("product_esg_profiles", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 150 }).notNull(),
  sku: varchar("sku", { length: 60 }).notNull().unique(),
  footprintPerUnitKgCo2e: numeric("footprint_per_unit_kg_co2e", { precision: 12, scale: 3 }),
  sustainableSourcing: boolean("sustainable_sourcing").default(false).notNull(),
  recyclablePackaging: boolean("recyclable_packaging").default(false).notNull(),
  notes: text("notes"),
});

export const environmentalGoals = pgTable("environmental_goals", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 150 }).notNull(),
  departmentId: integer("department_id").notNull().references(() => departments.id),
  targetCo2: numeric("target_co2", { precision: 12, scale: 2 }).notNull(),
  currentCo2: numeric("current_co2", { precision: 12, scale: 2 }).default("0").notNull(),
  deadline: date("deadline").notNull(),
  status: varchar("status", { length: 30 }).default("active").notNull(), // active | on_track | at_risk | completed
});

export const esgPolicies = pgTable("esg_policies", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 150 }).notNull(),
  category: varchar("category", { length: 30 }).notNull(), // environmental | social | governance
  version: varchar("version", { length: 20 }).default("1.0").notNull(),
  effectiveDate: date("effective_date").notNull(),
  documentUrl: varchar("document_url", { length: 300 }),
  status: statusEnum("status").default("active").notNull(),
});

export const badges = pgTable("badges", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 80 }).notNull(),
  description: text("description"),
  unlockRuleType: varchar("unlock_rule_type", { length: 30 }).notNull(), // xp_threshold | challenges_completed
  unlockRuleValue: integer("unlock_rule_value").notNull(),
  icon: varchar("icon", { length: 50 }).default("award").notNull(), // lucide-react icon name
});

export const rewards = pgTable("rewards", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description"),
  pointsRequired: integer("points_required").notNull(),
  stock: integer("stock").notNull(),
  status: statusEnum("status").default("active").notNull(),
});

// Not in the source PDF's master data table. Required for auth, D&I dashboard,
// and every FK below that references "employee". Fields kept minimal and
// aggregate-only on the D&I dashboard (see Social/DiversityDashboard.jsx) to
// avoid exposing individual pay/gender rows.
export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 150 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: roleEnum("role").default("employee").notNull(),
  departmentId: integer("department_id").references(() => departments.id),
  gender: genderEnum("gender"),
  ageBand: varchar("age_band", { length: 20 }), // "20-29" | "30-39" | "40-49" | "50+"
  salaryBand: varchar("salary_band", { length: 20 }), // banded, never exact figure
  xpTotal: integer("xp_total").default(0).notNull(),
  pointsBalance: integer("points_balance").default(0).notNull(),
  status: statusEnum("status").default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ============================================================
   TRANSACTIONAL DATA
   ============================================================ */

export const carbonTransactions = pgTable("carbon_transactions", {
  id: serial("id").primaryKey(),
  departmentId: integer("department_id").notNull().references(() => departments.id),
  emissionFactorId: integer("emission_factor_id").notNull().references(() => emissionFactors.id),
  sourceType: sourceTypeEnum("source_type").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
  co2eAmount: numeric("co2e_amount", { precision: 12, scale: 3 }).notNull(), // quantity * emissionFactor.co2ePerUnit, computed server-side
  transactionDate: date("transaction_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const csrActivities = pgTable("csr_activities", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull().references(() => categories.id),
  name: varchar("name", { length: 150 }).notNull(),
  description: text("description"),
  evidenceRequired: boolean("evidence_required").default(false).notNull(),
  date: date("date").notNull(),
  departmentId: integer("department_id").references(() => departments.id),
  status: varchar("status", { length: 30 }).default("open").notNull(),
});

// PDF is explicit: tracks CSR Activity participation ONLY. Kept separate
// from challengeParticipation per the spec, despite the wireframe's merged
// "Activity/Challenge" table header.
export const employeeParticipation = pgTable("employee_participation", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employees.id),
  csrActivityId: integer("csr_activity_id").notNull().references(() => csrActivities.id),
  proofUrl: varchar("proof_url", { length: 300 }),
  approvalStatus: approvalStatusEnum("approval_status").default("pending").notNull(),
  pointsEarned: integer("points_earned").default(0).notNull(),
  completionDate: date("completion_date"),
});

export const challenges = pgTable("challenges", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull().references(() => categories.id),
  title: varchar("title", { length: 150 }).notNull(),
  description: text("description"),
  xp: integer("xp").notNull(),
  difficulty: varchar("difficulty", { length: 20 }).notNull(), // easy | medium | hard
  evidenceRequired: boolean("evidence_required").default(false).notNull(),
  deadline: date("deadline").notNull(),
  status: challengeStatusEnum("status").default("draft").notNull(),
});

export const challengeParticipation = pgTable("challenge_participation", {
  id: serial("id").primaryKey(),
  challengeId: integer("challenge_id").notNull().references(() => challenges.id),
  employeeId: integer("employee_id").notNull().references(() => employees.id),
  progress: integer("progress").default(0).notNull(), // 0-100
  proofUrl: varchar("proof_url", { length: 300 }),
  approvalStatus: approvalStatusEnum("approval_status").default("pending").notNull(),
  xpAwarded: integer("xp_awarded").default(0).notNull(),
  // v3: needed so the Dashboard's Recent Activity feed can sort challenge
  // completions chronologically against compliance issues / carbon
  // transactions / policy acks, which all already had a real timestamp
  // column. Without this there was nothing to sort by except the row's
  // serial id, which doesn't interleave correctly with ISO timestamp
  // strings from the other three event types in a UNION ORDER BY.
  respondedAt: timestamp("responded_at"),
});

export const policyAcknowledgements = pgTable("policy_acknowledgements", {
  id: serial("id").primaryKey(),
  policyId: integer("policy_id").notNull().references(() => esgPolicies.id),
  employeeId: integer("employee_id").notNull().references(() => employees.id),
  acknowledgedAt: timestamp("acknowledged_at"),
}, (t) => ({
  onePerEmployeePerPolicy: uniqueIndex("policy_employee_unique").on(t.policyId, t.employeeId),
}));

export const audits = pgTable("audits", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 150 }).notNull(),
  departmentId: integer("department_id").notNull().references(() => departments.id),
  auditor: varchar("auditor", { length: 120 }).notNull(),
  date: date("date").notNull(),
  findings: text("findings"),
  status: auditStatusEnum("status").default("scheduled").notNull(),
});

// Business rule (PDF Section 8): Owner + Due Date are NOT optional.
// The wireframe's Compliance Issues table omits both -- added here per spec,
// not per wireframe.
export const complianceIssues = pgTable("compliance_issues", {
  id: serial("id").primaryKey(),
  auditId: integer("audit_id").references(() => audits.id),
  title: varchar("title", { length: 150 }).notNull(),
  description: text("description"),
  severity: severityEnum("severity").notNull(),
  departmentId: integer("department_id").notNull().references(() => departments.id),
  ownerId: integer("owner_id").notNull().references(() => employees.id),
  dueDate: date("due_date").notNull(),
  status: issueStatusEnum("status").default("open").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const departmentScores = pgTable("department_scores", {
  id: serial("id").primaryKey(),
  departmentId: integer("department_id").notNull().references(() => departments.id),
  environmentalScore: numeric("environmental_score", { precision: 5, scale: 2 }).notNull(),
  socialScore: numeric("social_score", { precision: 5, scale: 2 }).notNull(),
  governanceScore: numeric("governance_score", { precision: 5, scale: 2 }).notNull(),
  totalScore: numeric("total_score", { precision: 5, scale: 2 }).notNull(),
  period: varchar("period", { length: 20 }).notNull(), // "2026-07"
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  onePerDeptPerPeriod: uniqueIndex("dept_period_unique").on(t.departmentId, t.period),
}));

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employees.id),
  type: notificationTypeEnum("type").notNull(),
  message: varchar("message", { length: 300 }).notNull(),
  relatedEntityType: varchar("related_entity_type", { length: 50 }),
  relatedEntityId: integer("related_entity_id"),
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Reward Redemption -- PDF Section 8: "in scope, not optional."
export const rewardRedemptions = pgTable("reward_redemptions", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employees.id),
  rewardId: integer("reward_id").notNull().references(() => rewards.id),
  pointsSpent: integer("points_spent").notNull(),
  redeemedAt: timestamp("redeemed_at").defaultNow().notNull(),
});

// Tracks which badges an employee already holds. Not listed in the source
// PDF's data model (it only defines the Badge itself), but required to avoid
// re-awarding the same badge every time checkAndAwardBadges() runs.
export const employeeBadges = pgTable("employee_badges", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employees.id),
  badgeId: integer("badge_id").notNull().references(() => badges.id),
  awardedAt: timestamp("awarded_at").defaultNow().notNull(),
}, (t) => ({
  onePerEmployeePerBadge: uniqueIndex("emp_badge_unique").on(t.employeeId, t.badgeId),
}));

/* ---- Added features (see PRD Appendix A for feasibility verdicts) ---- */

// "Peer-to-Peer Kudos" -- standalone equivalent, NOT an Odoo Chatter integration.
export const kudos = pgTable("kudos", {
  id: serial("id").primaryKey(),
  fromEmployeeId: integer("from_employee_id").notNull().references(() => employees.id),
  toEmployeeId: integer("to_employee_id").notNull().references(() => employees.id),
  points: integer("points").default(5).notNull(), // fixed small amount, not configurable, to prevent gaming
  message: varchar("message", { length: 200 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// "Whistleblower Portal" -- deliberately has NO submitter/employeeId/ip column.
// Anonymity is structural (the field doesn't exist), not access-controlled.
export const whistleblowerReports = pgTable("whistleblower_reports", {
  id: serial("id").primaryKey(),
  category: varchar("category", { length: 60 }).notNull(), // "ethics" | "safety" | "financial" | "harassment" | "other"
  description: text("description").notNull(),
  departmentId: integer("department_id").references(() => departments.id), // optional, reporter's choice
  status: varchar("status", { length: 30 }).default("open").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ============================================================
   SETTINGS (single-organization -> one row each)
   ============================================================ */

export const esgConfiguration = pgTable("esg_configuration", {
  id: serial("id").primaryKey().default(1),
  environmentalWeight: numeric("environmental_weight", { precision: 4, scale: 2 }).default("40.00").notNull(),
  socialWeight: numeric("social_weight", { precision: 4, scale: 2 }).default("30.00").notNull(),
  governanceWeight: numeric("governance_weight", { precision: 4, scale: 2 }).default("30.00").notNull(),
  autoEmissionCalc: boolean("auto_emission_calc").default(true).notNull(),
  evidenceRequiredForCsr: boolean("evidence_required_for_csr").default(true).notNull(),
  autoAwardBadges: boolean("auto_award_badges").default(true).notNull(),
});

export const notificationSettings = pgTable("notification_settings", {
  id: serial("id").primaryKey().default(1),
  complianceAlerts: boolean("compliance_alerts").default(true).notNull(),
  approvalDecisions: boolean("approval_decisions").default(true).notNull(),
  policyReminders: boolean("policy_reminders").default(true).notNull(),
  badgeUnlocks: boolean("badge_unlocks").default(true).notNull(),
});

/* ============================================================
   RELATIONS (for Drizzle's relational query API)
   ============================================================ */
export const employeesRelations = relations(employees, ({ one, many }) => ({
  department: one(departments, { fields: [employees.departmentId], references: [departments.id] }),
  participation: many(employeeParticipation),
  challengeParticipation: many(challengeParticipation),
}));

export const complianceIssuesRelations = relations(complianceIssues, ({ one }) => ({
  owner: one(employees, { fields: [complianceIssues.ownerId], references: [employees.id] }),
  department: one(departments, { fields: [complianceIssues.departmentId], references: [departments.id] }),
  audit: one(audits, { fields: [complianceIssues.auditId], references: [audits.id] }),
}));