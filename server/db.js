import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const { Pool } = pg;

/**
 * Clean and trim quotes, semicolons or whitespace from environment variables
 */
export function cleanUrl(val) {
  if (!val || typeof val !== 'string') return '';
  let cleaned = val.trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  if (cleaned.endsWith(';')) {
    cleaned = cleaned.slice(0, -1).trim();
  }
  try {
    const u = new URL(cleaned);
    if (u.searchParams.has('channel_binding')) {
      u.searchParams.delete('channel_binding');
      cleaned = u.toString();
    }
  } catch {
    cleaned = cleaned.replace(/[?&]channel_binding=[^&]+/gi, '');
    if (cleaned.includes('&') && !cleaned.includes('?')) {
      cleaned = cleaned.replace('&', '?');
    }
  }
  if (cleaned.endsWith('?')) {
    cleaned = cleaned.slice(0, -1);
  }
  return cleaned;
}

/**
 * Resolves current site base URL dynamically without hardcoded domains.
 * Priority:
 * 1. SITE_URL / APP_URL environment variable if explicitly configured by user
 * 2. Incoming Vercel request headers (x-forwarded-proto + x-forwarded-host / host)
 * 3. VERCEL_URL environment variable fallback
 * 4. Client-side window.location.origin if in browser
 */
export function getSiteUrl(reqOrBaseUrl = null) {
  if (typeof reqOrBaseUrl === 'string' && reqOrBaseUrl.trim()) {
    let raw = reqOrBaseUrl.trim();
    if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
      raw = `https://${raw}`;
    }
    return raw.replace(/\/$/, '');
  }

  const req = (reqOrBaseUrl && typeof reqOrBaseUrl === 'object') ? reqOrBaseUrl : null;
  if (req && req.headers) {
    const proto = req.headers['x-forwarded-proto'] || (req.socket && req.socket.encrypted ? 'https' : 'https');
    const host = req.headers['x-forwarded-host'] || req.headers.host || req.headers[':authority'];
    if (host) {
      return `${proto}://${host}`.replace(/\/$/, '');
    }
  }

  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return window.location.origin.replace(/\/$/, '');
  }

  const envUrl = cleanUrl(process.env.SITE_URL || process.env.APP_URL);
  if (envUrl) {
    let formatted = envUrl;
    if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
      formatted = `https://${formatted}`;
    }
    return formatted.replace(/\/$/, '');
  }

  if (process.env.VERCEL_URL) {
    const vUrl = process.env.VERCEL_URL.startsWith('http') ? process.env.VERCEL_URL : `https://${process.env.VERCEL_URL}`;
    return vUrl.replace(/\/$/, '');
  }

  return '';
}

/**
 * Retrieves the PostgreSQL connection string with full compatibility for Vercel & Neon:
 * 1. POSTGRES_URL (Vercel Postgres / Neon integration pooled)
 * 2. DATABASE_URL (Neon / Supabase default)
 * 3. POSTGRES_PRISMA_URL (Vercel Prisma pooled)
 * 4. POSTGRES_URL_NON_POOLING (Direct Vercel Postgres)
 * 5. NEON_DATABASE_URL / DATABASE_AUTHENTICATED_URL
 * 6. SUPABASE_DB_URL / POSTGRESQL_URL / PGURI / PGSTRING
 * 7. Discrete credentials (POSTGRES_HOST, POSTGRES_USER, etc.)
 */
export function getConnectionString() {
  const url = cleanUrl(process.env.POSTGRES_URL) ||
              cleanUrl(process.env.DATABASE_URL) ||
              cleanUrl(process.env.POSTGRES_PRISMA_URL) ||
              cleanUrl(process.env.POSTGRES_URL_NON_POOLING) ||
              cleanUrl(process.env.NEON_DATABASE_URL) ||
              cleanUrl(process.env.DATABASE_AUTHENTICATED_URL) ||
              cleanUrl(process.env.SUPABASE_DB_URL) ||
              cleanUrl(process.env.POSTGRESQL_URL) ||
              cleanUrl(process.env.PGURI) ||
              cleanUrl(process.env.PGSTRING) ||
              cleanUrl(process.env.PG_CONNECTION_STRING);

  if (url) return url;

  // Discrete variables fallback for custom configurations
  const host = cleanUrl(process.env.POSTGRES_HOST || process.env.PGHOST);
  const user = cleanUrl(process.env.POSTGRES_USER || process.env.PGUSER);
  const password = cleanUrl(process.env.POSTGRES_PASSWORD || process.env.PGPASSWORD);
  const database = cleanUrl(process.env.POSTGRES_DATABASE || process.env.PGDATABASE || process.env.POSTGRES_DB);
  const port = cleanUrl(process.env.POSTGRES_PORT || process.env.PGPORT) || '5432';

  if (host && user && database) {
    const encodedUser = encodeURIComponent(user);
    const encodedPass = password ? `:${encodeURIComponent(password)}` : '';
    const isLocal = host === 'localhost' || host === '127.0.0.1';
    const sslParam = isLocal ? '' : '?sslmode=require';
    return `postgres://${encodedUser}${encodedPass}@${host}:${port}/${database}${sslParam}`;
  }

  return null;
}

/**
 * Returns which environment variable provided the connection string
 */
export function getActiveEnvVarName() {
  if (cleanUrl(process.env.POSTGRES_URL)) return 'POSTGRES_URL';
  if (cleanUrl(process.env.DATABASE_URL)) return 'DATABASE_URL';
  if (cleanUrl(process.env.POSTGRES_PRISMA_URL)) return 'POSTGRES_PRISMA_URL';
  if (cleanUrl(process.env.POSTGRES_URL_NON_POOLING)) return 'POSTGRES_URL_NON_POOLING';
  if (cleanUrl(process.env.NEON_DATABASE_URL)) return 'NEON_DATABASE_URL';
  if (cleanUrl(process.env.DATABASE_AUTHENTICATED_URL)) return 'DATABASE_AUTHENTICATED_URL';
  if (cleanUrl(process.env.SUPABASE_DB_URL)) return 'SUPABASE_DB_URL';
  if (cleanUrl(process.env.POSTGRESQL_URL)) return 'POSTGRESQL_URL';
  if (cleanUrl(process.env.PGURI)) return 'PGURI';
  if (cleanUrl(process.env.PGSTRING)) return 'PGSTRING';
  if (cleanUrl(process.env.PG_CONNECTION_STRING)) return 'PG_CONNECTION_STRING';
  if (cleanUrl(process.env.POSTGRES_HOST || process.env.PGHOST)) return 'POSTGRES_HOST (Discrete)';
  return null;
}

/**
 * Sanitizes errors so passwords and secrets are NEVER exposed in logs or responses
 */
export function sanitizeError(err) {
  if (!err) return 'Unknown error';
  let msg = typeof err === 'string' ? err : (err.message || String(err));
  msg = msg.replace(/postgres(?:ql)?:\/\/[^@:]+(?::[^@]*)?@/gi, 'postgres://****:****@');
  return msg;
}

/**
 * Safely parses JSON strings or returns fallback value without throwing
 */
export function safeJsonParse(val, fallback = []) {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') return val;
  if (typeof val !== 'string') return fallback;
  const trimmed = val.trim();
  if (!trimmed) return fallback;
  try {
    return JSON.parse(trimmed);
  } catch {
    return fallback;
  }
}

// Global Singleton Connection Pool across warm Vercel serverless containers
let globalPool = null;
let activeConnString = null;

/**
 * Returns the singleton PostgreSQL Connection Pool tuned specifically for Vercel Serverless
 */
