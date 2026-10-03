import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();

const { Pool } = pg;

export function isInvalidPageServer(server, allServersInEp) {
  if (!server || !server.url) return true;
  const url = String(server.url).trim().toLowerCase();

  // If there's another real video stream/embed, check if this one is a web scraping page URL
  const hasRealStream = allServersInEp.some(s => {
    if (!s || !s.url || s === server) return false;
    const u = String(s.url).trim().toLowerCase();
    return u.includes('.mp4') || u.includes('.m3u8') || u.includes('.webm') || u.includes('.mkv') ||
           u.includes('myvidplay') || u.includes('streamtape') || u.includes('dood') ||
           u.includes('fembed') || u.includes('uqload') || u.includes('ok.ru') ||
           u.includes('drive.google') || u.includes('mega.nz') || u.includes('embed') ||
           u.includes('site.word.tn');
  });

  if (hasRealStream) {
    // Check if current server URL is just a web article/page permalink
    if (url.includes('dima-toon.com/cartoon-episode') ||
        url.includes('dima-toon.com/anime-episode') ||
        url.includes('/cartoon-episode/') ||
        url.includes('/anime-episode/')) {
      return true;
    }
  }

  return false;
}

export function cleanEpisodeServers(servers, episodeId = '') {
  if (!Array.isArray(servers) || servers.length === 0) return [];

  // Deduplicate by URL, ID, and episodeId + URL
  const seenUrls = new Set();
  const seenIds = new Set();
  const seenComposite = new Set();

  const validServers = [];

  for (const s of servers) {
    if (!s || !s.url) continue;
    const normUrl = String(s.url).trim();
    const sId = s.id ? String(s.id).trim() : '';
    const compKey = `${episodeId}_${normUrl}`;

    if (seenUrls.has(normUrl) || (sId && seenIds.has(sId)) || seenComposite.has(compKey)) {
      continue;
    }

    // Check if it's an invalid webpage server when a real server is present
    if (isInvalidPageServer(s, servers)) {
      continue;
    }

    seenUrls.add(normUrl);
    if (sId) seenIds.add(sId);
    seenComposite.add(compKey);

    validServers.push({
      id: s.id || `srv-${validServers.length + 1}`,
      name: s.name || `سيرفر ${validServers.length + 1}`,
      url: normUrl,
      type: s.type || (normUrl.includes('.mp4') || normUrl.includes('.m3u8') ? 'video' : 'embed')
    });
  }

  // If all were somehow filtered (edge case), fall back to original non-empty
  if (validServers.length === 0 && servers.length > 0) {
    return servers.slice(0, 1);
  }

  return validServers;
}

async function runCleanup() {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error('No connection string available');
    return;
  }

  const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('--- Starting Server Cleanup Migration in PostgreSQL ---');
    const res = await pool.query('SELECT id, work_id, number, title, servers FROM dw_episodes ORDER BY work_id, number ASC');
    console.log(`Found ${res.rows.length} total episodes to audit.`);

    let cleanedCount = 0;
    let unchangedCount = 0;
    const sampleBeforeAfter = [];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const row of res.rows) {
        const rawServers = Array.isArray(row.servers) ? row.servers : JSON.parse(row.servers || '[]');
        const cleaned = cleanEpisodeServers(rawServers, row.id);

        const beforeJson = JSON.stringify(rawServers);
        const afterJson = JSON.stringify(cleaned);

        if (beforeJson !== afterJson) {
          cleanedCount++;
          if (sampleBeforeAfter.length < 5) {
            sampleBeforeAfter.push({
              epId: row.id,
              title: row.title,
              beforeCount: rawServers.length,
              afterCount: cleaned.length,
              before: rawServers,
              after: cleaned
            });
          }

          await client.query(
            'UPDATE dw_episodes SET servers = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [JSON.stringify(cleaned), row.id]
          );
        } else {
          unchangedCount++;
        }
      }

      await client.query('COMMIT');
      console.log('Transaction COMMITTED successfully.');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Migration error, rolled back:', err);
      throw err;
    } finally {
      client.release();
    }

    console.log(`\n=== Migration Results ===`);
    console.log(`Episodes cleaned: ${cleanedCount}`);
    console.log(`Episodes unchanged: ${unchangedCount}`);
    console.log(`Sample transformations:`, JSON.stringify(sampleBeforeAfter, null, 2));

  } finally {
    await pool.end();
  }
}

if (process.argv[1].endsWith('clean_servers_migration.js')) {
  runCleanup().catch(err => {
    console.error('Fatal cleanup error:', err);
    process.exit(1);
  });
}
