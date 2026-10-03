import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();

const { Pool } = pg;

async function checkAllServers() {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

  try {
    const res = await pool.query('SELECT id, work_id, number, title, servers FROM dw_episodes');
    console.log(`Total episodes in database: ${res.rows.length}`);
    
    let episodesWith2Servers = 0;
    let episodesWith1Server = 0;
    let episodesWithOtherCount = 0;
    const urlPatterns = {};

    for (const row of res.rows) {
      const servers = Array.isArray(row.servers) ? row.servers : JSON.parse(row.servers || '[]');
      if (servers.length === 2) episodesWith2Servers++;
      else if (servers.length === 1) episodesWith1Server++;
      else episodesWithOtherCount++;

      servers.forEach((s, idx) => {
        try {
          const u = new URL(s.url);
          const domain = u.hostname;
          urlPatterns[domain] = (urlPatterns[domain] || 0) + 1;
        } catch {
          urlPatterns['invalid-url'] = (urlPatterns['invalid-url'] || 0) + 1;
        }
      });
    }

    console.log(`Episodes with 1 server: ${episodesWith1Server}`);
    console.log(`Episodes with 2 servers: ${episodesWith2Servers}`);
    console.log(`Episodes with other counts: ${episodesWithOtherCount}`);
    console.log('Domain breakdown:', JSON.stringify(urlPatterns, null, 2));

  } finally {
    await pool.end();
  }
}

checkAllServers();
