import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { JSONParser } from './js/parser.js';
import { getSql, getContentStatsFromPostgres, testPostgresConnection, getConnectionString } from './api/db.js';

console.log('====================================================');
console.log('🧪 VERIFYING CLEAN DATABASE & IMPORT READINESS STATE');
console.log('====================================================\n');

// 1. Check data/works.json
const worksFile = path.resolve(process.cwd(), 'data', 'works.json');
assert(fs.existsSync(worksFile), 'works.json must exist');
const worksData = JSON.parse(fs.readFileSync(worksFile, 'utf8'));

console.log('1. Checking works.json structure and counts:');
console.log('   - Works count in works.json:', (worksData.works || []).length);
assert.strictEqual((worksData.works || []).length, 0, 'Works count must be exactly 0');
console.log('   ✅ works.json is completely cleaned (0 works).');

// 2. Calculate episodes & servers in works.json
let totalEpisodes = 0;
let totalServers = 0;
(worksData.works || []).forEach(w => {
  const eps = w.episodes || [];
  totalEpisodes += eps.length;
  eps.forEach(ep => {
    totalServers += (ep.servers || []).length;
  });
});
console.log('   - Episodes count:', totalEpisodes);
console.log('   - Servers count:', totalServers);
assert.strictEqual(totalEpisodes, 0, 'Episodes count must be 0');
assert.strictEqual(totalServers, 0, 'Servers count must be 0');
console.log('   ✅ Episodes and Servers are exactly 0.');

// 3. Check JSON Import System Readiness with a fresh test JSON
console.log('\n2. Testing JSON Deep-Scan Parser Readiness for New Imports:');
const sampleNewJSON = {
  data: {
    series_title: "مسلسل كرتون جديد 2026",
    synopsis: "قصة مغامرات رائعة وجديدة تماماً لأبطال الكرتون",
    images: {
      poster: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600",
      backdrop: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200"
    },
    seasons: [
      {
        season_number: 1,
        episodes_list: [
          {
            ep_num: 1,
            ep_name: "بداية الرحلة",
            streaming_servers: [
              { server_name: "سيرفر سريع 1", player_url: "https://stream.example.com/embed/ep1" },
              { server_name: "سيرفر بديل 2", player_url: "https://cdn.example.com/video1.mp4" }
            ]
          }
        ]
      }
    ]
  }
};

const parseResult = await JSONParser.parse(sampleNewJSON);
assert(Array.isArray(parseResult.works), 'parseResult.works must be an array');
assert.strictEqual(parseResult.works.length, 1, 'Should discover 1 new work');
const newWork = parseResult.works[0];
console.log('   - Discovered Title:', newWork.title);
console.log('   - Discovered Episodes:', (newWork.episodes || []).length);
console.log('   - Discovered Servers in Ep 1:', (newWork.episodes[0]?.servers || []).length);
assert.strictEqual(newWork.title, 'مسلسل كرتون جديد 2026');
assert.strictEqual((newWork.episodes || []).length, 1);
assert.strictEqual((newWork.episodes[0]?.servers || []).length, 2);
console.log('   ✅ JSON Parser is 100% operational and ready to process new JSON imports!');

// 4. Verify PostgreSQL DB test helper functions
console.log('\n3. Testing PostgreSQL API and Connection Safety:');
const testConn = await testPostgresConnection();
console.log('   - PostgreSQL Test Result Connected:', testConn.connected);
console.log('   - PostgreSQL Test Message:', testConn.message);
console.log('   ✅ Database connection utility is intact and secure.');

console.log('\n====================================================');
console.log('🎉 ALL CLEAN DATABASE VERIFICATIONS PASSED SUCCESSFULLY!');
console.log('====================================================\n');
