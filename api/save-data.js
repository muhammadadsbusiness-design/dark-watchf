import { saveWorksToPostgres, getConnectionString, sanitizeError } from './db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const worksList = Array.isArray(data.works) ? data.works : [];
    const targetState = data.statusState || 'PUBLISHED';

    const connStr = getConnectionString();
    if (!connStr) {
      return res.status(400).json({
        success: false,
        error: 'لم يتم العثور على POSTGRES_URL أو DATABASE_URL. يرجى ضبط متغير البيئة في Vercel.'
      });
    }

    if (worksList.length === 0) {
      return res.status(200).json({
        success: true,
        storage: 'postgresql',
        count: 0,
        savedCount: 0,
        errorCount: 0,
        timestamp: new Date().toISOString()
      });
    }

    const pgResult = await saveWorksToPostgres(worksList, targetState);

    return res.status(200).json({
      success: true,
      storage: 'postgresql',
      count: worksList.length,
      savedCount: pgResult.savedCount,
      errorCount: pgResult.errorCount,
      errors: pgResult.errors,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    const safeError = sanitizeError(err);
    console.error('Error in save-data handler:', safeError);
    return res.status(500).json({ success: false, error: safeError });
  }
}

