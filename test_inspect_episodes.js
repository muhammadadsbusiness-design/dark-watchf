import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();

const { Pool } = pg;

async function inspectEpisodes() {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  console.log('Using URL:', url ? url.substring(0, 30) + '...' : 'NONE');
  if (!url) {
    console.log('No database url found in env');
    return;
  }

  const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const res = await pool.query('SELECT id, work_id, number, title, servers FROM dw_episodes ORDER BY work_id, number ASC LIMIT 100');
    console.log(`Total episodes found: ${res.rows.length}`);
    
    let twoServerCount = 0;
    for (const row of res.rows) {
      const servers = Array.isArray(row.servers) ? row.servers : JSON.parse(row.servers || '[]');
      if (servers.length > 1) {
        twoServerCount++;
        console.log(`[Episode ${row.id}] Work: ${row.work_id} Ep #${row.number} Title: ${row.title}`);
        console.log(`  Servers (${servers.length}):`, JSON.stringify(servers, null, 2));
      }
    }
    console.log(`Episodes with >1 servers: ${twoServerCount}`);
  } catch (e) {
    console.error('Query error:', e);
  } finally {
    await pool.end();
  }
}

inspectEpisodes();
