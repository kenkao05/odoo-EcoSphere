DO $$ BEGIN
 CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'rejected');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."audit_status" AS ENUM('scheduled', 'under_review', 'completed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."category_type" AS ENUM('csr_activity', 'challenge');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."challenge_status" AS ENUM('draft', 'active', 'under_review', 'completed', 'archived');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."emission_scope" AS ENUM('scope_1', 'scope_2', 'scope_3');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."gender" AS ENUM('male', 'female', 'non_binary', 'undisclosed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."issue_status" AS ENUM('open', 'resolved');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."notification_type" AS ENUM('compliance_issue_raised', 'compliance_issue_overdue', 'approval_decision', 'policy_reminder', 'badge_unlock', 'kudos_received');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."role" AS ENUM('admin', 'employee');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."severity" AS ENUM('low', 'medium', 'high', 'critical');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."source_type" AS ENUM('purchase', 'manufacturing', 'fleet', 'expense', 'manual');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."status" AS ENUM('active', 'inactive');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audits" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(150) NOT NULL,
	"department_id" integer NOT NULL,
	"auditor" varchar(120) NOT NULL,
	"date" date NOT NULL,
	"findings" text,
	"status" "audit_status" DEFAULT 'scheduled' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "badges" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	"description" text,
	"unlock_rule_type" varchar(30) NOT NULL,
	"unlock_rule_value" integer NOT NULL,
	"icon" varchar(50) DEFAULT 'award' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "carbon_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"department_id" integer NOT NULL,
	"emission_factor_id" integer NOT NULL,
	"source_type" "source_type" NOT NULL,
	"quantity" numeric(12, 3) NOT NULL,
	"co2e_amount" numeric(12, 3) NOT NULL,
	"transaction_date" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" "category_type" NOT NULL,
	"status" "status" DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "challenge_participation" (
	"id" serial PRIMARY KEY NOT NULL,
	"challenge_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"proof_url" varchar(300),
	"approval_status" "approval_status" DEFAULT 'pending' NOT NULL,
	"xp_awarded" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "challenges" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"title" varchar(150) NOT NULL,
	"description" text,
	"xp" integer NOT NULL,
	"difficulty" varchar(20) NOT NULL,
	"evidence_required" boolean DEFAULT false NOT NULL,
	"deadline" date NOT NULL,
	"status" "challenge_status" DEFAULT 'draft' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "compliance_issues" (
	"id" serial PRIMARY KEY NOT NULL,
	"audit_id" integer,
	"title" varchar(150) NOT NULL,
	"description" text,
	"severity" "severity" NOT NULL,
	"department_id" integer NOT NULL,
	"owner_id" integer NOT NULL,
	"due_date" date NOT NULL,
	"status" "issue_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "csr_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"name" varchar(150) NOT NULL,
	"description" text,
	"evidence_required" boolean DEFAULT false NOT NULL,
	"date" date NOT NULL,
	"department_id" integer,
	"status" varchar(30) DEFAULT 'open' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "department_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"department_id" integer NOT NULL,
	"environmental_score" numeric(5, 2) NOT NULL,
	"social_score" numeric(5, 2) NOT NULL,
	"governance_score" numeric(5, 2) NOT NULL,
	"total_score" numeric(5, 2) NOT NULL,
	"period" varchar(20) NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"code" varchar(20) NOT NULL,
	"head" varchar(120),
	"parent_department_id" integer,
	"employee_count" integer DEFAULT 0 NOT NULL,
	"status" "status" DEFAULT 'active' NOT NULL,
	CONSTRAINT "departments_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "emission_factors" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(150) NOT NULL,
	"scope" "emission_scope" NOT NULL,
	"activity_type" varchar(100) NOT NULL,
	"unit" varchar(30) NOT NULL,
	"co2e_per_unit" numeric(12, 6) NOT NULL,
	"source" varchar(150)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "employee_badges" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"badge_id" integer NOT NULL,
	"awarded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "employee_participation" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"csr_activity_id" integer NOT NULL,
	"proof_url" varchar(300),
	"approval_status" "approval_status" DEFAULT 'pending' NOT NULL,
	"points_earned" integer DEFAULT 0 NOT NULL,
	"completion_date" date
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "employees" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"email" varchar(150) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"role" "role" DEFAULT 'employee' NOT NULL,
	"department_id" integer,
	"gender" "gender",
	"age_band" varchar(20),
	"salary_band" varchar(20),
	"xp_total" integer DEFAULT 0 NOT NULL,
	"points_balance" integer DEFAULT 0 NOT NULL,
	"status" "status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "employees_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "environmental_goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(150) NOT NULL,
	"department_id" integer NOT NULL,
	"target_co2" numeric(12, 2) NOT NULL,
	"current_co2" numeric(12, 2) DEFAULT '0' NOT NULL,
	"deadline" date NOT NULL,
	"status" varchar(30) DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "esg_configuration" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"environmental_weight" numeric(4, 2) DEFAULT '40.00' NOT NULL,
	"social_weight" numeric(4, 2) DEFAULT '30.00' NOT NULL,
	"governance_weight" numeric(4, 2) DEFAULT '30.00' NOT NULL,
	"auto_emission_calc" boolean DEFAULT true NOT NULL,
	"evidence_required_for_csr" boolean DEFAULT true NOT NULL,
	"auto_award_badges" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "esg_policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(150) NOT NULL,
	"category" varchar(30) NOT NULL,
	"version" varchar(20) DEFAULT '1.0' NOT NULL,
	"effective_date" date NOT NULL,
	"document_url" varchar(300),
	"status" "status" DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "kudos" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_employee_id" integer NOT NULL,
	"to_employee_id" integer NOT NULL,
	"points" integer DEFAULT 5 NOT NULL,
	"message" varchar(200) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"compliance_alerts" boolean DEFAULT true NOT NULL,
	"approval_decisions" boolean DEFAULT true NOT NULL,
	"policy_reminders" boolean DEFAULT true NOT NULL,
	"badge_unlocks" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"type" "notification_type" NOT NULL,
	"message" varchar(300) NOT NULL,
	"related_entity_type" varchar(50),
	"related_entity_id" integer,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "policy_acknowledgements" (
	"id" serial PRIMARY KEY NOT NULL,
	"policy_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"acknowledged_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_esg_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(150) NOT NULL,
	"sku" varchar(60) NOT NULL,
	"footprint_per_unit_kg_co2e" numeric(12, 3),
	"sustainable_sourcing" boolean DEFAULT false NOT NULL,
	"recyclable_packaging" boolean DEFAULT false NOT NULL,
	"notes" text,
	CONSTRAINT "product_esg_profiles_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reward_redemptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"reward_id" integer NOT NULL,
	"points_spent" integer NOT NULL,
	"redeemed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rewards" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"points_required" integer NOT NULL,
	"stock" integer NOT NULL,
	"status" "status" DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "whistleblower_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" varchar(60) NOT NULL,
	"description" text NOT NULL,
	"department_id" integer,
	"status" varchar(30) DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audits" ADD CONSTRAINT "audits_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "carbon_transactions" ADD CONSTRAINT "carbon_transactions_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "carbon_transactions" ADD CONSTRAINT "carbon_transactions_emission_factor_id_emission_factors_id_fk" FOREIGN KEY ("emission_factor_id") REFERENCES "public"."emission_factors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "challenge_participation" ADD CONSTRAINT "challenge_participation_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "challenge_participation" ADD CONSTRAINT "challenge_participation_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "challenges" ADD CONSTRAINT "challenges_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "compliance_issues" ADD CONSTRAINT "compliance_issues_audit_id_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."audits"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "compliance_issues" ADD CONSTRAINT "compliance_issues_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "compliance_issues" ADD CONSTRAINT "compliance_issues_owner_id_employees_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "csr_activities" ADD CONSTRAINT "csr_activities_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "csr_activities" ADD CONSTRAINT "csr_activities_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "department_scores" ADD CONSTRAINT "department_scores_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_badges" ADD CONSTRAINT "employee_badges_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_badges" ADD CONSTRAINT "employee_badges_badge_id_badges_id_fk" FOREIGN KEY ("badge_id") REFERENCES "public"."badges"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_participation" ADD CONSTRAINT "employee_participation_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_participation" ADD CONSTRAINT "employee_participation_csr_activity_id_csr_activities_id_fk" FOREIGN KEY ("csr_activity_id") REFERENCES "public"."csr_activities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "environmental_goals" ADD CONSTRAINT "environmental_goals_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kudos" ADD CONSTRAINT "kudos_from_employee_id_employees_id_fk" FOREIGN KEY ("from_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kudos" ADD CONSTRAINT "kudos_to_employee_id_employees_id_fk" FOREIGN KEY ("to_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "policy_acknowledgements" ADD CONSTRAINT "policy_acknowledgements_policy_id_esg_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."esg_policies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "policy_acknowledgements" ADD CONSTRAINT "policy_acknowledgements_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_reward_id_rewards_id_fk" FOREIGN KEY ("reward_id") REFERENCES "public"."rewards"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "whistleblower_reports" ADD CONSTRAINT "whistleblower_reports_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "dept_period_unique" ON "department_scores" USING btree ("department_id","period");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "emp_badge_unique" ON "employee_badges" USING btree ("employee_id","badge_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "policy_employee_unique" ON "policy_acknowledgements" USING btree ("policy_id","employee_id");