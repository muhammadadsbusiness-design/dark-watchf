import { deleteWorkFromPostgres, getConnectionString, sanitizeError } from './db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const workIds = Array.isArray(data.ids)
      ? data.ids
      : (data.id || data.workId || data.slug ? [data.id || data.workId || data.slug] : []);

    if (workIds.length === 0) {
      return res.status(400).json({ success: false, error: 'لم يتم تحديد معرف العمل للحذف' });
    }

    const connStr = getConnectionString();
    if (!connStr) {
      return res.status(400).json({
        success: false,
        error: 'قاعدة بيانات PostgreSQL غير متصلة. يرجى إضافة POSTGRES_URL أو DATABASE_URL في إعدادات Vercel.'
      });
    }

    const result = await deleteWorkFromPostgres(workIds);
    return res.status(200).json({
      success: true,
      storage: 'postgresql',
      deletedWork: result.deletedWork,
      deletedCount: result.deletedCount
    });
  } catch (err) {
    const safeError = sanitizeError(err);
    console.error('Error deleting work from PostgreSQL:', safeError);
    return res.status(500).json({ success: false, error: safeError });
  }
}

