import { getSettingFromPostgres, saveSettingToPostgres, sanitizeError } from './db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Handle direct serving of verification HTML files e.g. /hilltopads12345.html
  const reqUrl = req.url || '';
  const urlParams = new URLSearchParams(reqUrl.split('?')[1] || '');
  let fileQuery = urlParams.get('file') || '';

  if (!fileQuery) {
    const pathname = reqUrl.split('?')[0];
    const parts = pathname.split('/');
    const lastPart = parts[parts.length - 1] || '';
    if (lastPart.startsWith('hilltopads') && lastPart.endsWith('.html')) {
      fileQuery = lastPart;
    }
  }

  if (req.method === 'GET') {
    try {
      const settings = await getSettingFromPostgres('hilltopads_verification');

      // If requested as a file route
      if (fileQuery && settings && settings.html_enabled) {
        const targetFilename = String(settings.html_filename || '').trim().toLowerCase();
        const reqFilename = String(fileQuery).trim().toLowerCase();

        if (reqFilename === targetFilename || (reqFilename.startsWith('hilltopads') && reqFilename.endsWith('.html'))) {
          const content = settings.html_content || `hilltopads-site-verification: ${targetFilename}`;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Cache-Control', 'public, max-age=3600');
          return res.status(200).send(content);
        }
      }

      return res.status(200).json({
        success: true,
        settings: settings || {
          meta_code: '',
          meta_enabled: false,
          html_filename: '',
          html_content: '',
          html_enabled: false,
          script_code: '',
          script_enabled: false,
          snippet_code: '',
          snippet_enabled: false
        }
      });
    } catch (err) {
      const safeErr = sanitizeError(err);
      return res.status(500).json({ success: false, error: safeErr });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

      let rawMetaCode = String(body.meta_code || '').trim();
      // Auto convert full <meta name="..." content="..." /> to content token if provided, or store as tag
      if (rawMetaCode.includes('content=')) {
        const match = rawMetaCode.match(/content=["']([^"']+)["']/i);
        if (match && match[1]) {
          rawMetaCode = match[1].trim();
        }
      }

      let rawHtmlFilename = String(body.html_filename || '').trim();
      if (rawHtmlFilename && !rawHtmlFilename.toLowerCase().endsWith('.html')) {
        rawHtmlFilename += '.html';
      }

      let rawHtmlContent = String(body.html_content || '').trim();
      if (!rawHtmlContent && rawHtmlFilename) {
        rawHtmlContent = `hilltopads-site-verification: ${rawHtmlFilename}`;
      }

      const settingsData = {
        meta_code: rawMetaCode,
        meta_enabled: Boolean(body.meta_enabled),
        html_filename: rawHtmlFilename,
        html_content: rawHtmlContent,
        html_enabled: Boolean(body.html_enabled),
        script_code: String(body.script_code || '').trim(),
        script_enabled: Boolean(body.script_enabled),
        snippet_code: String(body.snippet_code || '').trim(),
        snippet_enabled: Boolean(body.snippet_enabled),
        updated_at: new Date().toISOString()
      };

      await saveSettingToPostgres('hilltopads_verification', settingsData);

      return res.status(200).json({
        success: true,
        message: 'تم حفظ إعدادات التحقق لـ HilltopAds بنجاح',
        settings: settingsData
      });
    } catch (err) {
      const safeErr = sanitizeError(err);
      return res.status(500).json({ success: false, error: safeErr });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
