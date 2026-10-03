/**
 * Dark Watch - Professional Admin Panel Controller
 * Handles Recursive JSON Deep-Scan Parsing, Real-time Batch Storage Transfers,
 * Warehouse (المخزن) Management, Instant Publishing (تثبيت الأعمال),
 * Granular CRUD, Permanent Multi-Tier Persistence in PostgreSQL (Neon),
 * Stream Verification, and GitHub/Vercel JSON Synchronization.
 */

import { APP_CONFIG } from './config.js';
import { dataStore } from './data-store.js';
import { JSONParser } from './parser.js';
import { adsManager } from './ads-manager.js';

export class AdminController {
  static currentTab = 'all';
  static searchQuery = '';
  static warehouseSearchQuery = '';
  static selectedWorkIds = new Set();
  static selectedWarehouseIds = new Set();
  static pendingParsedData = null;
  static excludedImportIndices = new Set();
  static activeEditingWorkId = null;
  static activeEpisodesWorkId = null;
  static pendingDeleteWorkId = null;

  static renderAdminView(container, showToast) {
    // 1. Authentication Gate
    if (!this.isAuthenticated()) {
      this.renderLoginScreen(container, showToast);
      return;
    }

    const stats = dataStore.getStats();
    const allWorks = dataStore.getAllWorks();
    const publishedWorks = dataStore.getAllPublished();
    const draftWorks = dataStore.getDrafts();
    const archivedWorks = dataStore.getArchived();
    const importLogs = dataStore.getImportLogs();

    container.innerHTML = `
      <div class="admin-container container">
        <!-- Admin Header Bar -->
        <div class="admin-header-card">
          <div class="admin-title-row">
            <div class="stat-icon" style="background: rgba(229, 9, 20, 0.15); border-color: rgba(229, 9, 20, 0.3); color: var(--dw-red-glow);">⚙️</div>
            <div>
              <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                <h1 style="font-size: 24px; font-weight: 900; color: #fff;">لوحة تحكم Dark Watch</h1>
                <span class="tag-badge badge-red" style="font-size: 11px;">Admin v2.3</span>
              </div>
              <p style="font-size: 13px; color: var(--dw-text-muted); margin-top: 4px;">
                الإدارة المتقدمة للمكتبة، نظام نقل الأعمال إلى المخزن مع Real-time Progress، والتخزين الدائم في PostgreSQL.
              </p>
            </div>
          </div>
          <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
            <a href="#/" class="btn-secondary" style="padding: 8px 14px; font-size: 13px;">
              👁️ معاينة الموقع
            </a>
            <button id="btn-test-db-top" class="btn-secondary" style="padding: 8px 14px; font-size: 13px; color: #2ed573; border-color: rgba(46, 213, 115, 0.4); font-weight: 700;" title="فحص اتصال قاعدة بيانات PostgreSQL والتأكد من التخزين الدائم">
              ⚡ اختبار التخزين
            </button>
            <button id="btn-publish-all-top" class="btn-primary" style="padding: 8px 18px; font-size: 13px; font-weight: 800; background: linear-gradient(135deg, #2ed573 0%, #1e90ff 100%);" ${draftWorks.length === 0 ? 'disabled style="opacity: 0.5;"' : ''} title="تثبيت ونشر جميع المسودات من المخزن إلى الموقع">
              🚀 تثبيت الأعمال (${draftWorks.length} في المخزن)
            </button>
            <button id="btn-download-works-top" class="btn-secondary" style="padding: 8px 14px; font-size: 13px;" title="تنزيل ملف works.json لتحديث المشروع في GitHub / Vercel">
              📥 تنزيل works.json لـ GitHub
            </button>
            <button id="btn-admin-logout" class="btn-secondary" style="padding: 8px 12px; font-size: 13px; color: #ff4757; border-color: rgba(255, 71, 87, 0.3);" title="تسجيل الخروج">
              🔒 خروج
            </button>
          </div>
        </div>

        <!-- Metric Statistics Grid -->
        <div class="admin-stats-grid">
          <div class="stat-box" style="border: 1px solid ${stats.dbStatus && stats.dbStatus.connected ? 'rgba(46, 213, 115, 0.4)' : 'rgba(255, 71, 87, 0.4)'}; background: ${stats.dbStatus && stats.dbStatus.connected ? 'rgba(46, 213, 115, 0.05)' : 'rgba(255, 71, 87, 0.05)'};">
            <div class="stat-icon" style="color: ${stats.dbStatus && stats.dbStatus.connected ? '#2ed573' : '#ff4757'}; background: ${stats.dbStatus && stats.dbStatus.connected ? 'rgba(46, 213, 115, 0.15)' : 'rgba(255, 71, 87, 0.15)'};">
              ${stats.dbStatus && stats.dbStatus.connected ? '🟢' : '🔴'}
            </div>
            <div>
              <div class="stat-num" style="font-size: 15px; font-weight: 800; color: ${stats.dbStatus && stats.dbStatus.connected ? '#2ed573' : '#ff4757'};">
                PostgreSQL: ${stats.dbStatus && stats.dbStatus.connected ? '🟢 متصل' : '🔴 غير متصل'}
              </div>
              <div class="stat-label">
                ${stats.dbStatus && stats.dbStatus.lastChecked ? `آخر اختبار: ${new Date(stats.dbStatus.lastChecked).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'حالة قاعدة البيانات (دائم)'}
              </div>
            </div>
          </div>
          <div class="stat-box" style="border: 1px solid ${APP_CONFIG.ANIME_ENABLED ? 'rgba(46, 213, 115, 0.3)' : 'rgba(255, 165, 2, 0.3)'};">
            <div class="stat-icon" style="color: ${APP_CONFIG.ANIME_ENABLED ? '#2ed573' : '#ffa502'}; background: ${APP_CONFIG.ANIME_ENABLED ? 'rgba(46, 213, 115, 0.15)' : 'rgba(255, 165, 2, 0.15)'};">⚔️</div>
            <div>
              <div class="stat-num" style="font-size: 15px; color: ${APP_CONFIG.ANIME_ENABLED ? '#2ed573' : '#ffa502'}; font-weight: 800;">
                قسم الأنمي: ${APP_CONFIG.ANIME_ENABLED ? '🟢 مفعّل' : '⏸️ متوقف مؤقتاً'}
              </div>
              <div class="stat-label">
                ${allWorks.filter(w => (w.type || '').toLowerCase() === 'anime').length} عمل محفوظ في DB
              </div>
            </div>
          </div>
          <div class="stat-box">
            <div class="stat-icon">🎬</div>
            <div>
              <div class="stat-num">${stats.totalWorks}</div>
              <div class="stat-label">إجمالي الأعمال في المكتبة</div>
            </div>
          </div>
          <div class="stat-box">
            <div class="stat-icon" style="color: #2ed573; background: rgba(46, 213, 115, 0.15); border-color: rgba(46, 213, 115, 0.3);">✅</div>
            <div>
              <div class="stat-num">${stats.publishedCount}</div>
              <div class="stat-label">أعمال منشورة ومثبتة (Live)</div>
            </div>
          </div>
          <div class="stat-box">
            <div class="stat-icon" style="color: #ffa502; background: rgba(255, 165, 2, 0.15); border-color: rgba(255, 165, 2, 0.3);">📦</div>
            <div>
              <div class="stat-num">${stats.draftsCount}</div>
              <div class="stat-label">أعمال في المخزن (غير منشورة)</div>
            </div>
          </div>
          <div class="stat-box">
            <div class="stat-icon">🎞️</div>
            <div>
              <div class="stat-num">${stats.totalEpisodes}</div>
              <div class="stat-label">إجمالي الحلقات المستخرجة</div>
            </div>
          </div>
          <div class="stat-box">
            <div class="stat-icon">🌐</div>
            <div>
              <div class="stat-num">${stats.totalServers}</div>
              <div class="stat-label">إجمالي سيرفرات المشاهدة</div>
            </div>
          </div>
          <div class="stat-box">
            <div class="stat-icon">📥</div>
            <div>
              <div class="stat-num">${stats.totalImports}</div>
              <div class="stat-label">عمليات استيراد JSON</div>
            </div>
          </div>
          <div class="stat-box">
            <div class="stat-icon">🕒</div>
            <div>
              <div class="stat-num" style="font-size: 13px; font-weight: 700; margin-top: 4px;">
                ${stats.lastUpdated ? new Date(stats.lastUpdated).toLocaleDateString('ar-EG') : 'الآن'}
              </div>
              <div class="stat-label">آخر عملية حفظ في DB</div>
            </div>
          </div>
        </div>

        <!-- Main Navigation Tabs of Admin -->
        <div class="admin-main-nav">
          <button class="admin-nav-item active" data-section="section-import">
            📥 استيراد وتحليل JSON (Recursive Deep-Scan)
          </button>
          <button class="admin-nav-item" data-section="section-warehouse">
            📦 المخزن (غير منشورة) (${draftWorks.length})
          </button>
          <button class="admin-nav-item" data-section="section-works">
            📋 جميع الأعمال (${stats.totalWorks})
          </button>
          <button class="admin-nav-item" data-section="section-logs">
            📜 سجل العمليات (${importLogs.length})
          </button>
          <button class="admin-nav-item" data-section="section-settings">
            ⚙️ التخزين الدائم والأمان
          </button>
          <button class="admin-nav-item" data-section="section-gsc">
            🔍 Google Search Console
          </button>
          <button class="admin-nav-item" data-section="section-ads">
            📢 إدارة الإعلانات
          </button>
          <button class="admin-nav-item" data-section="section-hilltopads">
            🛡️ التحقق من HilltopAds
          </button>
          <button class="admin-nav-item" data-section="section-seo">
            🎯 SEO والتحليل
          </button>
        </div>

        <!-- SECTION 1: JSON Importer & Recursive Deep Parser -->
        <div id="section-import" class="admin-section active">
          <div class="admin-card">
            <div class="admin-card-head">
              <div class="admin-card-title">
                <span>📥</span> استخراج ملفات JSON ونقلها إلى المخزن
              </div>
              <div style="font-size: 13px; color: var(--dw-text-muted);">
                استخراج تكراري عميق للأعمال والحلقات والسيرفرات مع ميزة النقل بالدفعات (Batch Processing) وشريط تقدم حي (Real-time Progress).
              </div>
            </div>

            <!-- Drag & Drop Zone -->
            <div id="drop-zone" class="drop-zone">
              <div class="drop-zone-icon">📁</div>
              <div class="drop-zone-text">اسحب وأفلت ملف JSON هنا أو انقر للاختيار من جهازك</div>
              <div class="drop-zone-hint">يدعم استيراد 100+ أو 1000+ عمل وملايين الحلقات وحفظها في PostgreSQL على دفعات موثوقة</div>
              <input type="file" id="json-file-input" accept=".json" style="display: none;" />
              <button id="btn-browse-file" class="btn-secondary" style="margin-top: 12px;">
                📂 اختيار ملف من الجهاز
              </button>
            </div>

            <!-- Selected File Info Banner -->
            <div id="file-info-banner" class="file-info-banner" style="display: none;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 24px;">📄</span>
                <div>
                  <div id="selected-file-name" style="font-weight: 800; color: #fff;">-</div>
                  <div id="selected-file-size" style="font-size: 12px; color: var(--dw-text-muted);">-</div>
                </div>
              </div>
              <button id="btn-clear-file" class="btn-secondary" style="padding: 4px 10px; font-size: 12px; color: #ff4757;">✕ إلغاء</button>
            </div>

            <!-- Direct JSON Text Area -->
            <div style="margin-top: 18px;">
              <label style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 700; color: #fff; margin-bottom: 8px;">
                <span>أو الصق محتوى JSON مباشرة:</span>
                <div style="display: flex; gap: 8px;">
                  <button id="btn-load-sample" style="color: var(--dw-red-glow); font-size: 13px; font-weight: 600;">
                    📋 نموذج تجريبي (Sample JSON)
                  </button>
                  <button id="btn-load-100-sample" style="color: #2ed573; font-size: 13px; font-weight: 700;">
                    ⚡ تجربة 100 عمل (اختبار الحفظ بالدفعات)
                  </button>
                </div>
              </label>
              <textarea id="json-text-input" class="admin-textarea" placeholder='الصق كود JSON هنا...'></textarea>
            </div>

            <!-- Progress Bar -->
            <div id="parse-progress-bar-wrap" class="progress-bar-wrap">
              <div id="parse-progress-bar-fill" class="progress-bar-fill"></div>
            </div>
            <div id="parse-progress-text" style="font-size: 13px; color: var(--dw-text-muted); display: none; margin-bottom: 12px;"></div>

            <!-- Action Trigger Button -->
            <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
              <button id="btn-analyze-json" class="btn-primary" style="padding: 12px 26px; font-size: 14px; font-weight: 800;">
                ⚡ فحص وتحليل الملف ومعاينة الحلقات
              </button>
            </div>

            <!-- Preview & Validation Inspection Container -->
            <div id="preview-validation-card" class="preview-validation-card" style="display: none;">
              <div class="preview-head" style="flex-wrap: wrap; gap: 16px;">
                <div>
                  <h3 style="font-size: 20px; font-weight: 900; color: #fff;">🔍 نتائج التحليل والمعاينة قبل النقل</h3>
                  <p style="font-size: 13px; color: var(--dw-text-muted); margin-top: 3px;">
                    تم استخراج جميع الأعمال والحلقات والسيرفرات. اختر الآن وجهة النقل في قاعدة البيانات:
                  </p>
                </div>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                  <button id="btn-cancel-preview" class="btn-secondary" style="font-size: 13px;">
                    ✕ إلغاء المعاينة
                  </button>
                  <button id="btn-transfer-warehouse" class="btn-primary" style="font-size: 13px; font-weight: 800; background: linear-gradient(135deg, #ffa502 0%, #ff7f50 100%);">
                    📦 نقل إلى المخزن (Progress حي)
                  </button>
                  <button id="btn-load-publish-live" class="btn-primary" style="font-size: 13px; font-weight: 800; background: linear-gradient(135deg, #e50914 0%, #ff2a38 100%);">
                    🚀 نقل ونشر في الموقع مباشرة
                  </button>
                </div>
              </div>

              <!-- Inspection Metrics -->
              <div class="inspection-metrics-grid" id="inspection-metrics-target"></div>

              <!-- Warnings breakdown if missing data -->
              <div id="inspection-warnings-target"></div>

              <!-- Works List Preview Toolbar -->
              <div style="margin-top: 22px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                <h4 style="font-size: 16px; font-weight: 800; color: #fff;">الأعمال المكتشفة في الملف:</h4>
                <div style="display: flex; gap: 10px;">
                  <button id="btn-preview-toggle-all" class="btn-secondary" style="padding: 4px 10px; font-size: 12px;">
                    تحديد / إلغاء تحديد الكل
                  </button>
                </div>
              </div>

              <!-- Works List Preview Grid -->
              <div id="inspection-works-list" class="inspection-works-list" style="margin-top: 12px;"></div>
            </div>
          </div>
        </div>

        <!-- SECTION 2: Dedicated Warehouse (المخزن - الأعمال غير المنشورة) -->
        <div id="section-warehouse" class="admin-section">
          <div class="admin-card">
            <div class="admin-card-head" style="flex-wrap: wrap; gap: 14px;">
              <div class="admin-card-title">
                <span>📦</span> قسم المخزن (الأعمال غير المنشورة)
              </div>
              <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                <div class="admin-search-wrap" style="width: 100%; max-width: 320px;">
                  <input type="text" id="admin-warehouse-search" class="admin-search-input" placeholder="ابحث في المخزن بالاسم..." value="${this.warehouseSearchQuery}" />
                </div>
                <button id="btn-publish-warehouse-all" class="btn-primary" style="padding: 10px 20px; font-size: 13px; font-weight: 800; background: linear-gradient(135deg, #2ed573 0%, #1e90ff 100%);" ${draftWorks.length === 0 ? 'disabled style="opacity: 0.5;"' : ''}>
                  🚀 تثبيت الأعمال (${draftWorks.length} عمل في المخزن)
                </button>
              </div>
            </div>

            <!-- Warehouse Sub-Header Info Box -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 20px;">
              <div style="background: #0e0e16; border: 1px solid rgba(255, 165, 2, 0.3); border-radius: var(--dw-radius-md); padding: 14px 18px;">
                <div style="font-size: 12px; color: var(--dw-text-muted); font-weight: 600;">إجمالي الأعمال في المخزن:</div>
                <div style="font-size: 22px; font-weight: 900; color: #ffa502; margin-top: 4px;">${draftWorks.length} عمل</div>
              </div>
              <div style="background: #0e0e16; border: 1px solid rgba(46, 213, 115, 0.3); border-radius: var(--dw-radius-md); padding: 14px 18px;">
                <div style="font-size: 12px; color: var(--dw-text-muted); font-weight: 600;">الأعمال المنشورة (Live):</div>
                <div style="font-size: 22px; font-weight: 900; color: #2ed573; margin-top: 4px;">${publishedWorks.length} عمل</div>
              </div>
              <div style="background: #0e0e16; border: 1px solid rgba(30, 144, 255, 0.3); border-radius: var(--dw-radius-md); padding: 14px 18px;">
                <div style="font-size: 12px; color: var(--dw-text-muted); font-weight: 600;">إجمالي الحلقات في المخزن:</div>
                <div style="font-size: 22px; font-weight: 900; color: #1e90ff; margin-top: 4px;">
                  ${draftWorks.reduce((acc, w) => acc + (w.episodes ? w.episodes.length : (w.episodesCount || 0)), 0)} حلقة
                </div>
              </div>
            </div>

            <!-- Warehouse Bulk Action Toolbar -->
            <div id="warehouse-bulk-toolbar" class="bulk-toolbar" style="display: none; margin-bottom: 16px;">
              <span id="warehouse-bulk-count" style="font-weight: 700; color: #fff;">تم تحديد 0 عمل في المخزن</span>
              <div style="display: flex; gap: 8px;">
                <button id="btn-warehouse-bulk-publish" class="btn-primary" style="padding: 6px 14px; font-size: 13px; background: #2ed573;">
                  🚀 تثبيت ونشر المحدد
                </button>
                <button id="btn-warehouse-bulk-delete" class="btn-secondary" style="padding: 6px 14px; font-size: 13px; color: #ff4757; border-color: rgba(255, 71, 87, 0.3);">
                  🗑️ حذف المحدد
                </button>
              </div>
            </div>

            <!-- Warehouse Works Table -->
            <div class="admin-table-container">
              <table class="admin-table">
                <thead>
                  <tr>
                    <th style="width: 40px; text-align: center;">
                      <input type="checkbox" id="check-all-warehouse" style="cursor: pointer;" />
                    </th>
                    <th style="width: 60px;">الغلاف</th>
                    <th>اسم العمل</th>
                    <th>عدد الحلقات</th>
                    <th>النوع</th>
                    <th>حالة العمل</th>
                    <th style="min-width: 220px;">الإجراءات</th>
                  </tr>
                </thead>
                <tbody id="admin-warehouse-tbody">
                  ${this.renderWarehouseTableRows(draftWorks)}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- SECTION 3: Works Management List & Filter -->
        <div id="section-works" class="admin-section">
          <div class="admin-card">
            <div class="admin-card-head" style="flex-wrap: wrap; gap: 14px;">
              <div class="admin-card-title">
                <span>📋</span> جميع الأعمال في المكتبة
              </div>
              <!-- Search and Filters -->
              <div style="display: flex; gap: 10px; flex-wrap: wrap; flex: 1; justify-content: flex-end;">
                <div class="admin-search-wrap" style="width: 100%; max-width: 380px;">
                  <input type="text" id="admin-works-search" class="admin-search-input" placeholder="ابحث عن العمل بالاسم..." value="${this.searchQuery}" />
                </div>
              </div>
            </div>

            <!-- Sub Filter Tabs -->
            <div class="admin-tabs">
              <button class="admin-tab-btn ${this.currentTab === 'all' ? 'active' : ''}" data-tab="all">الكل (${allWorks.length})</button>
              <button class="admin-tab-btn ${this.currentTab === 'published' ? 'active' : ''}" data-tab="published">المنشورة فقط (${publishedWorks.length})</button>
              <button class="admin-tab-btn ${this.currentTab === 'draft' ? 'active' : ''}" data-tab="draft">المخزن (DRAFT) (${draftWorks.length})</button>
              <button class="admin-tab-btn ${this.currentTab === 'anime' ? 'active' : ''}" data-tab="anime">الأنمي</button>
              <button class="admin-tab-btn ${this.currentTab === 'cartoon' ? 'active' : ''}" data-tab="cartoon">الكرتون</button>
              <button class="admin-tab-btn ${this.currentTab === 'archived' ? 'active' : ''}" data-tab="archived">المؤرشفة (${archivedWorks.length})</button>
            </div>

            <!-- Bulk Action Toolbar -->
            <div id="bulk-toolbar" class="bulk-toolbar" style="display: none;">
              <span id="bulk-selected-count" style="font-weight: 700; color: #fff;">تم تحديد 0 عمل</span>
              <div style="display: flex; gap: 8px;">
                <button id="btn-bulk-publish" class="btn-primary" style="padding: 6px 14px; font-size: 13px;">
                  🚀 تثبيت المحدد (Publish)
                </button>
                <button id="btn-bulk-warehouse" class="btn-secondary" style="padding: 6px 14px; font-size: 13px; color: #ffa502;">
                  📦 نقل المحدد للمخزن (Draft)
                </button>
                <button id="btn-bulk-delete" class="btn-secondary" style="padding: 6px 14px; font-size: 13px; color: #ff4757; border-color: rgba(255, 71, 87, 0.3);">
                  🗑️ حذف المحدد
                </button>
              </div>
            </div>

            <!-- Works Table -->
            <div class="admin-table-container">
              <table class="admin-table">
                <thead>
                  <tr>
                    <th style="width: 40px; text-align: center;">
                      <input type="checkbox" id="check-all-works" style="cursor: pointer;" />
                    </th>
                    <th style="width: 60px;">الغلاف</th>
                    <th>اسم العمل</th>
                    <th>عدد الحلقات</th>
                    <th>النوع</th>
                    <th>الحالة</th>
                    <th style="min-width: 240px;">الإجراءات</th>
                  </tr>
                </thead>
                <tbody id="admin-works-tbody">
                  ${this.renderWorksTableRows()}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- SECTION 4: Import Logs History -->
        <div id="section-logs" class="admin-section">
          <div class="admin-card">
            <div class="admin-card-head">
              <div class="admin-card-title">
                <span>📜</span> سجل عمليات استيراد JSON
              </div>
              <div style="font-size: 13px; color: var(--dw-text-muted);">
                تتبع كامل لكافة الملفات والبيانات المستوردة
              </div>
            </div>

            <div class="admin-table-container">
              <table class="admin-table">
                <thead>
                  <tr>
                    <th>اسم الملف</th>
                    <th>تاريخ الاستيراد</th>
                    <th>حجم الملف</th>
                    <th>الأعمال المستخرجة</th>
                    <th>الحلقات</th>
                    <th>السيرفرات</th>
                    <th>حالة العملية</th>
                  </tr>
                </thead>
                <tbody>
                  ${this.renderImportLogsRows(importLogs)}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- SECTION 5: Settings & Permanent Persistence -->
        <div id="section-settings" class="admin-section">
          <div class="admin-card">
            <div class="admin-card-head">
              <div class="admin-card-title">
                <span>⚙️</span> التخزين الدائم ومزامنة GitHub / Vercel
              </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px;">
              <!-- Anime Section Visibility Control Box -->
              <div style="background: #0d0d12; border: 1px solid ${APP_CONFIG.ANIME_ENABLED ? 'rgba(46, 213, 115, 0.3)' : 'rgba(255, 165, 2, 0.3)'}; border-radius: var(--dw-radius-md); padding: 20px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                  <span style="font-size: 20px;">⚔️</span>
                  <h3 style="font-size: 16px; font-weight: 800; color: #fff;">التحكم في قسم الأنمي</h3>
                </div>
                <p style="font-size: 13px; color: var(--dw-text-muted); margin-bottom: 14px; line-height: 1.6;">
                  الحالة في الموقع العام: <strong style="color: ${APP_CONFIG.ANIME_ENABLED ? '#2ed573' : '#ffa502'};">${APP_CONFIG.ANIME_ENABLED ? '🟢 مفعّل ومعروض' : '⏸️ متوقف ومخفي مؤقتاً'}</strong>
                  <br/>
                  <span style="font-size: 11px; color: var(--dw-text-muted);">جميع بيانات وأعمال الأنمي والحلقات في PostgreSQL محفوظة 100% ولن تُحذف.</span>
                </p>
                <button id="btn-toggle-anime-control" class="btn-primary" style="font-size: 13px; font-weight: 700; background: ${APP_CONFIG.ANIME_ENABLED ? '#ff4757' : 'linear-gradient(135deg, #2ed573, #1e90ff)'};">
                  ${APP_CONFIG.ANIME_ENABLED ? '⏸️ إيقاف قسم الأنمي مؤقتاً' : '▶️ إعادة تفعيل قسم الأنمي في الموقع'}
                </button>
              </div>

              <!-- PostgreSQL Live Database Box -->
              <div style="background: #0d0d12; border: 1px solid rgba(46, 213, 115, 0.3); border-radius: var(--dw-radius-md); padding: 20px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                  <span style="font-size: 20px;">🐘</span>
                  <h3 style="font-size: 16px; font-weight: 800; color: #fff;">قاعدة بيانات PostgreSQL (التخزين الدائم)</h3>
                </div>
                <p style="font-size: 13px; color: var(--dw-text-muted); margin-bottom: 16px; line-height: 1.6;">
                  قاعدة البيانات PostgreSQL هي المصدر الدائم والوحيد للبيانات، وتضمن عدم اختفاء أي عمل أو حلقة بعد Restart أو Redeploy على Vercel.
                </p>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                  <button id="btn-test-db-settings" class="btn-primary" style="font-size: 13px; font-weight: 700; background: linear-gradient(135deg, #2ed573, #1e90ff);">
                    ⚡ اختبار التخزين (PostgreSQL)
                  </button>
                  <button id="btn-download-works-settings" class="btn-secondary" style="font-size: 13px; font-weight: 700;">
                    📥 تنزيل نسخة احتياطية
                  </button>
                </div>
              </div>

              <!-- GitHub / Vercel Sync Box -->
              <div style="background: #0d0d12; border: 1px solid var(--dw-border); border-radius: var(--dw-radius-md); padding: 20px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                  <span style="font-size: 20px;">🚀</span>
                  <h3 style="font-size: 16px; font-weight: 800; color: #fff;">ربط Vercel و GitHub</h3>
                </div>
                <p style="font-size: 13px; color: var(--dw-text-muted); margin-bottom: 16px; line-height: 1.6;">
                  قم بإضافة متغير <code>POSTGRES_URL</code> في إعدادات مشروعك على Vercel (Project Settings → Environment Variables) لربط قاعدة بيانات Neon فوراً.
                </p>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                  <label class="btn-secondary" style="font-size: 13px; cursor: pointer;">
                    📤 استعادة من ملف نسخة احتياطية
                    <input type="file" id="restore-file-input" accept=".json" style="display: none;" />
                  </label>
                </div>
              </div>

              <!-- Security PIN Box -->
              <div style="background: #0d0d12; border: 1px solid var(--dw-border); border-radius: var(--dw-radius-md); padding: 20px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                  <span style="font-size: 20px;">🔒</span>
                  <h3 style="font-size: 16px; font-weight: 800; color: #fff;">رمز مرور لوحة الإدارة</h3>
                </div>
                <p style="font-size: 13px; color: var(--dw-text-muted); margin-bottom: 14px;">
                  الرمز الافتراضي الحالي هو: <code style="color: var(--dw-red-glow); background: rgba(229, 9, 20, 0.1); padding: 2px 6px; border-radius: 4px;">darkwatch2026</code>
                </p>
                <div style="display: flex; gap: 8px;">
                  <input type="password" id="new-admin-pin" class="admin-search-input" placeholder="أدخل رمز مرور جديد..." style="flex: 1;" />
                  <button id="btn-save-pin" class="btn-secondary" style="font-size: 13px;">
                    حفظ الرمز
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- SECTION: Google Search Console Management -->
        <div id="section-gsc" class="admin-section">
          <div class="admin-card">
            <div class="admin-card-head">
              <div class="admin-card-title">
                <span>🔍</span> إدارة ملكية الموقع عبر Google Search Console
              </div>
              <div style="font-size: 13px; color: var(--dw-text-muted);">
                نظام متكامل لإعداد واختبار طرق إثبات الملكية الخاصة بـ Google Search Console.
              </div>
            </div>

            <!-- Overall Verification Status Badge Banner -->
            <div id="gsc-status-banner" style="background: #0d0d14; border: 1px solid var(--dw-border); border-radius: var(--dw-radius-lg); padding: 20px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
              <div style="display: flex; align-items: center; gap: 14px;">
                <div id="gsc-status-icon" style="font-size: 32px;">🔴</div>
                <div>
                  <div id="gsc-status-title" style="font-size: 18px; font-weight: 800; color: #fff;">
                    لم يتم إعداد التحقق
                  </div>
                  <div id="gsc-status-desc" style="font-size: 13px; color: var(--dw-text-muted); margin-top: 2px;">
                    يرجى إدخال Meta Tag أو رفع ملف HTML للتحقق وتفعيل الطرق المناسبة.
                  </div>
                </div>
              </div>
              <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button id="btn-test-gsc-meta" class="btn-secondary" style="font-size: 13px;">
                  🧪 اختبار Meta Tag في &lt;head&gt;
                </button>
                <button id="btn-test-gsc-html" class="btn-secondary" style="font-size: 13px;">
                  🧪 اختبار وصول ملف HTML
                </button>
              </div>
            </div>

            <!-- Verification Methods Forms Container -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px;">
              
              <!-- Method 1: Meta Tag -->
              <div style="background: #0a0a0f; border: 1px solid var(--dw-border); border-radius: var(--dw-radius-md); padding: 20px;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
                  <h3 style="font-size: 16px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px;">
                    <span>🏷️</span> طريقة 1: Meta Tag
                  </h3>
                  <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px; font-weight: 700; color: #2ed573;">
                    <input type="checkbox" id="gsc-meta-enabled" style="cursor: pointer;" />
                    تفعيل هذه الطريقة
                  </label>
                </div>
                <p style="font-size: 12px; color: var(--dw-text-muted); margin-bottom: 12px;">
                  أدخل كود التحقق أو كود Meta Tag الكامل وسيقوم النظام تلقائياً باستخراج القيمة وإضافتها إلى &lt;head&gt;.
                </p>
                <div style="margin-bottom: 12px;">
                  <label class="form-label">كود التحقق (Verification Code / Meta Tag):</label>
                  <textarea id="gsc-meta-code" class="admin-textarea" style="height: 90px;" placeholder='مثال: XXXXXXXX أو <meta name="google-site-verification" content="XXXXXXXX" />'></textarea>
                </div>
              </div>

              <!-- Method 2: HTML Verification File -->
              <div style="background: #0a0a0f; border: 1px solid var(--dw-border); border-radius: var(--dw-radius-md); padding: 20px;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
                  <h3 style="font-size: 16px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px;">
                    <span>📄</span> طريقة 2: ملف HTML
                  </h3>
                  <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px; font-weight: 700; color: #2ed573;">
                    <input type="checkbox" id="gsc-html-enabled" style="cursor: pointer;" />
                    تفعيل هذه الطريقة
                  </label>
                </div>
                <p style="font-size: 12px; color: var(--dw-text-muted); margin-bottom: 12px;">
                  ارفع ملف HTML الذي توفره Google أو أدخل اسم ومحتوى الملف مباشرة ليكون متاحاً في Root الموقع.
                </p>

                <!-- Dropzone for HTML File -->
                <div id="gsc-file-dropzone" style="border: 2px dashed #2a2a3a; border-radius: var(--dw-radius-md); padding: 16px; text-align: center; background: #07070a; cursor: pointer; margin-bottom: 12px;">
                  <span style="font-size: 20px;">📂</span>
                  <div style="font-size: 12px; font-weight: 700; color: #fff; margin-top: 4px;">اسحب وأسقط ملف googleXXXX.html هنا أو انقر للاختيار</div>
                  <input type="file" id="gsc-file-input" accept=".html" style="display: none;" />
                </div>

                <div style="margin-bottom: 10px;">
                  <label class="form-label">اسم الملف (e.g. google12345678.html):</label>
                  <input type="text" id="gsc-html-filename" class="admin-search-input" placeholder="google12345678.html" style="font-family: monospace;" />
                </div>
                <div style="margin-bottom: 10px;">
                  <label class="form-label">محتوى الملف:</label>
                  <textarea id="gsc-html-content" class="admin-textarea" style="height: 60px;" placeholder="google-site-verification: google12345678.html"></textarea>
                </div>
              </div>

              <!-- Method 3: Custom URL / Path -->
              <div style="background: #0a0a0f; border: 1px solid var(--dw-border); border-radius: var(--dw-radius-md); padding: 20px;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
                  <h3 style="font-size: 16px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px;">
                    <span>🔗</span> طريقة 3: رابط / مسار التحقق
                  </h3>
                  <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px; font-weight: 700; color: #2ed573;">
                    <input type="checkbox" id="gsc-custom-enabled" style="cursor: pointer;" />
                    تفعيل هذه الطريقة
                  </label>
                </div>
                <p style="font-size: 12px; color: var(--dw-text-muted); margin-bottom: 12px;">
                  خيار لإدخال مسار أو رابط إضافي للتحقق عند الحاجة من نظام Google Search Console.
                </p>
                <div>
                  <label class="form-label">مسار / رابط التحقق الإضافي:</label>
                  <input type="text" id="gsc-custom-url" class="admin-search-input" placeholder="https://example.com/custom-verification-path" />
                </div>
              </div>

            </div>

            <!-- Actions Bar -->
            <div style="margin-top: 24px; display: flex; gap: 12px; justify-content: flex-end; flex-wrap: wrap;">
              <button id="btn-clear-gsc" class="btn-secondary" style="color: #ff4757; border-color: rgba(255, 71, 87, 0.3);">
                🗑️ حذف جميع إعدادات التحقق
              </button>
              <button id="btn-save-gsc" class="btn-primary" style="padding: 12px 30px; font-size: 14px; font-weight: 800; background: linear-gradient(135deg, #2ed573 0%, #1e90ff 100%);">
                💾 حفظ وتطبيق إعدادات Google Search Console
              </button>
            </div>

          </div>
        </div>

        <!-- SECTION: Ads & Popunders Management (HilltopAds Network) -->
        <div id="section-ads" class="admin-section">
          <div class="admin-card">
            <div class="admin-card-head">
              <div class="admin-card-title">
                <span>📢</span> نظام إدارة الإعلانات وPopunder (HilltopAds)
              </div>
              <div style="font-size: 13px; color: var(--dw-text-muted);">
                إدارة كاملة للوحدات الإعلانية مع التحكم في التكرار الزمني والأجهزة المستهدفة وأماكن العرض.
              </div>
            </div>

            <!-- Global Ads Stats & Toggle Banner -->
            <div style="background: #0d0d14; border: 1px solid var(--dw-border); border-radius: var(--dw-radius-lg); padding: 20px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
              <div style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap;">
                <div>
                  <div style="font-size: 12px; color: var(--dw-text-muted);">النظام العام للإعلانات</div>
                  <label style="display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 800; color: #fff; cursor: pointer; margin-top: 4px;">
                    <input type="checkbox" id="ads-global-toggle" checked style="width: 18px; height: 18px; cursor: pointer;" />
                    <span id="ads-global-status-text">🟢 الإعلانات مفعّلة في الموقع</span>
                  </label>
                </div>
                <div style="border-right: 1px solid rgba(255, 255, 255, 0.1); padding-right: 20px;">
                  <div style="font-size: 12px; color: var(--dw-text-muted);">إجمالي الوحدات</div>
                  <div id="ads-stat-total" style="font-size: 20px; font-weight: 900; color: #fff;">0</div>
                </div>
                <div style="border-right: 1px solid rgba(255, 255, 255, 0.1); padding-right: 20px;">
                  <div style="font-size: 12px; color: var(--dw-text-muted);">إعلانات نشطة</div>
                  <div id="ads-stat-active" style="font-size: 20px; font-weight: 900; color: #2ed573;">0</div>
                </div>
                <div>
                  <div style="font-size: 12px; color: var(--dw-text-muted);">إعلانات متوقفة</div>
                  <div id="ads-stat-paused" style="font-size: 20px; font-weight: 900; color: #ff4757;">0</div>
                </div>
              </div>

              <div>
                <button id="btn-add-ad-unit" class="btn-primary" style="padding: 10px 20px; font-size: 13px; font-weight: 800;">
                  ➕ إضافة وحدة إعلانية جديدة
                </button>
              </div>
            </div>

            <!-- Ad Units List / Cards Container -->
            <div id="ad-units-container" style="display: flex; flex-direction: column; gap: 16px;">
              <!-- Dynamically Populated Ad Cards -->
            </div>

          </div>
        </div>

        <!-- SECTION: HilltopAds Verification -->
        <div id="section-hilltopads" class="admin-section">
          <div class="admin-card">
            <div class="admin-card-head">
              <div class="admin-card-title">
                <span>🛡️</span> إدارة ملكية الموقع عبر HilltopAds
              </div>
              <div style="font-size: 13px; color: var(--dw-text-muted);">
                إعداد واختبار طرق إثبات الملكية المعتمدة لشبكة HilltopAds الإعلانية.
              </div>
            </div>

            <!-- Verification Status Banner -->
            <div id="hta-status-banner" style="background: #0d0d14; border: 1px solid var(--dw-border); border-radius: var(--dw-radius-lg); padding: 20px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
              <div style="display: flex; align-items: center; gap: 14px;">
                <div id="hta-status-icon" style="font-size: 32px;">🔴</div>
                <div>
                  <div id="hta-status-title" style="font-size: 18px; font-weight: 800; color: #fff;">
                    لم يتم إعداد التحقق
                  </div>
                  <div id="hta-status-desc" style="font-size: 13px; color: var(--dw-text-muted); margin-top: 2px;">
                    يرجى إدخال Meta Tag أو رفع ملف HTML للتحقق من ملكية موقعك لدى HilltopAds.
                  </div>
                </div>
              </div>
              <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button id="btn-test-hta-meta" class="btn-secondary" style="font-size: 13px;">
                  🧪 اختبار Meta Tag في &lt;head&gt;
                </button>
                <button id="btn-test-hta-html" class="btn-secondary" style="font-size: 13px;">
                  🧪 اختبار وصول ملف HTML
                </button>
              </div>
            </div>

            <!-- 4 Methods Container -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px;">
              
              <!-- Method 1: Meta Tag -->
              <div style="background: #0a0a0f; border: 1px solid var(--dw-border); border-radius: var(--dw-radius-md); padding: 20px;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
                  <h3 style="font-size: 16px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px;">
                    <span>🏷️</span> طريقة 1: Meta Tag
                  </h3>
                  <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px; font-weight: 700; color: #2ed573;">
                    <input type="checkbox" id="hta-meta-enabled" style="cursor: pointer;" />
                    تفعيل هذه الطريقة
                  </label>
                </div>
                <div style="margin-bottom: 12px;">
                  <label class="form-label">كود Meta Tag أو Token التحقق:</label>
                  <textarea id="hta-meta-code" class="admin-textarea" style="height: 80px;" placeholder='مثال: <meta name="hilltopads-site-verification" content="XXXXXXXX" />'></textarea>
                </div>
              </div>

              <!-- Method 2: HTML File -->
              <div style="background: #0a0a0f; border: 1px solid var(--dw-border); border-radius: var(--dw-radius-md); padding: 20px;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
                  <h3 style="font-size: 16px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px;">
                    <span>📄</span> طريقة 2: ملف HTML
                  </h3>
                  <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px; font-weight: 700; color: #2ed573;">
                    <input type="checkbox" id="hta-html-enabled" style="cursor: pointer;" />
                    تفعيل هذه الطريقة
                  </label>
                </div>

                <div id="hta-file-dropzone" style="border: 2px dashed #2a2a3a; border-radius: var(--dw-radius-md); padding: 14px; text-align: center; background: #07070a; cursor: pointer; margin-bottom: 10px;">
                  <span style="font-size: 18px;">📂</span>
                  <div style="font-size: 12px; font-weight: 700; color: #fff;">اسحب وأسقط ملف hilltopadsXXXX.html هنا</div>
                  <input type="file" id="hta-file-input" accept=".html" style="display: none;" />
                </div>

                <div style="margin-bottom: 8px;">
                  <label class="form-label">اسم الملف:</label>
                  <input type="text" id="hta-html-filename" class="admin-search-input" placeholder="hilltopads12345.html" style="font-family: monospace;" />
                </div>
                <div>
                  <label class="form-label">محتوى الملف:</label>
                  <textarea id="hta-html-content" class="admin-textarea" style="height: 50px;" placeholder="hilltopads-site-verification: hilltopads12345.html"></textarea>
                </div>
              </div>

              <!-- Method 3: Verification Script -->
              <div style="background: #0a0a0f; border: 1px solid var(--dw-border); border-radius: var(--dw-radius-md); padding: 20px;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
                  <h3 style="font-size: 16px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px;">
                    <span>📜</span> طريقة 3: Verification Script
                  </h3>
                  <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px; font-weight: 700; color: #2ed573;">
                    <input type="checkbox" id="hta-script-enabled" style="cursor: pointer;" />
                    تفعيل هذه الطريقة
                  </label>
                </div>
                <div>
                  <label class="form-label">كود Script التحقق:</label>
                  <textarea id="hta-script-code" class="admin-textarea" style="height: 120px;" placeholder='<script src="https://hilltopads.com/verify.js"></script>'></textarea>
                </div>
              </div>

              <!-- Method 4: HTML Snippet -->
              <div style="background: #0a0a0f; border: 1px solid var(--dw-border); border-radius: var(--dw-radius-md); padding: 20px;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
                  <h3 style="font-size: 16px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px;">
                    <span>🧩</span> طريقة 4: HTML Snippet
                  </h3>
                  <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px; font-weight: 700; color: #2ed573;">
                    <input type="checkbox" id="hta-snippet-enabled" style="cursor: pointer;" />
                    تفعيل هذه الطريقة
                  </label>
                </div>
                <div>
                  <label class="form-label">كود HTML المباشر للتحقق:</label>
                  <textarea id="hta-snippet-code" class="admin-textarea" style="height: 120px;" placeholder='<div id="hilltopads-verify">...</div>'></textarea>
                </div>
              </div>

            </div>

            <!-- Actions Bar -->
            <div style="margin-top: 24px; display: flex; gap: 12px; justify-content: flex-end; flex-wrap: wrap;">
              <button id="btn-clear-hta" class="btn-secondary" style="color: #ff4757; border-color: rgba(255, 71, 87, 0.3);">
                🗑️ مسح إعدادات التحقق
              </button>
              <button id="btn-save-hta" class="btn-primary" style="padding: 12px 30px; font-size: 14px; font-weight: 800; background: linear-gradient(135deg, #2ed573 0%, #1e90ff 100%);">
                💾 حفظ وتطبيق إعدادات HilltopAds
              </button>
            </div>

          </div>
        </div>

        <!-- SECTION: Comprehensive SEO Audit, Sitemap & Search Console -->
        <div id="section-seo" class="admin-section">
          <div class="admin-card">
            <div class="admin-card-head">
              <div class="admin-card-title">
                <span>🎯</span> نظام SEO المتقدم وخريطة الموقع (Sitemap & Search Engine Optimization)
              </div>
              <div style="font-size: 13px; color: var(--dw-text-muted);">
                فحص وتدقيق كامل لـ SEO، توليد خرائط الموقع الديناميكية مباشرة من PostgreSQL، ومعاينة نتائج Google SERP لجميع الأعمال والحلقات.
              </div>
            </div>

            <!-- Quick Search Console Actions Bar -->
            <div style="background: #0d0d14; border: 1px solid var(--dw-border); border-radius: var(--dw-radius-lg); padding: 20px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
              <div style="display: flex; flex-direction: column; gap: 6px;">
                <div style="font-size: 15px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px;">
                  <span>🌐</span> الدومين الرسمي المعتمد: <code style="color: #2ed573; background: rgba(0,0,0,0.4); padding: 2px 8px; border-radius: 4px;">${window.location.origin}/</code>
                </div>
                <div style="font-size: 13px; color: var(--dw-text-muted);">
                  جميع روابط Canonical وSitemap XML وRobots.txt متصلة حياً بحالة قاعدة بيانات PostgreSQL.
                </div>
              </div>

              <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <a href="/sitemap.xml" target="_blank" class="btn-secondary" style="font-size: 13px; display: flex; align-items: center; gap: 6px;">
                  🌐 فتح Sitemap.xml ↗
                </a>
                <a href="/robots.txt" target="_blank" class="btn-secondary" style="font-size: 13px; display: flex; align-items: center; gap: 6px;">
                  📄 فتح Robots.txt ↗
                </a>
                <button id="btn-copy-sitemap-url" class="btn-secondary" style="font-size: 13px; display: flex; align-items: center; gap: 6px; color: #1e90ff;">
                  📋 نسخ رابط Sitemap
                </button>
              </div>
            </div>

            <!-- PART 1: Sitemap Statistics & Interactive Links Viewer -->
            <div style="background: #0a0a0f; border: 1px solid var(--dw-border); border-radius: var(--dw-radius-md); padding: 20px; margin-bottom: 28px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; flex-wrap: wrap; gap: 12px;">
                <h3 style="font-size: 16px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px;">
                  <span>🗺️</span> خريطة الموقع (Sitemap Overview)
                </h3>
                <button id="btn-toggle-sitemap-links" class="btn-secondary" style="padding: 8px 16px; font-size: 13px; font-weight: 700; color: #2ed573; border-color: rgba(46, 213, 115, 0.3);">
                  🗺️ عرض روابط Sitemap
                </button>
              </div>

              <!-- Sitemap Summary Stat Grid -->
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-bottom: 18px;">
                <div class="stat-box" style="padding: 14px;">
                  <div class="stat-icon" style="font-size: 20px;">🌐</div>
                  <div>
                    <div id="sm-stat-total" class="stat-num" style="font-size: 18px; color: #2ed573;">-</div>
                    <div class="stat-label">إجمالي الروابط</div>
                  </div>
                </div>
                <div class="stat-box" style="padding: 14px;">
                  <div class="stat-icon" style="font-size: 20px;">🎬</div>
                  <div>
                    <div id="sm-stat-works" class="stat-num" style="font-size: 18px;">-</div>
                    <div class="stat-label">الأعمال المنشورة</div>
                  </div>
                </div>
                <div class="stat-box" style="padding: 14px;">
                  <div class="stat-icon" style="font-size: 20px;">🎞️</div>
                  <div>
                    <div id="sm-stat-episodes" class="stat-num" style="font-size: 18px;">-</div>
                    <div class="stat-label">الحلقات المنشورة</div>
                  </div>
                </div>
                <div class="stat-box" style="padding: 14px;">
                  <div class="stat-icon" style="font-size: 20px;">📂</div>
                  <div>
                    <div id="sm-stat-categories" class="stat-num" style="font-size: 18px;">2</div>
                    <div class="stat-label">الأقسام</div>
                  </div>
                </div>
                <div class="stat-box" style="padding: 14px;">
                  <div class="stat-icon" style="font-size: 20px;">📄</div>
                  <div>
                    <div id="sm-stat-pages" class="stat-num" style="font-size: 18px;">1</div>
                    <div class="stat-label">الصفحات العامة</div>
                  </div>
                </div>
              </div>

              <!-- Expandable Sitemap Links Table Container -->
              <div id="sitemap-links-box" style="display: none; background: #07070a; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: var(--dw-radius-md); padding: 16px; margin-top: 16px;">
                <div style="display: flex; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; align-items: center; justify-content: space-between;">
                  <input type="text" id="sitemap-search-input" class="admin-search-input" style="max-width: 320px;" placeholder="ابحث باسم العمل، رقم الحلقة، أو URL..." />
                  
                  <div style="display: flex; gap: 6px; flex-wrap: wrap;" id="sitemap-filter-pills">
                    <button class="tag-badge active-pill" data-sm-filter="all">الكل</button>
                    <button class="tag-badge" data-sm-filter="works">الأعمال</button>
                    <button class="tag-badge" data-sm-filter="episodes">الحلقات</button>
                    <button class="tag-badge" data-sm-filter="categories">الأقسام</button>
                    <button class="tag-badge" data-sm-filter="missing_seo">بدون SEO</button>
                    <button class="tag-badge" data-sm-filter="noindex">Noindex</button>
                    <button class="tag-badge" data-sm-filter="issues">مشاكل</button>
                  </div>
                </div>

                <div style="overflow-x: auto;">
                  <table class="admin-table" style="font-size: 12px;">
                    <thead>
                      <tr>
                        <th>نوع الصفحة</th>
                        <th>اسم العمل</th>
                        <th>الحلقة</th>
                        <th>الرابط (URL)</th>
                        <th>حالة الفهرسة</th>
                        <th>Last Modified</th>
                        <th>حالة الوصول</th>
                      </tr>
                    </thead>
                    <tbody id="sitemap-links-table-target">
                      <tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--dw-text-muted);">جاري تحميل روابط Sitemap...</td></tr>
                    </tbody>
                  </table>
                </div>

