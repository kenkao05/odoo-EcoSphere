import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Single shared connection pool. Railway (and any managed Postgres) gives you
// one DATABASE_URL — parse it here rather than separate host/user/pass env
// vars, since that's the format Railway/Render/Neon all provide by default.
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Most managed Postgres providers (Railway included) require SSL but use a
  // self-signed cert chain that Node rejects by default. rejectUnauthorized:
  // false is the standard workaround for this exact situation — it still
  // encrypts the connection, it just doesn't verify the CA. Fine for a
  // hackathon; a production deployment would pin the real CA cert instead.
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
});

// Passing `schema` here (not just the pool) is what enables Drizzle's
// relational query API (db.query.employees.findMany({ with: { department: true }})),
// used sparingly in this codebase but available if a route needs it.
export const db = drizzle(pool, { schema });
