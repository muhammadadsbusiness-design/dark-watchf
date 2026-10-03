/**
 * Dark Watch - HilltopAds & Ad Units Runtime Manager
 */

class AdsManager {
  constructor() {
    this.verificationSettings = null;
    this.adsConfig = null;
    this.initialized = false;
    this.activeInjectedElements = new Map();
  }

  async init() {
    try {
      await Promise.all([
        this.loadVerification(),
        this.loadAds()
      ]);

      this.initialized = true;

      // Handle initial route
      this.evaluateAndRunAds();

      // Listen for route changes
      window.addEventListener('hashchange', () => this.evaluateAndRunAds());
      window.addEventListener('popstate', () => this.evaluateAndRunAds());
    } catch (err) {
      console.warn('Error initializing AdsManager:', err);
    }
  }

  async loadVerification() {
    try {
      const res = await fetch('/api/hilltopads-verification');
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.success && data.settings) {
        this.verificationSettings = data.settings;
        this.applyVerification(data.settings);
      }
    } catch (err) {
      console.warn('Error loading HilltopAds verification settings:', err);
    }
  }

  applyVerification(settings) {
    if (!settings) return;

    // 1. Meta Tag in <head>
    let metaTag = document.querySelector('meta[name="hilltopads-site-verification"]');
    if (settings.meta_enabled && settings.meta_code) {
      if (!metaTag) {
        metaTag = document.createElement('meta');
        metaTag.name = 'hilltopads-site-verification';
        document.head.appendChild(metaTag);
      }
      metaTag.content = settings.meta_code;
    } else if (metaTag) {
      metaTag.remove();
    }

    // 2. Verification Script
    const scriptId = 'hilltopads-verification-script';
    let existingScript = document.getElementById(scriptId);
    if (settings.script_enabled && settings.script_code) {
      if (!existingScript) {
        this.injectRawCode(settings.script_code, scriptId, document.head);
      }
    } else if (existingScript) {
      existingScript.remove();
    }

    // 3. Verification Snippet
    const snippetId = 'hilltopads-verification-snippet';
    let existingSnippet = document.getElementById(snippetId);
    if (settings.snippet_enabled && settings.snippet_code) {
      if (!existingSnippet) {
        const div = document.createElement('div');
        div.id = snippetId;
        div.style.display = 'none';
        div.innerHTML = settings.snippet_code;
        document.body.appendChild(div);
      }
    } else if (existingSnippet) {
      existingSnippet.remove();
    }
  }

  async loadAds() {
    try {
      const res = await fetch('/api/ads');
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.success) {
        this.adsConfig = data;
      }
    } catch (err) {
      console.warn('Error loading ads configuration:', err);
    }
  }

  isCurrentRouteAdmin() {
    const hash = (window.location.hash || '').toLowerCase();
    const pathname = (window.location.pathname || '').toLowerCase();
    return hash.includes('admin') || pathname.includes('admin');
  }

  getCurrentRoutePlacement() {
    const hash = window.location.hash || '#/';
    if (hash === '#/' || hash === '' || hash === '#/home') return 'home';
    if (hash.startsWith('#/work/')) return 'work';
    if (hash.startsWith('#/episode/')) return 'episode';
    return 'other';
  }

  detectDeviceType() {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
      return 'tablet';
    }
    if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
      return 'mobile';
    }
    return 'desktop';
  }

  checkFrequencyCapping(ad) {
    if (!ad.frequency || ad.frequency === 'always') return true;

    const storageKey = `dw_ad_shown_${ad.id}`;

    if (ad.frequency === 'session') {
      if (sessionStorage.getItem(storageKey)) return false;
      return true;
    }

    const lastShown = parseInt(localStorage.getItem(storageKey) || '0', 10);
    const now = Date.now();

    let durationMs = 0;
    if (ad.frequency === 'minutes_15') durationMs = 15 * 60 * 1000;
    else if (ad.frequency === 'minutes_30') durationMs = 30 * 60 * 1000;
    else if (ad.frequency === 'hours_1') durationMs = 1 * 3600 * 1000;
    else if (ad.frequency === 'hours_6') durationMs = 6 * 3600 * 1000;
    else if (ad.frequency === 'hours_24') durationMs = 24 * 3600 * 1000;

    if (durationMs > 0 && now - lastShown < durationMs) {
      return false;
    }

    return true;
  }

  recordAdShown(ad) {
    const storageKey = `dw_ad_shown_${ad.id}`;
    if (ad.frequency === 'session') {
      sessionStorage.setItem(storageKey, 'true');
    } else {
      localStorage.setItem(storageKey, String(Date.now()));
    }
  }

  evaluateAndRunAds() {
    // CRITICAL REQUIREMENT: NO ADS RUN IN ADMIN AREA
    if (this.isCurrentRouteAdmin()) {
      return;
    }

    if (!this.adsConfig || !this.adsConfig.global_enabled || !Array.isArray(this.adsConfig.ads)) {
      return;
    }

    const currentPlacement = this.getCurrentRoutePlacement();
    const currentDevice = this.detectDeviceType();
    const currentHash = window.location.hash || '#/';

    const eligibleAds = this.adsConfig.ads.filter(ad => {
      if (!ad.enabled || !ad.code) return false;

      // Check device
      if (ad.devices && ad.devices !== 'all' && ad.devices !== currentDevice) {
        return false;
      }

      // Check placement
      if (ad.placements && ad.placements !== 'all' && ad.placements !== currentPlacement) {
        return false;
      }

      // Check excluded pages
      if (Array.isArray(ad.excludedPages) && ad.excludedPages.length > 0) {
        const isExcluded = ad.excludedPages.some(ex => {
          if (!ex) return false;
          const cleanEx = ex.trim().toLowerCase();
          return currentHash.toLowerCase().includes(cleanEx) || window.location.pathname.toLowerCase().includes(cleanEx);
        });
        if (isExcluded) return false;
      }

      return true;
    });

    // Sort by priority (higher priority number first)
    eligibleAds.sort((a, b) => (b.priority || 1) - (a.priority || 1));

    eligibleAds.forEach(ad => {
      // DEDUPLICATION CHECK: Check if element already injected for this ad
      const existingEl = document.querySelector(`[data-ad-id="${ad.id}"]`);
      if (existingEl) {
        return; // Already present in DOM, do not duplicate!
      }

      // Check Frequency Capping
      if (!this.checkFrequencyCapping(ad)) {
        return;
      }

      // Inject & Execute Ad
      this.runAdUnit(ad);
    });
  }

  runAdUnit(ad) {
    if (!ad || !ad.code) return;

    const elId = `ad-runtime-${ad.id}`;
    this.injectRawCode(ad.code, elId, document.body, ad.id);
    this.recordAdShown(ad);
  }

  injectRawCode(codeStr, id, parentEl, adId = null) {
    if (!codeStr || typeof codeStr !== 'string') return;

    // Create wrapper container
    const container = document.createElement('div');
    container.id = id;
    container.className = 'dw-ad-wrapper';
    if (adId) {
      container.setAttribute('data-ad-id', adId);
    }
    container.style.display = 'none'; // Background script container

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${codeStr}</div>`, 'text/html');
    const nodes = Array.from(doc.body.firstChild.childNodes);

    nodes.forEach(node => {
      if (node.tagName === 'SCRIPT') {
        const scriptEl = document.createElement('script');
        if (adId) scriptEl.setAttribute('data-ad-id', adId);

        Array.from(node.attributes).forEach(attr => {
          scriptEl.setAttribute(attr.name, attr.value);
        });

        if (node.textContent) {
          scriptEl.textContent = node.textContent;
        }

        container.appendChild(scriptEl);
      } else {
        container.appendChild(node.cloneNode(true));
      }
    });

    (parentEl || document.body).appendChild(container);
  }

  testAd(ad) {
    if (!ad || !ad.code) {
      alert('لا يوجد كود إعلان للاختبار!');
      return false;
    }

    const testId = `ad-test-${Date.now()}`;
    this.injectRawCode(ad.code, testId, document.body, 'test_mode');
    return true;
  }
}

export const adsManager = new AdsManager();
export default adsManager;