export function getPool() {
  const connStr = getConnectionString();
  if (!connStr) return null;

  if (globalPool && activeConnString === connStr) {
    return globalPool;
  }

  // Gracefully terminate prior pool if connection string was updated
  if (globalPool) {
    try {
      globalPool.end().catch(() => {});
    } catch {
      // Ignore
    }
    globalPool = null;
  }

  activeConnString = connStr;
  const isLocal = connStr.includes('localhost') || connStr.includes('127.0.0.1');

  // Vercel Serverless & Neon optimized configuration:
  // - max: 2 connections per container to avoid connection limits on serverless scaling
  // - allowExitOnIdle: true to allow clean event-loop exit in Vercel Fluid Compute
  // - idleTimeoutMillis: 10000 to quickly release idle sockets
  // - connectionTimeoutMillis: 7000 to give Neon compute enough time to wake up while failing fast
  globalPool = new Pool({
    connectionString: connStr,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: 2,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 7000,
    allowExitOnIdle: true
  });

  globalPool.on('error', (err) => {
    console.warn('PostgreSQL pool client warning/error:', sanitizeError(err));
    const msg = String(err?.message || '').toLowerCase();
    if (msg.includes('connection') || msg.includes('socket') || msg.includes('terminated')) {
      globalPool = null;
      activeConnString = null;
    }
  });

  return globalPool;
}

/**
 * Exported pool proxy allowing standard pool.query(...) usage across modules
 */
export const pool = new Proxy({}, {
  get(target, prop) {
    const active = getPool();
    if (!active) {
      throw new Error('PostgreSQL connection pool not initialized. Please set POSTGRES_URL or DATABASE_URL in Vercel environment variables.');
    }
    const val = active[prop];
    return typeof val === 'function' ? val.bind(active) : val;
  }
});

/**
 * Detects whether an error is transient (e.g. Neon compute sleep, severed socket, or serverless cold reset)
 */
function isRetryableError(err) {
  if (!err) return false;
  const msg = String(err.message || err).toLowerCase();
  return (
    msg.includes('connection terminated') ||
    msg.includes('client has encountered a connection error') ||
    msg.includes('socket closed') ||
    msg.includes('econnreset') ||
    msg.includes('closed by remote peer') ||
    msg.includes('terminating connection') ||
    msg.includes('the database system is starting up') ||
    msg.includes('the database system is in recovery mode') ||
    msg.includes('connection timeout') ||
    msg.includes('broken pipe')
  );
}

/**
 * Central parameterized query runner using Connection Pool with auto-retry on transient serverless socket resets
 */
export async function query(text, params = []) {
  const currentPool = getPool();
  if (!currentPool) {
    throw new Error('PostgreSQL is not connected. Please set POSTGRES_URL or DATABASE_URL in Vercel Environment Variables.');
  }

  try {
    return await currentPool.query(text, params);
  } catch (err) {
    if (isRetryableError(err)) {
      console.warn('Transient serverless connection error detected. Reconnecting pool and retrying query...', sanitizeError(err));
      try {
        await currentPool.end().catch(() => {});
      } catch {
        // Ignore
      }
      globalPool = null;
      activeConnString = null;

      // Small backoff (350ms) to allow Neon / serverless database compute to wake up
      await new Promise(resolve => setTimeout(resolve, 350));

      const retryPool = getPool();
      if (!retryPool) {
        throw err;
      }
      return await retryPool.query(text, params);
    }
    throw err;
  }
}

/**
 * Tagged template literal SQL query runner
 * Example: await sql`SELECT * FROM dw_works WHERE id = ${id}`;
 */
export async function sql(strings, ...values) {
  let text = '';
  const params = [];

  for (let i = 0; i < strings.length; i++) {
    text += strings[i];
    if (i < values.length) {
      params.push(values[i]);
      text += `$${params.length}`;
    }
  }

  const result = await query(text, params);
  return result.rows;
}

export function getSql() {
  const p = getPool();
  if (!p) return null;
  return sql;
}

let dbInitialized = false;
let initDbPromise = null;

/**
 * Initializes tables non-destructively (CREATE IF NOT EXISTS) with concurrency latch
 */
export async function initDb() {
  const p = getPool();
  if (!p) {
    return { connected: false, message: 'لم يتم العثور على متغير البيئة POSTGRES_URL أو DATABASE_URL في Vercel أو .env' };
  }

  if (dbInitialized) {
    return { connected: true, message: 'قاعدة البيانات مهيأة مسبقاً' };
  }

  if (initDbPromise) {
    return initDbPromise;
  }

  initDbPromise = (async () => {
    try {
      // 1. Works Table
      await sql`
        CREATE TABLE IF NOT EXISTS dw_works (
          id VARCHAR(255) PRIMARY KEY,
          slug VARCHAR(255) UNIQUE NOT NULL,
          title TEXT NOT NULL,
          original_title TEXT,
          alt_names JSONB DEFAULT '[]'::jsonb,
          type VARCHAR(50) DEFAULT 'cartoon',
          status VARCHAR(50) DEFAULT 'مكتمل',
          status_state VARCHAR(50) DEFAULT 'PUBLISHED',
          year VARCHAR(50),
          cover TEXT,
          banner TEXT,
          description TEXT,
          episodes_count INT DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
      `;

      try {
        await sql`ALTER TABLE dw_works ADD COLUMN IF NOT EXISTS banner TEXT;`;
      } catch {
        // Ignore concurrent DDL
      }

      try {
        await sql`CREATE INDEX IF NOT EXISTS idx_dw_works_slug ON dw_works(slug);`;
        await sql`CREATE INDEX IF NOT EXISTS idx_dw_works_type ON dw_works(type);`;
        await sql`CREATE INDEX IF NOT EXISTS idx_dw_works_state ON dw_works(status_state);`;
      } catch {
        // Ignore concurrent DDL
      }

      // 2. Episodes Table
      await sql`
        CREATE TABLE IF NOT EXISTS dw_episodes (
          id VARCHAR(255) PRIMARY KEY,
          work_id VARCHAR(255) REFERENCES dw_works(id) ON DELETE CASCADE,
          number INT NOT NULL,
          title TEXT,
          servers JSONB DEFAULT '[]'::jsonb,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT uq_dw_episodes_work_num UNIQUE (work_id, number)
        );
      `;

      try {
        await sql`CREATE INDEX IF NOT EXISTS idx_dw_episodes_work ON dw_episodes(work_id);`;
      } catch {
        // Ignore concurrent DDL
      }

      // 3. Import Logs Table
      await sql`
        CREATE TABLE IF NOT EXISTS dw_import_logs (
          id VARCHAR(255) PRIMARY KEY,
          file_name TEXT,
          file_size TEXT,
          works_count INT DEFAULT 0,
          episodes_count INT DEFAULT 0,
          servers_count INT DEFAULT 0,
          status VARCHAR(50) DEFAULT 'نجاح',
          errors JSONB DEFAULT '[]'::jsonb,
          imported_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
      `;

      // 4. Settings Table
      await sql`
        CREATE TABLE IF NOT EXISTS dw_settings (
          key VARCHAR(255) PRIMARY KEY,
          value JSONB,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
      `;

      dbInitialized = true;
      return { connected: true, message: 'تم التحقق من جداول PostgreSQL بنجاح' };
    } catch (err) {
      const safeError = sanitizeError(err);
      if (safeError.includes('already exists') || safeError.includes('concurrently updated')) {
        dbInitialized = true;
        return { connected: true, message: 'تم التحقق من جداول PostgreSQL بنجاح' };
      }
      console.error('Error initializing PostgreSQL tables:', safeError);
      throw new Error(safeError);
    } finally {
      initDbPromise = null;
    }
  })();

  return initDbPromise;
}

/**
 * Cleans and deduplicates servers for an episode, removing invalid scraping page URLs
 */
