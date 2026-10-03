/**
 * Dark Watch - Main Application Controller
 * Pure Vanilla JavaScript Architecture.
 */

import { APP_CONFIG } from './config.js';
import { dataStore } from './data-store.js';
import { Router } from './router.js';
import { AdminController } from './admin.js';
import { adsManager } from './ads-manager.js';
import { SEOManager, PUBLIC_DOMAIN } from './seo.js';

class DarkWatchApp {
  constructor() {
    this.mainContent = document.getElementById('main-content');
    this.toastContainer = document.getElementById('toast-container');
    this.searchModal = document.getElementById('search-modal');
    this.searchInput = document.getElementById('search-input');
    this.searchResults = document.getElementById('search-results');
    this.mobileNavMenu = document.getElementById('nav-menu');

    this.currentPlayingServerIdx = 0;
  }

  async init() {
    this.syncNavVisibility();
    this.setupGlobalEvents();
    this.setupSearch();
    this.initRouter();
    
    // Load database and seed state
    await dataStore.init();

    // Initialize Google Search Console Meta Tag verification
    await this.initGSCVerification();

    // Initialize HilltopAds & Ad Units Manager
    await adsManager.init();

    // Refresh current route view once data is ready
    this.router.handleRoute();
  }

  async initGSCVerification() {
    try {
      const res = await fetch('/api/gsc');
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.success && data.settings) {
        this.applyGSCMetaTag(data.settings);
      }
    } catch (err) {
      console.warn('GSC meta tag init skipped:', err);
    }
  }

  applyGSCMetaTag(settings) {
    let metaTag = document.querySelector('meta[name="google-site-verification"]');
    if (settings && settings.meta_enabled && settings.meta_code) {
      if (!metaTag) {
        metaTag = document.createElement('meta');
        metaTag.name = 'google-site-verification';
        document.head.appendChild(metaTag);
      }
      metaTag.content = settings.meta_code;
    } else if (metaTag) {
      metaTag.remove();
    }
  }

  syncNavVisibility() {
    // Hide or show Anime links in header and footer based on APP_CONFIG.ANIME_ENABLED
    const animeNavLinks = document.querySelectorAll('a[href="#/anime"], a[href="/anime"]');
    animeNavLinks.forEach(link => {
      if (!APP_CONFIG.ANIME_ENABLED) {
        link.style.display = 'none';
      } else {
        link.style.display = '';
      }
    });
  }

  setupGlobalEvents() {
    // Mobile navigation toggle
    const mobileBtn = document.getElementById('mobile-nav-toggle');
    if (mobileBtn && this.mobileNavMenu) {
      mobileBtn.addEventListener('click', () => {
        this.mobileNavMenu.classList.toggle('mobile-open');
      });

      // Close mobile nav on link click
      this.mobileNavMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
          this.mobileNavMenu.classList.remove('mobile-open');
        });
      });
    }

    // Keyboard shortcut for search (/ or Ctrl+K)
    window.addEventListener('keydown', (e) => {
      if ((e.key === '/' || (e.ctrlKey && e.key === 'k')) && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        this.openSearch();
      }
      if (e.key === 'Escape' && this.searchModal && this.searchModal.classList.contains('open')) {
        this.closeSearch();
      }
    });

    // Close search modal when clicking backdrop
    if (this.searchModal) {
      this.searchModal.addEventListener('click', (e) => {
        if (e.target === this.searchModal) {
          this.closeSearch();
        }
      });
    }

    const searchOpenBtn = document.getElementById('btn-open-search');
    const searchCloseBtn = document.getElementById('btn-close-search');
    if (searchOpenBtn) searchOpenBtn.addEventListener('click', () => this.openSearch());
    if (searchCloseBtn) searchCloseBtn.addEventListener('click', () => this.closeSearch());
  }

  setupSearch() {
    if (!this.searchInput || !this.searchResults) return;

    this.searchInput.addEventListener('input', (e) => {
      const q = e.target.value;
      const results = dataStore.search(q);
      this.renderSearchResults(results, q);
    });
  }

  openSearch() {
    if (!this.searchModal) return;
    this.searchModal.classList.add('open');
    this.searchInput.value = '';
    this.searchInput.focus();
    this.renderSearchResults([], '');
  }

  closeSearch() {
    if (!this.searchModal) return;
    this.searchModal.classList.remove('open');
  }

  renderSearchResults(results, query) {
    if (!query.trim()) {
      const searchPlaceholderText = APP_CONFIG.ANIME_ENABLED
        ? 'ابحث عن أي أنمي أو كرتون'
        : 'ابحث عن أي مسلسل أو فيلم كرتون';

      this.searchResults.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--dw-text-sub);">
          <div style="font-size: 28px; margin-bottom: 8px;">🔍</div>
          <div style="font-weight: 700; color: #fff;">${searchPlaceholderText}</div>
          <div style="font-size: 13px; margin-top: 4px;">يمكنك البحث بالاسم العربي، الإنجليزي، أو الأسماء البديلة</div>
        </div>
      `;
      return;
    }

    if (results.length === 0) {
      this.searchResults.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--dw-text-sub);">
          <div style="font-size: 28px; margin-bottom: 8px;">🚫</div>
          <div style="font-weight: 700; color: #fff;">لم يتم العثور على أي نتائج</div>
          <div style="font-size: 13px; margin-top: 4px;">جرب البحث بكلمات أخرى أو تحقق من كتابة الاسم</div>
        </div>
      `;
      return;
    }

    this.searchResults.innerHTML = results.map(item => `
      <a href="#/work/${item.slug || item.id}" class="search-result-item" onclick="window.darkWatchApp.closeSearch()">
        <img src="${item.cover}" alt="${item.title}" class="search-item-thumb" onerror="this.src='https://images.unsplash.com/photo-1578632767115-351597cf2477?w=100'" />
        <div class="search-item-info">
          <div class="search-item-title">${item.title}</div>
          <div class="search-item-sub">${item.originalTitle ? item.originalTitle + ' • ' : ''}${item.type === 'anime' ? 'أنمي' : 'كرتون'} • ${item.episodes ? item.episodes.length : 0} حلقة</div>
        </div>
        <span class="tag-badge ${item.type === 'anime' ? 'badge-red' : ''}">
          ${item.type === 'anime' ? 'أنمي' : 'كرتون'}
        </span>
      </a>
    `).join('');
  }

  showToast(message, type = 'info') {
    if (!this.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
      <span>${message}</span>
    `;
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  setSEO(title, description, structuredData = null, image = null) {
    const siteTitle = APP_CONFIG.ANIME_ENABLED
      ? 'Dark Watch - مشاهدة الأنمي والكرتون'
      : 'Dark Watch - مشاهدة مسلسلات وأفلام الكرتون';

    const formattedTitle = title ? `${title} | Dark Watch` : siteTitle;
    const cleanDesc = description || 'Dark Watch منصة مشاهدة مسلسلات وأفلام الكرتون بجودة عالية وبدون إعلانات مزعجة';
    const activeOrigin = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
    const logoUrl = activeOrigin ? `${activeOrigin}/images/logo.svg` : '/images/logo.svg';
    const activeImage = image ? (image.startsWith('http') ? image : `${activeOrigin}${image.startsWith('/') ? '' : '/'}${image}`) : logoUrl;

    SEOManager.updatePageSEO({
      title: formattedTitle,
      description: cleanDesc,
      canonicalPath: (typeof window !== 'undefined' && window.location) ? (window.location.pathname + window.location.hash) : '/',
      image: activeImage,
      jsonLd: structuredData
    });
  }

  initRouter() {
    this.router = new Router([
      {
        pattern: '/',
        handler: () => this.renderHomeView()
      },
      {
        pattern: '/anime',
        handler: () => this.renderAnimeView()
      },
      {
        pattern: '/cartoon',
        handler: () => this.renderCartoonView()
      },
      {
        pattern: '/work/:slug',
        handler: (params) => this.renderWorkDetailView(params.slug)
      },
      {
        pattern: '/watch/:slug/:episodeNum',
        handler: (params) => this.renderWatchView(params.slug, parseInt(params.episodeNum, 10))
      },
      {
        pattern: '/admin',
        handler: () => this.renderAdminView()
      }
    ], () => this.renderNotFoundView());
  }

  // --- Views ---

  renderHomeView() {
    this.syncNavVisibility();
    const siteSubtitle = APP_CONFIG.ANIME_ENABLED
      ? 'الرئيسية - مشاهدة الأنمي والكرتون'
      : 'الرئيسية - مشاهدة مسلسلات وأفلام الكرتون';

    this.setSEO(
      siteSubtitle,
      'Dark Watch - شاهد أحدث مسلسلات وأفلام الكرتون والأنمي بجودة عالية وبدون إعلانات مزعجة.'
    );

    const cartoonList = dataStore.getCartoon();
    const animeList = APP_CONFIG.ANIME_ENABLED ? dataStore.getAnime() : [];
    const featured = cartoonList[0] || animeList[0] || null;

    let heroHtml = '';
    if (featured) {
      const heroBackdropImg = featured.banner || featured.cover || '';
      heroHtml = `
        <section class="hero-section">
          ${heroBackdropImg ? `<div class="hero-backdrop" style="background-image: url('${heroBackdropImg}'); opacity: 0.25; filter: blur(20px);"></div>` : ''}
          <div class="container">
            <div class="hero-card">
              <div class="hero-text">
                <div class="hero-badge">
                  <span>🔥</span> عمل مميز وموصى به
                </div>
                <h1 class="hero-title">
                  شاهد <span>${featured.title || 'عمل مميز'}</span> بجودة فائقة
                </h1>
                <p class="hero-desc">
                  ${featured.description || 'استمتع بمشاهدة جميع الحلقات بدقة عالية وبدون إعلانات.'}
                </p>
                <div class="hero-actions">
                  <a href="#/work/${featured.slug || featured.id}" class="btn-primary">
                    ▶ بدء المشاهدة الآن
                  </a>
                  <button onclick="window.darkWatchApp.openSearch()" class="btn-secondary">
                    🔍 البحث في المكتبة
                  </button>
                </div>
              </div>
              <div class="hero-visual">
                <img src="${featured.cover || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300'}" alt="${featured.title || 'الغلاف'}" class="hero-poster-mini" onerror="this.src='https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300'" />
                ${cartoonList[1] ? `<img src="${cartoonList[1].cover || 'https://images.unsplash.com/photo-1563089145-599997674d42?w=300'}" alt="${cartoonList[1].title || 'الغلاف'}" class="hero-poster-mini" onerror="this.src='https://images.unsplash.com/photo-1563089145-599997674d42?w=300'" />` : ''}
              </div>
            </div>
          </div>
        </section>
      `;
    }

    let animeSectionHtml = '';
    if (APP_CONFIG.ANIME_ENABLED) {
      animeSectionHtml = `
        <!-- Anime Section -->
        <section class="section-wrapper container">
          <div class="section-head">
            <h2 class="section-title">
              <span>⚔️</span> مسلسلات وأفلام الأنمي
            </h2>
            <a href="#/anime" class="section-more-link">
              عرض كل الأنمي ↗
            </a>
          </div>
          ${this.renderWorksGrid(animeList, 'لا توجد أعمال أنمي حالياً')}
        </section>
      `;
    }

    this.mainContent.innerHTML = `
      ${heroHtml}

      ${animeSectionHtml}

      <!-- Cartoon Section -->
      <section class="section-wrapper container">
        <div class="section-head">
          <h2 class="section-title">
            <span>🎨</span> مسلسلات وأفلام الكرتون
          </h2>
          <a href="#/cartoon" class="section-more-link">
            عرض كل الكرتون ↗
          </a>
        </div>
        ${this.renderWorksGrid(cartoonList, 'لا توجد أعمال حالياً')}
      </section>
    `;
  }

  renderAnimeView() {
    this.syncNavVisibility();

    // If Anime is disabled, provide friendly guidance and button to Cartoon section
    if (!APP_CONFIG.ANIME_ENABLED) {
      this.setSEO(
        'قسم الأنمي غير متاح حالياً',
        'قسم الأنمي متوقف مؤقتاً في Dark Watch. يمكنك تصفح مكتبة الكرتون الشاملة.'
      );

      this.mainContent.innerHTML = `
        <div class="container" style="padding: 90px 20px; text-align: center;">
          <div style="font-size: 54px; margin-bottom: 16px;">⏸️</div>
          <h1 style="font-size: 26px; font-weight: 900; color: #fff; margin-bottom: 12px;">قسم الأنمي غير متاح حالياً</h1>
          <p style="color: var(--dw-text-muted); font-size: 15px; max-width: 550px; margin: 0 auto 26px; line-height: 1.6;">
            تم إيقاف قسم الأنمي مؤقتاً لأعمال الصيانة والتطوير. يمكنك تصفح ومشاهدة أفضل مسلسلات وأفلام الكرتون بدقة فائقة.
          </p>
          <div style="display: flex; justify-content: center; gap: 12px; flex-wrap: wrap;">
            <a href="#/cartoon" class="btn-primary" style="padding: 12px 24px;">
              🎨 تصفح مسلسلات الكرتون
            </a>
            <a href="#/" class="btn-secondary" style="padding: 12px 24px;">
              🏠 الصفحة الرئيسية
            </a>
          </div>
        </div>
      `;
      return;
    }

    this.setSEO(
      'مسلسلات وأفلام الأنمي',
      'تصفح وشاهد أفضل مسلسلات وأفلام الأنمي المترجمة والمدبلجة بجودة عالية على Dark Watch.'
    );

    const animeList = dataStore.getAnime();

    this.mainContent.innerHTML = `
      <div class="container" style="padding-top: 40px;">
        <div class="section-head">
          <h1 class="section-title">
            <span>⚔️</span> جميع أعمال الأنمي
          </h1>
          <span style="font-size: 14px; font-weight: 700; color: var(--dw-text-muted);">
            ${animeList.length} عمل متوفر
          </span>
        </div>
        ${this.renderWorksGrid(animeList, 'لا توجد أعمال حالياً')}
      </div>
    `;
  }

  renderCartoonView() {
    this.syncNavVisibility();
    this.setSEO(
      'مسلسلات وأفلام الكرتون',
      'استمتع بمشاهدة أروع مسلسلات الكرتون العالمية والكلاسيكية بجودة عالية على Dark Watch.'
    );

    const cartoonList = dataStore.getCartoon();

    this.mainContent.innerHTML = `
      <div class="container" style="padding-top: 40px;">
        <div class="section-head">
          <h1 class="section-title">
            <span>🎨</span> جميع أعمال الكرتون
          </h1>
          <span style="font-size: 14px; font-weight: 700; color: var(--dw-text-muted);">
            ${cartoonList.length} عمل متوفر
          </span>
        </div>
        ${this.renderWorksGrid(cartoonList, 'لا توجد أعمال حالياً')}
      </div>
    `;
  }

  renderWorksGrid(works, emptyMessage = 'لا توجد أعمال حالياً') {
    if (!works || !Array.isArray(works) || works.length === 0) {
      return `
        <div class="empty-state-box">
          <div class="empty-state-icon">🎬</div>
          <div class="empty-state-title">${emptyMessage}</div>
          <p class="empty-state-text">سيتم إضافة المزيد من الأعمال المميزة قريباً جداً.</p>
        </div>
      `;
    }

    return `
      <div class="works-grid">
        ${works.filter(Boolean).map(w => `
          <a href="#/work/${w.slug || w.id}" class="work-card">
            <div class="work-card-media">
              <img src="${w.cover || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600'}" alt="${w.title || 'عمل'}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600'" />
              <div class="work-card-overlay">
                <div class="card-badge-top">
                  <span class="badge-type ${w.type === 'anime' ? 'badge-anime' : 'badge-cartoon'}">
                    ${w.type === 'anime' ? 'أنمي' : 'كرتون'}
                  </span>
                  <span class="badge-ep-count">
                    ${w.episodes ? w.episodes.length : (w.episodesCount || 0)} حلقة
                  </span>
                </div>
                <div class="play-hover-btn">
                  ▶
                </div>
              </div>
            </div>
            <div class="work-card-content">
              <h3 class="work-card-title">${w.title || 'عمل بدون عنوان'}</h3>
              <div class="work-card-meta">
                <span>📅 ${w.year || 'غير محدد'}</span>
                <span>•</span>
                <span>${w.status || 'مكتمل'}</span>
              </div>
            </div>
          </a>
        `).join('')}
      </div>
    `;
  }

  renderWorkDetailView(slug) {
    const work = dataStore.getBySlug(slug);

    if (!work) {
      this.renderNotFoundView('العمل المطلوب غير موجود أو تم حذفه.');
      return;
    }

    const episodes = Array.isArray(work.episodes) ? work.episodes : [];

    this.setSEO(
      `${work.title || 'العمل'} - جميع الحلقات`,
      work.description || '',
      {
        "@context": "https://schema.org",
        "@type": "TVSeries",
        "name": work.title || '',
        "alternateName": work.originalTitle || '',
        "numberOfEpisodes": episodes.length,
        "image": work.cover || '',
        "description": work.description || '',
        "genre": work.type === 'anime' ? "Anime" : "Animation"
      }
    );

    const firstEpNum = episodes.length > 0 ? episodes[0].number : null;
    const heroBackdrop = work.banner || work.cover || '';

    this.mainContent.innerHTML = `
      <div class="work-detail-hero">
        ${heroBackdrop ? `<div class="work-detail-backdrop" style="background-image: url('${heroBackdrop}');"></div>` : ''}
        <div class="container">
          <div class="work-detail-grid">
            <div>
              <img src="${work.cover || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600'}" alt="${work.title || 'الغلاف'}" class="work-detail-cover" onerror="this.src='https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600'" />
            </div>
            <div class="work-detail-info">
              <div class="work-tags-row">
                <span class="tag-badge ${work.type === 'anime' ? 'badge-red' : ''}">
                  ${work.type === 'anime' ? 'أنمي ياباني' : 'مسلسل كرتون'}
                </span>
                <span class="tag-badge">📅 سنة الإصدار: ${work.year || 'غير محدد'}</span>
                <span class="tag-badge">📌 الحالة: ${work.status || 'مكتمل'}</span>
                <span class="tag-badge">🎞️ ${episodes.length} حلقة</span>
              </div>

              <h1 class="work-detail-title">${work.title || 'عمل بدون عنوان'}</h1>
              ${work.originalTitle ? `<div class="work-detail-original-title">${work.originalTitle}</div>` : ''}

              <p class="work-detail-desc">${work.description || 'لا يوجد وصف متوفر لهذا العمل حالياً.'}</p>

              <div class="work-detail-actions">
                ${firstEpNum !== null ? `
                  <a href="#/watch/${work.slug || work.id}/${firstEpNum}" class="btn-primary">
                    ▶ مشاهدة الحلقة الأولى (${firstEpNum})
                  </a>
                ` : `
                  <span class="tag-badge" style="padding: 10px 18px; font-size: 14px; background: rgba(255, 255, 255, 0.08); color: var(--dw-text-muted);">
                    ⏳ لا توجد حلقات مضافة لهذا العمل حالياً
                  </span>
                `}
                <button onclick="window.darkWatchApp.openSearch()" class="btn-secondary">
                  🔍 بحث عن عمل آخر
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Episodes List Section -->
      <section class="episodes-section container">
        <div class="episodes-filter-bar">
          <h2 class="section-title">
            <span>🎞️</span> قائمة الحلقات المتوفرة (${episodes.length} حلقة)
          </h2>
          ${episodes.length > 0 ? `<input type="text" id="episodes-filter-input" class="episodes-search-input" placeholder="🔍 ابحث برقم أو عنوان الحلقة..." />` : ''}
        </div>

        <div id="episodes-grid-target" class="episodes-list-grid">
          ${this.renderEpisodesCards(work, episodes)}
        </div>
      </section>

      <!-- Related Works Section -->
      <section id="related-works-target" class="related-works-section container"></section>
    `;

    // Load & Render Related Works
    this.loadAndRenderRelatedWorks(work);

    // Attach episodes search filter
    const filterInput = document.getElementById('episodes-filter-input');
    const gridTarget = document.getElementById('episodes-grid-target');
    if (filterInput && gridTarget) {
      filterInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const filtered = episodes.filter(ep => 
          ep && (
            (ep.number || '').toString().includes(query) ||
            (ep.title || '').toLowerCase().includes(query)
          )
        );
        gridTarget.innerHTML = this.renderEpisodesCards(work, filtered);
      });
    }
  }

  async loadAndRenderRelatedWorks(work) {
    const targetEl = document.getElementById('related-works-target');
    if (!targetEl || !work) return;

    let relatedWorks = [];
    try {
      const res = await fetch(`/api/related-works?id=${encodeURIComponent(work.id || work.slug)}&limit=6`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && Array.isArray(data.works)) {
          relatedWorks = data.works;
        }
      }
    } catch (err) {
      console.warn('Error fetching related works from API:', err);
    }

    // Fallback if API returns empty
    if (relatedWorks.length === 0) {
      const allPublished = dataStore.getAllPublished();
      const targetType = (work.type || 'cartoon').toLowerCase();

      relatedWorks = allPublished.filter(w => {
        if (!w || w.id === work.id || w.slug === work.slug) return false;
        if (w.state && w.state !== 'PUBLISHED') return false;
        if (!APP_CONFIG.ANIME_ENABLED && (w.type || '').toLowerCase() === 'anime') return false;
        return true;
      });

      // Simple scoring for fallback
      relatedWorks = relatedWorks.map(w => {
        let score = 0;
        if ((w.type || '').toLowerCase() === targetType) score += 5;
        return { ...w, _score: score };
      }).sort((a, b) => b._score - a._score).slice(0, 6);
    }

    // Strict filter: Exclude anime if anime is disabled, exclude self, exclude unpublished
    if (!APP_CONFIG.ANIME_ENABLED) {
      relatedWorks = relatedWorks.filter(w => (w.type || '').toLowerCase() !== 'anime');
    }
    relatedWorks = relatedWorks.filter(w => w && w.id !== work.id && w.slug !== work.slug);

    if (relatedWorks.length === 0) {
      targetEl.style.display = 'none';
      return;
    }

    targetEl.style.display = 'block';
    targetEl.innerHTML = `
      <div class="related-works-wrapper" style="margin-top: 40px; margin-bottom: 30px; border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 30px;">
        <h2 class="section-title" style="font-size: 20px; font-weight: 900; color: #fff; margin-bottom: 20px; display: flex; align-items: center; gap: 8px;">
          <span>🎬</span> أعمال مشابهة
        </h2>
        <div class="related-works-grid">
          ${relatedWorks.map(item => {
            const itemTitle = item.title || 'عمل بدون عنوان';
            const itemCover = item.cover || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300';
            const itemType = (item.type || '').toLowerCase() === 'anime' ? 'أنمي' : 'كرتون';
            const itemYear = item.year ? ` • ${item.year}` : '';
            const targetUrl = `#/work/${item.slug || item.id}`;

            return `
              <a href="${targetUrl}" class="related-work-card">
                <div class="related-cover-wrap">
                  <img src="${itemCover}" alt="${itemTitle}" loading="lazy" class="related-cover-img" onerror="this.src='https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300'" />
                  <div class="related-type-badge">${itemType}</div>
                </div>
                <div class="related-card-info">
                  <h3 class="related-card-title">${itemTitle}</h3>
                  <div class="related-card-sub">${itemType}${itemYear}</div>
                </div>
              </a>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  renderEpisodesCards(work, episodesList) {
    if (!episodesList || episodesList.length === 0) {
      return `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--dw-text-muted);">
          لا توجد حلقات مضافة لهذا العمل حالياً.
        </div>
      `;
    }

    return episodesList.filter(Boolean).map(ep => `
      <a href="#/watch/${work.slug || work.id}/${ep.number}" class="episode-card">
        <div class="ep-num-pill">${ep.number}</div>
        <div class="ep-card-info">
          <div class="ep-card-title">${ep.title || `الحلقة ${ep.number}`}</div>
          <div class="ep-card-sub">${Array.isArray(ep.servers) ? ep.servers.length : 1} سيرفرات متوفرة</div>
        </div>
        <div style="color: var(--dw-red-glow); font-size: 18px;">▶</div>
      </a>
    `).join('');
  }

  renderWatchView(slug, episodeNum) {
    const work = dataStore.getBySlug(slug);

    if (!work) {
      this.renderNotFoundView('العمل المطلوب غير موجود أو ربما تم حذفه.');
      return;
    }

    const episodes = Array.isArray(work.episodes) ? work.episodes : [];
    if (episodes.length === 0) {
      this.renderNotFoundView('لا توجد حلقات مضافة لهذا العمل حالياً.');
      return;
    }

    const currentEpisode = episodes.find(ep => ep && ep.number === episodeNum) || episodes[0];

    if (!currentEpisode) {
      this.renderNotFoundView('الحلقة المطلوبة غير موجودة أو تم حذفها.');
      return;
    }

    const currentIndex = episodes.findIndex(ep => ep && ep.number === currentEpisode.number);
    const prevEpisode = currentIndex > 0 ? episodes[currentIndex - 1] : null;
    const nextEpisode = currentIndex < episodes.length - 1 ? episodes[currentIndex + 1] : null;

    const servers = Array.isArray(currentEpisode.servers) && currentEpisode.servers.length > 0
      ? currentEpisode.servers
      : [{ id: 'srv-1', name: 'السرفر الأول', url: '', type: 'video' }];

    if (this.currentPlayingServerIdx >= servers.length) {
      this.currentPlayingServerIdx = 0;
    }
    const activeServer = servers[this.currentPlayingServerIdx];

    const epTitle = currentEpisode.title || `الحلقة ${currentEpisode.number || 1}`;
    const workTitle = work.title || 'العمل';

    this.setSEO(
      `${workTitle} - ${epTitle} مشاهدة مباشرة`,
      `شاهد ${workTitle} ${epTitle} بجودة عالية وبدون تقطيع على Dark Watch.`,
      {
        "@context": "https://schema.org",
        "@type": "TVEpisode",
        "name": epTitle,
        "episodeNumber": currentEpisode.number || 1,
        "partOfSeries": {
          "@type": "TVSeries",
          "name": workTitle
        }
      }
    );

    this.mainContent.innerHTML = `
      <div class="watch-view-wrapper container">
        <!-- Breadcrumb -->
        <div style="display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--dw-text-muted); margin-bottom: 18px;">
          <a href="#/" style="hover: color: #fff;">الرئيسية</a>
          <span>/</span>
          <a href="#/${work.type === 'anime' ? 'anime' : 'cartoon'}">${work.type === 'anime' ? 'الأنمي' : 'الكرتون'}</a>
          <span>/</span>
          <a href="#/work/${work.slug || work.id}">${workTitle}</a>
          <span>/</span>
          <span style="color: #fff; font-weight: 700;">${epTitle}</span>
        </div>

        <div class="watch-layout">
          <!-- Main Player Area -->
          <div class="player-main-area">
            <!-- Video Player Frame -->
            <div class="video-frame-container" id="player-container">
              ${this.renderPlayerMarkup(activeServer)}
            </div>

            <!-- Server Selector -->
            <div class="servers-selector-bar">
              <span class="servers-label">🌐 اختر السيرفر:</span>
              <div class="server-pills-list">
                ${servers.map((srv, idx) => {
                  const displaySrvName = idx === 0 ? 'السرفر الأول' : (srv.name || `السرفر ${idx + 1}`);
                  return `
                    <button class="btn-server-pill ${idx === this.currentPlayingServerIdx ? 'active' : ''}" data-srv-idx="${idx}">
                      ${displaySrvName}
                    </button>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- Episode Controls (Prev / Title / Next) -->
            <div class="episode-nav-controls">
              <a ${prevEpisode ? `href="#/watch/${work.slug || work.id}/${prevEpisode.number}"` : 'disabled'} class="ep-nav-btn" ${!prevEpisode ? 'style="pointer-events: none; opacity: 0.4;"' : ''}>
                <span>⏭</span> الحلقة السابقة
              </a>

              <div class="ep-nav-title">
                ${epTitle}
              </div>

              <a ${nextEpisode ? `href="#/watch/${work.slug || work.id}/${nextEpisode.number}"` : 'disabled'} class="ep-nav-btn" ${!nextEpisode ? 'style="pointer-events: none; opacity: 0.4;"' : ''}>
                الحلقة التالية <span>⏮</span>
              </a>
            </div>

            <!-- Work Details Box -->
            <div class="watch-work-summary">
              <div style="display: flex; gap: 16px; align-items: center;">
                <img src="${work.cover || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=100'}" alt="${workTitle}" style="width: 70px; height: 100px; border-radius: 8px; object-fit: cover;" onerror="this.src='https://images.unsplash.com/photo-1578632767115-351597cf2477?w=100'" />
                <div>
                  <h2 style="font-size: 20px; font-weight: 800; color: #fff; margin-bottom: 6px;">${workTitle}</h2>
                  <div style="font-size: 13px; color: var(--dw-text-muted); margin-bottom: 8px;">
                    ${work.type === 'anime' ? 'أنمي' : 'كرتون'} • ${work.year || ''} • ${work.status || ''}
                  </div>
                  <p style="font-size: 14px; color: #c4c4d4; line-height: 1.5; max-width: 700px;">
                    ${work.description || 'مشاهدة مباشرة بدون إعلانات.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Sidebar Episodes List -->
          <div class="watch-sidebar">
            <div class="sidebar-head">
              <div class="sidebar-title">قائمة الحلقات (${episodes.length})</div>
              <a href="#/work/${work.slug || work.id}" style="font-size: 12px; color: var(--dw-red-glow); font-weight: 700;">
                صفحة العمل ↗
              </a>
            </div>

            <div class="sidebar-ep-list">
              ${episodes.filter(Boolean).map(ep => `
                <a href="#/watch/${work.slug || work.id}/${ep.number}" class="episode-card ${ep.number === currentEpisode.number ? 'active-playing' : ''}" style="padding: 10px 12px;">
                  <div class="ep-num-pill" style="width: 32px; height: 32px; font-size: 13px;">${ep.number}</div>
                  <div class="ep-card-info">
                    <div class="ep-card-title" style="font-size: 13px;">${ep.title || `الحلقة ${ep.number}`}</div>
                  </div>
                </a>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;


    // Attach Server switcher events
    const serverPills = this.mainContent.querySelectorAll('.btn-server-pill');
    serverPills.forEach(pill => {
      pill.addEventListener('click', () => {
        const idx = parseInt(pill.dataset.srvIdx, 10);
        this.currentPlayingServerIdx = idx;
        serverPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');

        const newActiveServer = servers[idx];
        const playerContainer = document.getElementById('player-container');
        if (playerContainer) {
          playerContainer.innerHTML = this.renderPlayerMarkup(newActiveServer);
        }
      });
    });
  }

  renderPlayerMarkup(server) {
    if (!server || !server.url) {
      return `
        <div class="video-error-fallback">
          <div style="font-size: 36px;">⚠️</div>
          <div style="font-size: 16px; font-weight: 700; color: #fff;">رابط المشاهدة غير متوفر حالياً</div>
          <p style="font-size: 13px; color: var(--dw-text-muted);">يرجى تجربة سيرفر آخر من قائمة السيرفرات أعلاه.</p>
        </div>
      `;
    }

    const cleanServerUrl = String(server.url).trim();

    if (server.type === 'video' || cleanServerUrl.endsWith('.mp4') || cleanServerUrl.endsWith('.webm')) {
      return `
        <div style="position: relative; width: 100%; height: 100%;">
          <video class="video-player-element" controls autoplay playsinline poster="" onerror="window.darkWatchApp.handleVideoError(this, '${encodeURIComponent(cleanServerUrl)}')">
            <source src="${cleanServerUrl}" type="video/mp4">
            متصفحك لا يدعم مشغل الفيديو المباشر.
          </video>
          <div style="position: absolute; bottom: 12px; left: 12px; z-index: 10;">
            <a href="${cleanServerUrl}" target="_blank" rel="noopener noreferrer" class="btn-secondary" style="font-size: 12px; padding: 6px 12px; background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(8px); border: 1px solid rgba(255, 255, 255, 0.2); color: #fff; border-radius: 6px; text-decoration: none;">
              🔗 فتح التشغيل الخارجي
            </a>
          </div>
        </div>
      `;
    } else {
      return `
        <div style="position: relative; width: 100%; height: 100%;">
          <iframe class="video-player-element" src="${cleanServerUrl}" allowfullscreen allow="autoplay; encrypted-media; picture-in-picture"></iframe>
          <div style="position: absolute; bottom: 12px; left: 12px; z-index: 10;">
            <a href="${cleanServerUrl}" target="_blank" rel="noopener noreferrer" class="btn-secondary" style="font-size: 12px; padding: 6px 12px; background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(8px); border: 1px solid rgba(255, 255, 255, 0.2); color: #fff; border-radius: 6px; text-decoration: none;">
              🔗 فتح التشغيل الخارجي
            </a>
          </div>
        </div>
      `;
    }
  }

  handleVideoError(videoEl, rawUrl = '') {
    const container = document.getElementById('player-container');
    const targetUrl = rawUrl ? decodeURIComponent(rawUrl) : '';

    if (container) {
      container.innerHTML = `
        <div class="video-error-fallback">
          <div style="font-size: 36px; color: var(--dw-red-glow);">⚠️</div>
          <div style="font-size: 17px; font-weight: 800; color: #fff;">هذا السيرفر لا يسمح بالتشغيل المباشر داخل الموقع</div>
          <p style="font-size: 14px; color: var(--dw-text-muted); max-width: 460px; margin-bottom: 16px;">
            قد يمنع السيرفر التضمين الحمي بسياسة CSP أو X-Frame-Options. يمكنك تجربة سيرفر آخر من قائمة السيرفرات في الأعلى، أو فتح المشاهدة في نافذة خارجية.
          </p>
          ${targetUrl ? `
            <a href="${targetUrl}" target="_blank" rel="noopener noreferrer" class="btn-primary" style="display: inline-flex; align-items: center; gap: 8px; font-size: 14px; padding: 10px 20px;">
              🔗 فتح التشغيل الخارجي
            </a>
          ` : ''}
        </div>
      `;
    }
  }

  renderAdminView() {
    this.setSEO('لوحة الإدارة ومعالجة البيانات', 'إدارة وتثبيت بيانات الأعمال والمسلسلات في Dark Watch');
    AdminController.renderAdminView(this.mainContent, (msg, type) => this.showToast(msg, type));
  }

  renderNotFoundView(message = 'الصفحة المطلوبة غير موجودة.') {
    this.setSEO('الصفحة غير موجودة 404', 'الصفحة التي تبحث عنها غير موجودة في Dark Watch.');
    this.mainContent.innerHTML = `
      <div class="container" style="padding: 100px 20px; text-align: center;">
        <div style="font-size: 72px; font-weight: 900; color: var(--dw-red-primary); line-height: 1;">404</div>
        <h1 style="font-size: 24px; font-weight: 800; color: #fff; margin: 16px 0 8px;">${message}</h1>
        <p style="color: var(--dw-text-muted); font-size: 15px; margin-bottom: 24px;">يبدو أن الرابط غير صحيح أو تم نقل العمل إلى مكان آخر.</p>
        <a href="#/" class="btn-primary">
          🏠 العودة إلى الصفحة الرئيسية
        </a>
      </div>
    `;
  }
}

// Global initialization
window.darkWatchApp = new DarkWatchApp();
window.addEventListener('DOMContentLoaded', () => {
  window.darkWatchApp.init();
});
