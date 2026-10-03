import { getSettingFromPostgres, saveSettingToPostgres, sanitizeError } from './_db.js';

/**
 * Unified Settings, Ads & Site Verifications Handler
 * Supports:
 * - /api/ads (HilltopAds banner / popunder configuration)
 * - /api/gsc (Google Search Console settings & verification)
 * - /api/hilltopads-verification (HilltopAds site ownership verification)
 * - /api/google-verification (Google site ownership verification)
 * - Dynamic serving of verification HTML files e.g. /google*.html and /hilltopads*.html
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const reqUrl = req.url || '';
  const urlParams = new URLSearchParams(reqUrl.split('?')[1] || '');
  const pathname = reqUrl.split('?')[0];

  const action = urlParams.get('action') || req.query?.action || '';
  const fileQuery = urlParams.get('file') || req.query?.file || '';

  // 1. Check for verification file downloads (HTML)
  let verifyFile = fileQuery;
  if (!verifyFile) {
    const parts = pathname.split('/');
    const lastPart = parts[parts.length - 1] || '';
    if ((lastPart.startsWith('google') || lastPart.startsWith('hilltopads')) && lastPart.endsWith('.html')) {
      verifyFile = lastPart;
    }
  }

  if (verifyFile) {
    const isGoogle = verifyFile.toLowerCase().startsWith('google');
    const settingKey = isGoogle ? 'gsc_settings' : 'hilltopads_verification';

    try {
      const settings = await getSettingFromPostgres(settingKey);
      if (settings && settings.html_enabled) {
        const targetFilename = String(settings.html_filename || '').trim().toLowerCase();
        const reqFilename = String(verifyFile).trim().toLowerCase();

        if (reqFilename === targetFilename || reqFilename.startsWith(isGoogle ? 'google' : 'hilltopads')) {
          const defaultContent = isGoogle
            ? `google-site-verification: ${targetFilename || reqFilename}`
            : `hilltopads-site-verification: ${targetFilename || reqFilename}`;
          const content = settings.html_content || defaultContent;

          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Cache-Control', 'public, max-age=3600');
          return res.status(200).send(content);
        }
      }

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(404).send('Verification File Not Found or Disabled');
    } catch (err) {
      console.error('Error serving verification file:', sanitizeError(err));
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(500).send('Internal Server Error');
    }
  }

  // 2. Google Search Console Settings (/api/gsc or /api/google-verification)
  if (action === 'gsc' || pathname.includes('/gsc') || pathname.includes('google-verification')) {
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
  }

  // 3. HilltopAds Verification (/api/hilltopads-verification)
  if (action === 'hilltopads-verification' || pathname.includes('hilltopads-verification')) {
    if (req.method === 'GET') {
      try {
        const settings = await getSettingFromPostgres('hilltopads_verification');
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
  }

  // 4. HilltopAds List & Config (/api/ads)
  if (req.method === 'GET') {
    try {
      const data = await getSettingFromPostgres('hilltopads_ads_list');
      return res.status(200).json({
        success: true,
        global_enabled: data ? Boolean(data.global_enabled) : true,
        ads: data && Array.isArray(data.ads) ? data.ads : [
          {
            id: 'ad_popunder_main',
            name: 'HilltopAds Popunder الرئيسي',
            type: 'popunder',
            code: '',
            enabled: false,
            devices: 'all',
            placements: 'all',
            excludedPages: ['/admin'],
            priority: 1,
            frequency: 'session',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ]
      });
    } catch (err) {
      const safeErr = sanitizeError(err);
      return res.status(500).json({ success: false, error: safeErr });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const globalEnabled = body.global_enabled !== undefined ? Boolean(body.global_enabled) : true;
      const adsList = Array.isArray(body.ads) ? body.ads : [];

      const sanitizedAds = adsList.map((ad, idx) => ({
        id: ad.id || `ad_${Date.now()}_${idx}`,
        name: String(ad.name || `إعلان ${idx + 1}`).trim(),
        type: String(ad.type || 'popunder').trim(),
        code: String(ad.code || '').trim(),
        enabled: Boolean(ad.enabled),
        devices: String(ad.devices || 'all').trim(),
        placements: String(ad.placements || 'all').trim(),
        excludedPages: Array.isArray(ad.excludedPages)
          ? ad.excludedPages.map(p => String(p).trim())
          : String(ad.excludedPages || '/admin').split(',').map(p => p.trim()).filter(Boolean),
        priority: parseInt(ad.priority || '1', 10),
        frequency: String(ad.frequency || 'session').trim(),
        createdAt: ad.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));

      const payload = {
        global_enabled: globalEnabled,
        ads: sanitizedAds,
        updated_at: new Date().toISOString()
      };

      await saveSettingToPostgres('hilltopads_ads_list', payload);
      return res.status(200).json({
        success: true,
        message: 'تم حفظ إعدادات إعلانات HilltopAds بنجاح',
        global_enabled: payload.global_enabled,
        ads: payload.ads
      });
    } catch (err) {
      const safeErr = sanitizeError(err);
      return res.status(500).json({ success: false, error: safeErr });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
