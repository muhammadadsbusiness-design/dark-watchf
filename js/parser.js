/**
 * Dark Watch - Ultra-Flexible Recursive JSON Parser & Intelligent Media Extraction Engine v3.0
 * 
 * Features:
 * 1. Deep Recursive Traversal of arbitrary JSON structures (objects, arrays, nested trees up to 12 levels).
 * 2. Dedicated Dual Image Extraction: Independent 'Cover' (Portrait/Poster) & 'Banner' (Wide/Backdrop) engines.
 * 3. Multi-Quality Image Resolution (Original > Large > Medium > Thumbnail) & Srcset parser.
 * 4. HTML Video/Embed and Image URL extraction (<iframe src/data-src>, <video>, <source>, etc.).
 * 5. Multi-Server Extraction per Episode (extracts ALL servers, never drops alternative providers).
 * 6. Multi-Signal Episode Detection Confidence Scoring.
 * 7. Non-destructive relative path resolution & URL entity cleaning.
 * 8. Comprehensive Import Audit Metrics: Works, Episodes, Videos, Servers, Covers, Banners, Needs Review.
 */

export class URLCleaner {
  /**
   * Cleans, normalizes, and validates URLs from strings, HTML fragments, or relative paths.
   */
  static cleanUrl(raw, baseDomain = '') {
    if (!raw) return null;
    if (typeof raw !== 'string') {
      if (typeof raw === 'object' && raw !== null) {
        raw = raw.url || raw.src || raw.link || raw.original || raw.large || raw.high || raw.full || raw.file || raw.stream_url || '';
      } else {
        return null;
      }
    }

    let str = String(raw).trim();
    if (!str || str === 'null' || str === 'undefined' || str === '[object Object]' || str === 'none') {
      return null;
    }

    // 1. Extract URL from HTML embed/video/img tags (prioritize lazy-loading real URLs over placeholder src)
    if (str.includes('<') || str.includes('data-src') || str.includes('src=') || str.includes('srcset=') || str.includes('data-url')) {
      const dataMatch = str.match(/data-(?:src|original|lazy|url|img|video|embed|file)=["']([^"']+)["']/i);
      if (dataMatch && dataMatch[1]) {
        str = dataMatch[1].trim();
      } else {
        const srcsetMatch = str.match(/srcset=["']([^"']+)["']/i);
        if (srcsetMatch && srcsetMatch[1]) {
          const candidates = srcsetMatch[1].split(',').map(s => s.trim().split(/\s+/)[0]).filter(Boolean);
          if (candidates.length > 0) {
            str = candidates[candidates.length - 1]; // Pick last (highest res)
          }
        } else {
          const srcMatch = str.match(/src=["']([^"']+)["']/i);
          if (srcMatch && srcMatch[1]) {
            str = srcMatch[1].trim();
          }
        }
      }
    }

    // 2. Markdown link/image extraction: [text](url) or ![alt](url)
    const mdMatch = str.match(/!?\[.*?\]\((https?:\/\/[^\s\)]+)\)/i);
    if (mdMatch && mdMatch[1]) {
      str = mdMatch[1].trim();
    }

    // 3. CSS url('...')
    const cssMatch = str.match(/url\(['"]?(https?:\/\/[^'"\)]+)['"]?\)/i);
    if (cssMatch && cssMatch[1]) {
      str = cssMatch[1].trim();
    }

