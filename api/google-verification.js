import { getSettingFromPostgres, sanitizeError } from './db.js';

export default async function handler(req, res) {
  try {
    const urlParams = new URLSearchParams(req.url.split('?')[1] || '');
    let fileQuery = urlParams.get('file') || '';

    if (!fileQuery) {
      // Extract from path e.g. /google123456.html
      const pathname = req.url.split('?')[0];
      const parts = pathname.split('/');
      fileQuery = parts[parts.length - 1] || '';
    }

    const settings = await getSettingFromPostgres('gsc_settings');

    if (settings && settings.html_enabled && settings.html_filename) {
      const targetFilename = String(settings.html_filename).trim().toLowerCase();
      const reqFilename = String(fileQuery).trim().toLowerCase();

      if (reqFilename === targetFilename || reqFilename.startsWith('google') && reqFilename.endsWith('.html')) {
        const content = settings.html_content || `google-site-verification: ${targetFilename}`;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.status(200).send(content);
      }
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(404).send('Google Verification File Not Found or Disabled');
  } catch (err) {
    console.error('Error serving Google verification file:', sanitizeError(err));
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(500).send('Internal Server Error');
  }
}