export function cleanEpisodeServers(servers, episodeId = '') {
  if (!Array.isArray(servers) || servers.length === 0) return [];

  const hasRealStream = servers.some(s => {
    if (!s || !s.url) return false;
    const u = String(s.url).toLowerCase();
    return u.includes('.mp4') || u.includes('.m3u8') || u.includes('.webm') || u.includes('.mkv') ||
           u.includes('myvidplay') || u.includes('site.word.tn') || u.includes('streamtape') ||
           u.includes('dood') || u.includes('fembed') || u.includes('uqload') ||
           u.includes('drive.google') || u.includes('mega.nz') || u.includes('embed');
  });

  const seenUrls = new Set();
  const seenIds = new Set();
  const seenComposite = new Set();
  const validServers = [];

  for (const s of servers) {
    if (!s || !s.url) continue;
    const u = String(s.url).trim();
    const uLower = u.toLowerCase();

    if (hasRealStream) {
      if (uLower.includes('dima-toon.com/cartoon-episode') ||
          uLower.includes('dima-toon.com/anime-episode') ||
          uLower.includes('/cartoon-episode/') ||
          uLower.includes('/anime-episode/')) {
        continue;
      }
    }

    const sId = s.id ? String(s.id).trim() : '';
    const compKey = episodeId ? `${episodeId}_${u}` : u;

    if (seenUrls.has(u) || seenComposite.has(compKey)) continue;
    if (sId && seenIds.has(sId)) continue;

    seenUrls.add(u);
    seenComposite.add(compKey);
    if (sId) seenIds.add(sId);

    validServers.push({
      id: sId || `srv-${validServers.length + 1}`,
      name: validServers.length === 0 ? 'السرفر الأول' : (s.name || `السرفر ${validServers.length + 1}`),
      url: u,
      type: s.type || (u.includes('.mp4') || u.includes('.m3u8') ? 'video' : 'embed')
    });
  }

  return validServers.length > 0 ? validServers : servers.slice(0, 1);
}

/**
 * Upserts a single work and its episodes into PostgreSQL
 */
