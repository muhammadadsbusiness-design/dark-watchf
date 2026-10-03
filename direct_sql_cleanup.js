import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();

const { Pool } = pg;

async function runDirectSqlCleanup() {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error('No connection string found.');
    return;
  }

  const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('--- Executing Direct Native PostgreSQL JSONB Cleanup ---');

    // 1. Direct native SQL cleanup of any dima-toon scraping page URLs from dw_episodes.servers
    const sqlQuery = `
      UPDATE dw_episodes
      SET servers = COALESCE(
        (
          SELECT jsonb_agg(elem)
          FROM jsonb_array_elements(servers) AS elem
          WHERE NOT (
            elem->>'url' ILIKE '%dima-toon.com/cartoon-episode%' OR
            elem->>'url' ILIKE '%dima-toon.com/anime-episode%' OR
            elem->>'url' ILIKE '%dima-toon.com/watch%' OR
            elem->>'url' ILIKE '%/cartoon-episode/%' OR
            elem->>'url' ILIKE '%/anime-episode/%'
          )
        ),
        servers
      ),
      updated_at = CURRENT_TIMESTAMP
      WHERE servers::text ILIKE '%dima-toon.com%'
         OR servers::text ILIKE '%cartoon-episode%'
         OR servers::text ILIKE '%anime-episode%';
    `;

    const result = await pool.query(sqlQuery);
    console.log(`✅ Native SQL updated ${result.rowCount} episodes successfully!`);

    // 2. Audit and check distribution of server counts across ALL episodes
    const auditRes = await pool.query(`
      SELECT 
        jsonb_array_length(servers) AS server_count,
        count(*) AS total_episodes
      FROM dw_episodes
      GROUP BY jsonb_array_length(servers)
      ORDER BY server_count;
    `);

    console.log('\n--- Server Count Distribution Across Database ---');
    console.table(auditRes.rows);

    // 3. Inspect a sample of episodes to verify exactly 1 valid server is present
    const sample = await pool.query(`
      SELECT id, title, servers
      FROM dw_episodes
      ORDER BY work_id, number ASC
      LIMIT 10;
    `);

    console.log('\n--- Sample Verified Episodes (After Cleanup) ---');
    sample.rows.forEach(r => {
      const srvs = typeof r.servers === 'string' ? JSON.parse(r.servers) : r.servers;
      console.log(`[Episode ${r.id}] ${r.title}`);
      console.log(`  Servers count: ${srvs.length}`);
      console.log(`  Servers:`, JSON.stringify(srvs, null, 2));
    });

  } finally {
    await pool.end();
  }
}

runDirectSqlCleanup().catch(err => {
  console.error('Direct SQL cleanup error:', err);
  process.exit(1);
});
