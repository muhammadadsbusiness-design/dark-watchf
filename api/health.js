import { sql, getConnectionString, testPostgresConnection, sanitizeError } from './_db.js';

/**
 * Unified Safe Health & Database Diagnostic Handler
 * Supports:
 * - /api/health (General status check)
 * - /api/health/database (Safe Neon ping via SELECT NOW())
 * - /api/health-database (Alias)
 * - /api/test-db (Comprehensive PostgreSQL connection diagnostics)
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = req.url || '';
  const isDatabaseSafeCheck = url.includes('/database') || url.includes('type=database') || url.includes('check=database');
  const isDetailedTest = url.includes('/test-db') || url.includes('type=test-db') || url.includes('check=test-db');

  // 1. Safe Database Check (/api/health/database)
  if (isDatabaseSafeCheck) {
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

  // 2. Comprehensive Test DB Check (/api/test-db)
  if (isDetailedTest) {
    try {
      const testResult = await testPostgresConnection();
      return res.status(200).json(testResult);
    } catch (err) {
      const safeError = sanitizeError(err);
      console.error('Error in test-db handler:', safeError);
      return res.status(200).json({
        connected: false,
        error: safeError,
        message: `فشل فحص اتصال قاعدة البيانات: ${safeError}`,
        testedAt: new Date().toISOString()
      });
    }
  }

  // 3. Default General Health Check (/api/health)
  try {
    const result = await testPostgresConnection();
    if (result.connected) {
      return res.status(200).json({
        status: 'ok',
        database: 'connected',
        worksCount: result.worksCount || 0,
        episodesCount: result.episodesCount || 0,
        timestamp: new Date().toISOString()
      });
    }
    return res.status(200).json({
      status: 'ok',
      database: 'disconnected',
      message: result.message || 'PostgreSQL connection not established',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    const safeError = sanitizeError(err);
    console.error('Error in /api/health handler:', safeError);
    return res.status(500).json({
      status: 'unhealthy',
      error: safeError,
      timestamp: new Date().toISOString()
    });
  }
}

// Edge / Web Standard GET handler
export async function GET(request) {
  const url = request?.url || '';
  const isDatabaseSafeCheck = url.includes('/database') || url.includes('type=database') || url.includes('check=database');
  const isDetailedTest = url.includes('/test-db') || url.includes('type=test-db') || url.includes('check=test-db');

  if (isDatabaseSafeCheck) {
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

  if (isDetailedTest) {
    try {
      const testResult = await testPostgresConnection();
      return new Response(JSON.stringify(testResult), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    } catch (err) {
      const safeError = sanitizeError(err);
      return new Response(JSON.stringify({
        connected: false,
        error: safeError,
        message: `فشل فحص اتصال قاعدة البيانات: ${safeError}`,
        testedAt: new Date().toISOString()
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  }

  try {
    const result = await testPostgresConnection();
    return new Response(JSON.stringify({
      status: 'ok',
      database: result.connected ? 'connected' : 'disconnected',
      worksCount: result.worksCount || 0,
      episodesCount: result.episodesCount || 0,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (err) {
    const safeError = sanitizeError(err);
    return new Response(JSON.stringify({
      status: 'unhealthy',
      error: safeError,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
