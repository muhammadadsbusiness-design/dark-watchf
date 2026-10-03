import { getSql, initDb, getConnectionString, sanitizeError, safeJsonParse } from './db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const connStr = getConnectionString();
  let sql = null;
  try {
    sql = connStr ? getSql() : null;
  } catch {
    sql = null;
  }

  if (req.method === 'GET') {
    try {
      if (!connStr || !sql) {
        return res.status(200).json({ logs: [] });
      }

      await initDb();
      const rows = await sql`SELECT * FROM dw_import_logs ORDER BY imported_at DESC LIMIT 50;`;
      const logs = (rows || []).map(r => ({
        id: r.id,
        fileName: r.file_name || 'ملف JSON',
        fileSize: r.file_size || '-',
        worksCount: r.works_count || 0,
        episodesCount: r.episodes_count || 0,
        serversCount: r.servers_count || 0,
        status: r.status || 'نجاح',
        errors: safeJsonParse(r.errors, []),
        importedAt: r.imported_at || new Date().toISOString()
      }));
      return res.status(200).json({ logs });
    } catch (err) {
      const safeError = sanitizeError(err);
      console.error('Error fetching import logs from PostgreSQL:', safeError);
      return res.status(200).json({ logs: [] });
    }
  }

  if (req.method === 'POST') {
    try {
      if (!connStr || !sql) {
        return res.status(200).json({ success: false, message: 'PostgreSQL not configured' });
      }

      const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const logItem = data.log || data;

      await initDb();
      const logId = String(logItem.id || `imp-${Date.now()}`);
      const fileName = String(logItem.fileName || 'ملف JSON');
      const fileSize = String(logItem.fileSize || '-');
      const worksCount = parseInt(logItem.worksCount, 10) || 0;
      const episodesCount = parseInt(logItem.episodesCount, 10) || 0;
      const serversCount = parseInt(logItem.serversCount, 10) || 0;
      const status = String(logItem.status || 'نجاح');
      const errorsJson = JSON.stringify(Array.isArray(logItem.errors) ? logItem.errors : []);
      const importedAt = logItem.importedAt || new Date().toISOString();

      await sql`
        INSERT INTO dw_import_logs (
          id, file_name, file_size, works_count, episodes_count, servers_count, status, errors, imported_at
        ) VALUES (
          ${logId}, ${fileName}, ${fileSize}, ${worksCount}, ${episodesCount}, ${serversCount}, ${status}, ${errorsJson}::jsonb, ${importedAt}
        );
      `;

      return res.status(200).json({ success: true, storage: 'postgresql' });
    } catch (err) {
      const safeError = sanitizeError(err);
      console.error('Error saving import log to PostgreSQL:', safeError);
      return res.status(500).json({ success: false, error: safeError });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

