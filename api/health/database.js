import { sql, getConnectionString } from '../../lib/db.js';

/**
 * Server-side Safe Database Health Check (/api/health/database)
 * 100% Vercel Serverless & Edge compatible
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const connStr = getConnectionString();
  if (!connStr) {
    return res.status(503).json({
      success: false,
      database: 'error',
      message: 'Database connection string is not configured. لم يتم العثور على POSTGRES_URL أو DATABASE_URL'
    });
  }

  try {
    const result = await sql`
      SELECT NOW() AS current_time
    `;

    return res.status(200).json({
      success: true,
      database: 'connected',
      time: result[0]?.current_time ?? null
    });
  } catch (error) {
    console.error('Database connection error:', error?.message || error);

    return res.status(500).json({
      success: false,
      database: 'error'
    });
  }
}

export async function GET() {
  const connStr = getConnectionString();
  if (!connStr) {
    return new Response(JSON.stringify({
      success: false,
      database: 'error',
      message: 'Database connection string is not configured. لم يتم العثور على POSTGRES_URL أو DATABASE_URL'
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  try {
    const result = await sql`
      SELECT NOW() AS current_time
    `;

    return new Response(JSON.stringify({
      success: true,
      database: 'connected',
      time: result[0]?.current_time ?? null
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (error) {
    console.error('Database connection error:', error?.message || error);

    return new Response(JSON.stringify({
      success: false,
      database: 'error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
