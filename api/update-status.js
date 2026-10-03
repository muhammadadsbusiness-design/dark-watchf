import { updateWorkStatusInPostgres, getConnectionString, sanitizeError } from './db.js';

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
    const workIds = Array.isArray(data.ids) ? data.ids : (data.id ? [data.id] : []);
    const targetState = data.statusState || 'PUBLISHED';

    if (workIds.length === 0) {
      return res.status(400).json({ success: false, error: 'لم يتم تحديد معرفات الأعمال' });
    }

    const connStr = getConnectionString();
    if (!connStr) {
      return res.status(400).json({
        success: false,
        error: 'قاعدة بيانات PostgreSQL غير متصلة. يرجى إضافة POSTGRES_URL أو DATABASE_URL في إعدادات Vercel.'
      });
    }

    const result = await updateWorkStatusInPostgres(workIds, targetState);
    return res.status(200).json({
      success: true,
      storage: 'postgresql',
      updatedCount: result.updatedCount,
      targetState
    });
  } catch (err) {
    const safeError = sanitizeError(err);
    console.error('Error updating work status in PostgreSQL:', safeError);
    return res.status(500).json({ success: false, error: safeError });
  }
}

