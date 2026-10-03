/**
 * Dark Watch Core Database Module (root db.js)
 * Fully optimized for Vercel Serverless / Fluid Compute and Neon / Supabase PostgreSQL.
 *
 * Provides:
 * - Connection-pooled client (`pool`, `getPool`)
 * - Parameterized query runner (`query`)
 * - Tagged template SQL runner (`sql`, `getSql`)
 * - Environment variable detection (`getConnectionString`, `getActiveEnvVarName`)
 * - Schema initialization with concurrency latch (`initDb`)
 * - Database operations for works, episodes, import logs, and site settings
 */
export * from './server/db.js';
import { pool } from './server/db.js';
export default pool;
