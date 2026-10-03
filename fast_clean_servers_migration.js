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

async function runFastCleanup() {
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
    console.log('--- Starting Fast Server Cleanup Migration in PostgreSQL ---');
    const res = await pool.query('SELECT id, work_id, number, title, servers FROM dw_episodes ORDER BY work_id, number ASC');
    console.log(`Found ${res.rows.length} total episodes to audit.`);

    const updates = [];
    let cleanedCount = 0;

    for (const row of res.rows) {
      const rawServers = Array.isArray(row.servers) ? row.servers : JSON.parse(row.servers || '[]');
      const cleaned = cleanEpisodeServers(rawServers, row.id);

      const beforeJson = JSON.stringify(rawServers);
      const afterJson = JSON.stringify(cleaned);

      if (beforeJson !== afterJson) {
        cleanedCount++;
        updates.push({ id: row.id, servers: afterJson });
      }
    }

    console.log(`Identified ${cleanedCount} episodes requiring server cleanup.`);

    if (updates.length > 0) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        const batchSize = 250;
        for (let i = 0; i < updates.length; i += batchSize) {
          const chunk = updates.slice(i, i + batchSize);
          
          // Construct parameterized bulk update
          const valuesClause = chunk.map((item, idx) => `($${idx * 2 + 1}::text, $${idx * 2 + 2}::jsonb)`).join(', ');
          const params = [];
          chunk.forEach(item => {
            params.push(item.id, item.servers);
          });

          const queryText = `
            UPDATE dw_episodes AS e
            SET servers = v.servers, updated_at = CURRENT_TIMESTAMP
            FROM (VALUES ${valuesClause}) AS v(id, servers)
            WHERE e.id = v.id;
          `;

          await client.query(queryText, params);
          console.log(`Updated batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(updates.length / batchSize)} (${Math.min(i + batchSize, updates.length)}/${updates.length})`);
        }

        await client.query('COMMIT');
        console.log('✅ All bulk updates COMMITTED successfully.');
      } catch (err) {
        await client.query('ROLLBACK');
        console.error('Batch error, rolled back:', err);
        throw err;
      } finally {
        client.release();
      }
    }

    // Verify final state
    const verifyRes = await pool.query('SELECT id, work_id, number, title, servers FROM dw_episodes LIMIT 5');
    console.log('\n--- Sample Verified Episodes in DB ---');
    verifyRes.rows.forEach(r => {
      console.log(`[Episode ${r.id}] Title: ${r.title}, Servers:`, r.servers);
    });

  } finally {
    await pool.end();
  }
}

runFastCleanup().catch(err => {
  console.error('Fatal cleanup error:', err);
  process.exit(1);
});
