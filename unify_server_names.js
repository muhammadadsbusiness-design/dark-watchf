import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();

const { Pool } = pg;

async function unifyServerNames() {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error('No database connection string');
    return;
  }

  const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 20
  });

  try {
    console.log('--- Unifying server names in dw_episodes ---');
    const res = await pool.query('SELECT id, servers FROM dw_episodes');
    console.log(`Found ${res.rows.length} episodes.`);

    const updates = [];
    for (const row of res.rows) {
      let servers = Array.isArray(row.servers) ? row.servers : JSON.parse(row.servers || '[]');
      if (!Array.isArray(servers) || servers.length === 0) continue;

      let changed = false;
      const updatedServers = servers.map((srv, idx) => {
        if (!srv) return srv;
        const targetName = idx === 0 ? 'السرفر الأول' : (srv.name || `السرفر ${idx + 1}`);
        if (srv.name !== targetName) {
          changed = true;
          return { ...srv, name: targetName };
        }
        return srv;
      });

      if (changed) {
        updates.push({ id: row.id, servers: JSON.stringify(updatedServers) });
      }
    }

    console.log(`Need to update ${updates.length} episode server names.`);

    const chunkSize = 100;
    let updatedCount = 0;
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
      updatedCount += chunk.length;
      if (updatedCount % 1000 === 0 || updatedCount === updates.length) {
        console.log(`Progress: ${updatedCount} / ${updates.length} updated`);
      }
    }

    console.log('✅ All episode server names unified to "السرفر الأول" successfully!');
  } finally {
    await pool.end();
  }
}

unifyServerNames().catch(err => {
  console.error('Error unifying server names:', err);
  process.exit(1);
});