export async function upsertSingleWork(sqlFn, work, targetState = 'PUBLISHED') {
  if (!work || typeof work !== 'object') return;

  const executor = sqlFn || sql;

  let workId = String(work.id || '').trim();
  let slug = String(work.slug || '').trim();
  const title = String(work.title || 'عمل بدون عنوان').trim();

  if (!slug && title) {
    slug = title.toLowerCase().replace(/[\s\t\n]+/g, '-').replace(/[^\w\u0600-\u06FF\-]/g, '');
  }

  // 1. Resolve workId and slug against existing records in dw_works to prevent duplicate key violations
  let existingRow = null;
  if (workId) {
    try {
      const rowsById = await executor`SELECT id, slug FROM dw_works WHERE id = ${workId} LIMIT 1;`;
      if (rowsById && rowsById.length > 0) {
        existingRow = rowsById[0];
      }
    } catch {
      // Ignore
    }
  }

  if (!existingRow && slug) {
    try {
      const rowsBySlug = await executor`SELECT id, slug FROM dw_works WHERE slug = ${slug} LIMIT 1;`;
      if (rowsBySlug && rowsBySlug.length > 0) {
        existingRow = rowsBySlug[0];
      }
    } catch {
      // Ignore
    }
  }

  if (existingRow) {
    // Re-use the existing work's ID so ON CONFLICT (id) triggers update
    workId = existingRow.id;
    if (!slug) {
      slug = existingRow.slug;
    } else if (slug !== existingRow.slug) {
      try {
        const slugCheck = await executor`SELECT id FROM dw_works WHERE slug = ${slug} AND id != ${workId} LIMIT 1;`;
        if (slugCheck && slugCheck.length > 0) {
          slug = existingRow.slug;
        }
      } catch {
        slug = existingRow.slug;
      }
    }
  } else {
    if (!workId) {
      workId = `dw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    }
    if (!slug) {
      slug = workId;
    }
    try {
      const slugCheck = await executor`SELECT id FROM dw_works WHERE slug = ${slug} LIMIT 1;`;
      if (slugCheck && slugCheck.length > 0) {
        slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
      }
    } catch {
      // Ignore
    }
  }

  const originalTitle = String(work.originalTitle || '').trim();
  const altNames = JSON.stringify(Array.isArray(work.altNames) ? work.altNames : safeJsonParse(work.altNames, []));
  const type = String(work.type || 'cartoon').trim();
  const status = String(work.status || 'مكتمل').trim();
  const statusState = targetState || work.statusState || 'PUBLISHED';
  const year = String(work.year || '').trim();
  const cover = String(work.cover || '').trim();
  const banner = String(work.banner || work.cover || '').trim();
  const description = String(work.description || '').trim();
  const episodes = Array.isArray(work.episodes) ? work.episodes : [];
  const episodesCount = episodes.length || parseInt(work.episodesCount, 10) || 0;

  await executor`
    INSERT INTO dw_works (
      id, slug, title, original_title, alt_names, type, status, status_state, year, cover, banner, description, episodes_count, updated_at
    ) VALUES (
      ${workId}, ${slug}, ${title}, ${originalTitle}, ${altNames}::jsonb, ${type}, ${status}, ${statusState}, ${year}, ${cover}, ${banner}, ${description}, ${episodesCount}, CURRENT_TIMESTAMP
    )
    ON CONFLICT (id) DO UPDATE SET
      slug = EXCLUDED.slug,
      title = EXCLUDED.title,
      original_title = EXCLUDED.original_title,
      alt_names = EXCLUDED.alt_names,
      type = EXCLUDED.type,
      status = EXCLUDED.status,
      status_state = EXCLUDED.status_state,
      year = EXCLUDED.year,
      cover = CASE
        WHEN EXCLUDED.cover IS NOT NULL AND EXCLUDED.cover != ''
          THEN EXCLUDED.cover
        ELSE dw_works.cover
      END,
      banner = CASE
        WHEN EXCLUDED.banner IS NOT NULL AND EXCLUDED.banner != ''
          THEN EXCLUDED.banner
        ELSE COALESCE(dw_works.banner, EXCLUDED.cover)
      END,
      description = CASE
        WHEN EXCLUDED.description IS NOT NULL AND EXCLUDED.description != ''
          THEN EXCLUDED.description
        ELSE dw_works.description
      END,
      episodes_count = EXCLUDED.episodes_count,
      updated_at = CURRENT_TIMESTAMP;
  `;

  if (episodes.length > 0) {
    const epChunkSize = 8;
    for (let eIdx = 0; eIdx < episodes.length; eIdx += epChunkSize) {
      const epChunk = episodes.slice(eIdx, eIdx + epChunkSize);
      await Promise.all(epChunk.map((ep, idx) => {
        const actualIdx = eIdx + idx;
        const epNum = parseInt(ep?.number, 10) || (actualIdx + 1);
        const epId = String(ep?.id || `ep-${workId}-${epNum}`);
        const epTitle = String(ep?.title || `الحلقة ${epNum}`);
        const rawServers = Array.isArray(ep?.servers) ? ep.servers : safeJsonParse(ep?.servers, []);
        const servers = cleanEpisodeServers(rawServers, epId);
        const serversJson = JSON.stringify(servers);

        return executor`
          INSERT INTO dw_episodes (
            id, work_id, number, title, servers, updated_at
          ) VALUES (
            ${epId}, ${workId}, ${epNum}, ${epTitle}, ${serversJson}::jsonb, CURRENT_TIMESTAMP
          )
          ON CONFLICT (work_id, number) DO UPDATE SET
            title = EXCLUDED.title,
            servers = EXCLUDED.servers,
            updated_at = CURRENT_TIMESTAMP;
        `;
      }));
    }
  }
}

/**
 * Fetches all works from PostgreSQL with full resilience against missing/deleted relations
 */
export async function getAllWorksFromPostgres() {
  const pool = getPool();
  if (!pool) return null;

  if (!dbInitialized) {
    await initDb();
  }

  let worksRows = [];
  try {
    worksRows = await sql`
      SELECT * FROM dw_works ORDER BY updated_at DESC;
    `;
  } catch (workErr) {
    console.warn('Notice: dw_works query:', sanitizeError(workErr));
    return [];
  }

  if (!worksRows || worksRows.length === 0) {
    return [];
  }

  let episodesRows = [];
  try {
    episodesRows = await sql`
      SELECT id, work_id, number, title, servers 
      FROM dw_episodes 
      ORDER BY work_id, number ASC;
    `;
  } catch (epErr) {
    console.warn('Notice: Could not query dw_episodes:', sanitizeError(epErr));
  }

  const epMap = new Map();
  if (Array.isArray(episodesRows)) {
    for (const row of episodesRows) {
      if (!row || !row.work_id) continue;
      if (!epMap.has(row.work_id)) {
        epMap.set(row.work_id, []);
      }
      epMap.get(row.work_id).push({
        id: row.id || `ep-${row.work_id}-${row.number || 1}`,
        number: typeof row.number === 'number' ? row.number : (parseInt(row.number, 10) || 1),
        title: row.title || `الحلقة ${row.number || 1}`,
        servers: safeJsonParse(row.servers, [])
      });
    }
  }

  const works = worksRows.map(row => {
    const episodes = epMap.get(row.id) || [];
    return {
      id: row.id || `dw-${row.slug || Math.random().toString(36).slice(2, 8)}`,
      slug: row.slug || row.id || '',
      title: row.title || 'عمل غير مسمى',
      originalTitle: row.original_title || '',
      altNames: safeJsonParse(row.alt_names, []),
      type: row.type || 'cartoon',
      status: row.status || 'مكتمل',
      statusState: row.status_state || 'PUBLISHED',
      year: row.year || '',
      cover: row.cover || '',
      banner: row.banner || row.cover || '',
      description: row.description || '',
      episodesCount: episodes.length,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
      episodes
    };
  });

  return works;
}

/**
 * Saves works in batches to PostgreSQL
 */
export async function saveWorksToPostgres(worksList, targetState = 'PUBLISHED') {
  const pool = getPool();
  if (!pool) {
    throw new Error('PostgreSQL is not connected. Please set POSTGRES_URL or DATABASE_URL in Vercel Environment Variables.');
  }

  if (!dbInitialized) {
    await initDb();
  }

  if (!Array.isArray(worksList) || worksList.length === 0) {
    return { success: true, savedCount: 0, errorCount: 0, errors: [] };
  }

  let savedCount = 0;
  let errorCount = 0;
  const errors = [];

  const chunkSize = 5;
  for (let i = 0; i < worksList.length; i += chunkSize) {
    const chunk = worksList.slice(i, i + chunkSize);
    const results = await Promise.allSettled(
      chunk.map(work => upsertSingleWork(sql, work, targetState))
    );

    results.forEach((res, index) => {
      const work = chunk[index];
      if (res.status === 'fulfilled') {
        savedCount++;
      } else {
        errorCount++;
        const safeReason = sanitizeError(res.reason);
        errors.push({ work: work?.title || work?.id || `Item ${index}`, error: safeReason });
        console.error(`Error saving work "${work?.title}":`, safeReason);
      }
    });
  }

  return { success: true, savedCount, errorCount, errors };
}

/**
 * Updates work status state
 */
export async function updateWorkStatusInPostgres(workIds, targetState = 'PUBLISHED') {
  const pool = getPool();
  if (!pool) throw new Error('PostgreSQL is not connected.');

  if (!dbInitialized) {
    await initDb();
  }

  const ids = Array.isArray(workIds) ? workIds.filter(Boolean) : [workIds].filter(Boolean);
  if (ids.length === 0) return { success: true, updatedCount: 0, updatedWorks: [] };

  const updatedRows = await sql`
    UPDATE dw_works 
    SET status_state = ${targetState}, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ANY(${ids}) OR slug = ANY(${ids})
    RETURNING id, title, status_state;
  `;

  return {
    success: true,
    updatedCount: updatedRows.length,
    updatedWorks: updatedRows
  };
}

/**
 * Deletes work(s) and cascading episodes
 */
export async function deleteWorkFromPostgres(workIdOrSlugOrIds) {
  const pool = getPool();
  if (!pool) throw new Error('PostgreSQL is not connected.');

  if (!dbInitialized) {
    await initDb();
  }

  const ids = Array.isArray(workIdOrSlugOrIds) 
    ? workIdOrSlugOrIds.filter(Boolean) 
    : [workIdOrSlugOrIds].filter(Boolean);

  if (ids.length === 0) return { success: true, deletedCount: 0 };

  const deletedRows = await sql`
    DELETE FROM dw_works 
    WHERE id = ANY(${ids}) OR slug = ANY(${ids}) 
    RETURNING id, title;
  `;

  try {
    await sql`
      DELETE FROM dw_episodes 
      WHERE work_id = ANY(${ids}) OR work_id NOT IN (SELECT id FROM dw_works);
    `;
  } catch {
    // Ignore
  }

  return {
    success: true,
    deletedCount: deletedRows.length,
    deletedWork: deletedRows[0] || null,
    deletedWorks: deletedRows
  };
}

/**
 * Diagnostic test differentiating the 4 states cleanly
 */
export async function testPostgresConnection() {
  const connectionString = getConnectionString();
  const testedAt = new Date().toISOString();
  const activeEnvVar = getActiveEnvVarName();

  // State 1: Missing Environment Variable
  if (!connectionString) {
    return {
      connected: false,
      state: 'MISSING_ENV_VAR',
      status: 'missing_env',
      activeEnvVar: null,
      message: 'لم يتم العثور على متغير البيئة POSTGRES_URL أو DATABASE_URL في إعدادات Vercel أو .env',
      instructions: 'يرجى إضافة POSTGRES_URL في Vercel Dashboard → Project Settings → Environment Variables ثم الضغط على Redeploy.',
      hasEnv: false,
      worksCount: 0,
      episodesCount: 0,
      testedAt
    };
  }

  const start = Date.now();
  try {
    const pool = getPool();
    if (!pool) {
      return {
        connected: false,
        state: 'CLIENT_INIT_FAILED',
        status: 'connection_failed',
        activeEnvVar,
        message: 'فشل في إنشاء اتصال العميل بقاعدة بيانات PostgreSQL.',
        hasEnv: true,
        worksCount: 0,
        episodesCount: 0,
        testedAt
      };
    }

    // Ping check
    const pingRows = await sql`
      SELECT 1 as ping, version(), NOW() as now;
    `;
    const latency = Date.now() - start;
    const pingRow = pingRows[0] || {};

    let formattedVersion = 'PostgreSQL';
    if (pingRow.version) {
      const parts = String(pingRow.version).split(' ');
      formattedVersion = `${parts[0]} ${parts[1] || ''}`.trim();
    }

    let storageEngine = 'PostgreSQL';
    const connLower = connectionString.toLowerCase();
    if (connLower.includes('neon.tech') || connLower.includes('neon.database')) {
      storageEngine = 'Neon Serverless PostgreSQL';
    } else if (connLower.includes('vercel-storage.com')) {
      storageEngine = 'Vercel Postgres (Neon)';
    } else if (connLower.includes('supabase.co')) {
      storageEngine = 'Supabase PostgreSQL';
    } else if (connLower.includes('render.com')) {
      storageEngine = 'Render PostgreSQL';
    } else if (connLower.includes('railway.app')) {
      storageEngine = 'Railway PostgreSQL';
    } else if (connLower.includes('localhost') || connLower.includes('127.0.0.1')) {
      storageEngine = 'Local PostgreSQL';
    }

    // Check tables
    let tablesExist = false;
    try {
      const tableCheck = await sql`
        SELECT 
          EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'dw_works') as works_table,
          EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'dw_episodes') as episodes_table;
      `;
      tablesExist = Boolean(tableCheck[0]?.works_table && tableCheck[0]?.episodes_table);
    } catch {
      tablesExist = false;
    }

    if (!tablesExist) {
      try {
        await initDb();
        tablesExist = true;
      } catch (tableInitErr) {
        // State 3: Connected but tables missing
        return {
          connected: true,
          state: 'TABLES_MISSING',
          status: 'tables_missing',
          storageEngine: 'PostgreSQL',
          activeEnvVar,
          latencyMs: latency,
          version: formattedVersion,
          serverTime: pingRow.now,
          tablesExist: false,
          worksCount: 0,
          episodesCount: 0,
          message: 'الاتصال بـ PostgreSQL ناجح (SELECT 1 يعمل)، ولكن تعذر تهيئة الجداول: ' + sanitizeError(tableInitErr),
          hasEnv: true,
          testedAt
        };
      }
    }

    // Counts check (0 is a healthy state)
    let worksCount = 0;
    let episodesCount = 0;
    try {
      const counts = await sql`
        SELECT 
          (SELECT COUNT(*)::int FROM dw_works) as works_count, 
          (SELECT COUNT(*)::int FROM dw_episodes) as episodes_count;
      `;
      worksCount = counts[0]?.works_count ?? 0;
      episodesCount = counts[0]?.episodes_count ?? 0;
    } catch {
      // 0
    }

    const isZeroData = (worksCount === 0 && episodesCount === 0);
    const successMessage = isZeroData
      ? `🟢 الاتصال بـ PostgreSQL ناجح (${activeEnvVar}) - قاعدة البيانات فارغة وجاهزة لاستقبال الأعمال.`
      : `🟢 الاتصال بـ PostgreSQL ناجح ومستقر (${activeEnvVar}).`;

    return {
      connected: true,
      state: isZeroData ? 'CONNECTED_EMPTY' : 'CONNECTED_READY',
      status: 'healthy',
      storageEngine: 'PostgreSQL',
      activeEnvVar,
      latencyMs: latency,
      version: formattedVersion,
      serverTime: pingRow.now,
      tablesExist: true,
      worksCount,
      episodesCount,
      message: successMessage,
      hasEnv: true,
      testedAt
    };

  } catch (err) {
    // State 2: Connection Failed
    const safeError = sanitizeError(err);
    console.error('PostgreSQL connection error:', safeError);

    let classifiedReason = 'DATABASE_ERROR';
    let userFriendlyMsg = `فشل الاتصال بقاعدة بيانات PostgreSQL: ${safeError}`;

    const lErr = safeError.toLowerCase();
    if (lErr.includes('password authentication failed') || lErr.includes('auth')) {
      classifiedReason = 'AUTH_FAILED';
      userFriendlyMsg = 'فشل المصادقة: كلمة المرور أو اسم المستخدم في متغير البيئة غير صحيحة.';
    } else if (lErr.includes('enotfound') || lErr.includes('getaddrinfo') || lErr.includes('could not resolve host')) {
      classifiedReason = 'HOST_NOT_FOUND';
      userFriendlyMsg = 'تعذر الوصول إلى خادم قاعدة البيانات: يرجى التحقق من صحة رابط الـ Host في Connection String.';
    } else if (lErr.includes('ssl') || lErr.includes('certificate')) {
      classifiedReason = 'SSL_ERROR';
      userFriendlyMsg = 'خطأ في اتصال SSL الآمن بقاعدة البيانات (تأكد من إضافة ?sslmode=require).';
    } else if (lErr.includes('timeout') || lErr.includes('timed out')) {
      classifiedReason = 'TIMEOUT';
      userFriendlyMsg = 'انتهت مهلة الاتصال بقاعدة بيانات PostgreSQL (Connection Timeout).';
    } else if (lErr.includes('database') && lErr.includes('does not exist')) {
      classifiedReason = 'DB_NOT_FOUND';
      userFriendlyMsg = 'اسم قاعدة البيانات المحدد في رابط الاتصال غير موجود.';
    }

    return {
      connected: false,
      state: 'CONNECTION_FAILED',
      status: 'connection_failed',
      reason: classifiedReason,
      activeEnvVar,
      error: safeError,
      message: userFriendlyMsg,
      hasEnv: true,
      worksCount: 0,
      episodesCount: 0,
      testedAt
    };
  }
}

/**
 * Gets a setting JSON value from dw_settings table
 */
export async function getSettingFromPostgres(key) {
  if (!getConnectionString()) {
    return null;
  }
  if (!dbInitialized) {
    await initDb();
  }
  try {
    const rows = await sql`
      SELECT value FROM dw_settings WHERE key = ${key} LIMIT 1;
    `;
    if (!rows || rows.length === 0) return null;
    return rows[0].value;
  } catch (err) {
    console.error(`Error getting setting ${key}:`, sanitizeError(err));
    return null;
  }
}

/**
 * Saves a setting JSON value to dw_settings table
 */
export async function saveSettingToPostgres(key, value) {
  if (!getConnectionString()) {
    throw new Error('PostgreSQL is not connected. Please set POSTGRES_URL or DATABASE_URL in Vercel Environment Variables.');
  }
  if (!dbInitialized) {
    await initDb();
  }
  try {
    const jsonVal = JSON.stringify(value);
    await sql`
      INSERT INTO dw_settings (key, value, updated_at)
      VALUES (${key}, ${jsonVal}::jsonb, CURRENT_TIMESTAMP)
      ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP;
    `;
    return { success: true, key };
  } catch (err) {
    const safeErr = sanitizeError(err);
    console.error(`Error saving setting ${key}:`, safeErr);
    throw new Error(safeErr);
  }
}

/**
 * Gets similar/related published works from PostgreSQL based on DB metadata
 */
export async function getRelatedWorksFromPostgres(workIdOrSlug, limit = 6) {
  if (!getConnectionString()) {
    return [];
  }
  if (!dbInitialized) {
    await initDb();
  }
  try {
    const targetRows = await sql`
      SELECT id, slug, title, type, description 
      FROM dw_works 
      WHERE (id = ${workIdOrSlug} OR slug = ${workIdOrSlug})
      LIMIT 1;
    `;

    const target = targetRows && targetRows.length > 0 ? targetRows[0] : null;
    const targetId = target ? target.id : workIdOrSlug;
    const targetType = target ? (target.type || 'cartoon').toLowerCase() : 'cartoon';
    const targetGenres = target && Array.isArray(target.genres) ? target.genres : [];
    const targetTitleWords = target && target.title ? target.title.split(/\s+/).filter(w => w.length > 2) : [];

    const candidates = await sql`
      SELECT id, slug, title, original_title, cover, type, year, status, status_state, description, updated_at
      FROM dw_works
      WHERE (status_state = 'PUBLISHED' OR status_state IS NULL) AND id != ${targetId} AND slug != ${workIdOrSlug}
      ORDER BY updated_at DESC;
    `;

    if (!candidates || candidates.length === 0) return [];

    const scored = candidates.map(c => {
      let score = 0;
      const cType = (c.type || 'cartoon').toLowerCase();

      if (cType === targetType) score += 10;

      const cGenres = Array.isArray(c.genres) ? c.genres : [];
      if (targetGenres.length > 0 && cGenres.length > 0) {
        const shared = cGenres.filter(g => targetGenres.includes(g));
        score += shared.length * 5;
      }

      if (targetTitleWords.length > 0) {
        const cTitleLower = (c.title || '').toLowerCase();
        const cDescLower = (c.description || '').toLowerCase();
        targetTitleWords.forEach(word => {
          const wLower = word.toLowerCase();
          if (cTitleLower.includes(wLower)) score += 4;
          if (cDescLower.includes(wLower)) score += 2;
        });
      }

      return { ...c, similarityScore: score };
    });

    scored.sort((a, b) => b.similarityScore - a.similarityScore || new Date(b.updated_at) - new Date(a.updated_at));

    return scored.slice(0, limit);
  } catch (err) {
    console.error('Error fetching related works:', sanitizeError(err));
    return [];
  }
}

/**
 * Fetches lightweight sitemap data directly from PostgreSQL
 */
export async function getSitemapDataFromPostgres(type = 'index', page = 1, pageSize = 2000, reqOrBaseUrl = null) {
  if (!getConnectionString()) {
    return { type, items: [], totalPages: 1 };
  }
  if (!dbInitialized) {
    await initDb();
  }

  const domain = getSiteUrl(reqOrBaseUrl);

  try {
    if (type === 'pages') {
      return {
        type: 'pages',
        items: [
          { loc: `${domain}/`, changefreq: 'daily', priority: '1.0' },
          { loc: `${domain}/#/cartoon`, changefreq: 'daily', priority: '0.9' },
          { loc: `${domain}/#/anime`, changefreq: 'daily', priority: '0.9' }
        ],
        totalPages: 1
      };
    }

    if (type === 'works') {
      const rows = await sql`
        SELECT slug, updated_at, created_at
        FROM dw_works
        WHERE status_state = 'PUBLISHED' OR status_state IS NULL
        ORDER BY updated_at DESC;
      `;

      const items = (rows || []).map(r => ({
        loc: `${domain}/#/work/${encodeURIComponent(r.slug)}`,
        lastmod: r.updated_at ? new Date(r.updated_at).toISOString() : (r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()),
        changefreq: 'weekly',
        priority: '0.8'
      }));

      return { type: 'works', items, totalPages: 1 };
    }

    if (type === 'episodes') {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const offset = (pageNum - 1) * pageSize;

      const countRows = await sql`
        SELECT COUNT(e.id) as total
        FROM dw_episodes e
        JOIN dw_works w ON e.work_id = w.id
        WHERE w.status_state = 'PUBLISHED' OR w.status_state IS NULL;
      `;

      const totalCount = parseInt(countRows?.[0]?.total || 0, 10);
      const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

      const rows = await sql`
        SELECT e.number, e.updated_at, w.slug as work_slug
        FROM dw_episodes e
        JOIN dw_works w ON e.work_id = w.id
        WHERE w.status_state = 'PUBLISHED' OR w.status_state IS NULL
        ORDER BY w.updated_at DESC, e.number ASC
        LIMIT ${pageSize} OFFSET ${offset};
      `;

      const items = (rows || []).map(r => ({
        loc: `${domain}/#/watch/${encodeURIComponent(r.work_slug)}/${r.number}`,
        lastmod: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
        changefreq: 'monthly',
        priority: '0.6'
      }));

      return { type: 'episodes', items, page: pageNum, totalPages, totalCount };
    }

    // Default: index
    const worksCountRows = await sql`
      SELECT COUNT(id) as total FROM dw_works WHERE status_state = 'PUBLISHED' OR status_state IS NULL;
    `;
    const epCountRows = await sql`
      SELECT COUNT(e.id) as total
      FROM dw_episodes e
      JOIN dw_works w ON e.work_id = w.id
      WHERE w.status_state = 'PUBLISHED' OR w.status_state IS NULL;
    `;

    const worksCount = parseInt(worksCountRows?.[0]?.total || 0, 10);
    const episodesCount = parseInt(epCountRows?.[0]?.total || 0, 10);
    const epPages = Math.max(1, Math.ceil(episodesCount / pageSize));

    return {
      type: 'index',
      worksCount,
      episodesCount,
      epPages
    };
  } catch (err) {
    console.error('Error fetching sitemap data from PostgreSQL:', sanitizeError(err));
    return { type, items: [], totalPages: 1, error: sanitizeError(err) };
  }
}

