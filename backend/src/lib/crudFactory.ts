import { Router } from "express";
import { eq, or, ilike, type SQL } from "drizzle-orm";
import type { PgTable, PgColumn } from "drizzle-orm/pg-core";
import type { ZodSchema } from "zod";
import { db } from "../db";
import { requireAuth, requireAdmin } from "../middleware/auth";

interface CrudConfig {
  table: PgTable;
  idColumn: PgColumn;
  insertSchema: ZodSchema;
  updateSchema: ZodSchema;
  // Columns checked with a case-insensitive partial match against ?search=
  searchColumns?: PgColumn[];
  // Set true if employees (not just admins) should be able to read this
  // table — every table using this factory today is admin-write, all-read,
  // so this defaults to false and reads still require requireAuth only.
}

// One implementation, config-driven, instead of ~8 near-identical route
// files. Covers list (+ ?search=), get-by-id, create, update, delete.
// Anything needing extra business logic (a score recalc, a notification, a
// transaction) is intentionally NOT built on this factory — see
// environmental.ts (Goals), complianceIssues.ts, gamification.ts (Rewards)
// for the hand-written equivalents.
export function makeCrudRouter(config: CrudConfig) {
  const { table, idColumn, insertSchema, updateSchema, searchColumns } = config;
  const router = Router();

  router.get("/", requireAuth, async (req, res) => {
    const search = req.query.search as string | undefined;
    let whereClause: SQL | undefined;
    if (search && searchColumns?.length) {
      whereClause = or(...searchColumns.map((col) => ilike(col, `%${search}%`)));
    }
    const rows = whereClause
      ? await db.select().from(table).where(whereClause)
      : await db.select().from(table);
    res.json(rows);
  });

  router.get("/:id", requireAuth, async (req, res) => {
    const [row] = await db.select().from(table).where(eq(idColumn, Number(req.params.id)));
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  });

  router.post("/", requireAuth, requireAdmin, async (req, res) => {
    const parsed = insertSchema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });
    const [row] = await db.insert(table).values(parsed.data).returning();
    res.status(201).json(row);
  });

  router.put("/:id", requireAuth, requireAdmin, async (req, res) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });
    const [row] = await db.update(table).set(parsed.data)
      .where(eq(idColumn, Number(req.params.id))).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  });

  router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
    const [row] = await db.delete(table).where(eq(idColumn, Number(req.params.id))).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.status(204).send();
  });

  return router;
}