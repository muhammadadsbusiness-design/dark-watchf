import { getSettingFromPostgres, saveSettingToPostgres, sanitizeError } from './db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      const settings = await getSettingFromPostgres('gsc_settings');
      return res.status(200).json({
        success: true,
        settings: settings || {
          meta_code: '',
          meta_enabled: false,
          html_filename: '',
          html_content: '',
          html_enabled: false,
          custom_url: '',
          custom_url_enabled: false
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
      // Auto convert full <meta name="google-site-verification" content="XYZ" /> tag to XYZ
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
        rawHtmlContent = `google-site-verification: ${rawHtmlFilename}`;
      }

      const settingsData = {
        meta_code: rawMetaCode,
        meta_enabled: Boolean(body.meta_enabled),
        html_filename: rawHtmlFilename,
        html_content: rawHtmlContent,
        html_enabled: Boolean(body.html_enabled),
        custom_url: String(body.custom_url || '').trim(),
        custom_url_enabled: Boolean(body.custom_url_enabled),
        updated_at: new Date().toISOString()
      };

      await saveSettingToPostgres('gsc_settings', settingsData);

      return res.status(200).json({
        success: true,
        message: 'تم حفظ إعدادات Google Search Console بنجاح',
        settings: settingsData
      });
    } catch (err) {
      const safeErr = sanitizeError(err);
      return res.status(500).json({ success: false, error: safeErr });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
