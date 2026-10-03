import assert from 'assert';
import { APP_CONFIG } from './js/config.js';
import { dataStore } from './js/data-store.js';
import { CoverExtractor, BannerExtractor, VideoExtractor, JSONParser } from './js/parser.js';

console.log('====================================================');
console.log('🧪 DARK WATCH - ANIME TOGGLE & MEDIA EXTRACTION TESTS');
console.log('====================================================\n');

// Mock works dataset
const testWorks = [
  {
    id: 'dw-anime-1',
    slug: 'solo-leveling',
    title: 'سولو ليفلينج',
    originalTitle: 'Solo Leveling',
    type: 'anime',
    statusState: 'PUBLISHED',
    cover: 'https://images.darkwatch.stream/solo.jpg',
    banner: 'https://images.darkwatch.stream/solo-backdrop.jpg',
    episodes: [{ number: 1, title: 'الحلقة 1', servers: [{ name: 'Server 1', url: 'https://v.mp4' }] }]
  },
  {
    id: 'dw-cartoon-1',
    slug: 'avatar-the-last-airbender',
    title: 'أفاتار أسطورة أنج',
    originalTitle: 'Avatar: The Last Airbender',
    type: 'cartoon',
    statusState: 'PUBLISHED',
    cover: 'https://images.darkwatch.stream/avatar.jpg',
    banner: 'https://images.darkwatch.stream/avatar-banner.jpg',
    episodes: [{ number: 1, title: 'الحلقة 1', servers: [{ name: 'Server 1', url: 'https://v.mp4' }] }]
  },
  {
    id: 'dw-cartoon-2',
    slug: 'ben-10-classic',
    title: 'بن تن كلاسيك',
    originalTitle: 'Ben 10 Classic',
    type: 'cartoon',
    statusState: 'PUBLISHED',
    cover: 'https://images.darkwatch.stream/ben10.jpg',
    banner: 'https://images.darkwatch.stream/ben10-banner.jpg',
    episodes: [{ number: 1, title: 'الحلقة 1', servers: [{ name: 'Server 1', url: 'https://v.mp4' }] }]
  }
];

dataStore.setAllWorks(testWorks);

// --- TEST PART 1: ANIME_ENABLED TOGGLE ---
console.log('1. Testing ANIME_ENABLED = false behavior...');
APP_CONFIG.ANIME_ENABLED = false;

const publicWorksDisabled = dataStore.getAllPublished();
assert.strictEqual(publicWorksDisabled.length, 2, 'Should only return 2 cartoon works when Anime is disabled');
assert(publicWorksDisabled.every(w => w.type !== 'anime'), 'No anime works should be present in public list');

const publicAnimeDisabled = dataStore.getAnime();
assert.strictEqual(publicAnimeDisabled.length, 0, 'getAnime() must return empty array when disabled');

const searchSoloDisabled = dataStore.search('Solo');
assert.strictEqual(searchSoloDisabled.length, 0, 'Search should not return anime when disabled');

const publicGetSlug = dataStore.getBySlug('solo-leveling');
assert.strictEqual(publicGetSlug, null, 'Public getBySlug must return null for anime when disabled');

const adminAnimeList = dataStore.getAllAnimeAdmin();
assert.strictEqual(adminAnimeList.length, 1, 'Admin must still access anime data in DB');
console.log('   ✅ Anime disabled mode verified: hidden from public, intact in database.');

// Reactivate Anime toggle test
console.log('\n2. Testing reactivating ANIME_ENABLED = true...');
APP_CONFIG.ANIME_ENABLED = true;

const publicWorksEnabled = dataStore.getAllPublished();
assert.strictEqual(publicWorksEnabled.length, 3, 'Should return all 3 works when Anime is enabled');
const publicAnimeEnabled = dataStore.getAnime();
assert.strictEqual(publicAnimeEnabled.length, 1, 'getAnime() must return anime works when enabled');
const searchSoloEnabled = dataStore.search('Solo');
assert.strictEqual(searchSoloEnabled.length, 1, 'Search should find anime when enabled');
console.log('   ✅ Reactivating Anime toggle works instantly without rebuilding.');

// Reset back to user desired default: ANIME_ENABLED = false
APP_CONFIG.ANIME_ENABLED = false;


// --- TEST PART 2: ADVANCED MEDIA EXTRACTION (JSON Deep-Scan) ---
console.log('\n3. Testing Dual Image Extraction (Cover vs Banner)...');

