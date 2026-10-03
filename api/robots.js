import { getSiteUrl } from './db.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const domain = getSiteUrl(req);

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
