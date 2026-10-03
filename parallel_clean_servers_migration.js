import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();

const { Pool } = pg;

export function isInvalidPageServer(server, allServersInEp) {
  if (!server || !server.url) return true;
  const url = String(server.url).trim().toLowerCase();

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

  if (validServers.length === 0 && servers.length > 0) {
    return servers.slice(0, 1);
  }

  return validServers;
}

async function runParallelCleanup() {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error('No connection string available');
    return;
  }

  const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 20
  });

  try {
    console.log('--- Fetching episodes for cleanup ---');
    const res = await pool.query('SELECT id, work_id, number, title, servers FROM dw_episodes');
    console.log(`Found ${res.rows.length} total episodes.`);

    const updates = [];
    for (const row of res.rows) {
      const rawServers = Array.isArray(row.servers) ? row.servers : JSON.parse(row.servers || '[]');
      const cleaned = cleanEpisodeServers(rawServers, row.id);

      const beforeJson = JSON.stringify(rawServers);
      const afterJson = JSON.stringify(cleaned);

      if (beforeJson !== afterJson) {
        updates.push({ id: row.id, servers: afterJson });
      }
    }

    console.log(`Need to update ${updates.length} episodes.`);

    const chunkSize = 50;
    let completed = 0;

    for (let i = 0; i < updates.length; i += chunkSize) {
      const chunk = updates.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(item =>
          pool.query(
            'UPDATE dw_episodes SET servers = $1::jsonb, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [item.servers, item.id]
          )
        )
      );
      completed += chunk.length;
      if (completed % 1000 === 0 || completed === updates.length) {
        console.log(`Progress: ${completed} / ${updates.length} updated`);
      }
    }

    console.log('✅ Server cleanup completed successfully!');

    // Verify
    const sample = await pool.query('SELECT id, title, servers FROM dw_episodes LIMIT 5');
    console.log('Sample updated records:');
    sample.rows.forEach(r => {
      console.log(`[Episode ${r.id}] ${r.title} =>`, r.servers);
    });

  } finally {
    await pool.end();
  }
}

runParallelCleanup().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