const complexWorkJSON = {
  title: 'مغامرات الفضاء جراندايزر',
  original_title: 'UFO Robot Grendizer',
  type: 'cartoon',
  media: {
    artwork: {
      poster: 'https://images.darkwatch.stream/posters/grendizer_poster.jpg?size=large',
      backdrop: 'https://images.darkwatch.stream/banners/grendizer_hero_backdrop.jpg?w=1920'
    }
  },
  episodes: [
    {
      episode_number: 1,
      title: 'الحلقة 1: شجاع الكوكب',
      // Multi-server extraction from nested sources
      servers: [
        { name: 'سيرفر Google Drive', url: 'https://drive.google.com/file/d/xyz123/preview' },
        { name: 'سيرفر مباشر FHD', url: 'https://cdn.stream.com/episodes/ep1_1080p.mp4' }
      ],
      // Video embedded in HTML iframe
      embed: '<iframe src="https://streamtape.com/e/abc999" data-src="https://streamtape.com/e/abc999/real" frameborder="0"></iframe>',
      // Direct stream
      direct_url: 'https://mega.nz/embed/file456'
    }
  ]
};

const parsedResult = await JSONParser.parseFlexible(complexWorkJSON);
const grendizer = parsedResult.works[0];

assert.strictEqual(grendizer.cover, 'https://images.darkwatch.stream/posters/grendizer_poster.jpg?size=large');
assert.strictEqual(grendizer.coverStatus, 'valid');
assert.strictEqual(grendizer.banner, 'https://images.darkwatch.stream/banners/grendizer_hero_backdrop.jpg?w=1920');
assert.strictEqual(grendizer.bannerStatus, 'valid');
console.log('   ✅ Cover correctly extracted:', grendizer.cover);
console.log('   ✅ Banner correctly extracted in its own field:', grendizer.banner);

console.log('\n4. Testing Multi-Server Extraction & HTML Video parser...');
const ep1 = grendizer.episodes[0];
console.log(`   ➔ Extracted ${ep1.servers.length} servers for Episode 1:`);
ep1.servers.forEach((s, idx) => {
  console.log(`      [${idx + 1}] ${s.name} -> ${s.url} (${s.type})`);
});

assert(ep1.servers.length >= 4, 'Should extract all 4 servers (Drive, direct mp4, iframe data-src, mega)');
assert(ep1.servers.some(s => s.url.includes('streamtape.com')), 'Must extract clean iframe url from HTML');
assert(ep1.servers.some(s => s.url.includes('drive.google.com')), 'Must extract Google Drive server');
assert(ep1.servers.some(s => s.url.includes('ep1_1080p.mp4')), 'Must extract MP4 video server');
assert(ep1.servers.some(s => s.url.includes('mega.nz')), 'Must extract Mega direct server');
console.log('   ✅ Multi-Server extraction & HTML unnesting works perfectly without dropping servers.');


console.log('\n5. Testing Srcset & Relative URL Resolution...');
const relativeSrcsetJSON = {
  name: 'المحقق كونان',
  html_cover: '<img src="/assets/small.jpg" srcset="/assets/small.jpg 300w, /assets/medium.jpg 600w, /assets/conan_hq_poster.jpg 1200w" />',
  banner_tag: '<div data-src="/images/conan_wide_banner.png"></div>',
  episodes: [
    {
      num: 1,
      name: 'جريمة القصر المجهول',
      video_urls: [
        '<video src="/videos/ep1.mp4"></video>',
        '/videos/ep1_alt.m3u8'
      ]
    }
  ]
};

const parsedRelative = await JSONParser.parseFlexible(relativeSrcsetJSON);
const conan = parsedRelative.works[0];
console.log('   ➔ Extracted Cover:', conan.cover);
console.log('   ➔ Extracted Banner:', conan.banner);
assert(conan.cover.includes('conan_hq_poster.jpg'), 'Srcset parser should pick highest resolution image');
assert(conan.banner.includes('conan_wide_banner.png'), 'HTML data-src banner should be extracted');
console.log('   ✅ High resolution srcset parsing verified.');

console.log('\n6. Testing Comprehensive Audit Stats Output...');
const stats = parsedResult.stats;
console.log('   📊 Audit Stats Preview:');
console.log('      - Total Works:', stats.totalWorks);
console.log('      - Total Episodes:', stats.totalEpisodes);
console.log('      - Total Videos:', stats.totalVideos);
console.log('      - Total Servers:', stats.totalServers);
console.log('      - Valid Covers:', stats.validCoversCount);
console.log('      - Valid Banners:', stats.validBannersCount);
console.log('      - Needs Review:', stats.needsReviewCount);

assert(stats.totalWorks > 0 && stats.totalServers > 0);
console.log('   ✅ Audit statistics verified.');

console.log('\n====================================================');
console.log('🎉 ALL UNIT & INTEGRATION TESTS PASSED (100%)');
console.log('====================================================\n');
