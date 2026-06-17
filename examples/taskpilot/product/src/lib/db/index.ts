/**
 * TaskPilot — Drizzle database client (singleton)
 *
 * One pool per process, reused across Next.js dev hot-reloads. The connection string comes from
 * the environment — never hardcode it (see harness/rules/security.md).
 *
 * Docs fetched via Context7: drizzle-orm@0.40.x, topic: "node-postgres driver setup"
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set — copy .env.example to .env.local and fill it in");
}

// Reuse the pool across module re-evaluation in dev so we don't exhaust connections.
const globalForDb = globalThis as unknown as { pool?: Pool };
const pool = globalForDb.pool ?? new Pool({ connectionString });
if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

export const db = drizzle(pool, { schema });
