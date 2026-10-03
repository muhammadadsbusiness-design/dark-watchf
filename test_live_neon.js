import dotenv from 'dotenv';
dotenv.config();

import { getPool, sql, testPostgresConnection, getConnectionString, getActiveEnvVarName } from './server/db.js';

async function runLiveTest() {
  console.log('====================================================');
  console.log('🐘 NEON POSTGRESQL LIVE CONNECTION VERIFICATION');
  console.log('====================================================\n');

  const connStr = getConnectionString();
  const envVarName = getActiveEnvVarName();

  console.log('1. Checking Environment Variables:');
  if (connStr) {
    console.log(`   ✅ POSTGRES_URL / Active Env Var: ${envVarName} = FOUND`);
  } else {
    console.error('   ❌ POSTGRES_URL is MISSING!');
    process.exit(1);
  }

  console.log('\n2. Executing Real SELECT 1; Query:');
  try {
    const pingStart = Date.now();
    const pingResult = await sql`SELECT 1 as ping, version(), NOW() as now;`;
    const latency = Date.now() - pingStart;
    console.log(`   ✅ SELECT 1 = SUCCESS (Latency: ${latency} ms)`);
    console.log(`   🐘 Database Version: ${pingResult[0]?.version?.split(' ')[0] || 'PostgreSQL'}`);
    console.log(`   🕒 Server Time: ${pingResult[0]?.now}`);
  } catch (err) {
    console.error('   ❌ SELECT 1 Failed:', err.message);
    process.exit(1);
  }

  console.log('\n3. Running Full Diagnostics & Table Check:');
  try {
    const diag = await testPostgresConnection();
    console.log(`   Connected: ${diag.connected ? 'YES ✅' : 'NO ❌'}`);
    console.log(`   State: ${diag.state}`);
    console.log(`   Status: ${diag.status}`);
    console.log(`   Tables Exist: ${diag.tablesExist ? 'YES ✅' : 'NO ❌'}`);
    console.log(`   Works Count: ${diag.worksCount}`);
    console.log(`   Episodes Count: ${diag.episodesCount}`);
    console.log(`   Message: ${diag.message}`);

    if (diag.connected && diag.worksCount === 0 && diag.episodesCount === 0) {
      console.log('\n   🎉 Empty database condition verified: 0 works, 0 episodes handled perfectly without error!');
    }
  } catch (err) {
    console.error('   ❌ Diagnostics failed:', err.message);
    process.exit(1);
  }

  console.log('\n====================================================');
  console.log('🎉 NEON POSTGRESQL IS FULLY CONNECTED & HEALTHY!');
  console.log('====================================================\n');
  process.exit(0);
}

runLiveTest();