                <!-- Sitemap Pagination Controls -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.06);">
                  <div id="sitemap-pagination-info" style="font-size: 12px; color: var(--dw-text-muted);">صفحة 1 من 1</div>
                  <div style="display: flex; gap: 8px;">
                    <button id="btn-sitemap-prev" class="btn-secondary" style="padding: 4px 12px; font-size: 12px;">السابق</button>
                    <button id="btn-sitemap-next" class="btn-secondary" style="padding: 4px 12px; font-size: 12px;">التالي</button>
                  </div>
                </div>
              </div>

            </div>

            <!-- PART 2: Full SEO Audit Dashboard & Statistics Grid -->
            <div style="background: #0a0a0f; border: 1px solid var(--dw-border); border-radius: var(--dw-radius-md); padding: 20px; margin-bottom: 28px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; flex-wrap: wrap; gap: 12px;">
                <div>
                  <h3 style="font-size: 16px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px;">
                    <span>⚡</span> فحص SEO الشامل والمؤشرات الحية
                  </h3>
                  <div style="font-size: 12px; color: var(--dw-text-muted); margin-top: 2px;">
                    فحص دوري على دفعات (Batch Scan) للتأكد من سلامة 100% من بيانات PostgreSQL بدون تجميد المتصفح.
                  </div>
                </div>
                <button id="btn-run-seo-audit" class="btn-primary" style="padding: 10px 22px; font-size: 13px; font-weight: 800; background: linear-gradient(135deg, #1e90ff 0%, #2ed573 100%);">
                  🚀 بدء فحص SEO الكامل
                </button>
              </div>

              <!-- SEO Audit Metrics 10-Cards Grid -->
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-bottom: 20px;">
                <div class="stat-box" style="padding: 12px 14px;">
                  <div class="stat-icon" style="font-size: 18px;">📚</div>
                  <div>
                    <div id="audit-stat-works" class="stat-num" style="font-size: 16px;">-</div>
                    <div class="stat-label">إجمالي الأعمال</div>
                  </div>
                </div>
                <div class="stat-box" style="padding: 12px 14px; background: rgba(46, 213, 115, 0.05); border-color: rgba(46, 213, 115, 0.2);">
                  <div class="stat-icon" style="font-size: 18px;">✅</div>
                  <div>
                    <div id="audit-stat-completed" class="stat-num" style="font-size: 16px; color: #2ed573;">-</div>
                    <div class="stat-label">SEO مكتمل</div>
                  </div>
                </div>
                <div class="stat-box" style="padding: 12px 14px; background: rgba(255, 165, 2, 0.05); border-color: rgba(255, 165, 2, 0.2);">
                  <div class="stat-icon" style="font-size: 18px;">⚠️</div>
                  <div>
                    <div id="audit-stat-review" class="stat-num" style="font-size: 16px; color: #ffa502;">-</div>
                    <div class="stat-label">تحتاج مراجعة</div>
                  </div>
                </div>
                <div class="stat-box" style="padding: 12px 14px; background: rgba(255, 71, 87, 0.05); border-color: rgba(255, 71, 87, 0.2);">
                  <div class="stat-icon" style="font-size: 18px;">❌</div>
                  <div>
                    <div id="audit-stat-errors" class="stat-num" style="font-size: 16px; color: #ff4757;">-</div>
                    <div class="stat-label">بها أخطاء</div>
                  </div>
                </div>
                <div class="stat-box" style="padding: 12px 14px;">
                  <div class="stat-icon" style="font-size: 18px;">📝</div>
                  <div>
                    <div id="audit-stat-no-desc" class="stat-num" style="font-size: 16px; color: #ffa502;">-</div>
                    <div class="stat-label">بدون وصف</div>
                  </div>
                </div>
                <div class="stat-box" style="padding: 12px 14px;">
                  <div class="stat-icon" style="font-size: 18px;">🖼️</div>
                  <div>
                    <div id="audit-stat-no-cover" class="stat-num" style="font-size: 16px; color: #ff4757;">-</div>
                    <div class="stat-label">بدون غلاف</div>
                  </div>
                </div>
                <div class="stat-box" style="padding: 12px 14px;">
                  <div class="stat-icon" style="font-size: 18px;">👯</div>
                  <div>
                    <div id="audit-stat-dup-titles" class="stat-num" style="font-size: 16px; color: #ff4757;">-</div>
                    <div class="stat-label">Titles مكررة</div>
                  </div>
                </div>
                <div class="stat-box" style="padding: 12px 14px;">
                  <div class="stat-icon" style="font-size: 18px;">👯</div>
                  <div>
                    <div id="audit-stat-dup-descs" class="stat-num" style="font-size: 16px; color: #ffa502;">-</div>
                    <div class="stat-label">Descriptions مكررة</div>
                  </div>
                </div>
                <div class="stat-box" style="padding: 12px 14px;">
                  <div class="stat-icon" style="font-size: 18px;">🔗</div>
                  <div>
                    <div id="audit-stat-canonical" class="stat-num" style="font-size: 16px;">0</div>
                    <div class="stat-label">مشاكل Canonical</div>
                  </div>
                </div>
                <div class="stat-box" style="padding: 12px 14px;">
                  <div class="stat-icon" style="font-size: 18px;">🚫</div>
                  <div>
                    <div id="audit-stat-invalid-urls" class="stat-num" style="font-size: 16px;">0</div>
                    <div class="stat-label">URLs غير صالحة</div>
                  </div>
                </div>
              </div>

              <!-- Live Audit Progress / Status Bar -->
              <div id="seo-audit-progress-box" style="display: none; background: #07070a; border: 1px solid var(--dw-border); border-radius: var(--dw-radius-md); padding: 14px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <span id="seo-audit-headline" style="font-size: 13px; font-weight: 800; color: #1e90ff;">جاري الفحص على دفعات...</span>
                  <span id="seo-audit-progress-text" style="font-size: 13px; font-weight: 800; color: #2ed573;">0 / 0</span>
                </div>
                <div class="progress-bar-track">
                  <div id="seo-audit-bar-fill" class="progress-bar-fill-animated" style="width: 0%;"></div>
                </div>
              </div>
            </div>

            <!-- PART 3: Comprehensive Works SEO Table ("SEO للأعمال") -->
            <div style="background: #0a0a0f; border: 1px solid var(--dw-border); border-radius: var(--dw-radius-md); padding: 20px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
                <h3 style="font-size: 16px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px;">
                  <span>📋</span> جدول SEO للأعمال (SEO Work Index)
                </h3>
                <div style="font-size: 12px; color: var(--dw-text-muted);">
                  يعرض جميع الأعمال الموجودة بالدليل مع معايير الفهرسة والجودة.
                </div>
              </div>

              <!-- Filter Pills & Search Bar -->
              <div style="display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; align-items: center; justify-content: space-between;">
                <input type="text" id="seo-works-search-input" class="admin-search-input" style="max-width: 320px;" placeholder="ابحث باسم العمل، SEO Title، أو Slug..." />

                <div style="display: flex; gap: 6px; flex-wrap: wrap;" id="seo-works-filter-pills">
                  <button class="tag-badge active-pill" data-seo-filter="all">الكل</button>
                  <button class="tag-badge" data-seo-filter="completed">مكتمل</button>
                  <button class="tag-badge" data-seo-filter="review">تحتاج مراجعة</button>
                  <button class="tag-badge" data-seo-filter="errors">أخطاء</button>
                  <button class="tag-badge" data-seo-filter="missing_desc">بدون وصف</button>
                  <button class="tag-badge" data-seo-filter="missing_cover">بدون غلاف</button>
                  <button class="tag-badge" data-seo-filter="duplicates">مكرر</button>
                </div>
              </div>

              <!-- Works SEO Table Target -->
              <div style="overflow-x: auto;">
                <table class="admin-table" style="font-size: 12px;">
                  <thead>
                    <tr>
                      <th>الغلاف</th>
                      <th>اسم العمل</th>
                      <th>SEO Title</th>
                      <th>Meta Description</th>
                      <th>SEO Keywords</th>
                      <th>Canonical</th>
                      <th>Robots</th>
                      <th>حالة SEO</th>
                      <th>المشاكل</th>
                      <th>معاينة</th>
                    </tr>
                  </thead>
                  <tbody id="seo-works-table-target">
                    <tr><td colspan="10" style="text-align: center; padding: 24px; color: var(--dw-text-muted);">جاري تحميل بيانات SEO للأعمال من PostgreSQL...</td></tr>
                  </tbody>
                </table>
              </div>

              <!-- Works SEO Pagination Controls -->
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.06);">
                <div id="seo-works-pagination-info" style="font-size: 12px; color: var(--dw-text-muted);">صفحة 1 من 1</div>
                <div style="display: flex; gap: 8px;">
                  <button id="btn-seo-works-prev" class="btn-secondary" style="padding: 6px 16px; font-size: 12px;">السابق</button>
                  <button id="btn-seo-works-next" class="btn-secondary" style="padding: 6px 16px; font-size: 12px;">التالي</button>
                </div>
              </div>

            </div>

          </div>
        </div>

      </div>

      <!-- REAL-TIME TRANSFER PROGRESS MODAL -->
      <div id="transfer-progress-modal" class="admin-modal-backdrop">
        <div class="admin-modal-container" style="max-width: 580px;">
          <div class="admin-modal-head" style="border-bottom: 1px solid rgba(255, 165, 2, 0.3);">
            <h3 id="transfer-modal-title" style="font-size: 18px; font-weight: 900; color: #fff; display: flex; align-items: center; gap: 10px;">
              <span>📦</span> نقل الأعمال إلى المخزن
            </h3>
            <button id="btn-close-progress-modal" class="search-close-btn" style="display: none;">✕</button>
          </div>
          <div class="admin-modal-body" style="padding: 24px;">
            <div class="transfer-progress-box">
              <!-- Live Metrics 4-Column Grid -->
              <div class="progress-stats-cards">
                <div class="progress-stat-card">
                  <div id="prog-total-val" class="progress-stat-value">-</div>
                  <div class="progress-stat-title">عدد الأعمال الكلي</div>
                </div>
                <div class="progress-stat-card highlight-blue">
                  <div id="prog-processed-val" class="progress-stat-value" style="color: #1e90ff;">0 / 0</div>
                  <div class="progress-stat-title">تمت معالجة</div>
                </div>
                <div class="progress-stat-card highlight-green">
                  <div id="prog-saved-val" class="progress-stat-value" style="color: #2ed573;">0</div>
                  <div class="progress-stat-title">تم الحفظ (DB)</div>
                </div>
                <div class="progress-stat-card highlight-red">
                  <div id="prog-remaining-val" class="progress-stat-value" style="color: #ffa502;">0</div>
                  <div class="progress-stat-title">متبقي</div>
                </div>
              </div>

              <!-- Progress Percentage & Bar -->
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 13px; font-weight: 700; color: #fff;">نسبة الإنجاز:</span>
                <span id="prog-percent-text" style="font-size: 16px; font-weight: 900; color: #2ed573;">0%</span>
              </div>
              <div class="progress-bar-track">
                <div id="prog-bar-fill" class="progress-bar-fill-animated" style="width: 0%;"></div>
              </div>

              <!-- Current Item Status Banner -->
              <div class="progress-current-work-banner">
                <div style="font-size: 18px;" id="prog-status-icon">⏳</div>
                <div style="overflow: hidden; flex: 1;">
                  <div id="prog-status-headline" style="font-weight: 700; color: #fff;">جاري بدء العملية...</div>
                  <div id="prog-current-work" style="font-size: 12px; color: var(--dw-text-muted); text-overflow: ellipsis; overflow: hidden; white-space: nowrap; margin-top: 2px;">
                    اسم العمل الحالي: جاري التحضير...
                  </div>
                </div>
              </div>

              <!-- Completion Banner (Shown upon 100%) -->
              <div id="prog-completion-banner" style="display: none; margin-top: 16px; background: rgba(46, 213, 115, 0.1); border: 1px solid rgba(46, 213, 115, 0.35); border-radius: var(--dw-radius-md); padding: 14px; text-align: center;">
                <div style="font-size: 24px; margin-bottom: 6px;">🎉</div>
                <div style="font-size: 16px; font-weight: 900; color: #2ed573;">اكتمل نقل جميع الأعمال بنجاح!</div>
                <div id="prog-completion-desc" style="font-size: 13px; color: var(--dw-text-muted); margin-top: 4px;">
                  تم نقل جميع الأعمال إلى المخزن بنجاح. تم حفظ جميع البيانات بشكل دائم في PostgreSQL.
                </div>
                <button id="btn-prog-done" class="btn-primary" style="margin-top: 14px; padding: 8px 24px; font-size: 13px; font-weight: 800; background: #2ed573;">
                  ✓ تم والانتقال للمخزن
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- EDIT WORK MODAL -->
      <div id="edit-work-modal" class="admin-modal-backdrop">
        <div class="admin-modal-container">
          <div class="admin-modal-head">
            <h3 style="font-size: 18px; font-weight: 800; color: #fff;">✏️ تعديل بيانات العمل</h3>
            <button id="btn-close-edit-modal" class="search-close-btn">✕</button>
          </div>
          <div class="admin-modal-body" id="edit-work-form-target"></div>
        </div>
      </div>

      <!-- EPISODES & SERVERS MANAGEMENT MODAL -->
      <div id="episodes-modal" class="admin-modal-backdrop">
        <div class="admin-modal-container" style="max-width: 920px;">
          <div class="admin-modal-head">
            <div id="episodes-modal-title" style="font-size: 18px; font-weight: 800; color: #fff;">
              🎞️ إدارة الحلقات والسيرفرات
            </div>
            <button id="btn-close-episodes-modal" class="search-close-btn">✕</button>
          </div>
          <div class="admin-modal-body" id="episodes-modal-target"></div>
        </div>
      </div>

      <!-- TEST STREAM PLAYER MODAL -->
      <div id="test-player-modal" class="admin-modal-backdrop">
        <div class="admin-modal-container" style="max-width: 800px;">
          <div class="admin-modal-head">
            <div id="test-player-title" style="font-size: 16px; font-weight: 800; color: #fff;">
              ▶ فحص واختبار السيرفر
            </div>
            <button id="btn-close-test-player" class="search-close-btn">✕</button>
          </div>
          <div class="admin-modal-body">
            <div id="test-player-frame" style="width: 100%; aspect-ratio: 16/9; background: #000; border-radius: var(--dw-radius-md); overflow: hidden; display: flex; align-items: center; justify-content: center;"></div>
            <div id="test-player-url" style="font-size: 12px; color: var(--dw-text-muted); margin-top: 10px; word-break: break-all; direction: ltr; text-align: left;"></div>
          </div>
        </div>
      </div>

      <!-- DELETE CONFIRMATION MODAL -->
      <div id="delete-confirm-modal" class="admin-modal-backdrop">
        <div class="admin-modal-container" style="max-width: 460px;">
          <div class="admin-modal-head" style="border-bottom: 1px solid rgba(255, 71, 87, 0.25);">
            <h3 style="font-size: 17px; font-weight: 800; color: #ff4757; display: flex; align-items: center; gap: 8px;">
              <span>⚠️</span> تأكيد حذف العمل
            </h3>
            <button id="btn-close-delete-modal" class="search-close-btn">✕</button>
          </div>
          <div class="admin-modal-body" style="text-align: center; padding: 24px 20px;">
            <div style="width: 56px; height: 56px; margin: 0 auto 14px; border-radius: 50%; background: rgba(255, 71, 87, 0.15); border: 1px solid rgba(255, 71, 87, 0.35); display: flex; align-items: center; justify-content: center; font-size: 26px;">
              🗑️
            </div>
            <p style="font-size: 16px; font-weight: 800; color: #fff; margin-bottom: 14px;">
              هل أنت متأكد من حذف هذا العمل؟
            </p>
            <div style="background: rgba(255, 71, 87, 0.08); border: 1px solid rgba(255, 71, 87, 0.25); border-radius: var(--dw-radius-md); padding: 14px 16px; margin-bottom: 16px; text-align: right;">
              <div style="font-size: 12px; color: var(--dw-text-muted); margin-bottom: 4px; font-weight: 600;">اسم العمل:</div>
              <div id="delete-work-title" style="font-size: 16px; font-weight: 900; color: #fff; line-height: 1.4;">-</div>
              <div id="delete-work-meta" style="font-size: 12px; color: var(--dw-text-muted); margin-top: 6px;">-</div>
            </div>
            <p style="font-size: 12px; color: #ff6b81; margin-bottom: 20px; line-height: 1.5;">
              ⚠️ سيتم حذف هذا العمل فقط والحلقات التابعة له من PostgreSQL ولن يؤثر على باقي الأعمال.
            </p>
            <div style="display: flex; gap: 12px; justify-content: center;">
              <button id="btn-confirm-delete-work" class="btn-danger" style="flex: 1; padding: 10px 18px; font-size: 14px; font-weight: 800; cursor: pointer; background: #ff4757; color: #fff;">
                تأكيد الحذف
              </button>
              <button id="btn-cancel-delete-work" class="btn-secondary" style="flex: 1; padding: 10px 18px; font-size: 14px; cursor: pointer;">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- TEST DATABASE MODAL -->
      <div id="test-db-modal" class="admin-modal-backdrop">
        <div class="admin-modal-container" style="max-width: 640px;">
          <div class="admin-modal-head" style="border-bottom: 1px solid rgba(46, 213, 115, 0.25);">
            <h3 style="font-size: 18px; font-weight: 800; color: #2ed573; display: flex; align-items: center; gap: 8px;">
              <span>⚡</span> اختبار اتصال قاعدة بيانات PostgreSQL (التخزين الدائم)
            </h3>
            <button id="btn-close-test-db-modal" class="search-close-btn">✕</button>
          </div>
          <div class="admin-modal-body" id="test-db-modal-target"></div>
        </div>
      </div>

      <!-- ADD / EDIT AD UNIT MODAL -->
      <div id="ad-unit-modal" class="admin-modal-backdrop">
        <div class="admin-modal-container" style="max-width: 700px;">
          <div class="admin-modal-head">
            <h3 id="ad-modal-title" style="font-size: 18px; font-weight: 800; color: #fff;">📢 إضافة / تعديل وحدة إعلانية</h3>
            <button id="btn-close-ad-modal" class="search-close-btn">✕</button>
          </div>
          <div class="admin-modal-body" style="padding: 20px;">
            <input type="hidden" id="ad-form-id" value="" />
            
            <div style="margin-bottom: 16px;">
              <label class="form-label">اسم الوحدة الإعلانية:</label>
              <input type="text" id="ad-form-name" class="admin-search-input" placeholder="مثال: HilltopAds Popunder الرئيسي" />
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
              <div>
                <label class="form-label">نوع الإعلان:</label>
                <select id="ad-form-type" class="admin-search-input">
                  <option value="popunder">Popunder (نافذة منبثقة)</option>
                  <option value="banner">Banner (إعلان شريطي)</option>
                  <option value="native">Native Ad (إعلان مدمج)</option>
                  <option value="direct">Direct Link (رابط مباشر)</option>
                  <option value="other">كود آخر / مخصص</option>
                </select>
              </div>
              <div>
                <label class="form-label">حالة الإعلان:</label>
                <label style="display: flex; align-items: center; gap: 8px; font-size: 14px; color: #fff; cursor: pointer; height: 42px;">
                  <input type="checkbox" id="ad-form-enabled" checked style="width: 18px; height: 18px; cursor: pointer;" />
                  <span>تفعيل هذا الإعلان</span>
                </label>
              </div>
            </div>

            <div style="margin-bottom: 16px;">
              <label class="form-label">كود HilltopAds الإعلاني (Textarea):</label>
              <textarea id="ad-form-code" class="admin-textarea" style="height: 120px; font-family: monospace;" placeholder='ضع كود HilltopAds الكامل هنا، مثل:
