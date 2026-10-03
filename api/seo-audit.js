import { runSeoAuditFromPostgres, getSiteUrl, sanitizeError } from './db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const urlParams = new URLSearchParams((req.url || '').split('?')[1] || '');
    const page = urlParams.get('page') || req.query?.page || 1;
    const pageSize = urlParams.get('pageSize') || req.query?.pageSize || 50;
    const search = urlParams.get('search') || req.query?.search || '';
    const filter = urlParams.get('filter') || req.query?.filter || 'all';

    const auditData = await runSeoAuditFromPostgres({
      page,
      pageSize,
      search,
      filter,
      reqOrBaseUrl: getSiteUrl(req)
    });

    return res.status(200).json({
      success: true,
      data: auditData
    });
  } catch (err) {
    const safeErr = sanitizeError(err);
    console.error('Error in /api/seo-audit handler:', safeErr);
    return res.status(500).json({ success: false, error: safeErr });
  }
}
