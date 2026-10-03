import assert from 'assert';
import { getConnectionString, getActiveEnvVarName, sanitizeError, testPostgresConnection, safeJsonParse, upsertSingleWork, getAllWorksFromPostgres } from './api/db.js';
import healthDatabaseHandler from './api/health/database.js';
import healthHandler from './api/health.js';

console.log('================================================================');
console.log('🧪 RUNNING POSTGRESQL CONNECTION & DATA RESILIENCE TEST SUITE');
console.log('================================================================\n');

// 1. Test getConnectionString prioritizing POSTGRES_URL
process.env.DATABASE_URL = 'postgres://dbuser:secretpass@ep-fallback.region.neon.tech/neondb';
process.env.POSTGRES_URL = 'postgres://mainuser:secretpass123@ep-primary.region.neon.tech/neondb';

const primaryUrl = getConnectionString();
console.log('1. Testing POSTGRES_URL priority:');
assert(primaryUrl.includes('mainuser'), 'POSTGRES_URL must have higher priority than DATABASE_URL');
assert.strictEqual(getActiveEnvVarName(), 'POSTGRES_URL');
console.log('   ✅ POSTGRES_URL is correctly prioritized as primary.');

// 2. Test fallback to DATABASE_URL when POSTGRES_URL is unset
delete process.env.POSTGRES_URL;
const fallbackUrl = getConnectionString();
console.log('\n2. Testing DATABASE_URL fallback:');
assert(fallbackUrl.includes('dbuser'), 'DATABASE_URL must be used when POSTGRES_URL is absent');
assert.strictEqual(getActiveEnvVarName(), 'DATABASE_URL');
console.log('   ✅ DATABASE_URL fallback works correctly.');

// 3. Test quotes and whitespace trimming in connection strings
process.env.POSTGRES_URL = '  "postgres://trimmeduser:pass@ep-trimmed.neon.tech/neondb"  ';
const cleanedUrl = getConnectionString();
console.log('\n3. Testing trimmed/unquoted URL parsing:');
assert(!cleanedUrl.startsWith('"') && !cleanedUrl.endsWith('"') && cleanedUrl.startsWith('postgres://trimmeduser'), 'Quoted URL must be trimmed');
console.log('   ✅ Quotes and whitespace are safely cleaned.');

// 4. Test Error Sanitization (Security: No credentials in error logs/UI)
console.log('\n4. Testing Credential Sanitization:');
const rawError = 'Connection failed: postgres://admin:supersecretpassword@ep-neon-12345.eu-west-1.neon.tech:5432/darkwatch?sslmode=require';
const safe = sanitizeError(rawError);
assert(!safe.includes('supersecretpassword'), 'Password must never appear in sanitized error');
assert(!safe.includes('admin:'), 'Credentials must be masked');
console.log('   Safe error preview:', safe);
console.log('   ✅ Sensitive connection credentials are sanitized 100%.');

// 5. Test State 1: missing environment variables (Clean server message)
delete process.env.POSTGRES_URL;
delete process.env.DATABASE_URL;
delete process.env.POSTGRES_PRISMA_URL;
delete process.env.POSTGRES_URL_NON_POOLING;
delete process.env.NEON_DATABASE_URL;
delete process.env.SUPABASE_DB_URL;
delete process.env.PGURI;

console.log('\n5. Testing State 1 (Missing env handling & classification):');
const missingEnvResult = await testPostgresConnection();
assert.strictEqual(missingEnvResult.connected, false);
assert.strictEqual(missingEnvResult.state, 'MISSING_ENV_VAR');
assert.strictEqual(missingEnvResult.status, 'missing_env');
assert(missingEnvResult.message.includes('POSTGRES_URL') || missingEnvResult.message.includes('DATABASE_URL'));
console.log('   State 1 message:', missingEnvResult.message);
console.log('   ✅ Missing environment variables categorized precisely as State 1 (MISSING_ENV_VAR).');

// 6. Test safeJsonParse resilience against deleted/corrupted/null columns
console.log('\n6. Testing safeJsonParse on null, corrupted, and valid data:');
assert.deepStrictEqual(safeJsonParse(null, []), []);
assert.deepStrictEqual(safeJsonParse(undefined, []), []);
assert.deepStrictEqual(safeJsonParse('', []), []);
assert.deepStrictEqual(safeJsonParse('{invalid_json', []), []);
assert.deepStrictEqual(safeJsonParse('["alt1", "alt2"]', []), ['alt1', 'alt2']);
assert.deepStrictEqual(safeJsonParse([{ name: 'srv' }], []), [{ name: 'srv' }]);
console.log('   ✅ safeJsonParse handles all corrupted or missing data without throwing.');

// 7. Test Health check route handlers (/api/health/database & /api/health)
console.log('\n7. Testing /api/health/database and /api/health handlers:');
let healthDbJson = null;
let healthDbStatus = null;
await healthDatabaseHandler({ method: 'GET' }, {
  setHeader: () => {},
  status: (code) => { healthDbStatus = code; return { json: (d) => { healthDbJson = d; } }; }
});
assert.strictEqual(healthDbStatus, 503);
assert.strictEqual(healthDbJson.database, 'error');

let healthJson = null;
await healthHandler({ method: 'GET' }, {
  setHeader: () => {},
  status: () => ({ json: (d) => { healthJson = d; } })
});
assert.strictEqual(healthJson.database, 'disconnected');
console.log('   ✅ Health check endpoints (/api/health/database & /api/health) respond accurately.');

console.log('\n================================================================');
console.log('🎉 ALL POSTGRESQL & VERCEL TESTS PASSED (100% OK)');
console.log('================================================================\n');


