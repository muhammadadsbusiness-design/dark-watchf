import {
  getAllWorksFromPostgres,
  saveWorksToPostgres,
  deleteWorkFromPostgres,
  updateWorkStatusInPostgres,
  getRelatedWorksFromPostgres,
  getConnectionString,
  sanitizeError
} from './_db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = req.url || '';
  const urlParams = new URLSearchParams(url.split('?')[1] || '');
  const action = urlParams.get('action') || req.query?.action || '';

  // 1. DELETE Operations (/api/delete-work or method === DELETE)
  if (req.method === 'DELETE' || action === 'delete-work' || url.includes('/delete-work')) {
    try {
      const data = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const workIds = Array.isArray(data.ids)
        ? data.ids
        : (data.id || data.workId || data.slug ? [data.id || data.workId || data.slug] : []);

      if (workIds.length === 0) {
        return res.status(400).json({ success: false, error: 'لم يتم تحديد معرف العمل للحذف' });
      }

      const connStr = getConnectionString();
      if (!connStr) {
        return res.status(400).json({
          success: false,
          error: 'قاعدة بيانات PostgreSQL غير متصلة. يرجى إضافة POSTGRES_URL أو DATABASE_URL في إعدادات Vercel.'
        });
      }

      const result = await deleteWorkFromPostgres(workIds);
      return res.status(200).json({
        success: true,
        storage: 'postgresql',
        deletedWork: result.deletedWork,
        deletedCount: result.deletedCount
      });
    } catch (err) {
      const safeError = sanitizeError(err);
      console.error('Error deleting work from PostgreSQL:', safeError);
      return res.status(500).json({ success: false, error: safeError });
    }
  }

  // 2. Status Update (/api/update-status or action === update-status)
  if (action === 'update-status' || url.includes('/update-status')) {
    try {
      const data = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const workIds = Array.isArray(data.ids) ? data.ids : (data.id ? [data.id] : []);
      const targetState = data.statusState || 'PUBLISHED';

      if (workIds.length === 0) {
        return res.status(400).json({ success: false, error: 'لم يتم تحديد معرفات الأعمال' });
      }

      const connStr = getConnectionString();
      if (!connStr) {
        return res.status(400).json({
          success: false,
          error: 'قاعدة بيانات PostgreSQL غير متصلة. يرجى إضافة POSTGRES_URL أو DATABASE_URL في إعدادات Vercel.'
        });
      }

      const result = await updateWorkStatusInPostgres(workIds, targetState);
      return res.status(200).json({
        success: true,
        storage: 'postgresql',
        updatedCount: result.updatedCount,
        targetState
      });
    } catch (err) {
      const safeError = sanitizeError(err);
      console.error('Error updating work status in PostgreSQL:', safeError);
      return res.status(500).json({ success: false, error: safeError });
    }
  }

  // 3. Related Works (/api/related-works or action === related-works)
  if (action === 'related-works' || url.includes('/related-works')) {
    try {
      const workId = urlParams.get('id') || urlParams.get('slug') || req.query?.id || req.query?.slug || '';
      const limit = parseInt(urlParams.get('limit') || req.query?.limit || '6', 10);

      if (!workId) {
        return res.status(400).json({ success: false, error: 'المعرف id مطلوب' });
      }

      const related = await getRelatedWorksFromPostgres(workId, limit);
      return res.status(200).json({
        success: true,
        works: Array.isArray(related) ? related : [],
        count: Array.isArray(related) ? related.length : 0
      });
    } catch (err) {
      const safeErr = sanitizeError(err);
      console.error('Error fetching related works:', safeErr);
      return res.status(500).json({ success: false, works: [], error: safeErr });
    }
  }

  // 4. POST Save Operations (/api/save-data or POST /api/works)
  if (req.method === 'POST') {
    try {
      const data = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const worksList = Array.isArray(data.works)
        ? data.works
        : (data.title ? [data] : []);
      const targetState = data.statusState || 'PUBLISHED';

      const connStr = getConnectionString();
      if (!connStr) {
        return res.status(400).json({
          success: false,
          error: 'قاعدة بيانات PostgreSQL غير متصلة. يرجى إضافة POSTGRES_URL أو DATABASE_URL في إعدادات Vercel.'
        });
      }

      if (worksList.length === 0) {
        return res.status(200).json({
          success: true,
          storage: 'postgresql',
          count: 0,
          savedCount: 0,
          errorCount: 0,
          timestamp: new Date().toISOString()
        });
      }

      const result = await saveWorksToPostgres(worksList, targetState);
      return res.status(200).json({
        success: true,
        storage: 'postgresql',
        count: worksList.length,
        savedCount: result.savedCount,
        errorCount: result.errorCount,
        errors: result.errors,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      const safeError = sanitizeError(err);
      console.error('Error saving works to PostgreSQL:', safeError);
      return res.status(500).json({ success: false, error: safeError });
    }
  }

  // 5. GET Works / Search / Detail / Episodes / Pagination
  if (req.method === 'GET') {
    try {
      const connStr = getConnectionString();
      if (!connStr) {
        return res.status(200).json({
          source: 'none',
          connected: false,
          works: [],
          total: 0,
          message: 'لم يتم العثور على متغير البيئة POSTGRES_URL أو DATABASE_URL في Vercel',
          lastUpdated: new Date().toISOString()
        });
      }

      const works = await getAllWorksFromPostgres();
      const allList = Array.isArray(works) ? works : [];

      const paramId = urlParams.get('id') || urlParams.get('slug') || req.query?.id || req.query?.slug || '';
      const episodeIdParam = urlParams.get('episodeId') || req.query?.episodeId || '';
      const requestEpisodes = urlParams.get('episodes') === 'true' || req.query?.episodes === 'true';
      const episodeNumStr = urlParams.get('episodeNum') || req.query?.episodeNum || '';
      const requestServers = urlParams.get('servers') === 'true' || req.query?.servers === 'true';
      const typeFilter = urlParams.get('type') || req.query?.type || '';
      const statusStateFilter = urlParams.get('statusState') || req.query?.statusState || '';
      const pageStr = urlParams.get('page') || req.query?.page || '';
      const limitStr = urlParams.get('limit') || req.query?.limit || '';

      // Direct Episode ID lookup
      if (episodeIdParam) {
        const normEpId = decodeURIComponent(episodeIdParam).trim().toLowerCase();
        for (const w of allList) {
          if (!w || !Array.isArray(w.episodes)) continue;
          const foundEp = w.episodes.find(e => e && String(e.id).toLowerCase() === normEpId);
          if (foundEp) {
            if (requestServers) {
              return res.status(200).json({
                success: true,
                episodeId: foundEp.id,
                workId: w.id,
                servers: foundEp.servers || []
              });
            }
            return res.status(200).json({
              success: true,
              episode: foundEp,
              workId: w.id,
              workTitle: w.title
            });
          }
        }
        return res.status(404).json({ success: false, error: 'الحلقة غير موجودة' });
      }

      // Work ID / Slug lookup
      if (paramId) {
        const normId = decodeURIComponent(paramId).trim().toLowerCase();
        const found = allList.find(w =>
          w && (
            (w.id && String(w.id).toLowerCase() === normId) ||
            (w.slug && String(w.slug).toLowerCase() === normId)
          )
        );

        if (!found) {
          return res.status(404).json({ success: false, error: 'العمل غير موجود' });
        }

        if (episodeNumStr && requestServers) {
          const epNum = parseInt(episodeNumStr, 10);
          const ep = (found.episodes || []).find(e => e && e.number === epNum);
          return res.status(200).json({
            success: true,
            workId: found.id,
            episodeNumber: epNum,
            servers: ep ? (ep.servers || []) : []
          });
        }

        if (requestEpisodes) {
          return res.status(200).json({
            success: true,
            workId: found.id,
            episodes: found.episodes || []
          });
        }

        return res.status(200).json({
          success: true,
          work: found
        });
      }

      // List filtering
      let filteredList = allList;
      if (typeFilter) {
        const normType = typeFilter.trim().toLowerCase();
        filteredList = filteredList.filter(w => w && String(w.type || 'cartoon').toLowerCase() === normType);
      }
      if (statusStateFilter) {
        const normState = statusStateFilter.trim().toUpperCase();
        filteredList = filteredList.filter(w => w && String(w.statusState || 'PUBLISHED').toUpperCase() === normState);
      }

      // Pagination support
      if (pageStr || limitStr) {
        const page = Math.max(1, parseInt(pageStr, 10) || 1);
        const limit = Math.max(1, parseInt(limitStr, 10) || 24);
        const total = filteredList.length;
        const totalPages = Math.ceil(total / limit) || 1;
        const paginatedWorks = filteredList.slice((page - 1) * limit, page * limit);

        return res.status(200).json({
          source: 'postgresql',
          connected: true,
          works: paginatedWorks,
          total,
          page,
          limit,
          totalPages,
          lastUpdated: new Date().toISOString()
        });
      }

      return res.status(200).json({
        source: 'postgresql',
        connected: true,
        works: filteredList,
        lastUpdated: new Date().toISOString(),
        total: filteredList.length
      });
    } catch (err) {
      const safeError = sanitizeError(err);
      console.error('Error fetching works from PostgreSQL:', safeError);
      return res.status(500).json({ 
        success: false, 
        source: 'error',
        connected: false,
        works: [],
        total: 0,
        error: safeError 
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
