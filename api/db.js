/**
 * Central Database Module Proxy
 * Re-exports the unified PostgreSQL connection pool and query helpers from server/db.js
 */
export * from '../server/db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({ status: 'ok', service: 'Dark Watch Database Proxy' });
}
