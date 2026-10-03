import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

// Load local environment files during local development
dotenv.config({ path: '.env.local' });
dotenv.config();

/**
 * Clean whitespace, quotes, and trailing semicolons from environment variables
 */
export function cleanUrl(val) {
  if (!val || typeof val !== 'string') return '';
  let cleaned = val.trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  if (cleaned.endsWith(';')) {
    cleaned = cleaned.slice(0, -1).trim();
  }
  try {
    const u = new URL(cleaned);
    if (u.searchParams.has('channel_binding')) {
      u.searchParams.delete('channel_binding');
      cleaned = u.toString();
    }
  } catch {
    cleaned = cleaned.replace(/[?&]channel_binding=[^&]+/gi, '');
    if (cleaned.includes('&') && !cleaned.includes('?')) {
      cleaned = cleaned.replace('&', '?');
    }
  }
  return cleaned;
}

/**
 * Resolves PostgreSQL connection string with priority:
 * 1. POSTGRES_URL
 * 2. DATABASE_URL
 */
export function getConnectionString() {
  return cleanUrl(process.env.POSTGRES_URL) ||
         cleanUrl(process.env.DATABASE_URL) ||
         cleanUrl(process.env.POSTGRES_PRISMA_URL) ||
         cleanUrl(process.env.POSTGRES_URL_NON_POOLING) ||
         cleanUrl(process.env.NEON_DATABASE_URL) ||
         null;
}

export function getActiveEnvVarName() {
  if (cleanUrl(process.env.POSTGRES_URL)) return 'POSTGRES_URL';
  if (cleanUrl(process.env.DATABASE_URL)) return 'DATABASE_URL';
  if (cleanUrl(process.env.POSTGRES_PRISMA_URL)) return 'POSTGRES_PRISMA_URL';
  if (cleanUrl(process.env.POSTGRES_URL_NON_POOLING)) return 'POSTGRES_URL_NON_POOLING';
  if (cleanUrl(process.env.NEON_DATABASE_URL)) return 'NEON_DATABASE_URL';
  return null;
}

let _cachedClient = null;
let _cachedUrl = null;

/**
 * Returns the singleton @neondatabase/serverless client instance
 */
export function getSql() {
  const url = getConnectionString();
  if (!url) {
    throw new Error('POSTGRES_URL أو DATABASE_URL غير موجود في Environment Variables');
  }
  if (!_cachedClient || _cachedUrl !== url) {
    _cachedUrl = url;
    _cachedClient = neon(url);
  }
  return _cachedClient;
}

/**
 * Central tagged template SQL runner powered by Neon Serverless HTTP driver
 * Usage: await sql`SELECT * FROM dw_works WHERE id = ${id}`;
 */
export const sql = function (strings, ...values) {
  const client = getSql();
  return client(strings, ...values);
};

// Parameterized query runner: await sql.query('SELECT * FROM dw_works WHERE id = $1', [id])
sql.query = function (text, params) {
  const client = getSql();
  return client.query(text, params);
};

// Central query helper returning { rows } for compatibility
export async function query(text, params = []) {
  const client = getSql();
  const rows = await client.query(text, params);
  return { rows };
}

// Re-export all database operation helpers
export * from '../server/db.js';

export default sql;
