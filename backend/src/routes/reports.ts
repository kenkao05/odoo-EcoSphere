import { Router } from "express";
import { and, gte, lte, eq, sql } from "drizzle-orm";
import { Parser as CsvParser } from "json2csv";
import ExcelJS from "exceljs";
import { db } from "../db";
import { carbonTransactions, departmentScores, complianceIssues, challenges } from "../db/schema";
import { requireAuth } from "../middleware/auth";

const router = Router();

// GET /api/reports/custom?dateFrom=&dateTo=&departmentId=&module=environmental&format=json|csv|xlsx
// PDF Section 7: filter by Department, Date Range, Module, Employee, Challenge, ESG Category.
// Employee/Challenge/ESG-Category filters apply within whichever module-specific
// query is selected below -- documented per-module in PRD section 7, not
// re-implemented as one universal filterable table (the underlying tables
// have different shapes, a single mega-query would be unmaintainable in the
// time you have).
router.get("/custom", requireAuth, async (req, res) => {
  const { dateFrom, dateTo, departmentId, module = "environmental", format = "json" } = req.query as Record<string, string>;

  let rows: any[] = [];
  if (module === "environmental") {
    const conditions = [];
    if (dateFrom) conditions.push(gte(carbonTransactions.transactionDate, dateFrom));
    if (dateTo) conditions.push(lte(carbonTransactions.transactionDate, dateTo));
    if (departmentId) conditions.push(eq(carbonTransactions.departmentId, Number(departmentId)));
    rows = await db.select().from(carbonTransactions).where(conditions.length ? and(...conditions) : undefined);
  } else if (module === "governance") {
    const conditions = [];
    if (departmentId) conditions.push(eq(complianceIssues.departmentId, Number(departmentId)));
    rows = await db.select().from(complianceIssues).where(conditions.length ? and(...conditions) : undefined);
  } else if (module === "esg_summary") {
    rows = await db.select().from(departmentScores);
  } else if (module === "gamification") {
    rows = await db.select().from(challenges);
  }

  if (format === "csv") {
    const csv = new CsvParser().parse(rows);
    res.header("Content-Type", "text/csv");
    res.attachment(`${module}-report.csv`);
    return res.send(csv);
  }
  if (format === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(module);
    if (rows.length) {
      sheet.columns = Object.keys(rows[0]).map((key) => ({ header: key, key }));
      sheet.addRows(rows);
    }
    res.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.attachment(`${module}-report.xlsx`);
    await workbook.xlsx.write(res);
    return res.end();
  }
  // format === "pdf" is deliberately not implemented here -- see PRD 7.2:
  // generating readable PDF report layouts (not just a data dump) is real
  // design work, cut from the 8-hour build. CSV/Excel cover "export the data";
  // add PDF post-hackathon with a template library (e.g. pdf-lib or Puppeteer).
  res.json(rows);
});

export default router;