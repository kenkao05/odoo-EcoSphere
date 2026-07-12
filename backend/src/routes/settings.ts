import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { esgConfiguration, notificationSettings } from "../db/schema";
import { requireAuth, requireAdmin } from "../middleware/auth";

const router = Router();

const configSchema = z.object({
  environmentalWeight: z.number().min(0).max(100),
  socialWeight: z.number().min(0).max(100),
  governanceWeight: z.number().min(0).max(100),
  autoEmissionCalc: z.boolean(),
  evidenceRequiredForCsr: z.boolean(),
  autoAwardBadges: z.boolean(),
}).refine((v) => Math.round(v.environmentalWeight + v.socialWeight + v.governanceWeight) === 100, {
  message: "Environmental + Social + Governance weights must sum to 100",
});

router.get("/esg-configuration", requireAuth, async (_req, res) => {
  const [row] = await db.select().from(esgConfiguration);
  res.json(row);
});

router.put("/esg-configuration", requireAuth, requireAdmin, async (req, res) => {
  const parsed = configSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });
  const { environmentalWeight, socialWeight, governanceWeight, ...rest } = parsed.data;
  const [row] = await db.update(esgConfiguration).set({
    ...rest,
    environmentalWeight: environmentalWeight.toString(),
    socialWeight: socialWeight.toString(),
    governanceWeight: governanceWeight.toString(),
  }).where(eq(esgConfiguration.id, 1)).returning();
  res.json(row);
});

router.get("/notification-settings", requireAuth, async (_req, res) => {
  const [row] = await db.select().from(notificationSettings);
  res.json(row);
});

router.put("/notification-settings", requireAuth, requireAdmin, async (req, res) => {
  const schema = z.object({
    complianceAlerts: z.boolean(), approvalDecisions: z.boolean(),
    policyReminders: z.boolean(), badgeUnlocks: z.boolean(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });
  const [row] = await db.update(notificationSettings).set(parsed.data).where(eq(notificationSettings.id, 1)).returning();
  res.json(row);
});

export default router;
