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
