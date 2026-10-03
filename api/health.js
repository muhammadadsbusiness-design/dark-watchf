import { testPostgresConnection, sanitizeError } from './db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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