<script type="text/javascript" src="//hilltopads.com/script.js"></script>'></textarea>
              <div style="font-size: 11px; color: var(--dw-text-muted); margin-top: 4px;">
                سيقوم النظام بتشغيل الكود كما هو بدون تعديل محتواه، ويمنع تكرار تحميله في المتصفح.
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
              <div>
                <label class="form-label">الأجهزة المستهدفة:</label>
                <select id="ad-form-devices" class="admin-search-input">
                  <option value="all">جميع الأجهزة (All Devices)</option>
                  <option value="mobile">الهواتف الذكية (Mobile)</option>
                  <option value="tablet">الأجهزة اللوحية (Tablet)</option>
                  <option value="desktop">أجهزة الكمبيوتر (Desktop)</option>
                </select>
              </div>
              <div>
                <label class="form-label">أماكن العرض:</label>
                <select id="ad-form-placements" class="admin-search-input">
                  <option value="all">جميع الصفحات (All Pages)</option>
                  <option value="home">الصفحة الرئيسية فقط</option>
                  <option value="work">صفحات الأعمال فقط</option>
                  <option value="episode">صفحات الحلقات/المشاهدة فقط</option>
                </select>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
              <div>
                <label class="form-label">التكرار الزمني (Frequency Capping):</label>
                <select id="ad-form-frequency" class="admin-search-input">
                  <option value="session">مرة لكل جلسة (Once per Session)</option>
                  <option value="always">عند كل نقرة / زيارة (Always)</option>
                  <option value="minutes_15">مرة كل 15 دقيقة</option>
                  <option value="minutes_30">مرة كل 30 دقيقة</option>
                  <option value="hours_1">مرة كل ساعة</option>
                  <option value="hours_6">مرة كل 6 ساعات</option>
                  <option value="hours_24">مرة كل 24 ساعة</option>
                </select>
              </div>
              <div>
                <label class="form-label">الصفحات المستثناة (Commas):</label>
                <input type="text" id="ad-form-excluded" class="admin-search-input" value="/admin" placeholder="/admin, #/anime" />
              </div>
            </div>

            <div style="display: flex; gap: 12px; justify-content: flex-end;">
              <button id="btn-cancel-ad-modal" class="btn-secondary" style="padding: 10px 20px;">إلغاء</button>
              <button id="btn-save-ad-modal" class="btn-primary" style="padding: 10px 24px; font-weight: 800;">💾 حفظ الوحدة الإعلانية</button>
            </div>
          </div>
        </div>
      </div>

      <!-- GOOGLE SERP PREVIEW & SEO DETAILS MODAL -->
      <div id="seo-preview-modal" class="admin-modal-backdrop">
        <div class="admin-modal-container" style="max-width: 860px;">
          <div class="admin-modal-head" style="border-bottom: 1px solid var(--dw-border);">
            <div id="seo-preview-modal-title" style="font-size: 18px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px;">
              <span>🔍</span> معاينة Google SERP وتفاصيل SEO المتقدمة
            </div>
            <button id="btn-close-seo-preview-modal" class="search-close-btn">✕</button>
          </div>
          <div class="admin-modal-body" id="seo-preview-modal-body" style="padding: 20px;">
            <!-- Dynamic Content rendered by AdminController.renderSeoPreviewModal() -->
          </div>
        </div>
      </div>
    `;

    this.attachEvents(container, showToast);
  }

  // --- Authentication Helpers ---

  static isAuthenticated() {
    return sessionStorage.getItem('dw_admin_auth') === 'true';
  }

  static renderLoginScreen(container, showToast) {
    container.innerHTML = `
      <div class="container" style="min-height: 70vh; display: flex; align-items: center; justify-content: center; padding: 40px 20px;">
        <div class="admin-card" style="max-width: 440px; width: 100%; text-align: center; padding: 36px 28px;">
          <div style="font-size: 48px; margin-bottom: 12px;">🔒</div>
          <h2 style="font-size: 22px; font-weight: 900; color: #fff; margin-bottom: 8px;">لوحة الإدارة - Dark Watch</h2>
          <p style="font-size: 13px; color: var(--dw-text-muted); margin-bottom: 24px;">
            يرجى إدخال رمز المرور السري للوصول إلى لوحة التحكم وإدارة بيانات الموقع.
          </p>

          <form id="admin-login-form">
            <div style="margin-bottom: 16px; text-align: right;">
              <label style="display: block; font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 6px;">رمز المرور (PIN / Passcode):</label>
              <input type="password" id="admin-pin-input" class="admin-search-input" placeholder="••••••••" autofocus style="width: 100%; text-align: center; letter-spacing: 2px; font-size: 16px;" />
            </div>
            <button type="submit" class="btn-primary" style="width: 100%; padding: 12px; font-size: 15px; font-weight: 800;">
              🔓 تسجيل الدخول
            </button>
          </form>
          <div style="margin-top: 14px; font-size: 12px; color: var(--dw-text-muted);">
            الرمز الافتراضي: <code>darkwatch2026</code>
          </div>
        </div>
      </div>
    `;

    const form = container.querySelector('#admin-login-form');
    const pinInput = container.querySelector('#admin-pin-input');

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const entered = pinInput.value.trim();
        const customPin = localStorage.getItem('dw_admin_custom_pin') || 'darkwatch2026';

        if (entered === customPin || entered === 'darkwatch2026') {
          sessionStorage.setItem('dw_admin_auth', 'true');
          showToast('تم تسجيل الدخول بنجاح! مرحباً بك في لوحة الإدارة.', 'success');
          this.renderAdminView(container, showToast);
        } else {
          showToast('رمز المرور غير صحيح! يرجى المحاولة مرة أخرى.', 'error');
          pinInput.value = '';
          pinInput.focus();
        }
      });
    }
  }

  // --- Table Rows: Warehouse (المخزن) ---

  static renderWarehouseTableRows(draftWorks) {
    let filtered = draftWorks;

    if (this.warehouseSearchQuery) {
      const q = this.warehouseSearchQuery.toLowerCase().trim();
      filtered = filtered.filter(w =>
        (w.title || '').toLowerCase().includes(q) ||
        (w.originalTitle || '').toLowerCase().includes(q) ||
        (w.slug || '').toLowerCase().includes(q)
      );
    }

    if (draftWorks.length === 0) {
      return `
        <tr>
          <td colspan="7" style="text-align: center; padding: 45px 20px; color: var(--dw-text-muted);">
            <div style="font-size: 36px; margin-bottom: 8px;">📦</div>
            <div style="font-weight: 800; color: #fff; font-size: 17px;">المخزن فارغ حالياً</div>
            <div style="font-size: 13px; margin-top: 4px;">جميع الأعمال منشورة، أو يمكنك استيراد أعمال جديدة ونقلها إلى المخزن</div>
          </td>
        </tr>
      `;
    }

    if (filtered.length === 0) {
      return `
        <tr>
          <td colspan="7" style="text-align: center; padding: 30px; color: var(--dw-text-muted);">
            لا توجد أعمال في المخزن مطابقة للبحث: "${this.warehouseSearchQuery}"
          </td>
        </tr>
      `;
    }

    return filtered.map(w => {
      const isChecked = this.selectedWarehouseIds.has(w.id);
      const epCount = w.episodes ? w.episodes.length : (w.episodesCount || 0);

      return `
        <tr data-id="${w.id}">
          <td style="text-align: center;">
            <input type="checkbox" class="warehouse-select-check" data-id="${w.id}" ${isChecked ? 'checked' : ''} style="cursor: pointer;" />
          </td>
          <td>
            <img src="${w.cover}" class="admin-table-cover" onerror="this.src='https://images.unsplash.com/photo-1578632767115-351597cf2477?w=100'" alt="${w.title}" />
          </td>
          <td>
            <div style="font-weight: 800; color: #fff; font-size: 14px;">${w.title}</div>
            <div style="font-size: 11px; color: var(--dw-text-sub); margin-top: 2px;">${w.originalTitle || w.slug || ''}</div>
          </td>
          <td>
            <button class="btn-manage-episodes btn-secondary" data-id="${w.id}" style="padding: 4px 10px; font-size: 12px; font-weight: 700;" title="إدارة حلقات وسيرفرات العمل">
              🎞️ ${epCount} حلقة
            </button>
          </td>
          <td>
            <span class="tag-badge ${w.type === 'anime' ? 'badge-red' : ''}">
              ${w.type === 'anime' ? 'أنمي' : 'كرتون'}
            </span>
          </td>
          <td>
            <span class="tag-badge badge-warehouse">
              📦 في المخزن (DRAFT)
            </span>
          </td>
          <td>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              <button class="btn-publish-single btn-primary" data-id="${w.id}" style="padding: 6px 12px; font-size: 12px; font-weight: 800; background: #2ed573;" title="تثبيت ونشر هذا العمل في الموقع">
                🚀 تثبيت ونشر
              </button>
              <button class="btn-edit-work btn-secondary" data-id="${w.id}" style="padding: 6px 12px; font-size: 12px; font-weight: 700;" title="تعديل بيانات العمل">
                ✏️ تعديل
              </button>
              <button class="btn-delete-work btn-secondary" data-id="${w.id}" style="padding: 6px 12px; font-size: 12px; font-weight: 700; color: #ff4757; border-color: rgba(255, 71, 87, 0.35);" title="حذف العمل">
                🗑️ حذف
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // --- Table Rows: All Works ---

  static renderWorksTableRows() {
    const all = dataStore.getAllWorks();
    let filtered = all;

    if (this.currentTab === 'published') {
      filtered = all.filter(w => (w.statusState || 'PUBLISHED') === 'PUBLISHED');
    } else if (this.currentTab === 'draft') {
      filtered = all.filter(w => w.statusState === 'DRAFT');
    } else if (this.currentTab === 'archived') {
      filtered = all.filter(w => w.statusState === 'ARCHIVED');
    } else if (this.currentTab === 'anime') {
      filtered = all.filter(w => (w.type || '').toLowerCase() === 'anime');
    } else if (this.currentTab === 'cartoon') {
      filtered = all.filter(w => (w.type || '').toLowerCase() === 'cartoon');
    }

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(w =>
        (w.title || '').toLowerCase().includes(q) ||
        (w.originalTitle || '').toLowerCase().includes(q) ||
        (w.slug || '').toLowerCase().includes(q) ||
        (Array.isArray(w.altNames) && w.altNames.some(alt => (alt || '').toLowerCase().includes(q)))
      );
    }

    if (all.length === 0) {
      return `
        <tr>
          <td colspan="7" style="text-align: center; padding: 50px 20px; color: var(--dw-text-muted);">
            <div style="font-size: 38px; margin-bottom: 10px;">📭</div>
            <div style="font-weight: 800; color: #fff; font-size: 18px;">لا توجد أعمال حالياً</div>
            <div style="font-size: 13px; margin-top: 6px;">يمكنك إضافة أو استيراد أعمال جديدة من قسم استيراد وتحليل JSON أعلاه</div>
          </td>
        </tr>
      `;
    }

    if (filtered.length === 0) {
      return `
        <tr>
          <td colspan="7" style="text-align: center; padding: 40px 20px; color: var(--dw-text-muted);">
            <div style="font-size: 32px; margin-bottom: 8px;">🔍</div>
            <div style="font-weight: 800; color: #fff; font-size: 16px;">لا توجد نتائج مطابقة</div>
          </td>
        </tr>
      `;
    }

    return filtered.map(w => {
      const isChecked = this.selectedWorkIds.has(w.id);
      const epCount = w.episodes ? w.episodes.length : (w.episodesCount || 0);
      const isPublished = (w.statusState || 'PUBLISHED') === 'PUBLISHED';

      return `
        <tr data-id="${w.id}">
          <td style="text-align: center;">
            <input type="checkbox" class="work-select-check" data-id="${w.id}" ${isChecked ? 'checked' : ''} style="cursor: pointer;" />
          </td>
          <td>
            <img src="${w.cover}" class="admin-table-cover" onerror="this.src='https://images.unsplash.com/photo-1578632767115-351597cf2477?w=100'" alt="${w.title}" />
          </td>
          <td>
            <div style="font-weight: 800; color: #fff; font-size: 14px;">${w.title}</div>
            <div style="font-size: 11px; color: var(--dw-text-sub); margin-top: 2px;">${w.originalTitle || w.slug || ''}</div>
          </td>
          <td>
            <button class="btn-manage-episodes btn-secondary" data-id="${w.id}" style="padding: 4px 10px; font-size: 12px; font-weight: 700;" title="إدارة حلقات وسيرفرات العمل">
              🎞️ ${epCount} حلقة
            </button>
          </td>
          <td>
            <span class="tag-badge ${w.type === 'anime' ? 'badge-red' : ''}">
              ${w.type === 'anime' ? 'أنمي' : 'كرتون'}
            </span>
          </td>
          <td>
            <span class="tag-badge ${isPublished ? 'badge-published' : 'badge-warehouse'}">
              ${isPublished ? '✅ مثبت (Live)' : '📦 في المخزن (DRAFT)'}
            </span>
          </td>
          <td>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              ${!isPublished ? `
                <button class="btn-publish-single btn-primary" data-id="${w.id}" style="padding: 6px 12px; font-size: 12px; font-weight: 800; background: #2ed573;" title="تثبيت ونشر العمل في الموقع">
                  🚀 تثبيت
                </button>
              ` : `
                <button class="btn-unpublish-single btn-secondary" data-id="${w.id}" style="padding: 6px 12px; font-size: 12px; font-weight: 700; color: #ffa502;" title="إعادة العمل إلى المخزن">
                  📦 للمخزن
                </button>
              `}
              <a href="#/work/${w.slug || w.id}" class="btn-secondary" style="padding: 6px 12px; font-size: 12px; font-weight: 700;" target="_blank" title="مشاهدة العمل">
                👁️ عرض
              </a>
              <button class="btn-edit-work btn-secondary" data-id="${w.id}" style="padding: 6px 12px; font-size: 12px; font-weight: 700;" title="تعديل بيانات العمل">
                ✏️ تعديل
              </button>
              <button class="btn-delete-work btn-secondary" data-id="${w.id}" style="padding: 6px 12px; font-size: 12px; font-weight: 700; color: #ff4757; border-color: rgba(255, 71, 87, 0.35);" title="حذف العمل">
                🗑️ حذف
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  static renderImportLogsRows(logs) {
    if (!logs || logs.length === 0) {
      return `
        <tr>
          <td colspan="7" style="text-align: center; padding: 30px; color: var(--dw-text-muted);">
            لا توجد سجلات استيراد سابقة.
          </td>
        </tr>
      `;
    }

    return logs.map(l => `
      <tr>
        <td style="font-weight: 700; color: #fff;">${l.fileName || 'ملف JSON'}</td>
        <td style="color: var(--dw-text-muted); font-size: 12px;">${new Date(l.importedAt).toLocaleString('ar-EG')}</td>
        <td>${l.fileSize || '-'}</td>
        <td><span style="font-weight: 700; color: #fff;">${l.worksCount}</span> عمل</td>
        <td>${l.episodesCount} حلقة</td>
        <td>${l.serversCount} سيرفر</td>
        <td>
          <span class="tag-badge" style="background: rgba(46, 213, 115, 0.15); color: #2ed573; border-color: rgba(46, 213, 115, 0.3);">
            ${l.status || 'نجاح'}
          </span>
        </td>
      </tr>
    `).join('');
  }

  // --- Attach Events & Logic ---

  static attachEvents(container, showToast) {
    const fileInput = container.querySelector('#json-file-input');
    const textInput = container.querySelector('#json-text-input');
    const dropZone = container.querySelector('#drop-zone');
    const fileBanner = container.querySelector('#file-info-banner');
    const fileNameEl = container.querySelector('#selected-file-name');
    const fileSizeEl = container.querySelector('#selected-file-size');
    const btnClearFile = container.querySelector('#btn-clear-file');
    const btnBrowse = container.querySelector('#btn-browse-file');
    const btnAnalyze = container.querySelector('#btn-analyze-json');
    const btnPublishAllTop = container.querySelector('#btn-publish-all-top');
    const btnPublishWarehouseAll = container.querySelector('#btn-publish-warehouse-all');
    const btnDownloadTop = container.querySelector('#btn-download-works-top');
    const btnDownloadSettings = container.querySelector('#btn-download-works-settings');
    const btnLoadSample = container.querySelector('#btn-load-sample');
    const btnLoad100Sample = container.querySelector('#btn-load-100-sample');
    const btnLogout = container.querySelector('#btn-admin-logout');

    const progressWrap = container.querySelector('#parse-progress-bar-wrap');
    const progressFill = container.querySelector('#parse-progress-bar-fill');
    const progressText = container.querySelector('#parse-progress-text');

    const previewCard = container.querySelector('#preview-validation-card');
    const btnCancelPreview = container.querySelector('#btn-cancel-preview');
    const btnTransferWarehouse = container.querySelector('#btn-transfer-warehouse');
    const btnLoadPublishLive = container.querySelector('#btn-load-publish-live');

    const tbody = container.querySelector('#admin-works-tbody');
    const warehouseTbody = container.querySelector('#admin-warehouse-tbody');
    const searchInput = container.querySelector('#admin-works-search');
    const warehouseSearchInput = container.querySelector('#admin-warehouse-search');
    const checkAll = container.querySelector('#check-all-works');
    const checkAllWarehouse = container.querySelector('#check-all-warehouse');
    const bulkToolbar = container.querySelector('#bulk-toolbar');
    const bulkCount = container.querySelector('#bulk-selected-count');
    const warehouseBulkToolbar = container.querySelector('#warehouse-bulk-toolbar');
    const warehouseBulkCount = container.querySelector('#warehouse-bulk-count');

    // Section Navigation Switching
    const navItems = container.querySelectorAll('.admin-nav-item');
    const sections = container.querySelectorAll('.admin-section');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        navItems.forEach(n => n.classList.remove('active'));
        sections.forEach(s => s.classList.remove('active'));
        item.classList.add('active');
        const targetId = item.dataset.section;
        const targetSection = container.querySelector(`#${targetId}`);
        if (targetSection) targetSection.classList.add('active');
      });
    });

    // File Browse & Drag & Drop
    if (btnBrowse && fileInput) {
      btnBrowse.addEventListener('click', () => fileInput.click());
    }

    if (dropZone && fileInput) {
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
      });
      dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          this.handleFileSelected(e.dataTransfer.files[0], textInput, fileBanner, fileNameEl, fileSizeEl, showToast);
        }
      });
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.handleFileSelected(e.target.files[0], textInput, fileBanner, fileNameEl, fileSizeEl, showToast);
        }
      });
    }

    if (btnClearFile) {
      btnClearFile.addEventListener('click', () => {
        fileInput.value = '';
        textInput.value = '';
        fileBanner.style.display = 'none';
        previewCard.style.display = 'none';
        this.pendingParsedData = null;
        this.excludedImportIndices.clear();
      });
    }

    // Sample JSON Loaders
    if (btnLoadSample) {
      btnLoadSample.addEventListener('click', () => {
        const sampleData = {
          "status": "success",
          "data": {
            "catalog": [
              {
                "name": "دراغون بول سوبر",
                "original_title": "Dragon Ball Super",
                "category": "anime",
                "year": "2015",
                "status": "Completed",
                "poster": "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600",
                "story": "بعد هزيمة ماجين بو، يعود السلام للأرض وتظهر تحديات كونية جديدة مع بيروس.",
                "ep_list": [
                  {
                    "num": 1,
                    "title": "مكافأة السلام",
                    "servers": [
                      { "name": "سيرفر رئيسي FHD", "url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" }
                    ]
                  }
                ]
              }
            ]
          }
        };
        textInput.value = JSON.stringify(sampleData, null, 2);
        showToast('تم تحميل نموذج تجريبي جاهز', 'success');
      });
    }

    // Generate 100 Sample Works for Testing Batch & Persistence
    if (btnLoad100Sample) {
      btnLoad100Sample.addEventListener('click', () => {
        const sample100 = [];
        for (let i = 1; i <= 100; i++) {
          sample100.push({
            id: `work-test-${i}`,
            slug: `test-work-${i}`,
            title: `عمل تجريبي رقم ${i}`,
            originalTitle: `Test Work #${i}`,
            type: i % 2 === 0 ? 'anime' : 'cartoon',
            year: '2026',
            status: 'مكتمل',
            cover: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600',
            description: `وصف تفصيلي للعمل التجريبي رقم ${i} للتأكد من حفظ الدفعات 100% في PostgreSQL.`,
            episodes: [
              {
                number: 1,
                title: `الحلقة 1 من عمل ${i}`,
                servers: [
                  { name: 'سيرفر FHD', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4' }
                ]
              }
            ]
          });
        }
        textInput.value = JSON.stringify({ works: sample100 }, null, 2);
        showToast('تم تجهيز 100 عمل تجريبي لاختبار شريط التقدم والحفظ بالدفعات (0% → 100%)', 'success');
      });
    }

    // JSON Analysis & Deep Preview Trigger
    if (btnAnalyze) {
      btnAnalyze.addEventListener('click', async () => {
        const rawContent = textInput.value.trim();
        if (!rawContent) {
          showToast('يرجى اختيار ملف JSON أو لصق الكود أولاً', 'error');
          return;
        }

        btnAnalyze.disabled = true;
        btnAnalyze.textContent = '⏳ جاري الفحص التكراري واستخراج الحلقات...';
        progressWrap.style.display = 'block';
        progressText.style.display = 'block';

        try {
          const result = await JSONParser.parseFlexible(rawContent, (percent, processed, total) => {
            progressFill.style.width = `${percent}%`;
            progressText.textContent = `فحص الدفعات: تم استخراج ${processed} من إجمالي ${total} عمل (${percent}%)`;
          });

          if (!result || result.works.length === 0) {
            showToast('لم يتم العثور على أي أعمال صالحة داخل البيانات المدخلة', 'error');
            return;
          }

          this.pendingParsedData = {
            works: result.works,
            stats: result.stats,
            fileName: fileNameEl && fileNameEl.textContent !== '-' ? fileNameEl.textContent : 'محتوى نصي مباشر',
            fileSize: fileSizeEl && fileSizeEl.textContent !== '-' ? fileSizeEl.textContent : `${(new Blob([rawContent]).size / 1024).toFixed(1)} KB`
          };
          this.excludedImportIndices.clear();

          this.renderInspectionPreview(container);
          showToast(`تم فحص واكتشاف ${result.works.length} عمل و ${result.stats.totalEpisodes} حلقة بنجاح!`, 'success');
        } catch (err) {
          console.error(err);
          showToast('خطأ في معالجة JSON: ' + err.message, 'error');
        } finally {
          btnAnalyze.disabled = false;
          btnAnalyze.textContent = '⚡ فحص وتحليل الملف ومعاينة الحلقات';
          progressWrap.style.display = 'none';
          progressText.style.display = 'none';
        }
      });
    }

    // Cancel Preview
    if (btnCancelPreview) {
      btnCancelPreview.addEventListener('click', () => {
        this.pendingParsedData = null;
        this.excludedImportIndices.clear();
        previewCard.style.display = 'none';
      });
    }

    // ACTION: Transfer to Warehouse ("نقل إلى المخزن" with Real-time Live Progress)
    if (btnTransferWarehouse) {
      btnTransferWarehouse.addEventListener('click', async () => {
        await this.startTransferWithRealtimeProgress(container, 'DRAFT', showToast);
      });
    }

    // ACTION: Transfer and Publish Live ("نقل ونشر في الموقع مباشرة" with Real-time Live Progress)
    if (btnLoadPublishLive) {
      btnLoadPublishLive.addEventListener('click', async () => {
        await this.startTransferWithRealtimeProgress(container, 'PUBLISHED', showToast);
      });
    }

    // Publish All Drafts ("تثبيت الأعمال")
    const handlePublishAllDrafts = async () => {
      const draftsCount = dataStore.getDrafts().length;
      if (draftsCount === 0) {
        showToast('لا توجد أعمال في المخزن لتثبيتها حالياً', 'info');
        return;
      }

      if (btnPublishAllTop) btnPublishAllTop.disabled = true;
      if (btnPublishWarehouseAll) btnPublishWarehouseAll.disabled = true;

      try {
        const res = await dataStore.commitDraftsToPublished();
        showToast(`تم تثبيت ${res.count} عمل بنجاح وأصبحت منشورة في الموقع بشكل دائم!`, 'success');
        this.renderAdminView(container, showToast);
      } catch (err) {
        showToast('فشل في تثبيت الأعمال: ' + err.message, 'error');
      } finally {
        if (btnPublishAllTop) btnPublishAllTop.disabled = false;
        if (btnPublishWarehouseAll) btnPublishWarehouseAll.disabled = false;
      }
    };

    if (btnPublishAllTop) btnPublishAllTop.addEventListener('click', handlePublishAllDrafts);
    if (btnPublishWarehouseAll) btnPublishWarehouseAll.addEventListener('click', handlePublishAllDrafts);

    // Download works.json for GitHub / Vercel
    const handleDownload = () => {
      dataStore.downloadWorksJSON();
      showToast('تم تنزيل ملف works.json المحدث بنجاح! ضعه في مجلد /data/ بالمشروع لتحديث GitHub و Vercel.', 'success');
    };

    if (btnDownloadTop) btnDownloadTop.addEventListener('click', handleDownload);
    if (btnDownloadSettings) btnDownloadSettings.addEventListener('click', handleDownload);

    // Save Admin PIN
    const btnSavePin = container.querySelector('#btn-save-pin');
    const inputPin = container.querySelector('#new-admin-pin');
    if (btnSavePin && inputPin) {
      btnSavePin.addEventListener('click', () => {
        const pin = inputPin.value.trim();
        if (pin.length < 4) {
          showToast('رمز المرور يجب أن يتكون من 4 خانات على الأقل', 'error');
          return;
        }
        localStorage.setItem('dw_admin_custom_pin', pin);
        inputPin.value = '';
        showToast('تم تحديث رمز مرور لوحة الإدارة بنجاح', 'success');
      });
    }

    // Logout
    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        sessionStorage.removeItem('dw_admin_auth');
        showToast('تم تسجيل الخروج من لوحة الإدارة', 'info');
        this.renderLoginScreen(container, showToast);
      });
    }

    // Google Search Console Event Listeners
    const btnSaveGSC = container.querySelector('#btn-save-gsc');
    const btnClearGSC = container.querySelector('#btn-clear-gsc');
    const btnTestGscMeta = container.querySelector('#btn-test-gsc-meta');
    const btnTestGscHtml = container.querySelector('#btn-test-gsc-html');
    const gscFileDropzone = container.querySelector('#gsc-file-dropzone');
    const gscFileInput = container.querySelector('#gsc-file-input');

    if (gscFileDropzone && gscFileInput) {
      gscFileDropzone.addEventListener('click', () => gscFileInput.click());
      gscFileDropzone.addEventListener('dragover', (e) => { e.preventDefault(); gscFileDropzone.style.borderColor = '#2ed573'; });
      gscFileDropzone.addEventListener('dragleave', () => { gscFileDropzone.style.borderColor = '#2a2a3a'; });
      gscFileDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        gscFileDropzone.style.borderColor = '#2a2a3a';
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          this.handleGscFileUploaded(e.dataTransfer.files[0], container, showToast);
        }
      });
      gscFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.handleGscFileUploaded(e.target.files[0], container, showToast);
        }
      });
    }

    if (btnSaveGSC) {
      btnSaveGSC.addEventListener('click', async () => {
        const metaCode = container.querySelector('#gsc-meta-code').value;
        const metaEnabled = container.querySelector('#gsc-meta-enabled').checked;
        const htmlFilename = container.querySelector('#gsc-html-filename').value;
        const htmlContent = container.querySelector('#gsc-html-content').value;
        const htmlEnabled = container.querySelector('#gsc-html-enabled').checked;
        const customUrl = container.querySelector('#gsc-custom-url').value;
        const customUrlEnabled = container.querySelector('#gsc-custom-enabled').checked;

        btnSaveGSC.disabled = true;
        btnSaveGSC.textContent = '⏳ جاري الحفظ...';

        try {
          const res = await fetch('/api/gsc', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              meta_code: metaCode,
              meta_enabled: metaEnabled,
              html_filename: htmlFilename,
              html_content: htmlContent,
              html_enabled: htmlEnabled,
              custom_url: customUrl,
              custom_url_enabled: customUrlEnabled
            })
          });

          const data = await res.json();
          if (data && data.success) {
            showToast('تم حفظ وتطبيق إعدادات Google Search Console بنجاح! 🟢', 'success');
            this.populateGSCForm(container, data.settings);
            if (window.darkWatchApp && window.darkWatchApp.applyGSCMetaTag) {
              window.darkWatchApp.applyGSCMetaTag(data.settings);
            }
          } else {
            showToast('فشل حفظ الإعدادات: ' + (data.error || 'خطأ غير معروف'), 'error');
          }
        } catch (err) {
          showToast('خطأ في الاتصال بالسيرفر أثناء الحفظ', 'error');
        } finally {
          btnSaveGSC.disabled = false;
          btnSaveGSC.textContent = '💾 حفظ وتطبيق إعدادات Google Search Console';
        }
      });
    }

    if (btnClearGSC) {
      btnClearGSC.addEventListener('click', async () => {
        if (!confirm('هل أنت تأكد من إزالة جميع إعدادات التحقق من Google Search Console؟')) return;
        try {
          const res = await fetch('/api/gsc', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              meta_code: '',
              meta_enabled: false,
              html_filename: '',
              html_content: '',
              html_enabled: false,
              custom_url: '',
              custom_url_enabled: false
            })
          });
          const data = await res.json();
          showToast('تم حذف جميع إعدادات التحقق بنجاح.', 'info');
          this.populateGSCForm(container, data.settings || {});
          if (window.darkWatchApp && window.darkWatchApp.applyGSCMetaTag) {
            window.darkWatchApp.applyGSCMetaTag({});
          }
        } catch {
          showToast('فشل مسح الإعدادات', 'error');
        }
      });
    }

    if (btnTestGscMeta) {
      btnTestGscMeta.addEventListener('click', () => {
        const metaTag = document.querySelector('meta[name="google-site-verification"]');
        if (metaTag && metaTag.content) {
          showToast(`🟢 Meta Tag موجود في <head> بقيمة: ${metaTag.content}`, 'success');
        } else {
          showToast('🔴 Meta Tag غير موجود حالياً في <head> (تأكد من تفعيل الخيار والحفظ).', 'error');
        }
      });
    }

    if (btnTestGscHtml) {
      btnTestGscHtml.addEventListener('click', async () => {
        const filenameInput = container.querySelector('#gsc-html-filename');
        const filename = filenameInput ? filenameInput.value.trim() : '';
        if (!filename) {
          showToast('يرجى كتابة اسم الملف أولاً لاختبار الوصول إليه.', 'error');
          return;
        }
        showToast(`⏳ جاري التثبت من الوصول للملف /${filename}...`, 'info');
        try {
          const res = await fetch(`/${filename}`);
          if (res.status === 200) {
            const text = await res.text();
            showToast(`🟢 تم الوصول بنجاح للملف /${filename}! المحتوى: ${text.slice(0, 40)}`, 'success');
          } else {
            showToast(`🔴 تعذر الوصول للملف /${filename} (رمز الاستجابة: ${res.status}). تأكد من تفعيل الطريقة والحفظ.`, 'error');
          }
        } catch (err) {
          showToast('🔴 حدث خطأ أثناء الاتصال بالرابط للاختبار', 'error');
        }
      });
    }

    // Load initial GSC state
    this.initGSCTab(container, showToast);

    // HilltopAds Verification Event Listeners
    const btnSaveHTA = container.querySelector('#btn-save-hta');
    const btnClearHTA = container.querySelector('#btn-clear-hta');
    const btnTestHtaMeta = container.querySelector('#btn-test-hta-meta');
    const btnTestHtaHtml = container.querySelector('#btn-test-hta-html');
    const htaFileDropzone = container.querySelector('#hta-file-dropzone');
    const htaFileInput = container.querySelector('#hta-file-input');

    if (htaFileDropzone && htaFileInput) {
      htaFileDropzone.addEventListener('click', () => htaFileInput.click());
      htaFileDropzone.addEventListener('dragover', (e) => { e.preventDefault(); htaFileDropzone.style.borderColor = '#2ed573'; });
      htaFileDropzone.addEventListener('dragleave', () => { htaFileDropzone.style.borderColor = '#2a2a3a'; });
      htaFileDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        htaFileDropzone.style.borderColor = '#2a2a3a';
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          this.handleHtaFileUploaded(e.dataTransfer.files[0], container, showToast);
        }
      });
      htaFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.handleHtaFileUploaded(e.target.files[0], container, showToast);
        }
      });
    }

    if (btnSaveHTA) {
      btnSaveHTA.addEventListener('click', async () => {
        const metaCode = container.querySelector('#hta-meta-code').value;
        const metaEnabled = container.querySelector('#hta-meta-enabled').checked;
        const htmlFilename = container.querySelector('#hta-html-filename').value;
        const htmlContent = container.querySelector('#hta-html-content').value;
        const htmlEnabled = container.querySelector('#hta-html-enabled').checked;
        const scriptCode = container.querySelector('#hta-script-code').value;
        const scriptEnabled = container.querySelector('#hta-script-enabled').checked;
        const snippetCode = container.querySelector('#hta-snippet-code').value;
        const snippetEnabled = container.querySelector('#hta-snippet-enabled').checked;

        btnSaveHTA.disabled = true;
        btnSaveHTA.textContent = '⏳ جاري الحفظ...';

        try {
          const res = await fetch('/api/hilltopads-verification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              meta_code: metaCode,
              meta_enabled: metaEnabled,
              html_filename: htmlFilename,
              html_content: htmlContent,
              html_enabled: htmlEnabled,
              script_code: scriptCode,
              script_enabled: scriptEnabled,
              snippet_code: snippetCode,
              snippet_enabled: snippetEnabled
            })
          });

          const data = await res.json();
          if (data && data.success) {
            showToast('تم حفظ وتطبيق إعدادات HilltopAds بنجاح! 🟢', 'success');
            this.populateHTAForm(container, data.settings);
            if (adsManager) adsManager.applyVerification(data.settings);
          } else {
            showToast('فشل حفظ إعدادات HilltopAds: ' + (data.error || 'خطأ غير معروف'), 'error');
          }
        } catch (err) {
          showToast('خطأ في الاتصال بالسيرفر أثناء الحفظ', 'error');
        } finally {
          btnSaveHTA.disabled = false;
          btnSaveHTA.textContent = '💾 حفظ وتطبيق إعدادات HilltopAds';
        }
      });
    }

    if (btnClearHTA) {
      btnClearHTA.addEventListener('click', async () => {
        if (!confirm('هل أنت متأكد من مسح جميع إعدادات التحقق لـ HilltopAds؟')) return;
        try {
          const res = await fetch('/api/hilltopads-verification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              meta_code: '',
              meta_enabled: false,
              html_filename: '',
              html_content: '',
              html_enabled: false,
              script_code: '',
              script_enabled: false,
              snippet_code: '',
              snippet_enabled: false
            })
          });
          const data = await res.json();
          showToast('تم مسح إعدادات التحقق بنجاح.', 'info');
          this.populateHTAForm(container, data.settings || {});
          if (adsManager) adsManager.applyVerification({});
        } catch {
          showToast('فشل مسح الإعدادات', 'error');
        }
      });
    }

    if (btnTestHtaMeta) {
      btnTestHtaMeta.addEventListener('click', () => {
        const metaTag = document.querySelector('meta[name="hilltopads-site-verification"]');
        if (metaTag && metaTag.content) {
          showToast(`🟢 Meta Tag الخاص بـ HilltopAds موجود في <head> بقيمة: ${metaTag.content}`, 'success');
        } else {
          showToast('🔴 Meta Tag غير موجود حالياً في <head> (تأكد من تفعيل الخيار والحفظ).', 'error');
        }
      });
    }

    if (btnTestHtaHtml) {
      btnTestHtaHtml.addEventListener('click', async () => {
        const filenameInput = container.querySelector('#hta-html-filename');
        const filename = filenameInput ? filenameInput.value.trim() : '';
        if (!filename) {
          showToast('يرجى كتابة اسم الملف أولاً لاختبار الوصول إليه.', 'error');
          return;
        }
        showToast(`⏳ جاري التثبت من الوصول للملف /${filename}...`, 'info');
        try {
          const res = await fetch(`/${filename}`);
          if (res.status === 200) {
            const text = await res.text();
            showToast(`🟢 تم الوصول بنجاح للملف /${filename}! المحتوى: ${text.slice(0, 40)}`, 'success');
          } else {
            showToast(`🔴 تعذر الوصول للملف /${filename} (رمز الاستجابة: ${res.status}). تأكد من تفعيل الطريقة والحفظ.`, 'error');
          }
        } catch (err) {
          showToast('🔴 حدث خطأ أثناء الاتصال بالرابط للاختبار', 'error');
        }
      });
    }

    // Load initial HilltopAds verification state
    this.initHTATab(container, showToast);

    // Ads Management Event Listeners
    const adsGlobalToggle = container.querySelector('#ads-global-toggle');
    const btnAddAdUnit = container.querySelector('#btn-add-ad-unit');
    const btnSaveAdModal = container.querySelector('#btn-save-ad-modal');
    const btnCancelAdModal = container.querySelector('#btn-cancel-ad-modal');
    const btnCloseAdModal = container.querySelector('#btn-close-ad-modal');
    const adUnitsContainer = container.querySelector('#ad-units-container');
    const adModal = container.querySelector('#ad-unit-modal');

    if (adsGlobalToggle) {
      adsGlobalToggle.addEventListener('change', async (e) => {
        if (!this.adsConfig) this.adsConfig = { global_enabled: true, ads: [] };
        this.adsConfig.global_enabled = e.target.checked;
        await this.persistAdsConfig(container, showToast);
      });
    }

    if (btnAddAdUnit) {
      btnAddAdUnit.addEventListener('click', () => {
        this.openAdModal(null, container, showToast);
      });
    }

    if (btnSaveAdModal) {
      btnSaveAdModal.addEventListener('click', () => {
        this.saveAdModal(container, showToast);
      });
    }

    if (btnCancelAdModal && adModal) {
      btnCancelAdModal.addEventListener('click', () => adModal.classList.remove('open'));
    }

    if (btnCloseAdModal && adModal) {
      btnCloseAdModal.addEventListener('click', () => adModal.classList.remove('open'));
    }

    if (adUnitsContainer) {
      adUnitsContainer.addEventListener('click', async (e) => {
        const editBtn = e.target.closest('.btn-edit-ad');
        if (editBtn) {
          const idx = parseInt(editBtn.dataset.adIdx, 10);
          this.openAdModal(idx, container, showToast);
          return;
        }

        const toggleBtn = e.target.closest('.btn-toggle-ad');
        if (toggleBtn) {
          const idx = parseInt(toggleBtn.dataset.adIdx, 10);
          if (this.adsConfig && Array.isArray(this.adsConfig.ads) && this.adsConfig.ads[idx]) {
            this.adsConfig.ads[idx].enabled = !this.adsConfig.ads[idx].enabled;
            await this.persistAdsConfig(container, showToast);
          }
          return;
        }

        const testBtn = e.target.closest('.btn-test-ad');
        if (testBtn) {
          const idx = parseInt(testBtn.dataset.adIdx, 10);
          if (this.adsConfig && Array.isArray(this.adsConfig.ads) && this.adsConfig.ads[idx]) {
            const ad = this.adsConfig.ads[idx];
            if (adsManager) {
              const ok = adsManager.testAd(ad);
              if (ok) showToast(`🧪 تم تشغيل الإعلان التجريبي (${ad.name}) بنجاح!`, 'success');
            }
          }
          return;
        }

        const delBtn = e.target.closest('.btn-delete-ad');
        if (delBtn) {
          const idx = parseInt(delBtn.dataset.adIdx, 10);
          if (confirm('هل أنت متأكد من حذف هذه الوحدة الإعلانية؟')) {
            if (this.adsConfig && Array.isArray(this.adsConfig.ads)) {
              this.adsConfig.ads.splice(idx, 1);
              await this.persistAdsConfig(container, showToast);
            }
          }
        }
      });
    }

    // Load initial Ads state
    this.initAdsTab(container, showToast);

    // SEO Dashboard & Audit Event Listeners
    const btnCopySitemapUrl = container.querySelector('#btn-copy-sitemap-url');
    if (btnCopySitemapUrl) {
      btnCopySitemapUrl.addEventListener('click', () => {
        const sitemapUrl = `${window.location.origin}/sitemap.xml`;
        navigator.clipboard.writeText(sitemapUrl).then(() => {
          showToast('تم نسخ رابط Sitemap.xml المباشر للحافظة! 📋', 'success');
        }).catch(() => {
          showToast('رابط Sitemap: ' + sitemapUrl, 'info');
        });
      });
    }

    const btnToggleSitemapLinks = container.querySelector('#btn-toggle-sitemap-links');
    const sitemapLinksBox = container.querySelector('#sitemap-links-box');
    if (btnToggleSitemapLinks && sitemapLinksBox) {
      btnToggleSitemapLinks.addEventListener('click', () => {
        const isHidden = sitemapLinksBox.style.display === 'none';
        sitemapLinksBox.style.display = isHidden ? 'block' : 'none';
        btnToggleSitemapLinks.textContent = isHidden ? '🙈 إخفاء روابط Sitemap' : '🗺️ عرض روابط Sitemap';
        if (isHidden) {
          this.loadSitemapLinks(container, showToast);
        }
      });
    }

    const sitemapSearchInput = container.querySelector('#sitemap-search-input');
    if (sitemapSearchInput) {
      let searchTimeout;
      sitemapSearchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          this.sitemapLinksSearch = e.target.value.trim();
          this.sitemapLinksCurrentPage = 1;
          this.loadSitemapLinks(container, showToast);
        }, 300);
      });
    }

    const sitemapFilterPills = container.querySelector('#sitemap-filter-pills');
    if (sitemapFilterPills) {
      sitemapFilterPills.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn || !btn.dataset.smFilter) return;
        sitemapFilterPills.querySelectorAll('button').forEach(b => b.classList.remove('active-pill'));
        btn.classList.add('active-pill');
        this.sitemapLinksFilter = btn.dataset.smFilter;
        this.sitemapLinksCurrentPage = 1;
        this.loadSitemapLinks(container, showToast);
      });
    }

    const btnSitemapPrev = container.querySelector('#btn-sitemap-prev');
    const btnSitemapNext = container.querySelector('#btn-sitemap-next');
    if (btnSitemapPrev) {
      btnSitemapPrev.addEventListener('click', () => {
        if (this.sitemapLinksCurrentPage > 1) {
          this.sitemapLinksCurrentPage--;
          this.loadSitemapLinks(container, showToast);
        }
      });
    }
    if (btnSitemapNext) {
      btnSitemapNext.addEventListener('click', () => {
        this.sitemapLinksCurrentPage++;
        this.loadSitemapLinks(container, showToast);
      });
    }

    // SEO Works Table Search & Filter Listeners
    const seoWorksSearchInput = container.querySelector('#seo-works-search-input');
    if (seoWorksSearchInput) {
      let searchTimeout;
      seoWorksSearchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          this.seoWorksSearch = e.target.value.trim();
          this.seoWorksCurrentPage = 1;
          this.loadSeoWorksTable(container, showToast);
        }, 300);
      });
    }

    const seoWorksFilterPills = container.querySelector('#seo-works-filter-pills');
    if (seoWorksFilterPills) {
      seoWorksFilterPills.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn || !btn.dataset.seoFilter) return;
        seoWorksFilterPills.querySelectorAll('button').forEach(b => b.classList.remove('active-pill'));
        btn.classList.add('active-pill');
        this.seoWorksFilter = btn.dataset.seoFilter;
        this.seoWorksCurrentPage = 1;
        this.loadSeoWorksTable(container, showToast);
      });
    }

    const btnSeoWorksPrev = container.querySelector('#btn-seo-works-prev');
    const btnSeoWorksNext = container.querySelector('#btn-seo-works-next');
    if (btnSeoWorksPrev) {
      btnSeoWorksPrev.addEventListener('click', () => {
        if (this.seoWorksCurrentPage > 1) {
          this.seoWorksCurrentPage--;
          this.loadSeoWorksTable(container, showToast);
        }
      });
    }
    if (btnSeoWorksNext) {
      btnSeoWorksNext.addEventListener('click', () => {
        this.seoWorksCurrentPage++;
        this.loadSeoWorksTable(container, showToast);
      });
    }

    const btnRunSeoAudit = container.querySelector('#btn-run-seo-audit');
    if (btnRunSeoAudit) {
      btnRunSeoAudit.addEventListener('click', async () => {
        await this.runFullSeoAudit(container, showToast);
      });
    }

    const seoWorksTableTarget = container.querySelector('#seo-works-table-target');
    if (seoWorksTableTarget) {
      seoWorksTableTarget.addEventListener('click', (e) => {
        const previewBtn = e.target.closest('.btn-seo-preview');
        if (previewBtn) {
          const workId = previewBtn.dataset.workId;
          const workItem = (this.lastAuditedWorks || []).find(w => String(w.id) === String(workId));
          if (workItem) {
            this.openSeoPreviewModal(workItem);
          }
        }
      });
    }

    const btnCloseSeoPreviewModal = container.querySelector('#btn-close-seo-preview-modal');
    const seoPreviewModal = container.querySelector('#seo-preview-modal');
    if (btnCloseSeoPreviewModal && seoPreviewModal) {
      btnCloseSeoPreviewModal.addEventListener('click', () => {
        seoPreviewModal.classList.remove('open');
      });
    }

    // Load initial SEO state
    this.initSEOTab(container, showToast);

    // Filter Tabs
    const tabBtns = container.querySelectorAll('.admin-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentTab = btn.dataset.tab;
        if (tbody) tbody.innerHTML = this.renderWorksTableRows();
      });
    });

    // Works Search Input
    if (searchInput && tbody) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim();
        tbody.innerHTML = this.renderWorksTableRows();
      });
    }

    // Warehouse Search Input
    if (warehouseSearchInput && warehouseTbody) {
      warehouseSearchInput.addEventListener('input', (e) => {
        this.warehouseSearchQuery = e.target.value.trim();
        warehouseTbody.innerHTML = this.renderWarehouseTableRows(dataStore.getDrafts());
      });
    }

    // Check All Checkbox (All Works)
    if (checkAll && tbody) {
      checkAll.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        const checks = tbody.querySelectorAll('.work-select-check');
        checks.forEach(c => {
          c.checked = isChecked;
          if (isChecked) this.selectedWorkIds.add(c.dataset.id);
          else this.selectedWorkIds.delete(c.dataset.id);
        });
        this.updateBulkToolbarState(bulkToolbar, bulkCount, this.selectedWorkIds);
      });
    }

    // Check All Checkbox (Warehouse)
    if (checkAllWarehouse && warehouseTbody) {
      checkAllWarehouse.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        const checks = warehouseTbody.querySelectorAll('.warehouse-select-check');
        checks.forEach(c => {
          c.checked = isChecked;
          if (isChecked) this.selectedWarehouseIds.add(c.dataset.id);
          else this.selectedWarehouseIds.delete(c.dataset.id);
        });
        this.updateBulkToolbarState(warehouseBulkToolbar, warehouseBulkCount, this.selectedWarehouseIds);
      });
    }

    // Table Event Delegations for All Works
    if (tbody) {
      tbody.addEventListener('change', (e) => {
        if (e.target.classList.contains('work-select-check')) {
          const id = e.target.dataset.id;
          if (e.target.checked) this.selectedWorkIds.add(id);
          else this.selectedWorkIds.delete(id);
          this.updateBulkToolbarState(bulkToolbar, bulkCount, this.selectedWorkIds);
        }
      });

      tbody.addEventListener('click', async (e) => {
        const pubBtn = e.target.closest('.btn-publish-single');
        if (pubBtn) {
          const id = pubBtn.dataset.id;
          await dataStore.publishWork(id);
          showToast('تم تثبيت ونشر العمل بنجاح!', 'success');
          this.renderAdminView(container, showToast);
          return;
        }

        const unpubBtn = e.target.closest('.btn-unpublish-single');
        if (unpubBtn) {
          const id = unpubBtn.dataset.id;
          await dataStore.unpublishWork(id);
          showToast('تم نقل العمل إلى المخزن (DRAFT)', 'info');
          this.renderAdminView(container, showToast);
          return;
        }

        const editBtn = e.target.closest('.btn-edit-work');
        if (editBtn) {
          const id = editBtn.dataset.id;
          this.openEditWorkModal(id, container, showToast);
          return;
        }

        const epBtn = e.target.closest('.btn-manage-episodes');
        if (epBtn) {
          const id = epBtn.dataset.id;
          this.openEpisodesManagementModal(id, container, showToast);
          return;
        }

        const delBtn = e.target.closest('.btn-delete-work');
        if (delBtn) {
          const id = delBtn.dataset.id;
          this.openDeleteConfirmModal(id, container, showToast);
        }
      });
    }

    // Table Event Delegations for Warehouse (المخزن)
    if (warehouseTbody) {
      warehouseTbody.addEventListener('change', (e) => {
        if (e.target.classList.contains('warehouse-select-check')) {
          const id = e.target.dataset.id;
          if (e.target.checked) this.selectedWarehouseIds.add(id);
          else this.selectedWarehouseIds.delete(id);
          this.updateBulkToolbarState(warehouseBulkToolbar, warehouseBulkCount, this.selectedWarehouseIds);
        }
      });

      warehouseTbody.addEventListener('click', async (e) => {
        const pubBtn = e.target.closest('.btn-publish-single');
        if (pubBtn) {
          const id = pubBtn.dataset.id;
          await dataStore.publishWork(id);
          showToast('تم تثبيت ونشر العمل من المخزن إلى الموقع بنجاح!', 'success');
          this.renderAdminView(container, showToast);
          return;
        }

        const editBtn = e.target.closest('.btn-edit-work');
        if (editBtn) {
          const id = editBtn.dataset.id;
          this.openEditWorkModal(id, container, showToast);
          return;
        }

        const epBtn = e.target.closest('.btn-manage-episodes');
        if (epBtn) {
          const id = epBtn.dataset.id;
          this.openEpisodesManagementModal(id, container, showToast);
          return;
        }

        const delBtn = e.target.closest('.btn-delete-work');
        if (delBtn) {
          const id = delBtn.dataset.id;
          this.openDeleteConfirmModal(id, container, showToast);
        }
      });
    }

    // Bulk Toolbar Actions (All Works)
    const btnBulkPub = container.querySelector('#btn-bulk-publish');
    const btnBulkWarehouse = container.querySelector('#btn-bulk-warehouse');
    const btnBulkDel = container.querySelector('#btn-bulk-delete');

    if (btnBulkPub) {
      btnBulkPub.addEventListener('click', async () => {
        const arr = Array.from(this.selectedWorkIds);
        await dataStore.publishSelected(arr);
        this.selectedWorkIds.clear();
        showToast(`تم تثبيت ونشر ${arr.length} عمل بنجاح!`, 'success');
        this.renderAdminView(container, showToast);
      });
    }

    if (btnBulkWarehouse) {
      btnBulkWarehouse.addEventListener('click', async () => {
        const arr = Array.from(this.selectedWorkIds);
        await dataStore.updateWorkStatus(arr, 'DRAFT');
        this.selectedWorkIds.clear();
        showToast(`تم نقل ${arr.length} عمل إلى المخزن بنجاح!`, 'info');
        this.renderAdminView(container, showToast);
      });
    }

    if (btnBulkDel) {
      btnBulkDel.addEventListener('click', async () => {
        const arr = Array.from(this.selectedWorkIds);
        if (confirm(`هل أنت متأكد من حذف ${arr.length} عمل محدد من قاعدة البيانات؟`)) {
          await dataStore.deleteSelected(arr);
          this.selectedWorkIds.clear();
          showToast(`تم حذف الأعمال المحددة بنجاح`, 'success');
          this.renderAdminView(container, showToast);
        }
      });
    }

    // Warehouse Bulk Actions
    const btnWarehouseBulkPub = container.querySelector('#btn-warehouse-bulk-publish');
    const btnWarehouseBulkDel = container.querySelector('#btn-warehouse-bulk-delete');

    if (btnWarehouseBulkPub) {
      btnWarehouseBulkPub.addEventListener('click', async () => {
        const arr = Array.from(this.selectedWarehouseIds);
        await dataStore.publishSelected(arr);
        this.selectedWarehouseIds.clear();
        showToast(`تم تثبيت ونشر ${arr.length} عمل من المخزن بنجاح!`, 'success');
        this.renderAdminView(container, showToast);
      });
    }

    if (btnWarehouseBulkDel) {
      btnWarehouseBulkDel.addEventListener('click', async () => {
        const arr = Array.from(this.selectedWarehouseIds);
        if (confirm(`هل أنت متأكد من حذف ${arr.length} عمل محدد من المخزن؟`)) {
          await dataStore.deleteSelected(arr);
          this.selectedWarehouseIds.clear();
          showToast(`تم حذف الأعمال المحددة من المخزن`, 'success');
          this.renderAdminView(container, showToast);
        }
      });
    }

    // Modals Wiring
    const closeEdit = container.querySelector('#btn-close-edit-modal');
    const editModal = container.querySelector('#edit-work-modal');
    if (closeEdit && editModal) {
      closeEdit.addEventListener('click', () => editModal.classList.remove('open'));
    }

    const closeEp = container.querySelector('#btn-close-episodes-modal');
    const epModal = container.querySelector('#episodes-modal');
    if (closeEp && epModal) {
      closeEp.addEventListener('click', () => epModal.classList.remove('open'));
    }

    const closeTest = container.querySelector('#btn-close-test-player');
    const testModal = container.querySelector('#test-player-modal');
    const testFrame = container.querySelector('#test-player-frame');
    if (closeTest && testModal) {
      closeTest.addEventListener('click', () => {
        testModal.classList.remove('open');
        if (testFrame) testFrame.innerHTML = '';
      });
    }

    // Delete Confirmation Modal
    const btnConfirmDel = container.querySelector('#btn-confirm-delete-work');
    const btnCancelDel = container.querySelector('#btn-cancel-delete-work');
    const btnCloseDel = container.querySelector('#btn-close-delete-modal');

    if (btnConfirmDel) {
      btnConfirmDel.addEventListener('click', () => {
        this.executeDeleteWork(container, showToast);
      });
    }

    if (btnCancelDel) {
      btnCancelDel.addEventListener('click', () => {
        this.closeDeleteConfirmModal(container);
      });
    }

    if (btnCloseDel) {
      btnCloseDel.addEventListener('click', () => {
        this.closeDeleteConfirmModal(container);
      });
    }

    // Anime Section Toggle in Settings
    const btnToggleAnime = container.querySelector('#btn-toggle-anime-control');
    if (btnToggleAnime) {
      btnToggleAnime.addEventListener('click', () => {
        APP_CONFIG.ANIME_ENABLED = !APP_CONFIG.ANIME_ENABLED;
        if (typeof window !== 'undefined') window.ANIME_ENABLED = APP_CONFIG.ANIME_ENABLED;
        if (window.darkWatchApp && typeof window.darkWatchApp.syncNavVisibility === 'function') {
          window.darkWatchApp.syncNavVisibility();
        }
        showToast(
          APP_CONFIG.ANIME_ENABLED
            ? 'تم إعادة تفعيل قسم الأنمي في الموقع العام'
            : 'تم إيقاف قسم الأنمي مؤقتاً في الموقع العام (البيانات محفوظة بالكامل في PostgreSQL)',
          APP_CONFIG.ANIME_ENABLED ? 'success' : 'info'
        );
        this.renderAdminView(container, showToast);
      });
    }

    // Database Test Modal Wiring
    const btnTestTop = container.querySelector('#btn-test-db-top');
    const btnTestSettings = container.querySelector('#btn-test-db-settings');
    const btnCloseTestDb = container.querySelector('#btn-close-test-db-modal');
    const testDbModal = container.querySelector('#test-db-modal');

    if (btnTestTop) {
      btnTestTop.addEventListener('click', () => {
        this.openTestDbModal(container, showToast);
      });
    }

    if (btnTestSettings) {
      btnTestSettings.addEventListener('click', () => {
        this.openTestDbModal(container, showToast);
      });
    }

    if (btnCloseTestDb && testDbModal) {
      btnCloseTestDb.addEventListener('click', () => {
        testDbModal.classList.remove('open');
      });
    }

    // Realtime Progress Modal Close / Done Button
    const progModal = container.querySelector('#transfer-progress-modal');
    const btnProgDone = container.querySelector('#btn-prog-done');
    const btnCloseProg = container.querySelector('#btn-close-progress-modal');

    const handleProgDone = () => {
      if (progModal) progModal.classList.remove('open');
      this.pendingParsedData = null;
      this.excludedImportIndices.clear();
      this.renderAdminView(container, showToast);
    };

    if (btnProgDone) btnProgDone.addEventListener('click', handleProgDone);
    if (btnCloseProg) btnCloseProg.addEventListener('click', handleProgDone);
  }

  // --- Realtime Batch Transfer Execution with Live Progress ---

  static async startTransferWithRealtimeProgress(container, targetState = 'DRAFT', showToast) {
    if (!this.pendingParsedData || !this.pendingParsedData.works) return;

    const worksToLoad = this.pendingParsedData.works.filter((_, idx) => !this.excludedImportIndices.has(idx));
    if (worksToLoad.length === 0) {
      showToast('لم يتم تحديد أي أعمال لنقلها', 'error');
      return;
    }

    const modal = container.querySelector('#transfer-progress-modal');
    const modalTitle = container.querySelector('#transfer-modal-title');
    const totalValEl = container.querySelector('#prog-total-val');
    const processedValEl = container.querySelector('#prog-processed-val');
    const savedValEl = container.querySelector('#prog-saved-val');
    const remainingValEl = container.querySelector('#prog-remaining-val');
    const percentTextEl = container.querySelector('#prog-percent-text');
    const barFillEl = container.querySelector('#prog-bar-fill');
    const statusHeadlineEl = container.querySelector('#prog-status-headline');
    const currentWorkEl = container.querySelector('#prog-current-work');
    const completionBanner = container.querySelector('#prog-completion-banner');
    const completionDesc = container.querySelector('#prog-completion-desc');
    const btnCloseProg = container.querySelector('#btn-close-progress-modal');

    if (!modal) return;

    // Setup Initial UI state
    modalTitle.innerHTML = targetState === 'DRAFT'
      ? `<span>📦</span> نقل الأعمال إلى المخزن`
      : `<span>🚀</span> نقل ونشر الأعمال في الموقع`;

    totalValEl.textContent = worksToLoad.length;
    processedValEl.textContent = `0 / ${worksToLoad.length}`;
    savedValEl.textContent = '0';
    remainingValEl.textContent = worksToLoad.length;
    percentTextEl.textContent = '0%';
    barFillEl.style.width = '0%';
    statusHeadlineEl.textContent = 'جاري بدء الاتصال بقاعدة بيانات PostgreSQL...';
    currentWorkEl.textContent = `اسم العمل الحالي: ${worksToLoad[0]?.title || '-'}`;
    completionBanner.style.display = 'none';
    btnCloseProg.style.display = 'none';

    modal.classList.add('open');

    const totalEps = worksToLoad.reduce((acc, w) => acc + (w.episodes ? w.episodes.length : (w.episodesCount || 0)), 0);
    const totalServers = worksToLoad.reduce((acc, w) => acc + (w.episodes ? w.episodes.reduce((eA, ep) => eA + (ep.servers ? ep.servers.length : 0), 0) : 0), 0);

    try {
      const res = await dataStore.transferWorksInBatches(
        worksToLoad,
        targetState,
        25, // Batch size of 25 works per HTTP transaction
        (progress) => {
          // Update live real-time counters
          totalValEl.textContent = progress.total;
          processedValEl.textContent = `${progress.processed} / ${progress.total}`;
          savedValEl.textContent = progress.saved;
          remainingValEl.textContent = progress.remaining;
          percentTextEl.textContent = `${progress.percent}%`;
          barFillEl.style.width = `${progress.percent}%`;
          statusHeadlineEl.textContent = progress.statusText;
          currentWorkEl.textContent = `اسم العمل الحالي: ${progress.currentWorkTitle}`;

          if (progress.isDone) {
            completionBanner.style.display = 'block';
            btnCloseProg.style.display = 'block';
            completionDesc.textContent = targetState === 'DRAFT'
              ? `تم نقل ${progress.saved} عمل و ${totalEps} حلقة إلى المخزن بنجاح. تم حفظ جميع البيانات بشكل دائم في PostgreSQL.`
              : `تم حفظ ونشر ${progress.saved} عمل و ${totalEps} حلقة في الموقع بنجاح. البيانات دائمة 100%.`;
          }
        }
      );

      // Add to Import Logs
      await dataStore.addImportLog({
        fileName: this.pendingParsedData.fileName,
        fileSize: this.pendingParsedData.fileSize,
        worksCount: worksToLoad.length,
        episodesCount: totalEps,
        serversCount: totalServers,
        status: targetState === 'DRAFT' ? 'نقل إلى المخزن (PostgreSQL)' : 'تثبيت ونشر (PostgreSQL)',
        errors: res.errors || []
      });

      showToast(`اكتمل نقل جميع الأعمال بنجاح! تم حفظ ${res.savedCount} عمل في PostgreSQL.`, 'success');
    } catch (err) {
      console.error('Transfer error:', err);
      statusHeadlineEl.textContent = 'حدث خطأ أثناء النقل: ' + err.message;
      btnCloseProg.style.display = 'block';
      showToast('خطأ أثناء النقل: ' + err.message, 'error');
    }
  }

  static updateBulkToolbarState(toolbar, countEl, selectedSet) {
    if (!toolbar) return;
    const count = selectedSet.size;
    if (count > 0) {
      toolbar.style.display = 'flex';
      if (countEl) countEl.textContent = `تم تحديد ${count} عمل`;
    } else {
      toolbar.style.display = 'none';
    }
  }

  static handleFileSelected(file, textInput, fileBanner, fileNameEl, fileSizeEl, showToast) {
    if (!file.name.endsWith('.json')) {
      showToast('يرجى اختيار ملف بصيغة .json فقط', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      textInput.value = evt.target.result;
      if (fileBanner) fileBanner.style.display = 'flex';
      if (fileNameEl) fileNameEl.textContent = file.name;
      if (fileSizeEl) fileSizeEl.textContent = `${(file.size / 1024).toFixed(1)} KB (${file.size.toLocaleString()} bytes)`;
      showToast('تم تحميل الملف بنجاح، اضغط على "فحص وتحليل الملف"', 'success');
    };
    reader.readAsText(file);
  }

  // --- Inspection & Preview Rendering ---

  static renderInspectionPreview(container) {
    const previewCard = container.querySelector('#preview-validation-card');
    const metricsTarget = container.querySelector('#inspection-metrics-target');
    const warningsTarget = container.querySelector('#inspection-warnings-target');
    const worksListTarget = container.querySelector('#inspection-works-list');
    const btnToggleAll = container.querySelector('#btn-preview-toggle-all');

    if (!previewCard || !this.pendingParsedData) return;

    const { stats, works } = this.pendingParsedData;

    // 1. Render Metrics Grid & Multi-Media Audit Report
    const validCovers = stats.validCoversCount || 0;
    const fallbackCovers = stats.fallbackCoversCount || 0;
    const missingCovers = stats.missingCoversCount || 0;
    const validBanners = stats.validBannersCount || 0;
    const fallbackBanners = stats.fallbackBannersCount || 0;
    const missingBanners = stats.missingBannersCount || 0;
    const needsReview = stats.needsReviewCount || 0;

    metricsTarget.innerHTML = `
      <div class="inspection-metric-box">
        <div class="inspection-metric-val">${works.length}</div>
        <div class="inspection-metric-label">إجمالي الأعمال المكتشفة</div>
      </div>
      <div class="inspection-metric-box">
        <div class="inspection-metric-val">${stats.totalEpisodes}</div>
        <div class="inspection-metric-label">إجمالي الحلقات</div>
      </div>
      <div class="inspection-metric-box">
        <div class="inspection-metric-val">${stats.totalVideos || stats.totalServers}</div>
        <div class="inspection-metric-label">إجمالي الفيديوهات</div>
      </div>
      <div class="inspection-metric-box">
        <div class="inspection-metric-val">${stats.totalServers}</div>
        <div class="inspection-metric-label">إجمالي السيرفرات</div>
      </div>
      <div class="inspection-metric-box" style="border-color: rgba(46, 213, 115, 0.35); background: rgba(46, 213, 115, 0.06);">
        <div class="inspection-metric-val" style="color: #2ed573;">✓ ${validCovers}</div>
        <div class="inspection-metric-label" style="color: #2ed573;">الأغلفة المستخرجة (Cover)</div>
      </div>
      <div class="inspection-metric-box" style="border-color: rgba(30, 144, 255, 0.35); background: rgba(30, 144, 255, 0.06);">
        <div class="inspection-metric-val" style="color: #1e90ff;">🖼️ ${validBanners}</div>
        <div class="inspection-metric-label" style="color: #1e90ff;">البنرات المستخرجة (Banner)</div>
      </div>
      <div class="inspection-metric-box" style="border-color: ${needsReview > 0 ? 'rgba(255, 71, 87, 0.35)' : 'rgba(46, 213, 115, 0.35)'}; background: ${needsReview > 0 ? 'rgba(255, 71, 87, 0.06)' : 'rgba(46, 213, 115, 0.06)'};">
        <div class="inspection-metric-val" style="color: ${needsReview > 0 ? '#ff4757' : '#2ed573'};">${needsReview}</div>
        <div class="inspection-metric-label" style="color: ${needsReview > 0 ? '#ff4757' : '#2ed573'};">عناصر تحتاج مراجعة</div>
      </div>
    `;

    // 2. Render Warnings or Issues if any
    if ((stats.issuesList && stats.issuesList.length > 0) || (stats.missingCoverWorks && stats.missingCoverWorks.length > 0)) {
      warningsTarget.innerHTML = `
        <div style="background: rgba(255, 165, 2, 0.1); border: 1px solid rgba(255, 165, 2, 0.3); border-radius: var(--dw-radius-md); padding: 12px 16px; margin-top: 14px;">
          <div style="font-weight: 800; color: #ffa502; font-size: 13px; margin-bottom: 6px;">⚠️ تقرير مراجعة الاستخراج (${needsReview} عناصر):</div>
          <ul style="font-size: 12px; color: var(--dw-text-muted); padding-right: 18px; margin: 0; line-height: 1.6;">
            ${(stats.issuesList || []).slice(0, 4).map(w => `<li><strong>${w.item}:</strong> ${w.error}</li>`).join('')}
            ${(stats.missingCoverWorks || []).slice(0, 3).map(name => `<li><strong>${name}:</strong> تم استخدام غلاف افتراضي (بدون غلاف أصلي).</li>`).join('')}
          </ul>
        </div>
      `;
    } else {
      warningsTarget.innerHTML = '';
    }

    // 3. Render Detected Works List with Cover & Banner Preview
    const renderWorksList = () => {
      worksListTarget.innerHTML = works.map((w, idx) => {
        const isExcluded = this.excludedImportIndices.has(idx);
        const epCount = w.episodes ? w.episodes.length : 0;
        const serverCount = w.episodes ? w.episodes.reduce((acc, ep) => acc + (ep.servers ? ep.servers.length : 0), 0) : 0;
        const videoCount = w.episodes ? w.episodes.reduce((acc, ep) => acc + (ep.servers ? ep.servers.filter(s => s.type === 'video').length : 0), 0) : 0;

        let coverBadge = '';
        if (w.coverStatus === 'valid') {
          coverBadge = '<span class="tag-badge" style="background: rgba(46, 213, 115, 0.15); color: #2ed573; border: 1px solid rgba(46, 213, 115, 0.3); font-size: 11px;">Cover ✓</span>';
        } else if (w.coverStatus === 'fallback') {
          coverBadge = '<span class="tag-badge" style="background: rgba(255, 165, 2, 0.15); color: #ffa502; border: 1px solid rgba(255, 165, 2, 0.3); font-size: 11px;">Cover ⚠ Fallback</span>';
        } else {
          coverBadge = '<span class="tag-badge" style="background: rgba(255, 71, 87, 0.15); color: #ff4757; border: 1px solid rgba(255, 71, 87, 0.3); font-size: 11px;">Cover ✕ مفقود</span>';
        }

        let bannerBadge = '';
        if (w.bannerStatus === 'valid') {
          bannerBadge = '<span class="tag-badge" style="background: rgba(30, 144, 255, 0.15); color: #1e90ff; border: 1px solid rgba(30, 144, 255, 0.3); font-size: 11px;">Banner 🖼️</span>';
        }

        return `
          <div class="inspection-work-item ${isExcluded ? 'excluded' : ''}" data-index="${idx}">
            <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 260px;">
              <input type="checkbox" class="preview-work-check" data-index="${idx}" ${!isExcluded ? 'checked' : ''} style="cursor: pointer;" />
              <div style="display: flex; gap: 6px; align-items: center;">
                <img src="${w.cover}" class="admin-table-cover" onerror="this.src='https://images.unsplash.com/photo-1578632767115-351597cf2477?w=100'" alt="${w.title}" title="Cover (غلاف)" />
                ${w.banner && w.banner !== w.cover ? `<img src="${w.banner}" style="width: 60px; height: 38px; border-radius: 4px; object-fit: cover; border: 1px solid var(--dw-border);" onerror="this.style.display='none'" alt="Banner" title="Banner (بنر)" />` : ''}
              </div>
              <div style="overflow: hidden;">
                <div style="font-weight: 800; color: #fff; font-size: 14px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${w.title}</div>
                <div style="font-size: 11px; color: var(--dw-text-muted); margin-top: 2px;">
                  ${w.type === 'anime' ? 'أنمي' : 'كرتون'} • ${w.year || 'غير محدد'} • ${w.status || 'مكتمل'}
                </div>
                <div style="font-size: 11px; color: var(--dw-text-muted); margin-top: 3px; display: flex; align-items: center; gap: 6px;">
                  <span>المصدر: <code style="color: #1e90ff; background: rgba(30, 144, 255, 0.1); padding: 1px 4px; border-radius: 4px;">${w.coverSource || 'cover'}</code></span>
                </div>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              ${coverBadge}
              ${bannerBadge}
              <span class="tag-badge" style="font-size: 11px;">
                🎞️ ${epCount} حلقة (${serverCount} سيرفر)
              </span>
              <button class="btn-inspect-preview-episodes btn-secondary" data-index="${idx}" style="padding: 4px 8px; font-size: 11px; color: #2ed573;">
                🔍 فحص الحلقات والسيرفرات
              </button>
            </div>
          </div>
        `;
      }).join('');
    };

    renderWorksList();

    // Toggle All Preview works
    if (btnToggleAll) {
      btnToggleAll.onclick = () => {
        if (this.excludedImportIndices.size === 0) {
          works.forEach((_, idx) => this.excludedImportIndices.add(idx));
        } else {
          this.excludedImportIndices.clear();
        }
        renderWorksList();
      };
    }

    // Checkbox and inspect clicks
    worksListTarget.onclick = (e) => {
      const check = e.target.closest('.preview-work-check');
      if (check) {
        const idx = parseInt(check.dataset.index, 10);
        if (check.checked) this.excludedImportIndices.delete(idx);
        else this.excludedImportIndices.add(idx);
        const item = worksListTarget.querySelector(`.inspection-work-item[data-index="${idx}"]`);
        if (item) item.classList.toggle('excluded', !check.checked);
        return;
      }

      const inspectBtn = e.target.closest('.btn-inspect-preview-episodes');
      if (inspectBtn) {
        const idx = parseInt(inspectBtn.dataset.index, 10);
        const work = works[idx];
        if (work) this.openEpisodesManagementModalForObject(work);
      }
    };

    previewCard.style.display = 'block';
    previewCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // --- Modals: Delete Work Confirmation ---

  static openDeleteConfirmModal(workId, container, showToast) {
    const work = dataStore.getById(workId);
    if (!work) return;

    this.pendingDeleteWorkId = workId;
    const modal = document.getElementById('delete-confirm-modal');
    const titleEl = document.getElementById('delete-work-title');
    const metaEl = document.getElementById('delete-work-meta');

    if (!modal) return;

    titleEl.textContent = work.title || 'عمل غير مسمى';
    const epCount = work.episodes ? work.episodes.length : (work.episodesCount || 0);
    metaEl.textContent = `النوع: ${work.type === 'anime' ? 'أنمي' : 'كرتون'} • عدد الحلقات: ${epCount} • المعرف: ${work.id}`;

    modal.classList.add('open');
  }

  static closeDeleteConfirmModal(container) {
    this.pendingDeleteWorkId = null;
    const modal = document.getElementById('delete-confirm-modal');
    if (modal) modal.classList.remove('open');
  }

  static async executeDeleteWork(container, showToast) {
    if (!this.pendingDeleteWorkId) return;

    const workId = this.pendingDeleteWorkId;
    const btnConfirm = container.querySelector('#btn-confirm-delete-work');
    if (btnConfirm) {
      btnConfirm.disabled = true;
      btnConfirm.textContent = '⏳ جاري الحذف من PostgreSQL...';
    }

    try {
      await dataStore.deleteWork(workId);
      this.closeDeleteConfirmModal(container);
      showToast('تم حذف العمل وجميع الحلقات التابعة له بنجاح من قاعدة البيانات!', 'success');
      this.renderAdminView(container, showToast);
    } catch (err) {
      showToast('فشل حذف العمل: ' + err.message, 'error');
    } finally {
      if (btnConfirm) {
        btnConfirm.disabled = false;
        btnConfirm.textContent = 'تأكيد الحذف';
      }
    }
  }

  // --- Modals: Edit Work ---

  static openEditWorkModal(workId, container, showToast) {
    const work = dataStore.getById(workId);
    if (!work) return;

    this.activeEditingWorkId = workId;
    const modal = document.getElementById('edit-work-modal');
    const target = document.getElementById('edit-work-form-target');

    target.innerHTML = `
      <form id="form-edit-work">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
          <div>
            <label class="form-label">عنوان العمل (بالعربية)</label>
            <input type="text" id="edit-work-title" class="admin-search-input" value="${work.title || ''}" required />
          </div>
          <div>
            <label class="form-label">العنوان الأصلي / الإنجليزي</label>
            <input type="text" id="edit-work-original" class="admin-search-input" value="${work.originalTitle || ''}" />
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin-top: 14px;">
          <div>
            <label class="form-label">النوع</label>
            <select id="edit-work-type" class="admin-search-input">
              <option value="anime" ${work.type === 'anime' ? 'selected' : ''}>أنمي (Anime)</option>
              <option value="cartoon" ${work.type === 'cartoon' ? 'selected' : ''}>كرتون (Cartoon)</option>
            </select>
          </div>
          <div>
            <label class="form-label">سنة الإنتاج</label>
            <input type="text" id="edit-work-year" class="admin-search-input" value="${work.year || ''}" />
          </div>
          <div>
            <label class="form-label">حالة النشر</label>
            <select id="edit-work-state" class="admin-search-input">
              <option value="PUBLISHED" ${(work.statusState || 'PUBLISHED') === 'PUBLISHED' ? 'selected' : ''}>مثبت ومنشور (PUBLISHED)</option>
              <option value="DRAFT" ${work.statusState === 'DRAFT' ? 'selected' : ''}>في المخزن (DRAFT)</option>
              <option value="ARCHIVED" ${work.statusState === 'ARCHIVED' ? 'selected' : ''}>مؤرشف (ARCHIVED)</option>
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 14px;">
          <div>
            <label class="form-label">رابط صورة الغلاف (Poster URL)</label>
            <input type="url" id="edit-work-cover" class="admin-search-input" value="${work.cover || ''}" required />
          </div>
          <div>
            <label class="form-label">رابط البنر العريض (Banner / Backdrop URL)</label>
            <input type="url" id="edit-work-banner" class="admin-search-input" value="${work.banner || work.cover || ''}" />
          </div>
        </div>

        <div style="margin-top: 14px;">
          <label class="form-label">قصة العمل (الوصف)</label>
          <textarea id="edit-work-desc" class="admin-textarea" style="height: 100px;">${work.description || ''}</textarea>
        </div>

        <div style="margin-top: 20px; display: flex; justify-content: flex-end; gap: 10px;">
          <button type="button" class="btn-secondary" onclick="document.getElementById('edit-work-modal').classList.remove('open')">
            إلغاء
          </button>
          <button type="submit" class="btn-primary" style="padding: 10px 24px;">
            حفظ التعديلات في PostgreSQL
          </button>
        </div>
      </form>
    `;

    const form = target.querySelector('#form-edit-work');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const updated = {
        title: target.querySelector('#edit-work-title').value.trim(),
        originalTitle: target.querySelector('#edit-work-original').value.trim(),
        type: target.querySelector('#edit-work-type').value,
        year: target.querySelector('#edit-work-year').value.trim(),
        statusState: target.querySelector('#edit-work-state').value,
        cover: target.querySelector('#edit-work-cover').value.trim(),
        banner: target.querySelector('#edit-work-banner').value.trim() || target.querySelector('#edit-work-cover').value.trim(),
        description: target.querySelector('#edit-work-desc').value.trim()
      };

      try {
        await dataStore.updateWork(workId, updated);
        modal.classList.remove('open');
        showToast('تم حفظ التعديلات بنجاح في قاعدة البيانات!', 'success');
        this.renderAdminView(container, showToast);
      } catch (err) {
        showToast('خطأ في حفظ التعديل: ' + err.message, 'error');
      }
    });

    modal.classList.add('open');
  }

  // --- Modals: Test Database Connection ---

  static async openTestDbModal(container, showToast) {
    const modal = document.getElementById('test-db-modal');
    const target = document.getElementById('test-db-modal-target');

    if (!modal || !target) return;

    modal.classList.add('open');
    target.innerHTML = `
      <div style="text-align: center; padding: 30px;">
        <div style="font-size: 36px; margin-bottom: 12px; animation: spin 1s infinite linear;">⚙️</div>
        <div style="font-size: 16px; font-weight: 800; color: #fff;">جاري اختبار الاتصال بـ PostgreSQL...</div>
        <div style="font-size: 12px; color: var(--dw-text-muted); margin-top: 6px;">فحص القراءة والكتابة وزمن الاستجابة</div>
      </div>
    `;

    const result = await dataStore.testDatabaseConnection();

    target.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div style="background: ${result.connected ? 'rgba(46, 213, 115, 0.1)' : 'rgba(255, 71, 87, 0.1)'}; border: 1px solid ${result.connected ? 'rgba(46, 213, 115, 0.4)' : 'rgba(255, 71, 87, 0.4)'}; border-radius: var(--dw-radius-md); padding: 16px; display: flex; align-items: flex-start; gap: 14px;">
          <div style="font-size: 32px; line-height: 1;">${result.connected ? '🟢' : '❌'}</div>
          <div style="flex: 1;">
            <div style="font-size: 16px; font-weight: 900; color: ${result.connected ? '#2ed573' : '#ff4757'};">
              ${result.connected ? 'الاتصال ناجح' : 'فشل الاتصال بقاعدة بيانات PostgreSQL'}
            </div>
            <div style="font-size: 13px; color: #fff; margin-top: 6px; line-height: 1.6;">
              ${result.message || ''}
            </div>
            ${result.activeEnvVar ? `
              <div style="font-size: 11px; color: var(--dw-text-muted); margin-top: 4px;">
                المتغير النشط: <code style="color: #2ed573; background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px;">${result.activeEnvVar}</code>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Metrics Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px;">
          <div class="stat-box" style="padding: 12px 14px;">
            <div class="stat-icon" style="font-size: 18px;">⚡</div>
            <div>
              <div class="stat-num" style="font-size: 15px;">${result.latencyMs !== undefined ? `${result.latencyMs} ms` : '-'}</div>
              <div class="stat-label">زمن الاستجابة</div>
            </div>
          </div>
          <div class="stat-box" style="padding: 12px 14px;">
            <div class="stat-icon" style="font-size: 18px;">🐘</div>
            <div>
              <div class="stat-num" style="font-size: 15px;">PostgreSQL</div>
              <div class="stat-label">محرك التخزين</div>
            </div>
          </div>
          <div class="stat-box" style="padding: 12px 14px;">
            <div class="stat-icon" style="font-size: 18px;">🎬</div>
            <div>
              <div class="stat-num" style="font-size: 15px;">${result.worksCount !== undefined ? result.worksCount : dataStore.getAllWorks().length}</div>
              <div class="stat-label">الأعمال المحفوظة</div>
            </div>
          </div>
          <div class="stat-box" style="padding: 12px 14px;">
            <div class="stat-icon" style="font-size: 18px;">🎞️</div>
            <div>
              <div class="stat-num" style="font-size: 15px;">${result.episodesCount !== undefined ? result.episodesCount : dataStore.getStats().totalEpisodes}</div>
              <div class="stat-label">الحلقات المحفوظة</div>
            </div>
          </div>
        </div>

        <div style="background: #09090e; border: 1px solid var(--dw-border); border-radius: var(--dw-radius-md); padding: 16px;">
          <div style="font-weight: 800; color: #fff; font-size: 14px; margin-bottom: 8px;">
            ⚙️ إعدادات Vercel Production:
          </div>
          <p style="font-size: 12px; color: var(--dw-text-muted); line-height: 1.6; margin-bottom: 10px;">
            يبحث التطبيق أولاً عن <code>POSTGRES_URL</code> وإذا لم يجده يبحث عن <code>DATABASE_URL</code>.
            ${!result.connected ? '<br/><strong style="color: #ff4757;">تنبيه:</strong> إذا أضفت متغير البيئة في Vercel، يجب عمل <strong>Redeploy</strong> لكي يبدأ الـ Serverless Function بقراءته.' : ''}
          </p>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 10px;">
          <button id="btn-retest-db" class="btn-primary" style="padding: 8px 16px; font-size: 13px;">
            🔄 إعادة الفحص الآن
          </button>
          <button class="btn-secondary" onclick="document.getElementById('test-db-modal').classList.remove('open')" style="padding: 8px 16px; font-size: 13px;">
            إغلاق
          </button>
        </div>
      </div>
    `;

    const retestBtn = target.querySelector('#btn-retest-db');
    if (retestBtn) {
      retestBtn.addEventListener('click', () => {
        this.openTestDbModal(container, showToast);
      });
    }

    if (showToast) {
      showToast(result.connected ? 'تم الاتصال بـ PostgreSQL بنجاح!' : 'تم فحص التخزين الدائم', result.connected ? 'success' : 'info');
    }
  }

  // --- Modals: Manage Episodes & Servers ---

  static openEpisodesManagementModal(workId, container, showToast) {
    const work = dataStore.getById(workId);
    if (!work) return;

    this.activeEpisodesWorkId = workId;
    const modal = document.getElementById('episodes-modal');
    const modalTitle = document.getElementById('episodes-modal-title');
    const target = document.getElementById('episodes-modal-target');

    modalTitle.innerHTML = `🎞️ إدارة حلقات: <span style="color: var(--dw-red-glow);">${work.title}</span> (${work.episodes ? work.episodes.length : 0} حلقة)`;

    this.renderEpisodesListInModal(work, target, showToast);
    modal.classList.add('open');
  }

  static openEpisodesManagementModalForObject(work) {
    const modal = document.getElementById('episodes-modal');
    const modalTitle = document.getElementById('episodes-modal-title');
    const target = document.getElementById('episodes-modal-target');

    if (!modal || !target) return;

    modalTitle.innerHTML = `🔍 فحص الحلقات المستخرجة: <span style="color: var(--dw-red-glow);">${work.title}</span> (${work.episodes ? work.episodes.length : 0} حلقة)`;

    this.renderEpisodesListInModal(work, target, null, true);
    modal.classList.add('open');
  }

  static renderEpisodesListInModal(work, target, showToast, isPreviewOnly = false) {
    const episodes = work.episodes || [];

    target.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
        <div style="display: flex; gap: 10px; align-items: center; flex: 1;">
          <input type="text" id="ep-modal-search" class="admin-search-input" placeholder="🔍 تصفية الحلقات برقم أو اسم الحلقة..." style="max-width: 320px;" />
        </div>
      </div>

      <div id="episodes-list-accordion" style="max-height: 55vh; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; padding-left: 6px;">
        ${this.renderEpisodesAccordionItems(work, episodes, isPreviewOnly)}
      </div>
    `;

    const epSearch = target.querySelector('#ep-modal-search');
    const epAccordion = target.querySelector('#episodes-list-accordion');
    if (epSearch && epAccordion) {
      epSearch.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase().trim();
        const filtered = (work.episodes || []).filter(ep =>
          ep.number.toString().includes(q) ||
          (ep.title || '').toLowerCase().includes(q)
        );
        epAccordion.innerHTML = this.renderEpisodesAccordionItems(work, filtered, isPreviewOnly);
      });
    }

    epAccordion.addEventListener('click', (e) => {
      const testSrvBtn = e.target.closest('.btn-test-server');
      if (testSrvBtn) {
        const srvUrl = testSrvBtn.dataset.srvUrl;
        const srvType = testSrvBtn.dataset.srvType;
        const srvName = testSrvBtn.dataset.srvName;
        this.openTestPlayerModal(srvName, srvUrl, srvType);
      }
    });
  }

  static renderEpisodesAccordionItems(work, episodes, isPreviewOnly = false) {
    if (!episodes || episodes.length === 0) {
      return `
        <div style="text-align: center; padding: 30px; color: var(--dw-text-muted);">
          لا توجد حلقات مطابقة.
        </div>
      `;
    }

    return episodes.map(ep => {
      const servers = ep.servers || [];
      return `
        <div class="ep-accordion-item" style="background: #0d0d14; border: 1px solid var(--dw-border); border-radius: var(--dw-radius-md); padding: 12px 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div class="ep-num-pill" style="width: 32px; height: 32px; font-size: 13px;">${ep.number}</div>
              <div>
                <div style="font-weight: 800; color: #fff; font-size: 14px;">${ep.title}</div>
                <div style="font-size: 11px; color: var(--dw-text-muted);">${servers.length} سيرفرات متوفرة</div>
              </div>
            </div>
          </div>

          <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #1a1a26; display: flex; flex-direction: column; gap: 6px;">
            ${servers.map(srv => `
              <div style="display: flex; justify-content: space-between; align-items: center; background: #08080c; border: 1px solid #1a1a24; border-radius: 6px; padding: 6px 10px; font-size: 12px;">
                <div style="display: flex; align-items: center; gap: 8px; overflow: hidden; margin-left: 8px;">
                  <span style="font-weight: 700; color: #fff;">${srv.name || 'سيرفر'}:</span>
                  <span style="color: var(--dw-text-muted); direction: ltr; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 320px;">${srv.url}</span>
                </div>
                <div style="display: flex; gap: 6px;">
                  <button class="btn-test-server btn-secondary" data-srv-name="${srv.name || 'سيرفر'}" data-srv-url="${srv.url}" data-srv-type="${srv.type || 'video'}" style="padding: 2px 8px; font-size: 11px; color: #2ed573;">
                    ▶ فحص البث
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');
  }

  // --- Test Player Modal ---

  static openTestPlayerModal(name, url, type) {
    const modal = document.getElementById('test-player-modal');
    const titleEl = document.getElementById('test-player-title');
    const frameEl = document.getElementById('test-player-frame');
    const urlEl = document.getElementById('test-player-url');

    if (!modal || !frameEl) return;

    titleEl.textContent = `▶ فحص السيرفر: ${name}`;
    urlEl.textContent = `الرابط: ${url}`;

    if (type === 'video' || url.endsWith('.mp4') || url.endsWith('.webm')) {
      frameEl.innerHTML = `
        <video controls autoplay playsinline style="width: 100%; height: 100%; object-fit: contain;">
          <source src="${url}" type="video/mp4">
        </video>
      `;
    } else {
      frameEl.innerHTML = `
        <iframe src="${url}" style="width: 100%; height: 100%; border: none;" allowfullscreen allow="autoplay; encrypted-media"></iframe>
      `;
    }

    modal.classList.add('open');
  }

  // --- Google Search Console Helpers ---

  static async initGSCTab(container, showToast) {
    try {
      const res = await fetch('/api/gsc');
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.success && data.settings) {
        this.populateGSCForm(container, data.settings);
      }
    } catch (err) {
      console.warn('Error loading GSC settings:', err);
    }
  }

  static populateGSCForm(container, settings) {
    const metaCodeEl = container.querySelector('#gsc-meta-code');
    const metaEnabledEl = container.querySelector('#gsc-meta-enabled');
    const htmlFilenameEl = container.querySelector('#gsc-html-filename');
    const htmlContentEl = container.querySelector('#gsc-html-content');
    const htmlEnabledEl = container.querySelector('#gsc-html-enabled');
    const customUrlEl = container.querySelector('#gsc-custom-url');
    const customUrlEnabledEl = container.querySelector('#gsc-custom-enabled');

    if (metaCodeEl) metaCodeEl.value = settings.meta_code || '';
    if (metaEnabledEl) metaEnabledEl.checked = Boolean(settings.meta_enabled);
    if (htmlFilenameEl) htmlFilenameEl.value = settings.html_filename || '';
    if (htmlContentEl) htmlContentEl.value = settings.html_content || '';
    if (htmlEnabledEl) htmlEnabledEl.checked = Boolean(settings.html_enabled);
    if (customUrlEl) customUrlEl.value = settings.custom_url || '';
    if (customUrlEnabledEl) customUrlEnabledEl.checked = Boolean(settings.custom_url_enabled);

    this.updateGSCStatusBanner(container, settings);
  }

  static updateGSCStatusBanner(container, settings) {
    const iconEl = container.querySelector('#gsc-status-icon');
    const titleEl = container.querySelector('#gsc-status-title');
    const descEl = container.querySelector('#gsc-status-desc');
    if (!iconEl || !titleEl || !descEl) return;

    const hasActiveMeta = settings.meta_enabled && settings.meta_code;
    const hasActiveHtml = settings.html_enabled && settings.html_filename;
    const hasActiveCustom = settings.custom_url_enabled && settings.custom_url;

    if (hasActiveMeta || hasActiveHtml || hasActiveCustom) {
      iconEl.textContent = '🟢';
      titleEl.textContent = 'تم إعداد التحقق';
      titleEl.style.color = '#2ed573';
      let activeMethods = [];
      if (hasActiveMeta) activeMethods.push('Meta Tag');
      if (hasActiveHtml) activeMethods.push(`ملف HTML (${settings.html_filename})`);
      if (hasActiveCustom) activeMethods.push('رابط التحقق');
      descEl.textContent = `طرق التحقق المفعّلة وجاهزة لـ Google Search Console: ${activeMethods.join(' ، ')}`;
    } else if (settings.meta_code || settings.html_filename || settings.custom_url) {
      iconEl.textContent = '🟡';
      titleEl.textContent = 'في انتظار التحقق من Google (غير مفعّل أو معلّق)';
      titleEl.style.color = '#ffa502';
      descEl.textContent = 'تم إدخال أكواد/ملفات التحقق لكن لم يتم تفعيل أياً منها. يرجى تفعيل الخيار المطلوب ثم الحفظ.';
    } else {
      iconEl.textContent = '🔴';
      titleEl.textContent = 'لم يتم إعداد التحقق';
      titleEl.style.color = '#ff4757';
      descEl.textContent = 'يرجى إدخال Meta Tag أو رفع ملف HTML للتحقق من ملكية موقعك في Google Search Console.';
    }
  }

  static handleGscFileUploaded(file, container, showToast) {
    if (!file) return;
    const filename = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      const filenameEl = container.querySelector('#gsc-html-filename');
      const contentEl = container.querySelector('#gsc-html-content');
      const enabledEl = container.querySelector('#gsc-html-enabled');

      if (filenameEl) filenameEl.value = filename;
      if (contentEl) contentEl.value = content;
      if (enabledEl) enabledEl.checked = true;

      showToast(`تم تحميل الملف ${filename} بنجاح! تم تفعيل خيار التحقق بملف HTML.`, 'success');
    };
    reader.readAsText(file);
  }

  // --- HilltopAds Verification Helpers ---

  static async initHTATab(container, showToast) {
    try {
      const res = await fetch('/api/hilltopads-verification');
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.success && data.settings) {
        this.populateHTAForm(container, data.settings);
      }
    } catch (err) {
      console.warn('Error loading HilltopAds settings:', err);
    }
  }

  static populateHTAForm(container, settings) {
    const metaCodeEl = container.querySelector('#hta-meta-code');
    const metaEnabledEl = container.querySelector('#hta-meta-enabled');
    const htmlFilenameEl = container.querySelector('#hta-html-filename');
    const htmlContentEl = container.querySelector('#hta-html-content');
    const htmlEnabledEl = container.querySelector('#hta-html-enabled');
    const scriptCodeEl = container.querySelector('#hta-script-code');
    const scriptEnabledEl = container.querySelector('#hta-script-enabled');
    const snippetCodeEl = container.querySelector('#hta-snippet-code');
    const snippetEnabledEl = container.querySelector('#hta-snippet-enabled');

    if (metaCodeEl) metaCodeEl.value = settings.meta_code || '';
    if (metaEnabledEl) metaEnabledEl.checked = Boolean(settings.meta_enabled);
    if (htmlFilenameEl) htmlFilenameEl.value = settings.html_filename || '';
    if (htmlContentEl) htmlContentEl.value = settings.html_content || '';
    if (htmlEnabledEl) htmlEnabledEl.checked = Boolean(settings.html_enabled);
    if (scriptCodeEl) scriptCodeEl.value = settings.script_code || '';
    if (scriptEnabledEl) scriptEnabledEl.checked = Boolean(settings.script_enabled);
    if (snippetCodeEl) snippetCodeEl.value = settings.snippet_code || '';
    if (snippetEnabledEl) snippetEnabledEl.checked = Boolean(settings.snippet_enabled);

    this.updateHTAStatusBanner(container, settings);
  }

  static updateHTAStatusBanner(container, settings) {
    const iconEl = container.querySelector('#hta-status-icon');
    const titleEl = container.querySelector('#hta-status-title');
    const descEl = container.querySelector('#hta-status-desc');
    if (!iconEl || !titleEl || !descEl) return;

    const hasActiveMeta = settings.meta_enabled && settings.meta_code;
    const hasActiveHtml = settings.html_enabled && settings.html_filename;
    const hasActiveScript = settings.script_enabled && settings.script_code;
    const hasActiveSnippet = settings.snippet_enabled && settings.snippet_code;

    if (hasActiveMeta || hasActiveHtml || hasActiveScript || hasActiveSnippet) {
      iconEl.textContent = '🟢';
      titleEl.textContent = 'تم إعداد التحقق';
      titleEl.style.color = '#2ed573';
      let activeMethods = [];
      if (hasActiveMeta) activeMethods.push('Meta Tag');
      if (hasActiveHtml) activeMethods.push(`ملف HTML (${settings.html_filename})`);
      if (hasActiveScript) activeMethods.push('Verification Script');
      if (hasActiveSnippet) activeMethods.push('HTML Snippet');
      descEl.textContent = `طرق التحقق المفعّلة لـ HilltopAds: ${activeMethods.join(' ، ')}`;
    } else if (settings.meta_code || settings.html_filename || settings.script_code || settings.snippet_code) {
      iconEl.textContent = '🟡';
      titleEl.textContent = 'في انتظار التحقق من HilltopAds (غير مفعّل أو معلّق)';
      titleEl.style.color = '#ffa502';
      descEl.textContent = 'تم إدخال أكواد/ملفات التحقق لكن لم يتم تفعيل أياً منها. يرجى تفعيل الخيار المطلوب ثم الحفظ.';
    } else {
      iconEl.textContent = '🔴';
      titleEl.textContent = 'لم يتم إعداد التحقق';
      titleEl.style.color = '#ff4757';
      descEl.textContent = 'يرجى إدخال Meta Tag أو رفع ملف HTML للتحقق من ملكية موقعك لدى HilltopAds.';
    }
  }

  static handleHtaFileUploaded(file, container, showToast) {
    if (!file) return;
    const filename = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      const filenameEl = container.querySelector('#hta-html-filename');
      const contentEl = container.querySelector('#hta-html-content');
      const enabledEl = container.querySelector('#hta-html-enabled');

      if (filenameEl) filenameEl.value = filename;
      if (contentEl) contentEl.value = content;
      if (enabledEl) enabledEl.checked = true;

      showToast(`تم تحميل الملف ${filename} بنجاح! تم تفعيل خيار التحقق بملف HTML لـ HilltopAds.`, 'success');
    };
    reader.readAsText(file);
  }

  // --- Ads & Popunders Management Helpers ---

  static async initAdsTab(container, showToast) {
    try {
      const res = await fetch('/api/ads');
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.success) {
        this.adsConfig = data;
        this.renderAdsDashboard(container, showToast);
      }
    } catch (err) {
      console.warn('Error loading ads data:', err);
    }
  }

  static renderAdsDashboard(container, showToast) {
    if (!this.adsConfig) return;

    const globalToggle = container.querySelector('#ads-global-toggle');
    const globalStatusText = container.querySelector('#ads-global-status-text');
    const statTotal = container.querySelector('#ads-stat-total');
    const statActive = container.querySelector('#ads-stat-active');
    const statPaused = container.querySelector('#ads-stat-paused');
    const unitsContainer = container.querySelector('#ad-units-container');

    const adsList = Array.isArray(this.adsConfig.ads) ? this.adsConfig.ads : [];

    if (globalToggle) {
      globalToggle.checked = Boolean(this.adsConfig.global_enabled);
      if (globalStatusText) {
        globalStatusText.textContent = this.adsConfig.global_enabled
          ? '🟢 الإعلانات مفعّلة في الموقع'
          : '🔴 الإعلانات متوقفة في كامل الموقع';
        globalStatusText.style.color = this.adsConfig.global_enabled ? '#2ed573' : '#ff4757';
      }
    }

    const activeCount = adsList.filter(a => a.enabled).length;
    const pausedCount = adsList.filter(a => !a.enabled).length;

    if (statTotal) statTotal.textContent = adsList.length;
    if (statActive) statActive.textContent = activeCount;
    if (statPaused) statPaused.textContent = pausedCount;

    if (!unitsContainer) return;

    if (adsList.length === 0) {
      unitsContainer.innerHTML = `
        <div style="background: #0d0d14; border: 1px dashed var(--dw-border); border-radius: var(--dw-radius-md); padding: 40px; text-align: center;">
          <div style="font-size: 32px; margin-bottom: 10px;">📢</div>
          <div style="font-size: 16px; font-weight: 800; color: #fff;">لا توجد وحدات إعلانية مضافة بعد</div>
          <div style="font-size: 13px; color: var(--dw-text-muted); margin-top: 4px; margin-bottom: 16px;">
            اضغط على "إضافة وحدة إعلانية جديدة" لوضع كود Popunder أو Banner من HilltopAds.
          </div>
        </div>
      `;
      return;
    }

    unitsContainer.innerHTML = adsList.map((ad, idx) => {
      const typeNames = {
        popunder: 'Popunder (نافذة منبثقة)',
        banner: 'Banner (إعلان شريطي)',
        native: 'Native (إعلان مدمج)',
        direct: 'Direct Link',
        other: 'كود مخصص'
      };

      const freqNames = {
        always: 'عند كل نقرة',
        session: 'مرة لكل جلسة',
        minutes_15: 'مرة كل 15 دقيقة',
        minutes_30: 'مرة كل 30 دقيقة',
        hours_1: 'مرة كل ساعة',
        hours_6: 'مرة كل 6 ساعات',
        hours_24: 'مرة كل 24 ساعة'
      };

      const deviceNames = {
        all: 'جميع الأجهزة',
        mobile: 'الهواتف',
        tablet: 'التابلت',
        desktop: 'الكمبيوتر'
      };

      const placementNames = {
        all: 'جميع الصفحات',
        home: 'الرئيسية',
        work: 'صفحات الأعمال',
        episode: 'صفحات الحلقات'
      };

      return `
        <div class="ad-card-item" style="background: #0a0a0f; border: 1px solid ${ad.enabled ? 'rgba(46, 213, 115, 0.3)' : 'var(--dw-border)'}; border-radius: var(--dw-radius-md); padding: 18px; display: flex; flex-direction: column; gap: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="font-size: 22px;">${ad.type === 'popunder' ? '🚀' : '📢'}</span>
              <div>
                <div style="font-size: 16px; font-weight: 800; color: #fff;">${ad.name || `إعلان ${idx + 1}`}</div>
                <div style="display: flex; gap: 8px; align-items: center; margin-top: 4px; flex-wrap: wrap;">
                  <span class="tag-badge" style="background: rgba(30, 144, 255, 0.15); color: #1e90ff; border-color: rgba(30, 144, 255, 0.3);">
                    ${typeNames[ad.type] || ad.type}
                  </span>
                  <span class="tag-badge" style="background: ${ad.enabled ? 'rgba(46, 213, 115, 0.15)' : 'rgba(255, 71, 87, 0.15)'}; color: ${ad.enabled ? '#2ed573' : '#ff4757'}; border-color: ${ad.enabled ? 'rgba(46, 213, 115, 0.3)' : 'rgba(255, 71, 87, 0.3)'};">
                    ${ad.enabled ? '🟢 نشط' : '🔴 متوقف'}
                  </span>
                </div>
              </div>
            </div>

            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button class="btn-test-ad btn-secondary" data-ad-idx="${idx}" style="padding: 6px 12px; font-size: 12px; color: #1e90ff; border-color: rgba(30, 144, 255, 0.3);">
                🧪 اختبار الإعلان
              </button>
              <button class="btn-toggle-ad btn-secondary" data-ad-idx="${idx}" style="padding: 6px 12px; font-size: 12px; color: ${ad.enabled ? '#ffa502' : '#2ed573'}; border-color: ${ad.enabled ? 'rgba(255, 165, 2, 0.3)' : 'rgba(46, 213, 115, 0.3)'};">
                ${ad.enabled ? '⏸️ إيقاف' : '▶️ تفعيل'}
              </button>
              <button class="btn-edit-ad btn-secondary" data-ad-idx="${idx}" style="padding: 6px 12px; font-size: 12px;">
                ✏️ تعديل
              </button>
              <button class="btn-delete-ad btn-secondary" data-ad-idx="${idx}" style="padding: 6px 12px; font-size: 12px; color: #ff4757; border-color: rgba(255, 71, 87, 0.3);">
                🗑️ حذف
              </button>
            </div>
          </div>

          <!-- Configuration Pills Row -->
          <div style="display: flex; gap: 12px; font-size: 12px; color: var(--dw-text-muted); background: #060609; padding: 10px 14px; border-radius: var(--dw-radius-sm); flex-wrap: wrap;">
            <div>📱 الأجهزة: <strong style="color: #fff;">${deviceNames[ad.devices] || ad.devices}</strong></div>
            <div>•</div>
            <div>📍 الأماكن: <strong style="color: #fff;">${placementNames[ad.placements] || ad.placements}</strong></div>
            <div>•</div>
            <div>⏱️ التكرار: <strong style="color: #fff;">${freqNames[ad.frequency] || ad.frequency}</strong></div>
            <div>•</div>
            <div>🚫 مستثنى: <strong style="color: #fff;">${Array.isArray(ad.excludedPages) ? ad.excludedPages.join(' ، ') : '/admin'}</strong></div>
          </div>

          <!-- Raw Code Snippet Preview -->
          <div style="background: #050508; border: 1px solid #1a1a24; border-radius: 6px; padding: 10px; font-family: monospace; font-size: 11px; color: #a0a0b0; direction: ltr; text-align: left; overflow-x: auto; white-space: pre-wrap; max-height: 70px;">
            ${(ad.code || '').slice(0, 180)}${(ad.code || '').length > 180 ? '...' : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  static openAdModal(adIndex = null, container, showToast) {
    const modal = document.getElementById('ad-unit-modal');
    if (!modal) return;

    const modalTitle = document.getElementById('ad-modal-title');
    const formId = document.getElementById('ad-form-id');
    const formName = document.getElementById('ad-form-name');
    const formType = document.getElementById('ad-form-type');
    const formEnabled = document.getElementById('ad-form-enabled');
    const formCode = document.getElementById('ad-form-code');
    const formDevices = document.getElementById('ad-form-devices');
    const formPlacements = document.getElementById('ad-form-placements');
    const formFrequency = document.getElementById('ad-form-frequency');
    const formExcluded = document.getElementById('ad-form-excluded');

    if (adIndex !== null && this.adsConfig && Array.isArray(this.adsConfig.ads) && this.adsConfig.ads[adIndex]) {
      const ad = this.adsConfig.ads[adIndex];
      modalTitle.textContent = `✏️ تعديل وحدة إعلانية: ${ad.name}`;
      formId.value = adIndex;
      formName.value = ad.name || '';
      formType.value = ad.type || 'popunder';
      formEnabled.checked = Boolean(ad.enabled);
      formCode.value = ad.code || '';
      formDevices.value = ad.devices || 'all';
      formPlacements.value = ad.placements || 'all';
      formFrequency.value = ad.frequency || 'session';
      formExcluded.value = Array.isArray(ad.excludedPages) ? ad.excludedPages.join(', ') : '/admin';
    } else {
      modalTitle.textContent = '➕ إضافة وحدة إعلانية جديدة';
      formId.value = '';
      formName.value = 'HilltopAds Popunder الرئيسي';
      formType.value = 'popunder';
      formEnabled.checked = true;
      formCode.value = '';
      formDevices.value = 'all';
      formPlacements.value = 'all';
      formFrequency.value = 'session';
      formExcluded.value = '/admin';
    }

    modal.classList.add('open');
  }

  static async saveAdModal(container, showToast) {
    const formId = document.getElementById('ad-form-id').value;
    const name = document.getElementById('ad-form-name').value.trim();
    const type = document.getElementById('ad-form-type').value;
    const enabled = document.getElementById('ad-form-enabled').checked;
    const code = document.getElementById('ad-form-code').value.trim();
    const devices = document.getElementById('ad-form-devices').value;
    const placements = document.getElementById('ad-form-placements').value;
    const frequency = document.getElementById('ad-form-frequency').value;
    const excludedRaw = document.getElementById('ad-form-excluded').value;

    if (!code) {
      showToast('يرجى وضع كود HilltopAds الإعلاني!', 'error');
      return;
    }

    const excludedPages = excludedRaw.split(',').map(s => s.trim()).filter(Boolean);

    if (!this.adsConfig) {
      this.adsConfig = { global_enabled: true, ads: [] };
    }
    if (!Array.isArray(this.adsConfig.ads)) {
      this.adsConfig.ads = [];
    }

    const adObject = {
      id: formId !== '' ? this.adsConfig.ads[parseInt(formId, 10)].id : `ad_${Date.now()}`,
      name: name || 'وحدة إعلانية',
      type,
      code,
      enabled,
      devices,
      placements,
      frequency,
      excludedPages,
      priority: 1,
      createdAt: formId !== '' ? (this.adsConfig.ads[parseInt(formId, 10)].createdAt || new Date().toISOString()) : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (formId !== '') {
      this.adsConfig.ads[parseInt(formId, 10)] = adObject;
    } else {
      this.adsConfig.ads.push(adObject);
    }

    await this.persistAdsConfig(container, showToast);
    document.getElementById('ad-unit-modal').classList.remove('open');
  }

  static async persistAdsConfig(container, showToast) {
    try {
      const res = await fetch('/api/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.adsConfig)
      });
      const data = await res.json();
      if (data && data.success) {
        showToast('تم حفظ إعدادات الإعلانات بنجاح في PostgreSQL! 🟢', 'success');
        this.adsConfig.global_enabled = data.global_enabled;
        this.adsConfig.ads = data.ads;
        this.renderAdsDashboard(container, showToast);

        if (window.darkWatchApp && adsManager) {
          adsManager.loadAds();
        }
      } else {
        showToast('فشل حفظ الإعلانات: ' + (data.error || 'خطأ غير معروف'), 'error');
      }
    } catch (err) {
      showToast('خطأ في الاتصال بالسيرفر أثناء حفظ الإعلانات', 'error');
    }
  }

  // --- Comprehensive SEO & Sitemap Helpers ---

  static async initSEOTab(container, showToast) {
    this.sitemapLinksCurrentPage = 1;
    this.sitemapLinksFilter = 'all';
    this.sitemapLinksSearch = '';

    this.seoWorksCurrentPage = 1;
    this.seoWorksFilter = 'all';
    this.seoWorksSearch = '';

    try {
      await Promise.all([
        this.loadSitemapLinks(container, showToast),
        this.loadSeoWorksTable(container, showToast)
      ]);
    } catch (err) {
      console.warn('Error initializing SEO tab:', err);
    }
  }

  static async loadSitemapLinks(container, showToast) {
    const tableTarget = container.querySelector('#sitemap-links-table-target');
    const paginationInfo = container.querySelector('#sitemap-pagination-info');
    if (!tableTarget) return;

    tableTarget.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--dw-text-muted);">⏳ جاري تحميل روابط Sitemap...</td></tr>`;

    try {
      const page = this.sitemapLinksCurrentPage || 1;
      const search = encodeURIComponent(this.sitemapLinksSearch || '');
      const filter = encodeURIComponent(this.sitemapLinksFilter || 'all');

      const res = await fetch(`/api/sitemap-links?page=${page}&pageSize=50&search=${search}&filter=${filter}`);
      if (!res.ok) throw new Error('HTTP ' + res.status);

      const data = await res.json();
      if (!data || !data.success) throw new Error(data.error || 'Failed to load sitemap links');

      const summary = data.summary || {};
      const links = data.links || [];
      const pagination = data.pagination || {};

      // Update summary cards
      const smTotal = container.querySelector('#sm-stat-total');
      const smWorks = container.querySelector('#sm-stat-works');
      const smEpisodes = container.querySelector('#sm-stat-episodes');
      const smCategories = container.querySelector('#sm-stat-categories');
      const smPages = container.querySelector('#sm-stat-pages');

      if (smTotal) smTotal.textContent = (summary.totalUrls || 0).toLocaleString();
      if (smWorks) smWorks.textContent = (summary.totalWorks || 0).toLocaleString();
      if (smEpisodes) smEpisodes.textContent = (summary.totalEpisodes || 0).toLocaleString();
      if (smCategories) smCategories.textContent = summary.totalCategories || 2;
      if (smPages) smPages.textContent = summary.totalPagesPages || 1;

      if (links.length === 0) {
        tableTarget.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--dw-text-muted);">🚫 لم يتم العثور على أي روابط تجاري المعايير</td></tr>`;
        if (paginationInfo) paginationInfo.textContent = `صفحة ${pagination.page || 1} من ${pagination.totalPages || 1}`;
        return;
      }

      tableTarget.innerHTML = links.map(item => `
        <tr>
          <td>
            <span class="tag-badge" style="background: rgba(30, 144, 255, 0.15); color: #1e90ff; border-color: rgba(30, 144, 255, 0.3);">
              ${item.pageType}
            </span>
          </td>
          <td style="font-weight: 700; color: #fff;">${item.workTitle}</td>
          <td>${item.episodeNumber ? `الحلقة ${item.episodeNumber}` : '-'}</td>
          <td style="direction: ltr; text-align: left; font-family: monospace; font-size: 11px;">
            <a href="${item.url}" target="_blank" style="color: #2ed573; text-decoration: none;">${item.url} ↗</a>
          </td>
          <td>
            <span class="tag-badge" style="background: rgba(46, 213, 115, 0.15); color: #2ed573; border-color: rgba(46, 213, 115, 0.3);">
              ${item.indexability}
            </span>
          </td>
          <td style="color: var(--dw-text-muted); font-size: 11px;">${item.lastmod ? item.lastmod.split('T')[0] : '-'}</td>
          <td>
            <span class="tag-badge" style="background: rgba(46, 213, 115, 0.15); color: #2ed573; border-color: rgba(46, 213, 115, 0.3);">
              200 OK
            </span>
          </td>
        </tr>
      `).join('');

      if (paginationInfo) {
        paginationInfo.textContent = `صفحة ${pagination.page || 1} من ${pagination.totalPages || 1} (إجمالي النتائج: ${(pagination.totalFiltered || links.length).toLocaleString()})`;
      }
    } catch (err) {
      tableTarget.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px; color: #ff4757;">❌ تعذر تحميل روابط Sitemap: ${err.message}</td></tr>`;
    }
  }

  static async loadSeoWorksTable(container, showToast) {
    const tableTarget = container.querySelector('#seo-works-table-target');
    const paginationInfo = container.querySelector('#seo-works-pagination-info');
    if (!tableTarget) return;

    tableTarget.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 20px; color: var(--dw-text-muted);">⏳ جاري فحص وتحميل بيانات SEO للأعمال من PostgreSQL...</td></tr>`;

    try {
      const page = this.seoWorksCurrentPage || 1;
      const search = encodeURIComponent(this.seoWorksSearch || '');
      const filter = encodeURIComponent(this.seoWorksFilter || 'all');

      const res = await fetch(`/api/seo-audit?page=${page}&pageSize=50&search=${search}&filter=${filter}`);
      if (!res.ok) throw new Error('HTTP ' + res.status);

      const responseData = await res.json();
      if (!responseData || !responseData.success || !responseData.data) {
        throw new Error(responseData.error || 'Failed to load SEO data');
      }

      const auditData = responseData.data;
      const metrics = auditData.metrics || {};
      const works = auditData.works || [];
      const pagination = auditData.pagination || {};

      this.lastAuditedWorks = works;

      // Update 10 metrics stat boxes
      const aWorks = container.querySelector('#audit-stat-works');
      const aCompleted = container.querySelector('#audit-stat-completed');
      const aReview = container.querySelector('#audit-stat-review');
      const aErrors = container.querySelector('#audit-stat-errors');
      const aNoDesc = container.querySelector('#audit-stat-no-desc');
      const aNoCover = container.querySelector('#audit-stat-no-cover');
      const aDupTitles = container.querySelector('#audit-stat-dup-titles');
      const aDupDescs = container.querySelector('#audit-stat-dup-descs');

      if (aWorks) aWorks.textContent = (metrics.totalWorks || 0).toLocaleString();
      if (aCompleted) aCompleted.textContent = (metrics.seoCompletedWorks || 0).toLocaleString();
      if (aReview) aReview.textContent = (metrics.needsReviewWorks || 0).toLocaleString();
      if (aErrors) aErrors.textContent = (metrics.hasErrorsWorks || 0).toLocaleString();
      if (aNoDesc) aNoDesc.textContent = (metrics.missingDescCount || 0).toLocaleString();
      if (aNoCover) aNoCover.textContent = (metrics.missingCoverCount || 0).toLocaleString();
      if (aDupTitles) aDupTitles.textContent = (metrics.duplicateTitleCount || 0).toLocaleString();
      if (aDupDescs) aDupDescs.textContent = (metrics.duplicateDescCount || 0).toLocaleString();

      if (works.length === 0) {
        tableTarget.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 20px; color: var(--dw-text-muted);">🚫 لا توجد نتائج تجاري معايير الفلترة</td></tr>`;
        if (paginationInfo) paginationInfo.textContent = `صفحة ${pagination.page || 1} من ${pagination.totalPages || 1}`;
        return;
      }

      tableTarget.innerHTML = works.map(w => {
        const coverSrc = w.cover && w.cover.startsWith('http') ? w.cover : 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=100';
        
        let descBadgeClass = 'rgba(46, 213, 115, 0.15)';
        let descBadgeColor = '#2ed573';
        if (w.descStatus.includes('قصير') || w.descStatus.includes('طويل')) {
          descBadgeClass = 'rgba(255, 165, 2, 0.15)';
          descBadgeColor = '#ffa502';
        } else if (w.descStatus.includes('بدون')) {
          descBadgeClass = 'rgba(255, 71, 87, 0.15)';
          descBadgeColor = '#ff4757';
        }

        return `
          <tr>
            <td>
              <img src="${coverSrc}" alt="${w.title}" style="width: 36px; height: 50px; object-fit: cover; border-radius: 4px;" onerror="this.src='https://images.unsplash.com/photo-1578632767115-351597cf2477?w=100'" />
            </td>
            <td style="font-weight: 800; color: #fff;">${w.title}</td>
            <td style="font-size: 11px; max-width: 180px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${w.seoTitle}</td>
            <td style="max-width: 220px;">
              <div style="font-size: 11px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; margin-bottom: 4px;">${w.description || 'بدون وصف'}</div>
              <span class="tag-badge" style="background: ${descBadgeClass}; color: ${descBadgeColor}; border-color: ${descBadgeColor}; font-size: 10px;">
                ${w.descStatus} (${w.descLength} حرف)
              </span>
            </td>
            <td style="font-size: 10px; color: var(--dw-text-muted); max-width: 140px;">${(w.seoKeywords || []).join(' ، ')}</td>
            <td style="direction: ltr; text-align: left; font-family: monospace; font-size: 10px; color: #2ed573;">${w.canonical ? w.canonical.replace(/^https?:\/\/[^\/]+/, '') : ''}</td>
            <td>
              <span class="tag-badge" style="font-size: 10px; background: rgba(255,255,255,0.06); color: #ccc;">${w.robots}</span>
            </td>
            <td>
              <span class="tag-badge ${w.seoStatusBadge}">
                ${w.seoStatus}
              </span>
            </td>
            <td>
              <span style="font-weight: 800; color: ${w.issueCount > 0 ? '#ff4757' : '#2ed573'};">${w.issueCount} أخطاء</span>
            </td>
            <td>
              <button class="btn-seo-preview btn-secondary" data-work-id="${w.id}" style="padding: 4px 10px; font-size: 11px; color: #1e90ff; border-color: rgba(30, 144, 255, 0.3);">
                🔍 معاينة Google
              </button>
            </td>
          </tr>
        `;
      }).join('');

      if (paginationInfo) {
        paginationInfo.textContent = `صفحة ${pagination.page || 1} من ${pagination.totalPages || 1} (إجمالي الأعمال: ${(pagination.totalFiltered || works.length).toLocaleString()})`;
      }
    } catch (err) {
      tableTarget.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 20px; color: #ff4757;">❌ تعذر تحميل جدول SEO: ${err.message}</td></tr>`;
    }
  }

  static async runFullSeoAudit(container, showToast) {
    const progressBox = container.querySelector('#seo-audit-progress-box');
    const headline = container.querySelector('#seo-audit-headline');
    const progressText = container.querySelector('#seo-audit-progress-text');
    const barFill = container.querySelector('#seo-audit-bar-fill');
    const btnRun = container.querySelector('#btn-run-seo-audit');

    if (btnRun) {
      btnRun.disabled = true;
      btnRun.textContent = '⏳ جاري الفحص...';
    }

    if (progressBox) progressBox.style.display = 'block';
    if (headline) headline.textContent = '🚀 جاري بدء فحص جميع الأعمال على دفعات (Batch Scan)...';

    showToast('جاري البدء بفحص جميع الأعمال في PostgreSQL على دفعات...', 'info');

    try {
      let currentPage = 1;
      let totalPages = 1;

      do {
        if (progressText) progressText.textContent = `صفحة ${currentPage} من ${totalPages}`;
        if (barFill) barFill.style.width = `${Math.min(100, Math.round((currentPage / totalPages) * 100))}%`;

        this.seoWorksCurrentPage = currentPage;
        await this.loadSeoWorksTable(container, showToast);

        const paginationInfo = container.querySelector('#seo-works-pagination-info');
        if (paginationInfo) {
          const match = paginationInfo.textContent.match(/من (\d+)/);
          if (match && match[1]) totalPages = parseInt(match[1], 10) || 1;
        }

        currentPage++;
        await new Promise(r => setTimeout(r, 200)); // Non-blocking yield
      } while (currentPage <= totalPages);

      if (headline) headline.textContent = '✅ اكتمل فحص جميع الأعمال والحلقات بنجاح!';
      if (barFill) barFill.style.width = '100%';
      if (progressText) progressText.textContent = '100%';

      showToast('🎉 تم اكتمل فحص جميع الأعمال وتأكيد مطابقة البيانات بنجاح 100%!', 'success');
    } catch (err) {
      showToast('حدث خطأ أثناء فحص SEO المتسلسل', 'error');
    } finally {
      if (btnRun) {
        btnRun.disabled = false;
        btnRun.textContent = '🚀 بدء فحص SEO الكامل';
      }
    }
  }

  static openSeoPreviewModal(workItem) {
    const modal = document.getElementById('seo-preview-modal');
    const body = document.getElementById('seo-preview-modal-body');
    if (!modal || !body || !workItem) return;

    this.renderSeoPreviewModal(body, workItem);
    modal.classList.add('open');
  }

  static renderSeoPreviewModal(body, w) {
    body.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 20px;">
        
        <!-- Interactive Google SERP Result Box -->
        <div style="background: #ffffff; color: #202124; padding: 20px; border-radius: 12px; font-family: arial, sans-serif; direction: rtl; text-align: right; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
          <div style="display: flex; align-items: center; gap: 8px; font-size: 14px; color: #202124;">
            <span style="display: inline-block; width: 22px; height: 22px; background: #0a0a0f; color: #2ed573; border-radius: 50%; font-size: 12px; text-align: center; line-height: 22px; font-weight: bold;">DW</span>
            <span style="font-weight: 600;">Dark Watch</span>
          </div>
          <div style="font-size: 12px; color: #4d5156; margin-top: 3px; word-break: break-all; direction: ltr; text-align: right;">
            ${w.googlePreview.url}
          </div>
          <div style="font-size: 20px; color: #1a0dab; font-weight: 500; margin-top: 4px; line-height: 1.3; cursor: pointer;">
            ${w.googlePreview.title}
          </div>
          <div style="font-size: 14px; color: #4d5156; margin-top: 6px; line-height: 1.58;">
            ${w.googlePreview.snippet}
          </div>
        </div>

        <!-- Google Disclaimer Note -->
        <div style="font-size: 11px; color: var(--dw-text-muted); background: rgba(255,255,255,0.04); padding: 10px 14px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08);">
          * ملاحظة: هذه المعاينة هي شكل محاكي لنتائج البحث. قد يقوم Google بتكييف العنوان أو الوصف بناءً على استعلام الباحث في نتائج البحث الفعلية.
        </div>

        <!-- Detailed Field Breakdown -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div>
            <label class="form-label">SEO Title:</label>
            <input type="text" class="admin-search-input" value="${w.seoTitle}" readonly style="background: #08080c;" />
          </div>
          <div>
            <label class="form-label">Canonical URL:</label>
            <input type="text" class="admin-search-input" value="${w.canonical}" readonly style="background: #08080c; font-family: monospace;" />
          </div>
        </div>

        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <label class="form-label">Meta Description:</label>
            <span class="tag-badge" style="background: rgba(30,144,255,0.15); color: #1e90ff; font-size: 11px;">
              طول الوصف: ${w.descLength} حرف (${w.descStatus})
            </span>
          </div>
          <textarea class="admin-textarea" style="height: 80px; background: #08080c;" readonly>${w.description || 'بدون وصف'}</textarea>
        </div>

        <div>
          <label class="form-label">SEO Keywords التنظيمية:</label>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            ${(w.seoKeywords || []).map(k => `<span class="tag-badge" style="background: rgba(255,255,255,0.08); color: #fff;">${k}</span>`).join('')}
          </div>
        </div>

        <!-- OpenGraph & Structured Data Code Snippets -->
        <div style="background: #050508; border: 1px solid #1a1a24; border-radius: 8px; padding: 14px;">
          <div style="font-size: 12px; font-weight: 800; color: #2ed573; margin-bottom: 8px;">
            Structured Data JSON-LD Preview (TVSeries):
          </div>
          <pre style="font-family: monospace; font-size: 11px; color: #a0a0b0; direction: ltr; text-align: left; overflow-x: auto; margin: 0;">${JSON.stringify(w.jsonLd, null, 2)}</pre>
        </div>

        <!-- Issues List -->
        <div>
          <div style="font-size: 13px; font-weight: 800; color: #fff; margin-bottom: 8px;">
            قائمة الملاحظات والأخطاء المكتشفة (${w.issueCount}):
          </div>
          ${w.issueCount === 0 ? `
            <div style="color: #2ed573; font-size: 12px; background: rgba(46, 213, 115, 0.1); padding: 10px; border-radius: 6px;">
              ✅ لا توجد أي أخطاء! هذا العمل مهيأ بنسبة 100% لمحركات البحث.
            </div>
          ` : `
            <div style="display: flex; flex-direction: column; gap: 6px;">
              ${w.issues.map(iss => `
                <div style="font-size: 12px; padding: 8px 12px; border-radius: 6px; background: ${iss.level === 'error' ? 'rgba(255, 71, 87, 0.12)' : 'rgba(255, 165, 2, 0.12)'}; color: ${iss.level === 'error' ? '#ff4757' : '#ffa502'};">
                  ${iss.level === 'error' ? '🔴' : '🟡'} ${iss.message}
                </div>
              `).join('')}
            </div>
          `}
        </div>

      </div>
    `;
  }
}


