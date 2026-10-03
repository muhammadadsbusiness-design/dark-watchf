/**
 * Dark Watch - PostgreSQL Persistent Data Store
 * Connects directly to backend API (/api/works, /api/save-data, /api/update-status, /api/delete-work, /api/test-db).
 * PostgreSQL (Neon) serves as the primary and permanent source of truth for all works, episodes, and servers.
 */

import { APP_CONFIG } from './config.js';

class DataStore {
  constructor() {
    this.works = [];       // PUBLISHED works
    this.drafts = [];      // DRAFT works (المخزن / غير منشورة)
    this.archived = [];    // ARCHIVED works
    this.importLogs = [];  // Import logs
    this.isLoaded = false;
    this.listeners = [];
    this.lastUpdated = new Date().toISOString();
    this.dbStatus = {
      connected: false,
      source: 'checking',
      message: 'جاري التحقق من التخزين...',
      lastChecked: null
    };
  }

  async init() {
    try {
      await this.reloadFromDatabase();
      await this.fetchImportLogs();
      await this.checkDbHealth();
    } catch (err) {
      console.error('DataStore init error:', err);
    } finally {
      this.isLoaded = true;
      this.notifyListeners();
    }
  }

  async reloadFromDatabase() {
    try {
      const response = await fetch('/api/works?t=' + Date.now());
      if (response.ok) {
        const data = await response.json();
        if (data && Array.isArray(data.works)) {
          this.setAllWorks(data.works, data.lastUpdated);
          this.dbStatus.source = data.source || 'postgresql';
          this.dbStatus.connected = Boolean(data.connected);
          return true;
        }
      }
    } catch (fetchErr) {
      console.warn('API fetch error:', fetchErr);
    }

    // Default to empty array if DB has no works or connection is unavailable
    this.setAllWorks([], new Date().toISOString());
    return false;
  }

  setAllWorks(allWorks, lastUpdated) {
    const list = Array.isArray(allWorks) ? allWorks : [];
    this.lastUpdated = lastUpdated || new Date().toISOString();
    this.works = list.filter(w => w && (w.statusState || 'PUBLISHED') === 'PUBLISHED');
    this.drafts = list.filter(w => w && w.statusState === 'DRAFT');
    this.archived = list.filter(w => w && w.statusState === 'ARCHIVED');
  }

  async fetchImportLogs() {
    try {
      const response = await fetch('/api/save-imports?t=' + Date.now());
      if (response.ok) {
        const data = await response.json();
        this.importLogs = Array.isArray(data.logs) ? data.logs : [];
      }
    } catch (e) {
      console.warn('Could not fetch import logs:', e.message);
      this.importLogs = [];
    }
  }

