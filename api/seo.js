import {
  getSiteUrl,
  getSitemapDataFromPostgres,
  getSitemapLinksFromPostgres,
  runSeoAuditFromPostgres,
  sanitizeError
} from './_db.js';

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Unified SEO Handler
 * Supports:
 * - /robots.txt (type=robots)
 * - /sitemap.xml (type=index)
 * - /sitemap-pages.xml (type=pages)
 * - /sitemap-works.xml (type=works)
 * - /sitemap-episodes-(.*).xml (type=episodes&page=X)
 * - /api/sitemap-links (type=links)
 * - /api/seo-audit (type=audit)
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = req.url || '';
  const urlParams = new URLSearchParams(url.split('?')[1] || '');
  const pathname = url.split('?')[0];

  let type = urlParams.get('type') || req.query?.type || '';
  let page = urlParams.get('page') || req.query?.page || 1;

  if (pathname.includes('/robots') || pathname.endsWith('robots.txt')) {
    type = 'robots';
  } else if (pathname.includes('/sitemap-links')) {
    type = 'links';
  } else if (pathname.includes('/seo-audit')) {
    type = 'audit';
  } else if (pathname.includes('sitemap-pages')) {
    type = 'pages';
  } else if (pathname.includes('sitemap-works')) {
    type = 'works';
  } else if (pathname.includes('sitemap-episodes')) {
    type = 'episodes';
    const match = pathname.match(/sitemap-episodes-(\d+)/);
    if (match && match[1]) page = match[1];
  } else if (pathname.endsWith('sitemap.xml') || pathname.includes('/sitemap')) {
    if (!type) type = 'index';
  }

  const domain = getSiteUrl(req);

  // 1. Robots.txt
  if (type === 'robots') {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    const robotsContent = `# Dark Watch Search Engine Robots Configuration
User-agent: *
Allow: /

# Exclude Administrative and Internal Utility Paths
Disallow: /admin
Disallow: /#/admin
Disallow: /api/

# Sitemap Index Entry Point
Sitemap: ${domain}/sitemap.xml
`;
    return res.status(200).send(robotsContent);
  }

  // 2. Sitemap Links API (/api/sitemap-links)
  if (type === 'links') {
    try {
      const pageSize = urlParams.get('pageSize') || req.query?.pageSize || 50;
      const search = urlParams.get('search') || req.query?.search || '';
      const filter = urlParams.get('filter') || req.query?.filter || 'all';

      const result = await getSitemapLinksFromPostgres({
        page,
        pageSize,
        search,
        filter,
        reqOrBaseUrl: domain
      });
      return res.status(200).json(result);
    } catch (err) {
      const safeErr = sanitizeError(err);
      console.error('Error in /api/sitemap-links handler:', safeErr);
      return res.status(500).json({ success: false, error: safeErr });
    }
  }

  // 3. SEO Audit API (/api/seo-audit)
  if (type === 'audit') {
    try {
      const pageSize = urlParams.get('pageSize') || req.query?.pageSize || 50;
      const search = urlParams.get('search') || req.query?.search || '';
      const filter = urlParams.get('filter') || req.query?.filter || 'all';

      const auditData = await runSeoAuditFromPostgres({
        page,
        pageSize,
        search,
        filter,
        reqOrBaseUrl: domain
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

  // 4. Sitemaps XML (index, pages, works, episodes)
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');

  try {
    const sitemapType = type || 'index';
    const data = await getSitemapDataFromPostgres(sitemapType, page, 2000, domain);

    if (sitemapType === 'index') {
      const epPages = data.epPages || 1;
      let epSitemapsXml = '';
      for (let i = 1; i <= epPages; i++) {
        epSitemapsXml += `
  <sitemap>
    <loc>${domain}/sitemap-episodes-${i}.xml</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>`;
      }

      const xmlIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${domain}/sitemap-pages.xml</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${domain}/sitemap-works.xml</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>${epSitemapsXml}
</sitemapindex>`;
      return res.status(200).send(xmlIndex.trim());
    }

    const items = Array.isArray(data.items) ? data.items : [];
    const urlsXml = items.map(item => `
  <url>
    <loc>${escapeXml(item.loc)}</loc>
    <lastmod>${item.lastmod || new Date().toISOString()}</lastmod>
    <changefreq>${item.changefreq || 'weekly'}</changefreq>
    <priority>${item.priority || '0.8'}</priority>
  </url>`).join('');

    const xmlUrlset = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urlsXml}
</urlset>`;
    return res.status(200).send(xmlUrlset.trim());
  } catch (err) {
    const safeErr = sanitizeError(err);
    console.error('Error generating Sitemap XML:', safeErr);
    return res.status(500).send(`<?xml version="1.0" encoding="UTF-8"?><error>${safeErr}</error>`);
  }
}