/**
 * Clean text for meta descriptions by stripping HTML, entity quotes, and excessive spaces
 */
export function cleanTextDescription(raw = '') {
  if (!raw) return '';
  let str = String(raw).replace(/<[^>]*>/g, ' ');
  str = str.replace(/&nbsp;/gi, ' ')
           .replace(/&quot;/gi, '"')
           .replace(/&amp;/gi, '&')
           .replace(/&lt;/gi, '<')
           .replace(/&gt;/gi, '>')
           .replace(/\s+/g, ' ')
           .trim();
  return str;
}

/**
 * Generate focused, relevant SEO keywords without keyword stuffing
 */
export function generateSeoKeywords(title = '', originalTitle = '', type = 'cartoon') {
  const keywords = new Set();
  const cleanTitle = (title || '').trim();
  if (cleanTitle) {
    keywords.add(cleanTitle);
    keywords.add(`مشاهدة ${cleanTitle}`);
    keywords.add(`حلقات ${cleanTitle}`);
    const categoryName = type === 'anime' ? 'أنمي' : 'كرتون';
    keywords.add(`${categoryName} ${cleanTitle}`);
    keywords.add(`مسلسل ${cleanTitle}`);
  }
  if (originalTitle && originalTitle.trim() && originalTitle.trim() !== cleanTitle) {
    keywords.add(originalTitle.trim());
  }
  return Array.from(keywords).slice(0, 6);
}

