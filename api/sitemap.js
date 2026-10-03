import { getSitemapDataFromPostgres, getSiteUrl, sanitizeError } from './db.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const domain = getSiteUrl(req);

  // Parse query params or URL route
  const urlParams = new URLSearchParams((req.url || '').split('?')[1] || '');
  let type = urlParams.get('type') || req.query?.type || 'index';
  let page = urlParams.get('page') || req.query?.page || 1;

  // Handle direct filename route matching if passed
  const pathname = (req.url || '').split('?')[0];
  if (pathname.includes('sitemap-pages')) type = 'pages';
  else if (pathname.includes('sitemap-works')) type = 'works';
  else if (pathname.includes('sitemap-episodes')) {
    type = 'episodes';
    const match = pathname.match(/sitemap-episodes-(\d+)/);
    if (match && match[1]) page = match[1];
  }

  try {
    const data = await getSitemapDataFromPostgres(type, page, 2000, domain);

    if (type === 'index') {
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

    // Individual urlset generator
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

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