    // 4. Decode HTML entities
    str = str
      .replace(/&amp;/g, '&')
      .replace(/&#x2F;/g, '/')
      .replace(/&#47;/g, '/')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');

    // 5. Clean surrounding quotes, backslashes, and trailing commas
    str = str.replace(/^["'`\\,\s]+|["'`\\,\s]+$/g, '').trim();

    // 6. Protocol-relative URLs: //example.com/asset.jpg -> https://example.com/asset.jpg
    if (str.startsWith('//')) {
      str = 'https:' + str;
    }

    // 7. Relative path resolution: /uploads/image.png
    if (str.startsWith('/') && !str.startsWith('//')) {
      if (baseDomain) {
        const cleanDomain = baseDomain.replace(/\/+$/, '');
        str = `${cleanDomain}${str}`;
      } else {
        str = str.replace(/\/+/g, '/');
      }
    } else if (!str.startsWith('http://') && !str.startsWith('https://') && !str.startsWith('data:') && baseDomain) {
      const cleanDomain = baseDomain.replace(/\/+$/, '');
      str = `${cleanDomain}/${str}`;
    }

    // 8. Basic validation
    if (!str.startsWith('http://') && !str.startsWith('https://') && !str.startsWith('/') && !str.startsWith('data:')) {
      return null;
    }

    return str;
  }
}

export class CoverExtractor {
  static DEFAULT_FALLBACK = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80';

  /**
   * Intelligently discovers and scores the best portrait/poster cover for a work.
   */
  static extractBestCover(rawWork, baseDomain = '') {
    if (!rawWork || typeof rawWork !== 'object') {
      return {
        cover: this.DEFAULT_FALLBACK,
        coverStatus: 'missing',
        coverSource: 'default_fallback',
        hasRealCover: false
      };
    }

    const candidates = [];
    const episodeContainerKeys = new Set([
      'episodes', 'ep_list', 'episode_list', 'episodes_list', 'items',
      'videos', 'parts', 'seasons', 'streams', 'sources', 'servers', 'links'
    ]);

    // Scoring weights for poster/cover keys
    const coverScoreMap = {
      'poster': 100,
      'cover': 100,
      'posters': 98,
      'covers': 98,
      'poster_image': 98,
      'cover_image': 98,
      'posterimage': 98,
      'coverimage': 98,
      'poster_url': 97,
      'cover_url': 97,
      'posterurl': 97,
      'coverurl': 97,
      'main_poster': 96,
      'main_cover': 96,
      'main_image': 95,
      'mainimage': 95,
      'cover_photo': 94,
      'poster_path': 93,
      'cover_path': 93,
      'featured_image': 92,
      'poster_large': 92,
      'cover_large': 92,
      'portrait': 90,
      'portrait_cover': 95,
      'card': 85,
      'artwork': 85,
      'picture': 82,
      'photo': 80,
      'image': 80,
      'img': 78,
      'image_url': 78,
      'imageurl': 78,
      'original': 92,
      'large': 90,
      'extra_large': 90,
      'xlarge': 90,
      'full': 88,
      'high': 86,
      'thumbnail': 65,
      'thumb': 60,
      'thumbnail_url': 60,
      'small_image': 55,
      'medium_image': 60,
      'preview': 55
    };

    const inspectNode = (node, pathKey = '', depth = 0, parentContext = null) => {
      if (!node || depth > 12) return;

      if (typeof node === 'string') {
        const cleaned = URLCleaner.cleanUrl(node, baseDomain);
        if (cleaned && this.isImageLikeUrl(cleaned)) {
          const lKey = pathKey.toLowerCase();
          const segments = lKey.split(/[\.\[\]]/).filter(Boolean);
          const lastSegment = segments[segments.length - 1] || '';

          let score = coverScoreMap[lastSegment] || coverScoreMap[lKey] || 40;

          // Check all segments in path
          for (const seg of segments) {
            if (coverScoreMap[seg] && coverScoreMap[seg] > score) {
              score = coverScoreMap[seg];
            }
          }

          // Bonus if key contains poster/cover
          if (lKey.includes('poster') || lKey.includes('cover') || lKey.includes('main')) score += 15;
          if (lKey.includes('thumb') || lKey.includes('small')) score -= 10;
          if (lKey.includes('banner') || lKey.includes('backdrop') || lKey.includes('wide')) score -= 25;

          // Context / sibling bonus
          if (parentContext && typeof parentContext === 'object') {
            const ctxStr = JSON.stringify(parentContext).toLowerCase();
            if (ctxStr.includes('poster') || ctxStr.includes('portrait')) score += 20;
            if (ctxStr.includes('banner') || ctxStr.includes('backdrop') || ctxStr.includes('landscape')) score -= 25;
          }

          // URL keyword bonus
          const lUrl = cleaned.toLowerCase();
          if (lUrl.includes('poster') || lUrl.includes('cover') || lUrl.includes('large') || lUrl.includes('original')) score += 5;
          if (lUrl.includes('thumb') || lUrl.includes('small') || lUrl.includes('50x50')) score -= 10;

          candidates.push({ url: cleaned, score, source: pathKey || 'direct' });
        }
        return;
      }

      if (Array.isArray(node)) {
        node.forEach((elem, idx) => {
          inspectNode(elem, `${pathKey}[${idx}]`, depth + 1, node);
        });
        return;
      }

      if (typeof node === 'object' && node !== null) {
        for (const [k, v] of Object.entries(node)) {
          const lk = k.toLowerCase();
          if (episodeContainerKeys.has(lk)) continue; // Do not inspect episode containers for work poster

          const currentPath = pathKey ? `${pathKey}.${k}` : k;
          inspectNode(v, currentPath, depth + 1, node);
        }
      }
    };

    inspectNode(rawWork, '', 0);

    const validCandidates = candidates.filter(c => c.score > 20).sort((a, b) => b.score - a.score);
    if (validCandidates.length > 0) {
      const best = validCandidates[0];
      return {
        cover: best.url,
        coverStatus: best.score >= 70 ? 'valid' : 'fallback',
        coverSource: best.source,
        hasRealCover: true,
        candidateScore: best.score
      };
    }

    return {
      cover: this.DEFAULT_FALLBACK,
      coverStatus: 'missing',
      coverSource: 'default_placeholder',
      hasRealCover: false,
      candidateScore: 0
    };
  }

  static isImageLikeUrl(url) {
    if (!url) return false;
    const l = url.toLowerCase();
    if (l.includes('.mp4') || l.includes('.m3u8') || l.includes('.webm') || l.includes('.mkv') || l.includes('embed.php')) return false;
    if (l.includes('blank.gif') || l.includes('pixel.gif') || l.includes('1x1.png')) return false;
    return true;
  }
}

export class BannerExtractor {
  /**
   * Intelligently discovers and scores the best wide landscape/backdrop banner for a work.
   */
  static extractBestBanner(rawWork, baseDomain = '', fallbackCover = '') {
    if (!rawWork || typeof rawWork !== 'object') {
      return {
        banner: fallbackCover || '',
        bannerStatus: fallbackCover ? 'fallback' : 'missing',
        bannerSource: 'cover_fallback'
      };
    }

    const candidates = [];
    const episodeContainerKeys = new Set([
      'episodes', 'ep_list', 'episode_list', 'episodes_list', 'items',
      'videos', 'parts', 'seasons', 'streams', 'sources', 'servers', 'links'
    ]);

    const bannerScoreMap = {
      'banner': 100,
      'banners': 98,
      'banner_image': 98,
      'bannerimage': 98,
      'banner_url': 97,
      'bannerurl': 97,
      'backdrop': 96,
      'backdrops': 96,
      'backdrop_path': 95,
      'backdrop_url': 95,
      'backdrop_image': 95,
      'background': 92,
      'backgrounds': 92,
      'background_image': 92,
      'background_url': 92,
      'hero': 90,
      'hero_image': 90,
      'heroimage': 90,
      'hero_banner': 90,
      'wide_image': 88,
      'wideimage': 88,
      'wide': 85,
      'landscape': 85,
      'landscape_banner': 98,
      'fanart': 80,
      'wallpaper': 80,
      'header': 75,
      'header_image': 75
    };

    const inspectNode = (node, pathKey = '', depth = 0, parentContext = null) => {
      if (!node || depth > 12) return;

      if (typeof node === 'string') {
        const cleaned = URLCleaner.cleanUrl(node, baseDomain);
        if (cleaned && CoverExtractor.isImageLikeUrl(cleaned)) {
          const lKey = pathKey.toLowerCase();
          const segments = lKey.split(/[\.\[\]]/).filter(Boolean);
          const lastSegment = segments[segments.length - 1] || '';

          let score = bannerScoreMap[lastSegment] || bannerScoreMap[lKey] || 0;

          // Check segments
          for (const seg of segments) {
            if (bannerScoreMap[seg] && bannerScoreMap[seg] > score) {
              score = bannerScoreMap[seg];
            }
          }

          if (lKey.includes('banner') || lKey.includes('backdrop') || lKey.includes('background') || lKey.includes('hero') || lKey.includes('wide') || lKey.includes('landscape')) {
            score = Math.max(score, 80);
          }

          // Check parent object context (e.g., { url: "...", type: "landscape_banner" })
          if (parentContext && typeof parentContext === 'object') {
            const ctxStr = JSON.stringify(parentContext).toLowerCase();
            if (ctxStr.includes('banner') || ctxStr.includes('backdrop') || ctxStr.includes('landscape') || ctxStr.includes('wide')) {
              score = Math.max(score, 85);
            }
          }

          // URL keyword bonus
          const lUrl = cleaned.toLowerCase();
          if (lUrl.includes('banner') || lUrl.includes('backdrop') || lUrl.includes('wide') || lUrl.includes('landscape')) {
            score = Math.max(score, 85);
          }

          if (score > 30) {
            candidates.push({ url: cleaned, score, source: pathKey || 'direct' });
          }
        }
        return;
      }

      if (Array.isArray(node)) {
        node.forEach((elem, idx) => {
          inspectNode(elem, `${pathKey}[${idx}]`, depth + 1, node);
        });
        return;
      }

      if (typeof node === 'object' && node !== null) {
        for (const [k, v] of Object.entries(node)) {
          const lk = k.toLowerCase();
          if (episodeContainerKeys.has(lk)) continue;

          const currentPath = pathKey ? `${pathKey}.${k}` : k;
          inspectNode(v, currentPath, depth + 1, node);
        }
      }
    };

    inspectNode(rawWork, '', 0);

    const validCandidates = candidates.sort((a, b) => b.score - a.score);
    if (validCandidates.length > 0) {
      const best = validCandidates[0];
      return {
        banner: best.url,
        bannerStatus: 'valid',
        bannerSource: best.source
      };
    }

    return {
      banner: fallbackCover || '',
      bannerStatus: fallbackCover ? 'fallback' : 'missing',
      bannerSource: fallbackCover ? 'cover_fallback' : 'none'
    };
  }
}

export class VideoExtractor {
  /**
   * Discovers and extracts all video and embed streaming servers from any object or array.
   */
  static extractServers(node, baseDomain = '', episodeId = '') {
    const rawServers = [];
    const seenUrls = new Set();
    const seenIds = new Set();
    const seenComposite = new Set();

    const addServer = (url, name = null, type = null, rawId = null) => {
      if (!url) return;
      const cleanUrl = URLCleaner.cleanUrl(url, baseDomain);
      if (!cleanUrl) return;

      const normUrl = cleanUrl.trim();
      const compKey = episodeId ? `${episodeId}_${normUrl}` : normUrl;

      if (seenUrls.has(normUrl) || seenComposite.has(compKey)) return;
      if (rawId && seenIds.has(String(rawId).trim())) return;

      seenUrls.add(normUrl);
      seenComposite.add(compKey);
      if (rawId) seenIds.add(String(rawId).trim());

      const serverIdx = rawServers.length + 1;
      const finalName = name || this.inferServerName(normUrl, serverIdx);
      const isDirectVideo = normUrl.includes('.mp4') || normUrl.includes('.m3u8') || normUrl.includes('.webm') || normUrl.includes('.mkv');
      const finalType = type || (isDirectVideo ? 'video' : (normUrl.includes('embed') || normUrl.includes('player') ? 'embed' : 'normal'));

      rawServers.push({
        id: rawId ? String(rawId).trim() : `srv-${serverIdx}-${Date.now().toString(36).slice(-4)}`,
        name: finalName,
        url: normUrl,
        type: finalType
      });
    };

    // 1. Check if node is an object with explicit server/stream arrays
    if (node && typeof node === 'object' && !Array.isArray(node)) {
      const explicitServerKeys = ['servers', 'sources', 'streams', 'stream_sources', 'video_urls', 'stream_urls', 'links'];
      let foundExplicitArray = false;

      for (const k of explicitServerKeys) {
        if (Array.isArray(node[k]) && node[k].length > 0) {
          node[k].forEach((item, idx) => {
            if (typeof item === 'string') {
              addServer(item, `سيرفر ${idx + 1}`);
            } else if (typeof item === 'object' && item !== null) {
              const u = item.url || item.link || item.src || item.source || item.stream_url || item.video_url || item.file || item.embed || item.player || item.iframe;
              const n = item.name || item.server_name || item.title || item.host || item.quality || `سيرفر ${idx + 1}`;
              const t = item.type || (item.is_embed ? 'embed' : null);
              if (u) addServer(u, n, t, item.id);
            }
          });
          foundExplicitArray = true;
          break;
        }
      }

      // If explicit array was found and processed, skip scanning node's outer webpage url
      if (foundExplicitArray && rawServers.length > 0) {
        return this.cleanAndDeduplicateServers(rawServers, episodeId);
      }
    }

    const inspectForVideos = (subNode, depth = 0) => {
      if (!subNode || depth > 8) return;

      if (typeof subNode === 'string') {
        const rawStr = subNode.trim();
        if (rawStr.includes('<iframe') || rawStr.includes('<video') || rawStr.includes('<source')) {
          const clean = URLCleaner.cleanUrl(rawStr, baseDomain);
          if (clean) addServer(clean);
        } else if (rawStr.startsWith('http://') || rawStr.startsWith('https://') || rawStr.startsWith('//') || rawStr.includes('.mp4') || rawStr.includes('.m3u8') || rawStr.includes('embed')) {
          const clean = URLCleaner.cleanUrl(rawStr, baseDomain);
          if (clean) addServer(clean);
        }
        return;
      }

      if (Array.isArray(subNode)) {
        subNode.forEach((item, idx) => {
          if (typeof item === 'string') {
            const clean = URLCleaner.cleanUrl(item, baseDomain);
            if (clean) addServer(clean, `سيرفر ${idx + 1}`);
          } else if (typeof item === 'object' && item !== null) {
            const url = item.url || item.link || item.src || item.source || item.stream_url || item.video_url || item.file || item.embed || item.player || item.iframe;
            const name = item.name || item.server_name || item.title || item.host || item.quality || `سيرفر ${idx + 1}`;
            const type = item.type || (item.is_embed ? 'embed' : null);
            if (url) addServer(url, name, type, item.id);
            else inspectForVideos(item, depth + 1);
          }
        });
        return;
      }

      if (typeof subNode === 'object' && subNode !== null) {
        const ignoredKeys = new Set(['thumbnail', 'thumb', 'thumbnails', 'cover', 'poster', 'images', 'backdrops', 'photos', 'altnames', 'tags', 'cast', 'actors']);

        for (const [key, val] of Object.entries(subNode)) {
          const lKey = key.toLowerCase();
          if (ignoredKeys.has(lKey)) continue;

          if (typeof val === 'string') {
            const rawStr = val.trim();
            if (
              rawStr.includes('<iframe') || rawStr.includes('<video') || rawStr.includes('<source') ||
              rawStr.startsWith('http://') || rawStr.startsWith('https://') || rawStr.startsWith('//') ||
              rawStr.includes('.mp4') || rawStr.includes('.m3u8') || rawStr.includes('.webm') || rawStr.includes('.mkv') ||
              rawStr.includes('embed') || rawStr.includes('watch') || rawStr.includes('stream') ||
              rawStr.includes('player') || rawStr.includes('video') || rawStr.includes('drive.google') || rawStr.includes('mega.nz') ||
              lKey.includes('video') || lKey.includes('stream') || lKey.includes('server') || lKey.includes('embed')
            ) {
              const isImage = rawStr.endsWith('.jpg') || rawStr.endsWith('.jpeg') || rawStr.endsWith('.png') || rawStr.endsWith('.webp') || rawStr.endsWith('.gif') || rawStr.endsWith('.svg');
              if (!isImage) {
                let srvName = subNode.name || subNode.server_name || subNode.title || key.replace(/_/g, ' ').toUpperCase();
                if (['URL', 'LINK', 'SRC', 'FILE', 'VIDEO', 'STREAM'].includes(srvName)) {
                  srvName = subNode.name || null;
                }
                addServer(rawStr, srvName, subNode.type || (rawStr.includes('embed') || rawStr.includes('iframe') ? 'embed' : null), subNode.id);
              }
            }
          } else if (typeof val === 'object' && val !== null) {
            inspectForVideos(val, depth + 1);
          }
        }
      }
    };

    inspectForVideos(node, 0);

    return this.cleanAndDeduplicateServers(rawServers, episodeId);
  }

  /**
   * Filters out webpage permalinks when real video streams exist, enforces strict deduplication, and preserves valid servers.
   */
  static cleanAndDeduplicateServers(servers, episodeId = '') {
    if (!Array.isArray(servers) || servers.length === 0) {
      return [{
        id: 'srv-1',
        name: 'سيرفر رئيسي 1080p (FHD)',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        type: 'video'
      }];
    }

    const hasRealStream = servers.some(s => {
      if (!s || !s.url) return false;
      const u = s.url.toLowerCase();
      return u.includes('.mp4') || u.includes('.m3u8') || u.includes('.webm') || u.includes('.mkv') ||
             u.includes('myvidplay') || u.includes('site.word.tn') || u.includes('streamtape') ||
             u.includes('dood') || u.includes('fembed') || u.includes('uqload') ||
             u.includes('drive.google') || u.includes('mega.nz') || u.includes('embed');
    });

    const filtered = [];
    const seenUrls = new Set();
    const seenIds = new Set();
    const seenComposite = new Set();

    for (const s of servers) {
      if (!s || !s.url) continue;
      const u = s.url.trim();
      const uLower = u.toLowerCase();

      // Filter out webpage permalinks (e.g. dima-toon.com/cartoon-episode/...) if a real streaming link exists
      if (hasRealStream) {
        if (uLower.includes('dima-toon.com/cartoon-episode') ||
            uLower.includes('dima-toon.com/anime-episode') ||
            uLower.includes('/cartoon-episode/') ||
            uLower.includes('/anime-episode/')) {
          continue;
        }
      }

      const compKey = episodeId ? `${episodeId}_${u}` : u;
      if (seenUrls.has(u) || seenComposite.has(compKey)) continue;
      if (s.id && seenIds.has(s.id)) continue;

      seenUrls.add(u);
      seenComposite.add(compKey);
      if (s.id) seenIds.add(s.id);

      filtered.push({
        id: s.id || `srv-${filtered.length + 1}`,
        name: filtered.length === 0 ? 'السرفر الأول' : (s.name || `السرفر ${filtered.length + 1}`),
        url: u,
        type: s.type || (u.includes('.mp4') || u.includes('.m3u8') ? 'video' : 'embed')
      });
    }

    if (filtered.length === 0) {
      return [{
        id: 'srv-1',
        name: 'السرفر الأول',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        type: 'video'
      }];
    }

    return filtered;
  }

  static inferServerName(url, index) {
    try {
      if (url.includes('.mp4') || url.includes('.m3u8')) {
        return `سيرفر مباشر ${index} (HD)`;
      }
      const host = new URL(url).hostname.replace('www.', '');
      if (host.includes('site.word.tn')) return `سيرفر رئيسي ${index} (سريع)`;
      if (host.includes('myvidplay')) return `VidPlay (سيرفر ${index})`;
      if (host.includes('drive.google')) return `Google Drive (سيرفر ${index})`;
      if (host.includes('mega.nz')) return `Mega Stream (سيرفر ${index})`;
      if (host.includes('youtube')) return `YouTube (سيرفر ${index})`;
      if (host.includes('dailymotion')) return `Dailymotion (سيرفر ${index})`;
      if (host.includes('streamtape')) return `Streamtape (سيرفر ${index})`;
      if (host.includes('dood')) return `Doodstream (سيرفر ${index})`;
      if (host.includes('fembed')) return `Fembed (سيرفر ${index})`;
      if (host.includes('uqload')) return `Uqload (سيرفر ${index})`;
      if (host.includes('ok.ru')) return `OK.ru (سيرفر ${index})`;
      return `سيرفر ${index} (${host})`;
    } catch {
      return `سيرفر مشاهدة ${index}`;
    }
  }
}

export class JSONParser {
  /**
   * Main entry point
   */
  static async parse(input, onProgress = null) {
    return this.parseFlexible(input, onProgress);
  }

  /**
   * Parses arbitrary JSON input into standard Dark Watch schema with comprehensive audit report.
   */
  static async parseFlexible(input, onProgress = null) {
    let rawData;
    if (typeof input === 'string') {
      try {
        rawData = JSON.parse(input);
      } catch (err) {
        throw new Error('فشل في قراءة صيغة JSON: ' + err.message);
      }
    } else {
      rawData = input;
    }

    // 1. Recursive Discovery of Work Objects across any envelope
    const rawWorksList = this.discoverWorks(rawData);

    if (!rawWorksList || rawWorksList.length === 0) {
      throw new Error('لم يتم العثور على أي أعمال صالحة داخل بنية ملف JSON');
    }

    const total = rawWorksList.length;
    const standardized = [];
    const chunkSize = 20;

    let totalEpisodesCount = 0;
    let totalVideosCount = 0;
    let totalServersCount = 0;
    let validCoversCount = 0;
    let fallbackCoversCount = 0;
    let missingCoversCount = 0;
    let validBannersCount = 0;
    let fallbackBannersCount = 0;
    let missingBannersCount = 0;
    let needsReviewCount = 0;
    const missingCoverWorks = [];
    const issuesList = [];
    const seenSlugs = new Set();
    const seenIds = new Set();
    let duplicatesDetected = 0;

    for (let i = 0; i < total; i += chunkSize) {
      const chunk = rawWorksList.slice(i, i + chunkSize);

      for (const item of chunk) {
        try {
          const normalized = this.normalizeWork(item);
          if (normalized) {
            if (seenSlugs.has(normalized.slug) || seenIds.has(normalized.id)) {
              duplicatesDetected++;
              normalized.id = `${normalized.id}-${Math.random().toString(36).substring(2, 6)}`;
              normalized.slug = `${normalized.slug}-${Math.random().toString(36).substring(2, 6)}`;
            }
            seenSlugs.add(normalized.slug);
            seenIds.add(normalized.id);

            // Cover Auditing
            if (normalized.coverStatus === 'valid') {
              validCoversCount++;
            } else if (normalized.coverStatus === 'fallback') {
              fallbackCoversCount++;
            } else {
              missingCoversCount++;
              missingCoverWorks.push(normalized.title);
              needsReviewCount++;
            }

            // Banner Auditing
            if (normalized.bannerStatus === 'valid') {
              validBannersCount++;
            } else if (normalized.bannerStatus === 'fallback') {
              fallbackBannersCount++;
            } else {
              missingBannersCount++;
            }

            totalEpisodesCount += normalized.episodes.length;
            normalized.episodes.forEach(ep => {
              totalServersCount += ep.servers.length;
              totalVideosCount += ep.servers.filter(s => s.type === 'video').length || ep.servers.length;
            });

            standardized.push(normalized);
          }
        } catch (itemErr) {
          needsReviewCount++;
          issuesList.push({ item: item.title || item.name || 'عنصر غير محدد', error: itemErr.message });
        }
      }

      if (onProgress && total > 0) {
        const percent = Math.min(100, Math.round(((i + chunk.length) / total) * 100));
        onProgress(percent, Math.min(i + chunk.length, total), total);
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    return {
      works: standardized,
      stats: {
        totalWorks: standardized.length,
        totalEpisodes: totalEpisodesCount,
        totalVideos: totalVideosCount,
        totalServers: totalServersCount,
        coversCount: validCoversCount + fallbackCoversCount,
        validCoversCount,
        fallbackCoversCount,
        missingCoversCount,
        missingCoverWorks,
        bannersCount: validBannersCount + fallbackBannersCount,
        validBannersCount,
        fallbackBannersCount,
        missingBannersCount,
        needsReviewCount,
        issuesList,
        duplicatesDetected
      }
    };
  }

  /**
   * Recursively discovers work objects across any JSON hierarchy.
   */
  static discoverWorks(data) {
    if (!data) return [];

    if (Array.isArray(data)) {
      if (data.length > 0 && typeof data[0] === 'object' && data[0] !== null) {
        if (this.isWorkObject(data[0])) {
          return data;
        }
        const nestedWorks = [];
        for (const item of data) {
          nestedWorks.push(...this.discoverWorks(item));
        }
        if (nestedWorks.length > 0) return nestedWorks;
      }
      return data;
    }

    if (typeof data === 'object' && data !== null) {
      const workKeys = [
        'works', 'series', 'anime', 'cartoons', 'items', 'data', 'results',
        'content', 'list', 'shows', 'movies', 'payload', 'entries', 'posts',
        'animes', 'elements', 'records', 'catalog', 'library', 'response'
      ];

      for (const key of workKeys) {
        if (Array.isArray(data[key]) && data[key].length > 0) {
          const extracted = this.discoverWorks(data[key]);
          if (extracted.length > 0) return extracted;
        }
      }

      if (this.isWorkObject(data)) {
        return [data];
      }

      const values = Object.values(data);
      if (values.length > 0 && typeof values[0] === 'object' && values[0] !== null && this.isWorkObject(values[0])) {
        return values;
      }

      const collected = [];
      for (const key of Object.keys(data)) {
        const val = data[key];
        if (typeof val === 'object' && val !== null) {
          const found = this.discoverWorks(val);
          if (found.length > 0) {
            collected.push(...found);
          }
        }
      }
      if (collected.length > 0) return collected;
    }

    return [];
  }

  /**
   * Checks if an object has the hallmarks of a show/work.
   */
  static isWorkObject(obj) {
    if (!obj || typeof obj !== 'object') return false;

    const hasTitle = Boolean(
      obj.title || obj.name || obj.work_name || obj.workName ||
      obj.anime_title || obj.arabic_name || obj.arabicTitle ||
      obj.series_title || obj.show_title || obj.en_name ||
      obj.originalTitle || obj.original_title || obj.title_ar
    );

    const hasEpisodesOrMedia = Boolean(
      obj.episodes || obj.items || obj.videos || obj.parts || obj.seasons ||
      obj.ep_list || obj.cover || obj.image || obj.poster || obj.story ||
      obj.description || obj.overview || obj.type || obj.category || obj.media ||
      obj.images || obj.thumbnail || obj.artwork || obj.banner || obj.backdrop
    );

    return hasTitle && hasEpisodesOrMedia;
  }

  /**
   * Normalizes a raw work object and performs deep extraction of Cover, Banner, Episodes, and Servers.
   */
  static normalizeWork(raw) {
    if (!raw || typeof raw !== 'object') return null;

    // 1. Flexible Title Extraction
    const title = (
      raw.title ||
      raw.name ||
      raw.work_name ||
      raw.workName ||
      raw.anime_title ||
      raw.arabic_name ||
      raw.arabicTitle ||
      raw.ar_name ||
      raw.series_title ||
      raw.show_title ||
      raw.title_ar ||
      raw.title_arabic ||
      raw.post_title ||
      'عمل بدون عنوان'
    ).toString().trim();

    // 2. English / Original Title
    const originalTitle = (
      raw.originalTitle ||
      raw.original_title ||
      raw.en_name ||
      raw.english_title ||
      raw.englishTitle ||
      raw.romaji ||
      raw.japanese_name ||
      raw.original_name ||
      raw.title_en ||
      raw.native_title ||
      ''
    ).toString().trim();

    // 3. Alternative Names / Search Keywords
    let altNames = [];
    if (Array.isArray(raw.altNames)) altNames = raw.altNames;
    else if (Array.isArray(raw.aliases)) altNames = raw.aliases;
    else if (Array.isArray(raw.other_names)) altNames = raw.other_names;
    else if (Array.isArray(raw.tags)) altNames = raw.tags;
    else if (typeof raw.alt_names === 'string') altNames = raw.alt_names.split(',').map(s => s.trim());
    else if (typeof raw.aliases === 'string') altNames = raw.aliases.split(',').map(s => s.trim());

    // 4. Slug & ID Generation
    const slug = (
      raw.slug ||
      raw.id ||
      this.slugify(originalTitle || title)
    ).toString().trim();

    const id = (raw.id || 'dw-' + slug).toString().trim();

    // 5. Description / Story
    const rawDesc = (
      raw.description ||
      raw.desc ||
      raw.summary ||
      raw.overview ||
      raw.story ||
      raw.plot ||
      raw.about ||
      raw.details ||
      raw.synopsis ||
      raw.info ||
      raw.body ||
      raw.content ||
      ''
    ).toString().trim();

    const hasRealDesc = Boolean(rawDesc && rawDesc.length > 5);
    const description = hasRealDesc ? rawDesc : 'لا يوجد وصف متوفر لهذا العمل حالياً.';

    // 6. Intelligent Multi-Tier Cover Extraction (Poster / Portrait)
    const coverResult = CoverExtractor.extractBestCover(raw);
    const cover = coverResult.cover;
    const coverStatus = coverResult.coverStatus;
    const coverSource = coverResult.coverSource;
    const hasRealCover = coverResult.hasRealCover;

    // 7. Dedicated Banner Extraction (Backdrop / Landscape)
    const bannerResult = BannerExtractor.extractBestBanner(raw, '', cover);
    const banner = bannerResult.banner;
    const bannerStatus = bannerResult.bannerStatus;
    const bannerSource = bannerResult.bannerSource;

    // 8. Category Type (Anime / Cartoon)
    let typeStr = (raw.type || raw.category || raw.genre || raw.kind || 'anime').toString().toLowerCase().trim();
    let type = 'anime';
    if (typeStr.includes('cartoon') || typeStr.includes('كرتون') || typeStr.includes('animation') || typeStr.includes('disney') || typeStr.includes('cn')) {
      type = 'cartoon';
    }

    // 9. Release Year & Status
    const year = (raw.year || raw.release_year || raw.releaseDate || raw.air_date || raw.aired || raw.date || 'غير محدد').toString().trim();
    let status = (raw.status || raw.state || 'مكتمل').toString().trim();
    if (status.toLowerCase() === 'completed') status = 'مكتمل';
    if (status.toLowerCase() === 'ongoing') status = 'مستمر';

    // 10. Deep Recursive Episode & Video Server Extraction
    const episodes = this.extractEpisodesRecursively(raw, slug);

    return {
      id,
      slug,
      title,
      originalTitle,
      altNames: altNames.filter(Boolean),
      type,
      status,
      year,
      cover,
      coverStatus,
      coverSource,
      hasRealCover,
      banner,
      bannerStatus,
      bannerSource,
      description,
      hasRealDesc,
      episodesCount: episodes.length,
      statusState: raw.statusState || 'PUBLISHED',
      episodes
    };
  }

  /**
   * Recursively crawls an entire work object to discover all episodes and their video servers.
   */
  static extractEpisodesRecursively(rawWork, workSlug) {
    const rawEpisodeCandidates = [];
    const mediaAssetKeys = new Set([
      'media_assets', 'assets', 'images', 'posters', 'backdrops', 'covers',
      'banners', 'photos', 'artwork', 'fanart', 'thumbnails', 'cast', 'actors',
      'crew', 'genres', 'tags', 'meta', 'ratings', 'reviews'
    ]);

    const searchRecursively = (node, depth = 0) => {
      if (!node || depth > 8) return;

      if (Array.isArray(node)) {
        if (node.length > 0) {
          const sample = node[0];
          if (this.isEpisodeLike(sample)) {
            rawEpisodeCandidates.push(...node);
            return;
          }
        }
        for (const item of node) {
          if (typeof item === 'object' && item !== null) {
            searchRecursively(item, depth + 1);
          }
        }
        return;
      }

      if (typeof node === 'object') {
        const epKeys = [
          'episodes', 'items', 'videos', 'parts', 'seasons', 'ep_list',
          'episode_list', 'episodes_list', 'links', 'sources', 'streams',
          'servers', 'entries', 'tracks', 'clips', 'playlist',
          'eps', 'ep', 'files'
        ];

        let foundExplicitKey = false;
        for (const k of epKeys) {
          if (node[k]) {
            if (Array.isArray(node[k]) && node[k].length > 0) {
              if (this.isEpisodeLike(node[k][0]) || k.includes('ep') || k.includes('vid')) {
                rawEpisodeCandidates.push(...node[k]);
                foundExplicitKey = true;
              } else {
                searchRecursively(node[k], depth + 1);
              }
            } else if (typeof node[k] === 'object' && node[k] !== null) {
              const vals = Object.values(node[k]);
              if (vals.length > 0 && this.isEpisodeLike(vals[0])) {
                rawEpisodeCandidates.push(...vals);
                foundExplicitKey = true;
              } else {
                searchRecursively(node[k], depth + 1);
              }
            }
          }
        }

        if (!foundExplicitKey && this.isEpisodeLike(node) && (node.number || node.num || node.episode || node.servers || node.sources || node.video || node.ep_no || node.stream_url)) {
          rawEpisodeCandidates.push(node);
          return;
        }

        for (const key of Object.keys(node)) {
          const lk = key.toLowerCase();
          if (!epKeys.includes(key) && !mediaAssetKeys.has(lk) && typeof node[key] === 'object' && node[key] !== null) {
            searchRecursively(node[key], depth + 1);
          }
        }
      }
    };

    searchRecursively(rawWork, 0);

    return this.normalizeExtractedEpisodes(rawEpisodeCandidates, workSlug);
  }

  /**
   * Evaluates if a node resembles an episode item using multi-signal scoring.
   */
  static isEpisodeLike(item) {
    if (!item) return false;

    if (typeof item === 'string') {
      const clean = item.trim();
      if (clean.endsWith('.jpg') || clean.endsWith('.png') || clean.endsWith('.jpeg') || clean.endsWith('.webp') || clean.endsWith('.gif')) {
        return false;
      }
      return clean.startsWith('http') || clean.includes('.mp4') || clean.includes('.m3u8') || clean.includes('embed') || clean.includes('<iframe');
    }

    if (typeof item !== 'object') return false;

    // Filter out image asset objects
    if (item.type) {
      const lType = item.type.toString().toLowerCase();
      if (lType.includes('cover') || lType.includes('poster') || lType.includes('banner') || lType.includes('backdrop') || lType.includes('image') || lType.includes('photo')) {
        return false;
      }
    }

    const hasNum = Boolean(
      item.number !== undefined || item.num !== undefined ||
      item.ep_num !== undefined || item.epNum !== undefined ||
      item.episode !== undefined || item.episode_number !== undefined ||
      item.ep_no !== undefined || item.ep !== undefined ||
      item.index !== undefined || item.order !== undefined
    );

    const hasExplicitVideoField = Boolean(
      item.servers || item.sources || item.streams || item.stream_sources ||
      item.video_urls || item.video || item.embed || item.iframe ||
      item.player || item.stream_url || item.m3u8 || item.mp4 ||
      item.file || item.watch_url || item.stream
    );

    // If only has URL, verify it is not an image URL
    let hasVideoUrl = false;
    if (item.url || item.link || item.src) {
      const u = (item.url || item.link || item.src || '').toString().toLowerCase();
      if (u.includes('.mp4') || u.includes('.m3u8') || u.includes('embed') || u.includes('watch') || u.includes('video') || u.includes('stream') || u.includes('drive.google') || u.includes('mega.nz')) {
        hasVideoUrl = true;
      } else if (!u.endsWith('.jpg') && !u.endsWith('.jpeg') && !u.endsWith('.png') && !u.endsWith('.webp') && !u.endsWith('.gif') && !u.endsWith('.svg')) {
        hasVideoUrl = true;
      }
    }

    const hasEpisodeTitle = Boolean(
      item.title && (
        item.title.toString().includes('حلقة') ||
        item.title.toString().toLowerCase().includes('episode') ||
        item.title.toString().toLowerCase().includes('ep') ||
        /^\d+$/.test(item.title.toString().trim())
      )
    );

    return hasNum || hasExplicitVideoField || (hasVideoUrl && (hasNum || hasEpisodeTitle || item.name));
  }

  /**
   * Normalizes, deduplicates, and sorts raw extracted episodes.
   */
  static normalizeExtractedEpisodes(candidates, workSlug) {
    if (!candidates || candidates.length === 0) {
      return [{
        id: `ep-${workSlug}-1`,
        number: 1,
        title: 'الحلقة 1',
        servers: [{
          id: 'srv-1',
          name: 'سيرفر رئيسي 1080p',
          url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
          type: 'video'
        }]
      }];
    }

    const normalizedMap = new Map();
    let sequentialCounter = 1;

    candidates.forEach((ep) => {
      if (!ep) return;

      if (typeof ep === 'string') {
        const num = sequentialCounter++;
        const servers = VideoExtractor.extractServers(ep);
        normalizedMap.set(num, {
          id: `ep-${workSlug}-${num}`,
          number: num,
          title: `الحلقة ${num}`,
          servers
        });
        return;
      }

      if (typeof ep !== 'object') return;

      let num = null;
      const rawNum = ep.number ?? ep.num ?? ep.ep_num ?? ep.epNum ?? ep.episode ?? ep.episode_number ?? ep.ep_no ?? ep.ep ?? ep.order ?? ep.index;
      if (rawNum !== undefined && rawNum !== null && !isNaN(parseInt(rawNum, 10))) {
        num = parseInt(rawNum, 10);
      } else if (ep.title) {
        const match = ep.title.toString().match(/(?:حلقة|الحلقة|episode|ep|e)\s*[:#\-]?\s*(\d+)/i) || ep.title.toString().match(/(\d+)/);
        if (match && match[1]) {
          num = parseInt(match[1], 10);
        }
      }

      if (num === null || isNaN(num) || num <= 0) {
        num = sequentialCounter;
      }
      sequentialCounter = Math.max(sequentialCounter, num + 1);

      const title = (
        ep.title ||
        ep.name ||
        ep.ep_title ||
        ep.episode_name ||
        ep.headline ||
        `الحلقة ${num}`
      ).toString().trim();

      const epId = (ep.id || `ep-${workSlug}-${num}`).toString().trim();
      const servers = VideoExtractor.extractServers(ep, '', epId);

      if (normalizedMap.has(num)) {
        const existing = normalizedMap.get(num);
        const combined = [...existing.servers, ...servers];
        existing.servers = VideoExtractor.cleanAndDeduplicateServers(combined, epId);
      } else {
        normalizedMap.set(num, {
          id: epId,
          number: num,
          title,
          servers: VideoExtractor.cleanAndDeduplicateServers(servers, epId)
        });
      }
    });

    const result = Array.from(normalizedMap.values()).sort((a, b) => a.number - b.number);

    if (result.length === 0) {
      result.push({
        id: `ep-${workSlug}-1`,
        number: 1,
        title: 'الحلقة 1',
        servers: [{
          id: 'srv-1',
          name: 'سيرفر رئيسي 1080p',
          url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
          type: 'video'
        }]
      });
    }

    return result;
  }

  /**
   * Slug generator supporting Arabic and English alphanumeric characters.
   */
  static slugify(text) {
    if (!text) return 'work-' + Math.random().toString(36).substring(2, 8);
    return text
      .toString()
      .toLowerCase()
      .replace(/[^\w\s\u0621-\u064A-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/--+/g, '-')
      .trim();
  }
}
