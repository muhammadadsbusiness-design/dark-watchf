import { getRelatedWorksFromPostgres, sanitizeError } from './db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      const urlParams = new URLSearchParams(req.url.split('?')[1] || '');
      const workId = urlParams.get('id') || urlParams.get('slug') || '';
      const limit = parseInt(urlParams.get('limit') || '6', 10);

      if (!workId) {
        return res.status(400).json({ success: false, error: 'المعرف id مطلوب' });
      }

      const related = await getRelatedWorksFromPostgres(workId, limit);

      return res.status(200).json({
        success: true,
        works: Array.isArray(related) ? related : [],
        count: Array.isArray(related) ? related.length : 0
      });
    } catch (err) {
      const safeErr = sanitizeError(err);
      console.error('Error fetching related works:', safeErr);
      return res.status(500).json({ success: false, works: [], error: safeErr });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