/**
 * Returns list of Sitemap links for Admin Panel view with search, filter, and pagination
 */
export async function getSitemapLinksFromPostgres({ page = 1, pageSize = 50, search = '', filter = 'all', reqOrBaseUrl = null } = {}) {
  if (!getConnectionString()) {
    return { success: false, error: 'PostgreSQL connection missing' };
  }
  if (!dbInitialized) await initDb();

  const domain = getSiteUrl(reqOrBaseUrl);

  try {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limit = Math.max(10, Math.min(200, parseInt(pageSize, 10) || 50));
    const searchQuery = (search || '').trim().toLowerCase();

    // 1. Fetch total counts across DB
    const worksCountRows = await sql`
      SELECT COUNT(id) as total FROM dw_works WHERE status_state = 'PUBLISHED' OR status_state IS NULL;
    `;
    const epCountRows = await sql`
      SELECT COUNT(e.id) as total
      FROM dw_episodes e
      JOIN dw_works w ON e.work_id = w.id
      WHERE w.status_state = 'PUBLISHED' OR w.status_state IS NULL;
    `;

    const totalWorks = parseInt(worksCountRows?.[0]?.total || 0, 10);
    const totalEpisodes = parseInt(epCountRows?.[0]?.total || 0, 10);
    const totalPagesCount = 1;
    const totalCategoriesCount = 2;
    const totalUrls = totalPagesCount + totalCategoriesCount + totalWorks + totalEpisodes;

    // 2. Build full in-memory list for page filtering (fast & consistent)
    let allLinks = [
      {
        pageType: 'صفحة رئيسية',
        workTitle: 'Dark Watch - الرئيسية',
        episodeNumber: null,
        url: `${domain}/`,
        indexability: 'index, follow',
        lastmod: new Date().toISOString(),
        exists: true,
        typeKey: 'pages',
        hasIssue: false
      },
      {
        pageType: 'قسم',
        workTitle: 'قسم الكرتون',
        episodeNumber: null,
        url: `${domain}/#/cartoon`,
        indexability: 'index, follow',
        lastmod: new Date().toISOString(),
        exists: true,
        typeKey: 'categories',
        hasIssue: false
      },
      {
        pageType: 'قسم',
        workTitle: 'قسم الأنمي',
        episodeNumber: null,
        url: `${domain}/#/anime`,
        indexability: 'index, follow',
        lastmod: new Date().toISOString(),
        exists: true,
        typeKey: 'categories',
        hasIssue: false
      }
    ];

    // Fetch works
    const workRows = await sql`
      SELECT id, title, slug, cover, description, status_state, updated_at
      FROM dw_works
      ORDER BY updated_at DESC;
    `;

    (workRows || []).forEach(w => {
      const isPublished = (w.status_state === 'PUBLISHED' || !w.status_state);
      const isDraft = w.status_state === 'DRAFT';
      const isArchived = w.status_state === 'ARCHIVED';
      const hasMissingDesc = !w.description || cleanTextDescription(w.description).length < 5;
      const hasMissingCover = !w.cover || !w.cover.startsWith('http');
      const hasIssue = hasMissingDesc || hasMissingCover || isDraft || isArchived;

      if (isPublished) {
        allLinks.push({
          pageType: 'عمل',
          workTitle: w.title || 'عمل بدون عنوان',
          episodeNumber: null,
          url: `${domain}/#/work/${encodeURIComponent(w.slug || w.id)}`,
          indexability: 'index, follow',
          lastmod: w.updated_at ? new Date(w.updated_at).toISOString() : new Date().toISOString(),
          exists: true,
          typeKey: 'works',
          hasIssue
        });
      }
    });

    // Fetch episodes if filter allows
    if (filter === 'all' || filter === 'episodes') {
      const epRows = await sql`
        SELECT e.id, e.number, e.title as ep_title, e.updated_at, w.title as work_title, w.slug as work_slug
        FROM dw_episodes e
        JOIN dw_works w ON e.work_id = w.id
        WHERE w.status_state = 'PUBLISHED' OR w.status_state IS NULL
        ORDER BY w.updated_at DESC, e.number ASC
        LIMIT 2000;
      `;

      (epRows || []).forEach(e => {
        allLinks.push({
          pageType: 'حلقة',
          workTitle: e.work_title || 'عمل بدون عنوان',
          episodeNumber: e.number,
          url: `${domain}/#/watch/${encodeURIComponent(e.work_slug)}/${e.number}`,
          indexability: 'index, follow',
          lastmod: e.updated_at ? new Date(e.updated_at).toISOString() : new Date().toISOString(),
          exists: true,
          typeKey: 'episodes',
          hasIssue: false
        });
      });
    }

    // 3. Apply Filter
    let filtered = allLinks;
    if (filter === 'works') {
      filtered = filtered.filter(item => item.typeKey === 'works');
    } else if (filter === 'episodes') {
      filtered = filtered.filter(item => item.typeKey === 'episodes');
    } else if (filter === 'categories') {
      filtered = filtered.filter(item => item.typeKey === 'categories');
    } else if (filter === 'issues' || filter === 'missing_seo') {
      filtered = filtered.filter(item => item.hasIssue);
    } else if (filter === 'noindex') {
      filtered = filtered.filter(item => item.indexability.includes('noindex'));
    }

    // 4. Apply Search Query
    if (searchQuery) {
      filtered = filtered.filter(item => {
        const titleMatch = (item.workTitle || '').toLowerCase().includes(searchQuery);
        const urlMatch = (item.url || '').toLowerCase().includes(searchQuery);
        const epMatch = item.episodeNumber ? String(item.episodeNumber).includes(searchQuery) : false;
        const pageTypeMatch = (item.pageType || '').toLowerCase().includes(searchQuery);
        return titleMatch || urlMatch || epMatch || pageTypeMatch;
      });
    }

    const totalFiltered = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / limit));
    const offset = (pageNum - 1) * limit;
    const paginatedLinks = filtered.slice(offset, offset + limit);

    return {
      success: true,
      summary: {
        totalUrls,
        totalWorks,
        totalEpisodes,
        totalCategories: totalCategoriesCount,
        totalPagesPages: totalPagesCount
      },
      links: paginatedLinks,
      pagination: {
        page: pageNum,
        pageSize: limit,
        totalFiltered,
        totalPages
      }
    };
  } catch (err) {
    console.error('Error fetching sitemap links:', sanitizeError(err));
    return { success: false, error: sanitizeError(err) };
  }
}

