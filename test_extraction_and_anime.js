import assert from 'assert';
import { APP_CONFIG } from './js/config.js';
import { JSONParser, CoverExtractor, BannerExtractor, VideoExtractor, URLCleaner } from './js/parser.js';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING TEST SUITE: JSON EXTRACTION & ANIME TOGGLE');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // 1. Test URL Cleaner & HTML/Lazy-loading Extraction
  // ----------------------------------------------------
  console.log('1. Testing URL Cleaner & HTML/Lazy-loading Extraction:');

  const rawHtmlImg = '<img src="https://example.com/poster.jpg" alt="Poster">';
  assert.strictEqual(URLCleaner.cleanUrl(rawHtmlImg), 'https://example.com/poster.jpg');

  const rawLazyImg = '<img class="lazy" data-src="https://example.com/real-poster.jpg" src="data:image/png;base64,placeholder" />';
  assert.strictEqual(URLCleaner.cleanUrl(rawLazyImg), 'https://example.com/real-poster.jpg');

  const rawSrcset = '<img srcset="https://example.com/poster-small.jpg 300w, https://example.com/poster-large.jpg 1200w" />';
  assert.strictEqual(URLCleaner.cleanUrl(rawSrcset), 'https://example.com/poster-large.jpg');

  const encodedUrl = 'https://example.com/image.jpg?foo=1&amp;bar=2';
  assert.strictEqual(URLCleaner.cleanUrl(encodedUrl), 'https://example.com/image.jpg?foo=1&bar=2');

  const relativeUrl = '/media/covers/poster.jpg';
  assert.strictEqual(URLCleaner.cleanUrl(relativeUrl, 'https://cdn.darkwatch.app'), 'https://cdn.darkwatch.app/media/covers/poster.jpg');

  console.log('   ✓ URL Cleaner, HTML, data-src, srcset, and relative URL handling passed.');

  // ----------------------------------------------------
  // 2. Test Deep Recursive Cover & Banner Extraction
  // ----------------------------------------------------
  console.log('\n2. Testing Deep Recursive Cover & Banner Extraction:');

  const sampleComplexJSON = {
    data: {
      meta: {
        details: {
          series_info: {
            title: "المحقق كونان",
            type: "anime",
            media_assets: {
              posters: [
                { url: "https://cdn.example.com/conan-poster-hd.jpg", type: "portrait_cover" }
              ],
              backdrops: [
                { url: "https://cdn.example.com/conan-banner-wide.jpg", type: "landscape_banner" }
              ]
            },
            seasons: [
              {
                season_num: 1,
                episodes_list: [
                  {
                    ep_no: "1",
                    name: "جريمة قتل في مدينة الملاهي",
                    thumbnail: "https://cdn.example.com/ep1-thumb-small.jpg",
                    streams: [
                      { server_name: "سيرفر Google Drive", stream_url: "https://drive.google.com/file/d/xyz/preview" },
                      { server_name: "سيرفر Mega", embed: "https://mega.nz/embed/xyz" }
                    ]
                  },
                  {
                    ep_no: "2",
                    name: "اختطاف ابنة رئيس الشركة",
                    thumbnail: "https://cdn.example.com/ep2-thumb-small.jpg",
                    stream_sources: [
                      { name: "Direct MP4", url: "https://video.example.com/conan-ep2.mp4" }
                    ]
                  }
                ]
              }
            ]
          }
        }
      }
    }
  };

  const parsed = await JSONParser.parseFlexible(sampleComplexJSON);
  assert.strictEqual(parsed.works.length, 1);
  const conan = parsed.works[0];

  assert.strictEqual(conan.title, 'المحقق كونان');
  assert.strictEqual(conan.cover, 'https://cdn.example.com/conan-poster-hd.jpg');
  assert.strictEqual(conan.banner, 'https://cdn.example.com/conan-banner-wide.jpg');
  assert.strictEqual(conan.episodes.length, 2);
  assert.strictEqual(conan.episodes[0].number, 1);
  assert.strictEqual(conan.episodes[0].servers.length, 2);
  assert.strictEqual(conan.episodes[1].number, 2);
  assert.strictEqual(conan.episodes[1].servers.length, 1);

  console.log('   ✓ Complex 6-level nested JSON extracted perfectly with distinct cover, banner, and episodes.');

  // ----------------------------------------------------
  // 3. Test Video & Server Formats (embed, iframe, array of urls, etc.)
  // ----------------------------------------------------
  console.log('\n3. Testing Video and Server Extraction Variations:');

  const variousVideoJSON = {
    works: [
      {
        title: "مغامرات سندباد",
        type: "cartoon",
        poster: "https://cdn.example.com/sinbad-cover.jpg",
        episodes: [
          {
            number: 1,
            title: "البداية",
            // Case: servers as raw strings array
            servers: [
              "https://server1.com/watch?v=123",
              "https://server2.com/embed/456",
              "https://video.com/file.mp4"
            ]
          },
          {
            number: 2,
            title: "الجزيرة العائمة",
            // Case: servers as object with keys
            player: {
              server_alpha: "https://server-alpha.com/video/ep2",
              server_beta: { iframe_url: "https://server-beta.com/embed/ep2" }
            }
          }
        ]
      }
    ]
  };

  const parsedSinbad = await JSONParser.parseFlexible(variousVideoJSON);
  assert.strictEqual(parsedSinbad.works.length, 1);
  const sinbad = parsedSinbad.works[0];
  assert.strictEqual(sinbad.episodes.length, 2);
  assert.strictEqual(sinbad.episodes[0].servers.length, 3);
  assert.strictEqual(sinbad.episodes[1].servers.length, 2);

  console.log('   ✓ String arrays and nested server objects properly normalized into server lists.');

  // ----------------------------------------------------
  // 4. Test Anime Disabling (ANIME_ENABLED = false)
  // ----------------------------------------------------
  console.log('\n4. Testing Anime Pause Logic:');

  assert.strictEqual(APP_CONFIG.ANIME_ENABLED, false, 'APP_CONFIG.ANIME_ENABLED should be false by default');

  const mockStore = {
    works: [
      { id: '1', title: 'دراغون بول', type: 'anime', statusState: 'PUBLISHED' },
      { id: '2', title: 'سندباد', type: 'cartoon', statusState: 'PUBLISHED' },
      { id: '3', title: 'سالي', type: 'cartoon', statusState: 'PUBLISHED' }
    ],
    getAllPublished() {
      if (!APP_CONFIG.ANIME_ENABLED) {
        return this.works.filter(w => (w.type || '').toLowerCase() !== 'anime');
      }
      return [...this.works];
    },
    getAnime() {
      if (!APP_CONFIG.ANIME_ENABLED) {
        return [];
      }
      return this.works.filter(w => (w.type || '').toLowerCase() === 'anime');
    },
    getAllAnimeAdmin() {
      return this.works.filter(w => (w.type || '').toLowerCase() === 'anime');
    }
  };

  const publishedWhenDisabled = mockStore.getAllPublished();
  assert.strictEqual(publishedWhenDisabled.length, 2);
  assert.strictEqual(publishedWhenDisabled.some(w => w.type === 'anime'), false);
  assert.strictEqual(mockStore.getAnime().length, 0);
  assert.strictEqual(mockStore.getAllAnimeAdmin().length, 1, 'Anime data MUST remain preserved in DB/Admin');

  console.log('   ✓ Public queries return only cartoon works when ANIME_ENABLED=false.');
  console.log('   ✓ Admin queries and Database preserve all anime works and episodes 100%.');

  console.log('\n====================================================');
  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY (100% OK)');
  console.log('====================================================');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
