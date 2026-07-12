import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { initSocket } from "./lib/socket";
import { flagOverdueIssues } from "./routes/complianceIssues";

import authRouter from "./routes/auth";
import employeesRouter from "./routes/employees";
import complianceIssuesRouter from "./routes/complianceIssues";
import socialRouter from "./routes/social";
import governanceRouter from "./routes/governance";
import gamificationRouter from "./routes/gamification";
import environmentalRouter from "./routes/environmental";
import socialInsightsRouter from "./routes/socialInsights";
import dashboardRouter from "./routes/dashboard";
import reportsRouter from "./routes/reports";
import settingsRouter from "./routes/settings";
import {
  departmentsRouter, categoriesRouter, emissionFactorsRouter, productsRouter,
  policiesRouter, badgesRouter, rewardsAdminRouter, auditsRouter,
} from "./routes/masterData";

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/employees", employeesRouter);
app.use("/api/compliance-issues", complianceIssuesRouter);
app.use("/api", socialRouter);          // /csr-activities, /participation/*
app.use("/api", governanceRouter);      // /policy-acknowledgements/*
app.use("/api", gamificationRouter);    // /challenges, /leaderboard, /rewards, /kudos
app.use("/api", environmentalRouter);   // /goals, /carbon-transactions, /emissions-trend
app.use("/api", socialInsightsRouter);  // /diversity, /whistleblower
app.use("/api/dashboard", dashboardRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/settings", settingsRouter);

app.use("/api/departments", departmentsRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/emission-factors", emissionFactorsRouter);
app.use("/api/products", productsRouter);
app.use("/api/policies", policiesRouter);
app.use("/api/badges", badgesRouter);
app.use("/api/rewards-admin", rewardsAdminRouter); // CRUD on the catalog itself; redeem is in gamification.ts
app.use("/api/audits", auditsRouter);

const server = http.createServer(app);
initSocket(server);

// Overdue compliance issue check. Every 6h is enough for a demo; for judging
// day, run it once manually right before your demo slot so the notification
// feed has something in it (see PRD 6.5, seed script note).
setInterval(() => { flagOverdueIssues().catch(console.error); }, 6 * 60 * 60 * 1000);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`EcoSphere API listening on :${PORT}`));