/**
 * Performs a comprehensive SEO Audit over PostgreSQL data with batching and pagination
 */
export async function runSeoAuditFromPostgres({ page = 1, pageSize = 50, search = '', filter = 'all', reqOrBaseUrl = null } = {}) {
  if (!getConnectionString()) {
    return {
      connected: false,
      error: 'PostgreSQL connection missing'
    };
  }

  if (!dbInitialized) {
    await initDb();
  }

  const domain = getSiteUrl(reqOrBaseUrl);

  try {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limit = Math.max(10, Math.min(200, parseInt(pageSize, 10) || 50));
    const searchQuery = (search || '').trim().toLowerCase();

    // 1. Fetch overall database metrics across all works
    const publishedRows = await sql`
      SELECT id, slug, title, original_title, type, description, cover, status_state, created_at, updated_at
      FROM dw_works
      ORDER BY updated_at DESC;
    `;

    const draftRows = await sql`
      SELECT COUNT(id) as total FROM dw_works WHERE status_state = 'DRAFT';
    `;

    const archivedRows = await sql`
      SELECT COUNT(id) as total FROM dw_works WHERE status_state = 'ARCHIVED';
    `;

    const epCountRows = await sql`
      SELECT COUNT(e.id) as total
      FROM dw_episodes e
      JOIN dw_works w ON e.work_id = w.id
      WHERE w.status_state = 'PUBLISHED' OR w.status_state IS NULL;
    `;

    const allWorks = publishedRows || [];
    const totalWorksCount = allWorks.length;
    const totalDrafts = parseInt(draftRows?.[0]?.total || 0, 10);
    const totalArchived = parseInt(archivedRows?.[0]?.total || 0, 10);
    const totalEpisodes = parseInt(epCountRows?.[0]?.total || 0, 10);
    const publishedWorks = allWorks.filter(w => w.status_state === 'PUBLISHED' || !w.status_state);
    const totalPublishedWorks = publishedWorks.length;

    // Detect duplicates across all published works
    const titleMap = new Map();
    const descMap = new Map();
    const slugMap = new Map();

    const duplicateTitleSet = new Set();
    const duplicateDescSet = new Set();
    const duplicateSlugSet = new Set();

    publishedWorks.forEach(w => {
      // Title duplicate check
      const t = (w.title || '').trim().toLowerCase();
      if (t) {
        if (titleMap.has(t)) duplicateTitleSet.add(t);
        else titleMap.set(t, w);
      }

      // Description duplicate check
      const cleanD = cleanTextDescription(w.description);
      if (cleanD && cleanD.length > 20) {
        const dKey = cleanD.slice(0, 100).toLowerCase();
        if (descMap.has(dKey)) duplicateDescSet.add(dKey);
        else descMap.set(dKey, w);
      }

      // Slug duplicate check
      const s = (w.slug || '').trim().toLowerCase();
      if (s) {
        if (slugMap.has(s)) duplicateSlugSet.add(s);
        else slugMap.set(s, w);
      }
    });

    // 2. Audit all works and compute issue breakdown
    let missingDescCount = 0;
    let missingCoverCount = 0;
    let canonicalIssuesCount = 0;
    let invalidUrlCount = 0;

    let seoCompletedCount = 0;
    let needsReviewCount = 0;
    let hasErrorsCount = 0;

    const auditedWorks = allWorks.map(w => {
      const cleanDesc = cleanTextDescription(w.description);
      const descLen = cleanDesc.length;
      const isPublished = (w.status_state === 'PUBLISHED' || !w.status_state);
      const isDraft = w.status_state === 'DRAFT';
      const isArchived = w.status_state === 'ARCHIVED';

      const issues = [];

      // Check Description
      let descStatus = '✓ جيد';
      if (!cleanDesc) {
        descStatus = '✕ بدون وصف';
        missingDescCount++;
        issues.push({ level: 'error', code: 'MISSING_DESC', message: 'الوصف غير متوفر في قاعدة البيانات' });
      } else if (descLen < 120) {
        descStatus = '⚠ قصير';
        issues.push({ level: 'warning', code: 'SHORT_DESC', message: `الوصف قصير (${descLen} حرف - الموصى به 120-160 حرف)` });
      } else if (descLen > 160) {
        descStatus = '⚠ طويل';
        issues.push({ level: 'warning', code: 'LONG_DESC', message: `الوصف طويل (${descLen} حرف - قد يقتطعه Google)` });
      }

      // Check Cover Image
      const validCover = w.cover && w.cover.startsWith('http') && !w.cover.includes('placeholder');
      if (!validCover) {
        missingCoverCount++;
        issues.push({ level: 'error', code: 'MISSING_COVER', message: 'صورة الغلاف غير متوفرة أو رابطها غير صالح' });
      }

      // Check Title Duplicates
      const t = (w.title || '').trim().toLowerCase();
      if (t && duplicateTitleSet.has(t)) {
        issues.push({ level: 'error', code: 'DUPLICATE_TITLE', message: 'عنوان العمل مكرر مع عمل آخر في الموقع' });
      }

      // Check Description Duplicates
      if (cleanDesc && cleanDesc.length > 20) {
        const dKey = cleanDesc.slice(0, 100).toLowerCase();
        if (duplicateDescSet.has(dKey)) {
          issues.push({ level: 'warning', code: 'DUPLICATE_DESC', message: 'وصف العمل مكرر بشكل شبه كامل مع عمل آخر' });
        }
      }

      // Check Slug Duplicates
      const s = (w.slug || '').trim().toLowerCase();
      if (!s) {
        invalidUrlCount++;
        issues.push({ level: 'error', code: 'INVALID_SLUG', message: 'المعرف اللطيف (Slug) غير متوفر' });
      } else if (duplicateSlugSet.has(s)) {
        issues.push({ level: 'error', code: 'DUPLICATE_SLUG', message: 'المعرف اللطيف (Slug) مكرر' });
      }

      // Check Status State
      if (isDraft) {
        issues.push({ level: 'warning', code: 'DRAFT_STATUS', message: 'العمل في حالة مسودة (Draft) ولن يظهر في Sitemap' });
      } else if (isArchived) {
        issues.push({ level: 'warning', code: 'ARCHIVED_STATUS', message: 'العمل مؤرشف (Archived)' });
      }

      // Compute overall SEO Status
      const hasErrors = issues.some(i => i.level === 'error');
      const hasWarnings = issues.some(i => i.level === 'warning');

      let seoStatus = '✓ SEO مكتمل';
      let seoStatusBadge = 'badge-green';
      if (hasErrors) {
        seoStatus = '✕ SEO به مشكلة';
        seoStatusBadge = 'badge-red';
        hasErrorsCount++;
      } else if (hasWarnings) {
        seoStatus = '⚠ يحتاج مراجعة';
        seoStatusBadge = 'badge-amber';
        needsReviewCount++;
      } else {
        seoCompletedCount++;
      }

      const canonicalUrl = `${domain}/#/work/${encodeURIComponent(w.slug || w.id)}`;
      const seoTitle = `${w.title || 'عمل'} - مشاهدة جميع الحلقات أونلاين | Dark Watch`;
      const keywords = generateSeoKeywords(w.title, w.original_title, w.type);

      const ogImage = validCover ? w.cover : `${domain}/images/logo.svg`;

      return {
        id: w.id,
        title: w.title || 'بدون عنوان',
        originalTitle: w.original_title || '',
        type: w.type || 'cartoon',
        slug: w.slug || w.id,
        cover: w.cover || '',
        description: cleanDesc,
        descLength: descLen,
        descStatus,
        seoTitle,
        seoKeywords: keywords,
        canonical: canonicalUrl,
        robots: isPublished ? 'index, follow' : 'noindex, nofollow',
        url: canonicalUrl,
        statusState: w.status_state || 'PUBLISHED',
        seoStatus,
        seoStatusBadge,
        issueCount: issues.length,
        issues,
        openGraph: {
          title: seoTitle,
          description: cleanDesc || 'مشاهدة أحدث الحلقات أونلاين على Dark Watch.',
          image: ogImage,
          url: canonicalUrl,
          type: 'video.tv_show'
        },
        twitterCard: {
          card: 'summary_large_image',
          title: seoTitle,
          description: cleanDesc || 'مشاهدة أحدث الحلقات أونلاين على Dark Watch.',
          image: ogImage
        },
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'TVSeries',
          'name': w.title || 'عمل',
          'description': cleanDesc,
          'image': ogImage,
          'url': canonicalUrl,
          'inLanguage': 'ar'
        },
        googlePreview: {
          siteName: 'Dark Watch',
          title: seoTitle,
          url: canonicalUrl,
          snippet: cleanDesc || 'شاهد جميع حلقات ' + (w.title || 'هذا العمل') + ' أونلاين بجودة عالية عبر Dark Watch.'
        }
      };
    });

    // 3. Apply Filter to Audited Works List
    let filteredWorks = auditedWorks;
    if (filter === 'completed') {
      filteredWorks = filteredWorks.filter(w => w.issueCount === 0);
    } else if (filter === 'review') {
      filteredWorks = filteredWorks.filter(w => w.seoStatus.includes('يحتاج مراجعة'));
    } else if (filter === 'errors') {
      filteredWorks = filteredWorks.filter(w => w.seoStatus.includes('به مشكلة'));
    } else if (filter === 'missing_desc') {
      filteredWorks = filteredWorks.filter(w => !w.description);
    } else if (filter === 'missing_cover') {
      filteredWorks = filteredWorks.filter(w => !w.cover || !w.cover.startsWith('http'));
    } else if (filter === 'duplicates') {
      filteredWorks = filteredWorks.filter(w => w.issues.some(i => i.code.includes('DUPLICATE')));
    }

    // 4. Apply Search Query
    if (searchQuery) {
      filteredWorks = filteredWorks.filter(w => {
        const tMatch = (w.title || '').toLowerCase().includes(searchQuery);
        const sMatch = (w.slug || '').toLowerCase().includes(searchQuery);
        const uMatch = (w.url || '').toLowerCase().includes(searchQuery);
        const stMatch = (w.seoStatus || '').toLowerCase().includes(searchQuery);
        return tMatch || sMatch || uMatch || stMatch;
      });
    }

    // 5. Pagination
    const totalFiltered = filteredWorks.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / limit));
    const offset = (pageNum - 1) * limit;
    const paginatedWorks = filteredWorks.slice(offset, offset + limit);

    const totalSitemapUrls = 1 + 2 + totalPublishedWorks + totalEpisodes;

    return {
      connected: true,
      auditedAt: new Date().toISOString(),
      publicDomain: domain,
      metrics: {
        totalWorks: totalWorksCount,
        totalPublishedWorks,
        totalDraftWorks: totalDrafts,
        totalArchivedWorks: totalArchived,
        totalPublishedEpisodes: totalEpisodes,
        seoCompletedWorks: seoCompletedCount,
        needsReviewWorks: needsReviewCount,
        hasErrorsWorks: hasErrorsCount,
        missingDescCount,
        missingCoverCount,
        duplicateTitleCount: duplicateTitleSet.size,
        duplicateDescCount: duplicateDescSet.size,
        duplicateSlugCount: duplicateSlugSet.size,
        canonicalIssuesCount,
        invalidUrlCount,
        totalSitemapUrls
      },
      works: paginatedWorks,
      pagination: {
        page: pageNum,
        pageSize: limit,
        totalFiltered,
        totalPages
      }
    };
  } catch (err) {
    console.error('Error running SEO Audit:', sanitizeError(err));
    return { connected: false, error: sanitizeError(err) };
  }
}

export default {
  getPool,
  query,
  sql,
  getSql,
  getSiteUrl,
  getConnectionString,
  getActiveEnvVarName,
  sanitizeError,
  safeJsonParse,
  initDb,
  upsertSingleWork,
  getAllWorksFromPostgres,
  saveWorksToPostgres,
  updateWorkStatusInPostgres,
  deleteWorkFromPostgres,
  testPostgresConnection,
  getSettingFromPostgres,
  saveSettingToPostgres,
  getRelatedWorksFromPostgres,
  getSitemapDataFromPostgres,
  getSitemapLinksFromPostgres,
  runSeoAuditFromPostgres,
  cleanTextDescription,
  generateSeoKeywords
};