  async checkDbHealth() {
    try {
      const resp = await fetch('/api/test-db?t=' + Date.now());
      if (resp.ok) {
        const data = await resp.json();
        this.dbStatus = {
          connected: Boolean(data.connected),
          source: data.connected ? 'postgresql' : 'none',
          message: data.message,
          activeEnvVar: data.activeEnvVar,
          reason: data.reason,
          latencyMs: data.latencyMs,
          version: data.version,
          worksCount: data.worksCount,
          episodesCount: data.episodesCount,
          lastChecked: data.testedAt || new Date().toISOString()
        };
      }
    } catch (err) {
      this.dbStatus = {
        connected: false,
        source: 'error',
        message: 'تعذر الاتصال بـ API فحص قاعدة البيانات: ' + (err.message || 'خطأ'),
        lastChecked: new Date().toISOString()
      };
    }
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notifyListeners() {
    this.listeners.forEach(cb => {
      try {
        cb();
      } catch (e) {
        console.error('DataStore listener error:', e);
      }
    });
  }

  // --- Public Queries (Respecting ANIME_ENABLED flag) ---

  getAllPublished() {
    if (!APP_CONFIG.ANIME_ENABLED) {
      return this.works.filter(w => w && (w.type || '').toLowerCase() !== 'anime');
    }
    return [...this.works];
  }

  getAnime() {
    if (!APP_CONFIG.ANIME_ENABLED) {
      return [];
    }
    return this.works.filter(w => w && (w.type || '').toLowerCase() === 'anime');
  }

  getAllAnimeAdmin() {
    // Admin query: retrieves all anime regardless of public flag
    return this.getAllWorks().filter(w => w && (w.type || '').toLowerCase() === 'anime');
  }

  getCartoon() {
    return this.works.filter(w => w && (w.type || '').toLowerCase() === 'cartoon');
  }

  getBySlug(slug, allowDisabledAnime = false) {
    if (!slug) return null;
    const normalized = decodeURIComponent(slug).trim().toLowerCase();
    const all = this.getAllWorks();
    const match = all.find(w => 
      w && (
        (w.slug && w.slug.toLowerCase() === normalized) ||
        (w.id && w.id.toLowerCase() === normalized)
      )
    );

    if (!match) return null;

    // If Anime is temporarily disabled and viewer is public, hide anime detail
    if (!APP_CONFIG.ANIME_ENABLED && !allowDisabledAnime && (match.type || '').toLowerCase() === 'anime') {
      return null;
    }

    return match;
  }

  getById(id) {
    if (!id) return null;
    const all = this.getAllWorks();
    return all.find(w => w && (w.id === id || w.slug === id)) || null;
  }

  search(query) {
    if (!query || typeof query !== 'string') return [];
    const q = query.trim().toLowerCase();
    if (!q) return [];

    let list = this.works;
    if (!APP_CONFIG.ANIME_ENABLED) {
      list = list.filter(w => w && (w.type || '').toLowerCase() !== 'anime');
    }

    return list.filter(w => {
      if (!w) return false;
      const titleMatch = (w.title || '').toLowerCase().includes(q);
      const originalTitleMatch = (w.originalTitle || '').toLowerCase().includes(q);
      const slugMatch = (w.slug || '').toLowerCase().includes(q);
      const descMatch = (w.description || '').toLowerCase().includes(q);
      const altMatch = Array.isArray(w.altNames) && w.altNames.some(alt => (alt || '').toLowerCase().includes(q));
      return titleMatch || originalTitleMatch || slugMatch || descMatch || altMatch;
    });
  }

  getAllWorks() {
    return [...this.works, ...this.drafts, ...this.archived].filter(Boolean);
  }

  getDrafts() {
    return [...this.drafts].filter(Boolean);
  }

  getArchived() {
    return [...this.archived].filter(Boolean);
  }

  getImportLogs() {
    return [...this.importLogs].filter(Boolean);
  }

  getStats() {
    const all = this.getAllWorks();
    const totalEpisodes = all.reduce((acc, w) => {
      if (!w) return acc;
      return acc + (Array.isArray(w.episodes) ? w.episodes.length : (parseInt(w.episodesCount, 10) || 0));
    }, 0);

    const totalServers = all.reduce((acc, w) => {
      if (!w || !Array.isArray(w.episodes)) return acc;
      return acc + w.episodes.reduce((eAcc, ep) => {
        if (!ep || !Array.isArray(ep.servers)) return eAcc;
        return eAcc + ep.servers.length;
      }, 0);
    }, 0);

    const lastImport = this.importLogs.length > 0 
      ? this.importLogs[0].importedAt 
      : null;

    return {
      totalWorks: all.length,
      publishedCount: this.works.length,
      draftsCount: this.drafts.length,
      archivedCount: this.archived.length,
      animeCount: all.filter(w => w && (w.type || '').toLowerCase() === 'anime').length,
      cartoonCount: all.filter(w => w && (w.type || '').toLowerCase() === 'cartoon').length,
      animeEnabled: APP_CONFIG.ANIME_ENABLED,
      totalEpisodes,
      totalServers,
      totalImports: this.importLogs.length,
      lastImport,
      lastUpdated: this.lastUpdated,
      dbStatus: this.dbStatus
    };
  }

  // --- Real-time Batch Transfer to Storage (المخزن) / Live Site ---

  async transferWorksInBatches(newWorksList, targetState = 'DRAFT', batchSize = 25, onProgress = null) {
    if (!Array.isArray(newWorksList) || newWorksList.length === 0) {
      throw new Error('لا توجد أعمال محددة للحفظ.');
    }

    const total = newWorksList.length;
    let processed = 0;
    let saved = 0;
    let errorCount = 0;
    const errors = [];

    // Split into batches
    const batches = [];
    for (let i = 0; i < total; i += batchSize) {
      batches.push(newWorksList.slice(i, i + batchSize));
    }

    // Initial Progress Notification (0%)
    if (typeof onProgress === 'function') {
      onProgress({
        total,
        processed: 0,
        saved: 0,
        remaining: total,
        percent: 0,
        currentWorkTitle: newWorksList[0]?.title || 'بدء العملية...',
        statusText: 'بدء الاتصال بقاعدة بيانات PostgreSQL...',
        isDone: false,
        errors: []
      });
    }

    for (let bIndex = 0; bIndex < batches.length; bIndex++) {
      const batch = batches[bIndex];
      const processedBatch = batch.map(w => ({
        ...w,
        statusState: targetState
      }));

      const firstTitleInBatch = batch[0]?.title || `الدفعة ${bIndex + 1}`;

      // Notify progress start of batch
      if (typeof onProgress === 'function') {
        const currentPercent = Math.round((processed / total) * 100);
        onProgress({
          total,
          processed,
          saved,
          remaining: total - processed,
          percent: currentPercent,
          currentWorkTitle: firstTitleInBatch,
          statusText: `جاري حفظ الدفعة ${bIndex + 1} من ${batches.length} (${batch.length} عمل)...`,
          isDone: false,
          errors
        });
      }

      try {
        const response = await fetch('/api/save-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            works: processedBatch,
            statusState: targetState
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `خطأ في الخادم (${response.status})`);
        }

        const resData = await response.json();
        if (resData.success === false) {
          throw new Error(resData.error || 'فشل حفظ الدفعة في قاعدة البيانات');
        }

        const batchSaved = resData.savedCount !== undefined ? resData.savedCount : batch.length;
        saved += batchSaved;
        processed += batch.length;

        if (resData.errors && Array.isArray(resData.errors)) {
          errors.push(...resData.errors);
          errorCount += resData.errorCount || 0;
        }

      } catch (err) {
        console.error(`Error processing batch ${bIndex + 1}:`, err);
        errorCount += batch.length;
        processed += batch.length;
        errors.push({ batch: bIndex + 1, error: err.message });
      }

      // Notify progress after batch completion
      const updatedPercent = Math.min(100, Math.round((processed / total) * 100));
      if (typeof onProgress === 'function') {
        onProgress({
          total,
          processed,
          saved,
          remaining: total - processed,
          percent: updatedPercent,
          currentWorkTitle: batch[batch.length - 1]?.title || firstTitleInBatch,
          statusText: `تم حفظ ${saved} من أصل ${total} عمل في PostgreSQL...`,
          isDone: processed >= total,
          errors
        });
      }

      await new Promise(r => setTimeout(r, 30));
    }

    // Reload from PostgreSQL
    await this.reloadFromDatabase();
    this.notifyListeners();

    // Final Done Notification (100%)
    if (typeof onProgress === 'function') {
      onProgress({
        total,
        processed,
        saved,
        remaining: 0,
        percent: 100,
        currentWorkTitle: 'اكتمل الحفظ',
        statusText: `اكتمل نقل جميع الأعمال بنجاح! تم حفظ ${saved} عمل بشكل دائم في PostgreSQL.`,
        isDone: true,
        errors
      });
    }

    return {
      success: true,
      total,
      savedCount: saved,
      errorCount,
      errors,
      totalInDatabase: this.getAllWorks().length
    };
  }

