import assert from 'assert';
import { VideoExtractor, JSONParser } from './js/parser.js';
import { cleanEpisodeServers } from './server/db.js';

console.log('--- Testing Video Server Extraction & Deduplication ---');

// 1. Test filtering scraping page URL when direct video server is present
const rawEpisodeWithScrapingUrl = {
  id: 'ep-test-1',
  title: 'أبطال الكرة الجزء الأول الحلقة 20',
  url: 'https://www.dima-toon.com/cartoon-episode/%d8%a3%d8%a8%d8%b7%d8%a7%d9%84-%d8%a7%d9%84%d9%83%d8%b1%d8%a9-%d8%a7%d9%84%d8%ac%d8%b2%d8%a1-%d8%a7%d9%84%d8%a3%d9%88%d9%84-%d8%a7%d9%84%d8%ad%d9%84%d9%82%d8%a9-20/',
  servers: [
    {
      name: 'أبطال الكرة الجزء الأول الحلقة 20',
      url: 'https://site.word.tn/videos/football-heroes-part-1/football-heroes-part-1-20.mp4'
    }
  ]
};

const extractedServers = VideoExtractor.extractServers(rawEpisodeWithScrapingUrl, '', 'ep-test-1');
console.log('Extracted servers count:', extractedServers.length);
assert.strictEqual(extractedServers.length, 1, 'Should extract exactly 1 server');
assert.strictEqual(extractedServers[0].url, 'https://site.word.tn/videos/football-heroes-part-1/football-heroes-part-1-20.mp4', 'Should keep the real MP4 video server');
assert.ok(!extractedServers[0].url.includes('dima-toon.com'), 'Should NOT contain the scraping page URL');

// 2. Test cleanEpisodeServers function
const sampleDirtyServers = [
  {
    id: 'srv-1',
    name: 'سيرفر 1',
    url: 'https://www.dima-toon.com/cartoon-episode/example-1/'
  },
  {
    id: 'srv-2',
    name: 'سيرفر 2',
    url: 'https://site.word.tn/videos/example/example-1.mp4'
  }
];

const cleaned = cleanEpisodeServers(sampleDirtyServers, 'ep-test-clean');
console.log('Cleaned servers count:', cleaned.length);
assert.strictEqual(cleaned.length, 1, 'cleanEpisodeServers should filter out invalid page server');
assert.strictEqual(cleaned[0].url, 'https://site.word.tn/videos/example/example-1.mp4');

// 3. Test Deduplication by URL, ID, and Composite
const duplicatedServers = [
  { id: 'srv-1', name: 'Server A', url: 'https://myvidplay.com/v/abc123' },
  { id: 'srv-1', name: 'Server A Duplicate ID', url: 'https://myvidplay.com/v/diff123' },
  { id: 'srv-2', name: 'Server A Duplicate URL', url: 'https://myvidplay.com/v/abc123' },
  { id: 'srv-3', name: 'Server B', url: 'https://site.word.tn/videos/test.mp4' }
];

const deduped = cleanEpisodeServers(duplicatedServers, 'ep-dedup');
console.log('Deduped servers count:', deduped.length);
assert.strictEqual(deduped.length, 2, 'Should deduplicate by ID and URL leaving 2 unique servers');
assert.strictEqual(deduped[0].url, 'https://myvidplay.com/v/abc123');
assert.strictEqual(deduped[1].url, 'https://site.word.tn/videos/test.mp4');

// 4. Test JSONParser parse with single-server episode
const sampleJson = JSON.stringify({
  title: 'كابتن ماجد',
  episodes: [
    {
      number: 1,
      title: 'الحلقة 1',
      url: 'https://www.dima-toon.com/cartoon-episode/captain-tsubasa-1/',
      servers: [
        {
          name: 'سيرفر مباشر',
          url: 'https://site.word.tn/videos/captain/captain-1.mp4'
        }
      ]
    }
  ]
});

JSONParser.parse(sampleJson).then(parsed => {
  assert.strictEqual(parsed.works.length, 1);
  const ep = parsed.works[0].episodes[0];
  assert.strictEqual(ep.servers.length, 1, 'Parsed episode must have exactly 1 server');
  assert.strictEqual(ep.servers[0].url, 'https://site.word.tn/videos/captain/captain-1.mp4');
  console.log('✅ All Server Extraction & Deduplication tests passed successfully!');
}).catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