  async loadWorksIntoSite(newWorksList, targetState = 'PUBLISHED') {
    return this.transferWorksInBatches(newWorksList, targetState, 50);
  }

  async updateWorkStatus(workIds, targetState = 'PUBLISHED') {
    const ids = Array.isArray(workIds) ? workIds.filter(Boolean) : [workIds].filter(Boolean);
    if (ids.length === 0) return { success: true, updatedCount: 0 };

    try {
      const response = await fetch('/api/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids,
          statusState: targetState
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'فشل تحديث حالة العمل في قاعدة البيانات');
      }

      const all = this.getAllWorks();
      all.forEach(w => {
        if (w && (ids.includes(w.id) || ids.includes(w.slug))) {
          w.statusState = targetState;
          w.updatedAt = new Date().toISOString();
        }
      });
      this.setAllWorks(all, new Date().toISOString());
      this.notifyListeners();

      return await response.json();
    } catch (err) {
      console.error('updateWorkStatus error:', err);
      throw err;
    }
  }

  async publishWork(id) {
    return this.updateWorkStatus([id], 'PUBLISHED');
  }

  async unpublishWork(id) {
    return this.updateWorkStatus([id], 'DRAFT');
  }

  async archiveWork(id) {
    return this.updateWorkStatus([id], 'ARCHIVED');
  }

  async publishSelected(ids) {
    const res = await this.updateWorkStatus(ids, 'PUBLISHED');
    return res.updatedCount || ids.length;
  }

  async archiveSelected(ids) {
    const res = await this.updateWorkStatus(ids, 'ARCHIVED');
    return res.updatedCount || ids.length;
  }

  async commitDraftsToPublished() {
    const draftIds = this.drafts.map(w => w?.id).filter(Boolean);
    if (draftIds.length === 0) return { success: true, count: 0 };
    const res = await this.updateWorkStatus(draftIds, 'PUBLISHED');
    return { success: true, count: res.updatedCount || draftIds.length };
  }

  async updateWork(id, updatedFields) {
    const work = this.getById(id);
    if (!work) return false;

    const merged = { ...work, ...updatedFields };
    await this.transferWorksInBatches([merged], merged.statusState || 'PUBLISHED', 1);
    return true;
  }

  async deleteWork(id) {
    try {
      const response = await fetch('/api/delete-work', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'فشل في حذف العمل من قاعدة البيانات');
      }

      this.works = this.works.filter(w => w && w.id !== id && w.slug !== id);
      this.drafts = this.drafts.filter(w => w && w.id !== id && w.slug !== id);
      this.archived = this.archived.filter(w => w && w.id !== id && w.slug !== id);
      this.notifyListeners();

      return true;
    } catch (err) {
      console.error('Delete work error:', err);
      this.works = this.works.filter(w => w && w.id !== id && w.slug !== id);
      this.drafts = this.drafts.filter(w => w && w.id !== id && w.slug !== id);
      this.archived = this.archived.filter(w => w && w.id !== id && w.slug !== id);
      this.notifyListeners();
      return true;
    }
  }

  async deleteSelected(ids) {
    const validIds = Array.isArray(ids) ? ids.filter(Boolean) : [];
    if (validIds.length === 0) return true;

    try {
      const response = await fetch('/api/delete-work', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: validIds })
      });

      if (response.ok) {
        this.works = this.works.filter(w => w && !validIds.includes(w.id) && !validIds.includes(w.slug));
        this.drafts = this.drafts.filter(w => w && !validIds.includes(w.id) && !validIds.includes(w.slug));
        this.archived = this.archived.filter(w => w && !validIds.includes(w.id) && !validIds.includes(w.slug));
        this.notifyListeners();
        return true;
      }
    } catch {
      // Fallback local removal
    }

    for (const id of validIds) {
      await this.deleteWork(id);
    }
    return true;
  }

  async addImportLog(logData) {
    try {
      const response = await fetch('/api/save-imports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log: logData })
      });
      if (response.ok) {
        this.importLogs.unshift(logData);
        this.notifyListeners();
      }
    } catch (e) {
      console.warn('Could not save import log:', e.message);
    }
  }

  async testDatabaseConnection() {
    try {
      const response = await fetch('/api/test-db?t=' + Date.now());
      if (response.ok) {
        const result = await response.json();
        this.dbStatus = {
          connected: Boolean(result.connected),
          source: result.connected ? 'postgresql' : 'none',
          message: result.message,
          activeEnvVar: result.activeEnvVar,
          reason: result.reason,
          latencyMs: result.latencyMs,
          version: result.version,
          worksCount: result.worksCount,
          episodesCount: result.episodesCount,
          lastChecked: result.testedAt || new Date().toISOString()
        };
        this.notifyListeners();
        return result;
      } else {
        const err = await response.json().catch(() => ({}));
        const failedResult = {
          connected: false,
          message: err.message || err.error || 'فشل فحص الاتصال بقاعدة البيانات',
          testedAt: new Date().toISOString()
        };
        this.dbStatus = failedResult;
        this.notifyListeners();
        return failedResult;
      }
    } catch (err) {
      const failedResult = {
        connected: false,
        message: 'تعذر الاتصال بالسيرفر: ' + err.message,
        testedAt: new Date().toISOString()
      };
      this.dbStatus = failedResult;
      this.notifyListeners();
      return failedResult;
    }
  }

  downloadWorksJSON() {
    const data = {
      version: '1.0',
      databaseEngine: 'PostgreSQL',
      lastUpdated: new Date().toISOString(),
      worksCount: this.getAllWorks().length,
      works: this.getAllWorks()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `darkwatch-works-postgresql-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export const dataStore = new DataStore();
