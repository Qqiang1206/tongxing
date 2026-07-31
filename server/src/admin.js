import crypto from 'crypto';
import {
  readPageJson,
  listCatalogItemsRawSlim,
  getCatalogItemRaw,
  updateCatalogItemRaw,
  createCatalogItemRaw,
  deleteCatalogItemRaw,
  regenerateCatalogJs,
  regeneratePageJs,
  loadSiteSettings,
  writeSiteSettings,
  writePageJsonAny,
} from './services/catalog.js';
import {
  readTranslationStatus,
  markStale,
} from './services/translationStatus.js';
import { getAnalyticsSummary, getAnalyticsReport } from './services/analytics.js';
import {
  listTranslationJobs,
  getTranslationJob,
} from './services/translationJobs.js';
import { getTranslationConfig } from './services/translateProvider.js';
import { listApiLogs, getApiUsageStats } from './services/translationApiLog.js';
import {
  listEngines,
  createEngine,
  updateEngine,
  deleteEngine,
  activateEngine,
  getProviderPresets,
} from './services/translationEngines.js';
import { saveUploadedMedia, listUploadedMedia, deleteUploadedMedia, updateMediaAlt } from './services/media.js';
import { writeAudit, listAuditLogs, getAuditLog, listRecentContentUpdates, clientIp } from './services/audit.js';
import { normalizeForCompare, collectStrings } from './services/translationFields.js';
import {
  getCategoriesBundle,
  listProductCategories,
  listNewsCategories,
  listSolutionCategories,
  upsertProductCategory,
  upsertNewsCategory,
  upsertSolutionCategory,
  deleteProductCategory,
  deleteNewsCategory,
  deleteSolutionCategory,
  resolveProductCategoryFields,
  resolveSolutionCategoryFields,
  resolveNewsCategoryFields,
} from './services/categories.js';
import { getHomeSlotsStatus } from './services/homeSlots.js';
import { createBackup, ensureAutoBackup, listBackups, restoreBackup } from './services/backup.js';
import { generateSitemap } from './services/sitemap.js';
import { getDb } from './db.js';
import {
  authenticate,
  listAdminUsers,
  getAdminUserById,
  createAdminUser,
  updateAdminUser,
  resetAdminPassword,
  hasPermission,
  roleLabel,
  ROLES,
  ROLE_KEYS,
  verifyPassword,
} from './services/adminUsers.js';

const ADMIN_SESSION_TTL_MS = Math.max(
  30 * 60 * 1000,
  Number(process.env.ADMIN_SESSION_HOURS || 8) * 60 * 60 * 1000
);
const adminSessions = new Map();
const MAX_BODY_BYTES = Math.max(
  1024 * 1024,
  Number(process.env.MAX_BODY_BYTES || 12 * 1024 * 1024)
);
const LOGIN_WINDOW_MS = 60 * 1000;
const LOGIN_MAX_ATTEMPTS = Math.max(3, Number(process.env.ADMIN_LOGIN_MAX_ATTEMPTS || 8));
const loginAttempts = new Map();

function createAdminSession(user) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = Date.now() + ADMIN_SESSION_TTL_MS;
  adminSessions.set(token, {
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName || user.username,
      role: user.role,
    },
    expiresAt,
  });
  return { token, expiresAt: new Date(expiresAt).toISOString() };
}

function bearerToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

function cleanExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of adminSessions) {
    if (!session || session.expiresAt <= now) adminSessions.delete(token);
  }
}

function catalogNoun(kind) {
  return kind === 'products' ? '产品' : kind === 'news' ? '新闻' : '方案';
}

/**
 * Collect the translatable strings of an object (paths + normalized values),
 * sorted, so two snapshots can be compared for actual text changes.
 * Skipped keys (image/cover/href/url/updatedAt/…) never appear here.
 */
function translatableStrings(obj) {
  const paths = [];
  const values = [];
  collectStrings(obj || {}, '', paths, values, '');
  return paths
    .map((p, i) => `${p}\u0000${normalizeForCompare(values[i])}`)
    .sort();
}

/** True when translatable text changed between two catalog snapshots. */
function hasTranslatableDiff(before, after) {
  const a = translatableStrings(before);
  const b = translatableStrings(after);
  if (a.length !== b.length) return true;
  return a.some((v, i) => v !== b[i]);
}

function normalizeCatalogBody(kind, body) {
  const next = { ...body };
  if (kind === 'products') {
    const pick = body.categoryKey || body.filterKey || body.category || '';
    if (pick) Object.assign(next, resolveProductCategoryFields(pick));
  }
  if (kind === 'solutions') {
    const pick = body.categoryKey || body.filterKey || body.category || '';
    if (pick) Object.assign(next, resolveSolutionCategoryFields(pick));
  }
  if (kind === 'news') {
    const pick = body.categoryKey || body.category || '';
    if (pick) Object.assign(next, resolveNewsCategoryFields(pick));
  }
  return next;
}
const ADMIN_PAGE_KEYS = new Set(['contact', 'home', 'about', 'products', 'news', 'solutions']);
const ADMIN_CATALOG_KINDS = new Set(['products', 'news', 'solutions']);
export const SOLUTION_SLUG_OPTIONS = [
  'tv-display', 'refrigerator', 'packaging', 'washer', 'capacitor',
  'ac', 'microwave', 'coffee', 'tablet', 'headlight', 'robot',
];

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('body_too_large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function loginRateLimited(req) {
  const ip = clientIp(req) || 'unknown';
  const now = Date.now();
  let row = loginAttempts.get(ip);
  if (!row || row.resetAt <= now) {
    row = { count: 0, resetAt: now + LOGIN_WINDOW_MS };
    loginAttempts.set(ip, row);
  }
  return row.count >= LOGIN_MAX_ATTEMPTS;
}

function recordLoginFailure(req) {
  const ip = clientIp(req) || 'unknown';
  const now = Date.now();
  let row = loginAttempts.get(ip);
  if (!row || row.resetAt <= now) {
    row = { count: 0, resetAt: now + LOGIN_WINDOW_MS };
  }
  row.count += 1;
  loginAttempts.set(ip, row);
}

function clearLoginFailures(req) {
  const ip = clientIp(req) || 'unknown';
  loginAttempts.delete(ip);
}

function authOk(req) {
  cleanExpiredSessions();
  const token = bearerToken(req);
  const session = adminSessions.get(token);
  return !!session && !!session.user && session.expiresAt > Date.now();
}

/** The authenticated user object { id, username, displayName, role } or null. */
function currentUser(req) {
  cleanExpiredSessions();
  const session = adminSessions.get(bearerToken(req));
  return session && session.expiresAt > Date.now() ? session.user : null;
}

/** Does the current user hold the given permission? */
function can(req, permission) {
  const user = currentUser(req);
  return !!user && hasPermission(user.role, permission);
}

/**
 * Auth + permission guard. Sends 401/403 and returns false when denied.
 * Usage: if (!guard(req, res, origin, sendJson, 'content.write')) return true;
 */
function guard(req, res, origin, sendJson, permission) {
  if (!authOk(req)) {
    sendJson(res, 401, { error: 'unauthorized' }, origin);
    return false;
  }
  if (permission && !can(req, permission)) {
    sendJson(res, 403, { error: 'forbidden', required: permission }, origin);
    return false;
  }
  return true;
}

export function writePageJson(pageKey, lang, data) {
  if (lang !== 'zh') {
    throw new Error('admin_writes_zh_only');
  }
  if (!ADMIN_PAGE_KEYS.has(pageKey)) {
    throw new Error('invalid_page_key');
  }
  writePageJsonAny(pageKey, lang, data);
  return true;
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Admin page forms intentionally expose only operator-facing fields. Keep
 * implementation-only keys already stored in nested objects when a partial
 * form payload is saved. Arrays are replaced on purpose so operators can
 * still add and remove visible content rows.
 */
function mergeAdminPagePayload(previous, incoming) {
  if (!isPlainObject(incoming)) return incoming;
  const merged = isPlainObject(previous) ? { ...previous } : {};
  for (const [key, value] of Object.entries(incoming)) {
    merged[key] = isPlainObject(value) && isPlainObject(merged[key])
      ? mergeAdminPagePayload(merged[key], value)
      : value;
  }
  return merged;
}
function adminErrorStatus(message) {
  if (message === 'body_too_large') return 413;
  if (message === 'too_many_attempts') return 429;
  if (
    message === 'invalid_page_key' ||
    message === 'invalid_catalog_kind' ||
    message === 'invalid_lang' ||
    message === 'invalid_file_type' ||
    message === 'missing_data' ||
    message === 'empty_file' ||
    message === 'file_too_large' ||
    message === 'body_too_large' ||
    message === 'already_exists' ||
    message === 'admin_writes_zh_only' ||
    message === 'missing_resource' ||
    message === 'already_running' ||
    message === 'job_not_done' ||
    message === 'translation_not_configured' ||
    message === 'unsupported_provider' ||
    message === 'invalid_resource' ||
    message === 'translation_length_mismatch' ||
    message === 'translation_bad_response' ||
    message === 'invalid_category_key' ||
    message === 'missing_category_name' ||
    message === 'category_in_use' ||
    message === 'invalid_username' ||
    message === 'weak_password' ||
    message === 'invalid_role' ||
    message === 'cannot_disable_self' ||
    message === 'cannot_delete_self' ||
    String(message || '').startsWith('translation_api_error')
  ) {
    return 400;
  }
  if (message === 'not_found' || message === 'backup_not_found') return 404;
  if (message === 'invalid_backup_id') return 400;
  if (message === 'backup_in_progress' || message === 'home_slot_full' || message === 'unpublish_needs_replace' || message === 'protected_media' || message === 'username_taken' || message === 'last_super_admin') return 409;
  return 500;
}

function sendCatalogError(res, err, origin, sendJson) {
  if (err && (err.message === 'home_slot_full' || err.message === 'unpublish_needs_replace') && err.payload) {
    sendJson(res, 409, err.payload, origin);
    return;
  }
  const status = adminErrorStatus(err.message);
  const safeCodes = new Set([
    'not_found', 'invalid_body', 'unauthorized', 'forbidden', 'invalid_catalog_kind',
    'invalid_category_key', 'missing_category_name', 'category_in_use', 'backup_not_found',
    'invalid_backup_id', 'backup_in_progress', 'home_slot_full', 'unpublish_needs_replace',
    'protected_media', 'unsupported_provider', 'invalid_resource', 'translation_length_mismatch',
    'translation_bad_response', 'method_not_allowed', 'rate_limit_exceeded',
  ]);
  const code = err && err.message ? String(err.message) : 'internal_error';
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && status >= 500) {
    sendJson(res, status, { error: 'internal_error' }, origin);
    return;
  }
  if (isProd && !safeCodes.has(code) && !code.startsWith('translation_api_error')) {
    sendJson(res, status, { error: code || 'request_failed' }, origin);
    return;
  }
  sendJson(res, status, { error: code, message: code }, origin);
}

/**
 * Sanitize an error message for API responses. In production, unknown
 * errors (status >= 500, e.g. SQL / filesystem failures) are masked so
 * internal details never reach the client.
 */
function safeAdminMessage(err) {
  const code = err && err.message ? String(err.message) : 'internal_error';
  if (process.env.NODE_ENV === 'production' && adminErrorStatus(code) >= 500) {
    return 'internal_error';
  }
  return code;
}

function defaultProduct() {
  return {
    category: '',
    model: '',
    name: '新产品',
    image: '',
    specs: [],
    summary: '',
    contentHtml: '<p></p>',
    published: false,
    showInList: true,
    sortOrder: 0,
    filterKey: '',
    filterKeyEn: '',
  };
}

function defaultNews() {
  return {
    category: '公司新闻',
    title: '新新闻',
    date: new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
    cover: '',
    contentHtml: '<p></p>',
    published: false,
    sortOrder: 0,
    homeFeatured: false,
  };
}

function defaultSolution() {
  return {
    category: '解决方案',
    name: '新解决方案',
    image: '',
    specs: [],
    summary: '',
    contentHtml: '<p></p>',
    published: false,
    painPoints: [],
    process: [],
    slug: '',
    sortOrder: 0,
    homeSlot: '',
  };
}

async function handleCatalogAdmin(req, res, kind, id, origin, sendJson) {
  if (!ADMIN_CATALOG_KINDS.has(kind)) {
    sendJson(res, 400, { error: 'invalid_catalog_kind' }, origin);
    return true;
  }

  if (req.method === 'GET' && !id) {
    const items = listCatalogItemsRawSlim(kind);
    sendJson(res, 200, { kind, lang: 'zh', count: items.length, items }, origin);
    return true;
  }

  if (req.method === 'POST' && !id) {
    try {
      const body = await readBody(req);
      const defaults =
        kind === 'products' ? defaultProduct() :
        kind === 'news' ? defaultNews() :
        defaultSolution();
      const item = createCatalogItemRaw(kind, normalizeCatalogBody(kind, { ...defaults, ...body }));
      regenerateCatalogJs(kind, 'zh');
      generateSitemap();
      markStale(kind);
      writeAudit({
        req,
        action: `${kind}.create`,
        resource: kind,
        resourceId: item.id,
        summary: `新建${catalogNoun(kind)} ${item.id}`,
        detail: { title: item.title || item.name || item.id },
      });
      sendJson(res, 201, { ok: true, kind, id: item.id, item }, origin);
    } catch (err) {
      writeAudit({
        req,
        action: `${kind}.create`,
        resource: kind,
        summary: `新建${catalogNoun(kind)}失败`,
        detail: { error: err.message },
        ok: false,
      });
      sendCatalogError(res, err, origin, sendJson);
    }
    return true;
  }

  if (req.method === 'GET' && id) {
    const item = getCatalogItemRaw(kind, id);
    if (!item) {
      sendJson(res, 404, { error: 'not_found' }, origin);
      return true;
    }
    sendJson(res, 200, item, origin);
    return true;
  }

  if (req.method === 'PUT' && id) {
    try {
      const body = await readBody(req);
      const before = getCatalogItemRaw(kind, id);
      const item = updateCatalogItemRaw(kind, id, normalizeCatalogBody(kind, body));
      regenerateCatalogJs(kind, 'zh');
      generateSitemap();
      // Only enqueue a translation job when translatable text actually changed.
      // Image/link/status-only saves must not call the translation engine.
      if (!before || hasTranslatableDiff(before, item)) {
        markStale(kind);
      }
      writeAudit({
        req,
        action: `${kind}.update`,
        resource: kind,
        resourceId: id,
        summary: `更新${catalogNoun(kind)} ${id}`,
        detail: { keys: Object.keys(body || {}) },
      });
      sendJson(res, 200, { ok: true, kind, id: String(id), item }, origin);
    } catch (err) {
      writeAudit({
        req,
        action: `${kind}.update`,
        resource: kind,
        resourceId: id,
        summary: `更新${catalogNoun(kind)}失败 ${id}`,
        detail: { error: err.message },
        ok: false,
      });
      sendCatalogError(res, err, origin, sendJson);
    }
    return true;
  }

  if (req.method === 'DELETE' && id) {
    try {
      const u = new URL(req.url || '', 'http://localhost');
      const replaceId = u.searchParams.get('replaceId') || null;
      deleteCatalogItemRaw(kind, id, { replaceId });
      regenerateCatalogJs(kind, 'zh');
      generateSitemap();
      markStale(kind);
      writeAudit({
        req,
        action: `${kind}.delete`,
        resource: kind,
        resourceId: id,
        summary: `删除${catalogNoun(kind)} ${id}`,
      });
      sendJson(res, 200, { ok: true, kind, id: String(id), deleted: true }, origin);
    } catch (err) {
      writeAudit({
        req,
        action: `${kind}.delete`,
        resource: kind,
        resourceId: id,
        summary: `删除${catalogNoun(kind)}失败 ${id}`,
        detail: { error: err.message },
        ok: false,
      });
      sendCatalogError(res, err, origin, sendJson);
    }
    return true;
  }

  sendJson(res, 405, { error: 'method_not_allowed' }, origin);
  return true;
}

export async function handleAdmin(req, res, pathname, origin, sendJson) {
  if (pathname === '/api/v1/admin/login' && req.method === 'POST') {
    try {
      if (loginRateLimited(req)) {
        sendJson(res, 429, { error: 'too_many_attempts' }, origin);
        return true;
      }
      const body = await readBody(req);
      const username = String(body.actor || body.username || body.operator || body.name || '').trim();
      const password = body.password || '';

      // Primary: authenticate against admin_users.
      let user = authenticate(username, password);

      // Transition fallback: the legacy shared ADMIN_PASSWORD still grants the
      // bootstrap super_admin account, so existing deployments keep working.
      if (!user && ADMIN_PASSWORD && passwordMatches(password)) {
        const db = getDb();
        const row = db.prepare(
          `SELECT * FROM admin_users WHERE role = 'super_admin' AND status = 'active' ORDER BY id LIMIT 1`
        ).get();
        if (row) {
          db.prepare(`UPDATE admin_users SET last_login_at = datetime('now') WHERE id = ?`).run(row.id);
          user = {
            id: row.id, username: row.username,
            displayName: row.display_name, role: row.role,
          };
        }
      }

      if (!user) {
        recordLoginFailure(req);
        writeAudit({
          req,
          actor: username || undefined,
          action: 'login.fail',
          resource: 'auth',
          summary: username ? `登录失败（${username.slice(0, 40)}）` : '登录失败',
          ok: false,
        });
        sendJson(res, 401, { error: 'unauthorized' }, origin);
        return true;
      }

      clearLoginFailures(req);
      writeAudit({
        req,
        actor: user.displayName || user.username,
        action: 'login.ok',
        resource: 'auth',
        summary: `${user.displayName || user.username} 登录成功`,
      });
      const session = createAdminSession(user);
      sendJson(
        res,
        200,
        {
          token: session.token,
          expiresAt: session.expiresAt,
          sourceLang: 'zh',
          actor: user.displayName || user.username,
          user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName || user.username,
            role: user.role,
            roleLabel: roleLabel(user.role),
            permissions: [...(ROLES[user.role] ? ROLES[user.role].permissions : [])],
          },
        },
        origin
      );
    } catch (err) {
      writeAudit({
        req,
        action: 'login.fail',
        resource: 'auth',
        summary: '登录请求异常',
        detail: { error: err.message },
        ok: false,
      });
      sendJson(res, 400, { error: 'bad_request', message: safeAdminMessage(err) }, origin);
    }
    return true;
  }

  // A personal "who am I" endpoint so the frontend can restore role/permissions on refresh.
  if (pathname === '/api/v1/admin/me' && req.method === 'GET') {
    const user = currentUser(req);
    if (!user) { sendJson(res, 401, { error: 'unauthorized' }, origin); return true; }
    sendJson(res, 200, {
      user: {
        id: user.id, username: user.username, displayName: user.displayName,
        role: user.role, roleLabel: roleLabel(user.role),
        permissions: [...(ROLES[user.role] ? ROLES[user.role].permissions : [])],
      },
    }, origin);
    return true;
  }

  if (pathname === '/api/v1/admin/logout' && req.method === 'POST') {
    const token = bearerToken(req);
    if (token) adminSessions.delete(token);
    sendJson(res, 200, { ok: true }, origin);
    return true;
  }

  if (pathname === '/api/v1/admin/backups' && req.method === 'GET') {
    if (!guard(req, res, origin, sendJson, 'backup.read')) {
      return true;
    }
    const items = listBackups();
    sendJson(res, 200, { count: items.length, latest: items[0] || null, items }, origin);
    return true;
  }

  if (pathname === '/api/v1/admin/backups' && req.method === 'POST') {
    if (!guard(req, res, origin, sendJson, 'backup.write')) {
      return true;
    }
    try {
      const backup = createBackup({ reason: 'manual' });
      writeAudit({
        req,
        action: 'backup.create',
        resource: 'backup',
        resourceId: backup.id,
        summary: '创建完整备份',
        detail: { files: backup.files, bytes: backup.bytes },
      });
      sendJson(res, 201, { ok: true, backup }, origin);
    } catch (err) {
      sendJson(res, adminErrorStatus(err.message), { error: safeAdminMessage(err) }, origin);
    }
    return true;
  }

  const restoreMatch = pathname.match(/^\/api\/v1\/admin\/backups\/([^/]+)\/restore$/);
  if (restoreMatch && req.method === 'POST') {
    if (!guard(req, res, origin, sendJson, 'backup.write')) {
      return true;
    }
    try {
      const result = restoreBackup(decodeURIComponent(restoreMatch[1]));
      writeAudit({
        req,
        action: 'backup.restore',
        resource: 'backup',
        resourceId: result.backup.id,
        summary: '恢复完整备份',
        detail: { safetyBackupId: result.safetyBackup.id },
      });
      sendJson(res, 200, { ok: true, ...result }, origin);
    } catch (err) {
      sendJson(res, adminErrorStatus(err.message), { error: safeAdminMessage(err) }, origin);
    }
    return true;
  }

  if (['POST', 'PUT', 'DELETE'].includes(req.method) && authOk(req)) {
    try {
      ensureAutoBackup();
    } catch (err) {
      sendJson(res, 500, { error: 'auto_backup_failed', message: safeAdminMessage(err) }, origin);
      return true;
    }
  }
  if (pathname === '/api/v1/admin/audit-logs' && req.method === 'GET') {
    if (!guard(req, res, origin, sendJson, 'audit.read')) {
      return true;
    }
    const url = new URL(req.url || '/', 'http://localhost');
    const result = listAuditLogs({
      limit: url.searchParams.get('limit'),
      offset: url.searchParams.get('offset'),
      action: url.searchParams.get('action') || undefined,
      resource: url.searchParams.get('resource') || undefined,
      actor: url.searchParams.get('actor') || undefined,
    });
    sendJson(res, 200, result, origin);
    return true;
  }

  const auditOneMatch = pathname.match(/^\/api\/v1\/admin\/audit-logs\/(\d+)$/);
  if (auditOneMatch && req.method === 'GET') {
    if (!guard(req, res, origin, sendJson, 'audit.read')) {
      return true;
    }
    const item = getAuditLog(auditOneMatch[1]);
    if (!item) {
      sendJson(res, 404, { error: 'not_found' }, origin);
      return true;
    }
    sendJson(res, 200, item, origin);
    return true;
  }

  if (pathname === '/api/v1/admin/translation-status' && req.method === 'GET') {
    if (!guard(req, res, origin, sendJson, 'translation.read')) {
      return true;
    }
    sendJson(res, 200, readTranslationStatus(), origin);
    return true;
  }

  if (pathname === '/api/v1/admin/translation-jobs' && req.method === 'GET') {
    if (!guard(req, res, origin, sendJson, 'translation.read')) {
      return true;
    }
    sendJson(res, 200, listTranslationJobs(), origin);
    return true;
  }

  if (pathname === '/api/v1/admin/translation-config' && req.method === 'GET') {
    if (!guard(req, res, origin, sendJson, 'translation.read')) {
      return true;
    }
    // Strip apiKey before sending to client
    const { apiKey, ...safeCfg } = getTranslationConfig();
    sendJson(res, 200, safeCfg, origin);
    return true;
  }

  // --- Translation engine management ---

  if (pathname === '/api/v1/admin/translation-engines' && (req.method === 'GET' || req.method === 'POST')) {
    if (!guard(req, res, origin, sendJson, req.method === 'GET' ? 'translation.read' : 'translation.write')) {
      return true;
    }
    if (req.method === 'GET') {
      sendJson(res, 200, { engines: listEngines(), presets: getProviderPresets() }, origin);
      return true;
    }
    // POST — create
    try {
      const body = await readBody(req);
      const engine = createEngine(body);
      writeAudit({
        req,
        action: 'translation.engine_create',
        resource: 'translation',
        resourceId: String(engine.id),
        summary: `新增翻译引擎「${engine.name}」`,
        detail: { provider: engine.provider, model: engine.model },
      });
      sendJson(res, 201, { ok: true, engine }, origin);
    } catch (err) {
      writeAudit({
        req,
        action: 'translation.engine_create',
        resource: 'translation',
        summary: '新增翻译引擎失败',
        detail: { error: err.message },
        ok: false,
      });
      sendJson(res, adminErrorStatus(err.message), { error: safeAdminMessage(err) }, origin);
    }
    return true;
  }

  const engineMatch = pathname.match(/^\/api\/v1\/admin\/translation-engines\/([^/]+)(?:\/(activate))?$/);
  if (engineMatch) {
    if (!guard(req, res, origin, sendJson, 'translation.read')) {
      return true;
    }
    const engineId = engineMatch[1];
    const action = engineMatch[2];
    try {
      if (req.method === 'PUT' && !action) {
        const body = await readBody(req);
        const engine = updateEngine(engineId, body);
        writeAudit({
          req,
          action: 'translation.engine_update',
          resource: 'translation',
          resourceId: String(engine.id),
          summary: `编辑翻译引擎「${engine.name}」`,
          detail: { provider: engine.provider, model: engine.model },
        });
        sendJson(res, 200, { ok: true, engine }, origin);
        return true;
      }
      if (req.method === 'DELETE' && !action) {
        deleteEngine(engineId);
        writeAudit({
          req,
          action: 'translation.engine_delete',
          resource: 'translation',
          resourceId: engineId,
          summary: `删除翻译引擎 #${engineId}`,
        });
        sendJson(res, 200, { ok: true, deleted: engineId }, origin);
        return true;
      }
      if (req.method === 'POST' && action === 'activate') {
        const engine = activateEngine(engineId);
        writeAudit({
          req,
          action: 'translation.engine_activate',
          resource: 'translation',
          resourceId: String(engine.id),
          summary: `设为当前翻译引擎「${engine.name}」`,
        });
        sendJson(res, 200, { ok: true, engine }, origin);
        return true;
      }
    } catch (err) {
      writeAudit({
        req,
        action: action ? `translation.engine_${action}` : 'translation.engine_update',
        resource: 'translation',
        resourceId: engineId,
        summary: `翻译引擎操作失败 #${engineId}`,
        detail: { error: err.message },
        ok: false,
      });
      sendJson(res, adminErrorStatus(err.message), { error: safeAdminMessage(err) }, origin);
      return true;
    }
  }

  if (pathname === '/api/v1/admin/translation-jobs' && req.method === 'POST') {
    // Write actions on translation jobs were removed when the auto-scheduler
    // took over. Stale resources are now promoted + executed automatically;
    // this endpoint stays read-only (GET). Keep a friendly 405 so old admin
    // tabs that haven't refreshed don't get a silent 404.
    sendJson(res, 405, { error: 'method_not_allowed', hint: 'translation_runs_automatically' }, origin);
    return true;
  }

  // --- Translation API usage log (read-only observability) ---

  if (pathname === '/api/v1/admin/translation-api-logs' && req.method === 'GET') {
    if (!guard(req, res, origin, sendJson, 'translation.read')) {
      return true;
    }
    const url = new URL(req.url || '/', 'http://localhost');
    const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);
    const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);
    sendJson(res, 200, { logs: listApiLogs({ limit, offset }) }, origin);
    return true;
  }

  if (pathname === '/api/v1/admin/translation-api-usage' && req.method === 'GET') {
    if (!guard(req, res, origin, sendJson, 'translation.read')) {
      return true;
    }
    sendJson(res, 200, getApiUsageStats(), origin);
    return true;
  }

  if (pathname === '/api/v1/admin/glossary' && req.method === 'GET') {
    if (!guard(req, res, origin, sendJson, 'translation.read')) { return true; }
    const u = new URL(req.url, 'http://localhost');
    const q = (u.searchParams.get('q') || '').trim().toLowerCase();
    const scope = u.searchParams.get('scope') || '';
    const page = Math.max(1, Number(u.searchParams.get('page')) || 1);
    const size = Math.min(100, Math.max(1, Number(u.searchParams.get('size')) || 20));
    const db = getDb();
    let where = '1=1';
    const params = [];
    if (scope) { where += ' AND scope = ?'; params.push(scope); }
    // Group en/ru by (scope, source_norm)
    const baseSql = `FROM translation_memory WHERE ${where}`;
    let rows = db.prepare(`SELECT DISTINCT scope, source_norm ${baseSql} ORDER BY source_norm`).all(...params);
    // Search filter (match source_norm or any translation)
    if (q) {
      rows = rows.filter((r) => {
        if (r.source_norm.toLowerCase().includes(q)) return true;
        const tr = db.prepare('SELECT translation FROM translation_memory WHERE scope=? AND source_norm=?').all(r.scope, r.source_norm);
        return tr.some((t) => t.translation.toLowerCase().includes(q));
      });
    }
    const total = rows.length;
    const paged = rows.slice((page - 1) * size, page * size);
    const items = paged.map((r) => {
      const en = db.prepare("SELECT translation, updated_at FROM translation_memory WHERE scope=? AND source_norm=? AND lang='en'").get(r.scope, r.source_norm);
      const ru = db.prepare("SELECT translation, updated_at FROM translation_memory WHERE scope=? AND source_norm=? AND lang='ru'").get(r.scope, r.source_norm);
      return {
        source: r.source_norm, scope: r.scope,
        en: en?.translation || '', ru: ru?.translation || '',
        updatedAt: en?.updated_at || ru?.updated_at || '',
      };
    });
    const stats = db.prepare('SELECT scope, COUNT(DISTINCT source_norm) AS c FROM translation_memory GROUP BY scope').all();
    sendJson(res, 200, { total, page, size, items, stats: Object.fromEntries(stats.map((s) => [s.scope, s.c])) }, origin);
    return true;
  }

  if (pathname === '/api/v1/admin/glossary' && req.method === 'PUT') {
    if (!guard(req, res, origin, sendJson, 'translation.write')) { return true; }
    const body = await readBody(req);
    const source = String(body.source || '').trim();
    if (!source) { sendJson(res, 400, { error: 'missing_source' }, origin); return true; }
    const sourceNorm = normalizeForCompare(source);
    const scope = body.scope === 'page-title' ? 'page-title' : 'term';
    const db = getDb();
    const stmt = db.prepare(
      `INSERT INTO translation_memory (scope, source_norm, lang, translation, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(scope, source_norm, lang) DO UPDATE SET translation=excluded.translation, updated_at=datetime('now')`
    );
    let changes = 0;
    if (body.en != null && String(body.en).trim()) changes += stmt.run(scope, sourceNorm, 'en', String(body.en).trim()).changes || 0;
    if (body.ru != null && String(body.ru).trim()) changes += stmt.run(scope, sourceNorm, 'ru', String(body.ru).trim()).changes || 0;
    writeAudit({ req, action: 'glossary.upsert', resource: 'glossary', summary: `术语「${source}」更新` });
    sendJson(res, 200, { ok: true, sourceNorm, scope, changes }, origin);
    return true;
  }

  if (pathname === '/api/v1/admin/glossary' && req.method === 'DELETE') {
    if (!guard(req, res, origin, sendJson, 'translation.write')) { return true; }
    const u = new URL(req.url, 'http://localhost');
    const source = (u.searchParams.get('source') || '').trim();
    const scope = u.searchParams.get('scope') || 'term';
    if (!source) { sendJson(res, 400, { error: 'missing_source' }, origin); return true; }
    const sourceNorm = normalizeForCompare(source);
    const db = getDb();
    const r = db.prepare('DELETE FROM translation_memory WHERE scope=? AND source_norm=?').run(scope, sourceNorm);
    writeAudit({ req, action: 'glossary.delete', resource: 'glossary', summary: `删除术语「${source}」` });
    sendJson(res, 200, { ok: true, deleted: r.changes }, origin);
    return true;
  }

  /* ── Account management (super_admin only) ── */

  if (pathname === '/api/v1/admin/roles' && req.method === 'GET') {
    if (!guard(req, res, origin, sendJson, 'account.manage')) return true;
    const roles = ROLE_KEYS.map((key) => ({
      key,
      label: ROLES[key].label,
      desc: ROLES[key].desc,
      permissions: [...ROLES[key].permissions],
    }));
    sendJson(res, 200, { roles }, origin);
    return true;
  }

  if (pathname === '/api/v1/admin/accounts' && req.method === 'GET') {
    if (!guard(req, res, origin, sendJson, 'account.manage')) return true;
    sendJson(res, 200, { accounts: listAdminUsers() }, origin);
    return true;
  }

  if (pathname === '/api/v1/admin/accounts' && req.method === 'POST') {
    if (!guard(req, res, origin, sendJson, 'account.manage')) return true;
    try {
      const body = await readBody(req);
      const me = currentUser(req);
      const account = createAdminUser({
        username: body.username,
        displayName: body.displayName,
        password: body.password,
        role: body.role || 'editor',
        createdBy: me ? me.username : '',
      });
      writeAudit({ req, action: 'account.create', resource: 'account', resourceId: String(account.id), summary: `新建账号 ${account.username}（${roleLabel(account.role)}）` });
      sendJson(res, 201, { ok: true, account }, origin);
    } catch (err) {
      sendJson(res, adminErrorStatus(err.message), { error: safeAdminMessage(err) }, origin);
    }
    return true;
  }

  const accountMatch = pathname.match(/^\/api\/v1\/admin\/accounts\/(\d+)$/);
  if (accountMatch) {
    if (!guard(req, res, origin, sendJson, 'account.manage')) return true;
    const id = Number(accountMatch[1]);
    const me = currentUser(req);
    if (req.method === 'PUT') {
      try {
        const body = await readBody(req);
        const account = updateAdminUser(id, body, me ? me.username : '');
        writeAudit({ req, action: 'account.update', resource: 'account', resourceId: String(id), summary: `更新账号 ${account.username}` });
        sendJson(res, 200, { ok: true, account }, origin);
      } catch (err) {
        sendJson(res, adminErrorStatus(err.message), { error: safeAdminMessage(err) }, origin);
      }
      return true;
    }
    if (req.method === 'DELETE') {
      try {
        const target = getAdminUserById(id);
        if (!target) { sendJson(res, 404, { error: 'not_found' }, origin); return true; }
        if (me && target.username === me.username) { sendJson(res, 400, { error: 'cannot_delete_self' }, origin); return true; }
        // Reuse disable path: deleting == disabling (soft). Hard delete not exposed.
        const account = updateAdminUser(id, { status: 'disabled' }, me ? me.username : '');
        writeAudit({ req, action: 'account.disable', resource: 'account', resourceId: String(id), summary: `停用账号 ${account.username}` });
        sendJson(res, 200, { ok: true, account }, origin);
      } catch (err) {
        sendJson(res, adminErrorStatus(err.message), { error: safeAdminMessage(err) }, origin);
      }
      return true;
    }
  }

  const jobMatch = pathname.match(/^\/api\/v1\/admin\/translation-jobs\/([^/]+)(?:\/(run|apply))?$/);
  if (jobMatch) {
    if (!guard(req, res, origin, sendJson, req.method === 'GET' ? 'translation.read' : 'translation.write')) {
      return true;
    }
    const jobId = jobMatch[1];
    const action = jobMatch[2];
    // GET single job stays available (read-only history).
    if (req.method === 'GET' && !action) {
      try {
        sendJson(res, 200, getTranslationJob(jobId), origin);
      } catch (err) {
        sendJson(res, adminErrorStatus(err.message), { error: safeAdminMessage(err) }, origin);
      }
      return true;
    }
    // run / apply are now handled by the automatic scheduler.
    sendJson(res, 405, { error: 'method_not_allowed', hint: 'translation_runs_automatically' }, origin);
    return true;
  }

  if (pathname === '/api/v1/admin/home-slots' && req.method === 'GET') {
    if (!guard(req, res, origin, sendJson, 'content.read')) {
      return true;
    }
    sendJson(res, 200, getHomeSlotsStatus(), origin);
    return true;
  }

  if (pathname === '/api/v1/admin/site' && (req.method === 'GET' || req.method === 'PUT')) {
    if (!guard(req, res, origin, sendJson, req.method === 'GET' ? 'content.read' : 'content.write')) {
      return true;
    }
    if (req.method === 'GET') {
      sendJson(res, 200, loadSiteSettings('zh'), origin);
      return true;
    }
    try {
      const body = await readBody(req);
      writeSiteSettings('zh', body);
      markStale('site');
      writeAudit({
        req,
        action: 'site.update',
        resource: 'site',
        summary: '更新导航 / 页脚',
        detail: { keys: Object.keys(body || {}) },
      });
      sendJson(res, 200, { ok: true, lang: 'zh' }, origin);
    } catch (err) {
      writeAudit({
        req,
        action: 'site.update',
        resource: 'site',
        summary: '更新站点文案失败',
        detail: { error: err.message },
        ok: false,
      });
      sendJson(res, adminErrorStatus(err.message), { error: safeAdminMessage(err) }, origin);
    }
    return true;
  }

  if (pathname === '/api/v1/admin/media' && req.method === 'GET') {
    if (!guard(req, res, origin, sendJson, 'media.read')) {
      return true;
    }
    sendJson(res, 200, { items: listUploadedMedia() }, origin);
    return true;
  }

  if (pathname === '/api/v1/admin/media' && req.method === 'POST') {
    if (!guard(req, res, origin, sendJson, 'media.write')) {
      return true;
    }
    try {
      const body = await readBody(req);
      const saved = await saveUploadedMedia({
        filename: body.filename,
        dataBase64: body.data || body.dataBase64,
        mime: body.mime,
        alt: body.alt || '',
      });
      writeAudit({
        req,
        action: 'media.upload',
        resource: 'media',
        resourceId: saved.id || saved.path,
        summary: `上传媒体 ${saved.filename || saved.path || ''}`,
        detail: { path: saved.path, mime: body.mime },
      });
      sendJson(res, 201, { ok: true, ...saved }, origin);
    } catch (err) {
      writeAudit({
        req,
        action: 'media.upload',
        resource: 'media',
        summary: '上传媒体失败',
        detail: { error: err.message },
        ok: false,
      });
      sendJson(res, adminErrorStatus(err.message), { error: safeAdminMessage(err) }, origin);
    }
    return true;
  }

  const mediaItemMatch = pathname.match(/^\/api\/v1\/admin\/media\/([^/]+)$/);
  if (mediaItemMatch) {
    if (!guard(req, res, origin, sendJson, 'media.read')) {
      return true;
    }
    const mediaId = decodeURIComponent(mediaItemMatch[1]);
    if (req.method === 'DELETE') {
      try {
        const result = await deleteUploadedMedia(mediaId);
        writeAudit({
          req,
          action: 'media.delete',
          resource: 'media',
          resourceId: mediaId,
          summary: `删除媒体 ${mediaId}`,
        });
        sendJson(res, 200, { ok: true, ...result }, origin);
      } catch (err) {
        writeAudit({
          req,
          action: 'media.delete',
          resource: 'media',
          resourceId: mediaId,
          summary: `删除媒体失败 ${mediaId}`,
          detail: { error: err.message },
          ok: false,
        });
        sendJson(res, adminErrorStatus(err.message), { error: safeAdminMessage(err) }, origin);
      }
      return true;
    }
    if (req.method === 'PUT') {
      try {
        const body = await readBody(req);
        const result = updateMediaAlt(mediaId, body.alt || '');
        writeAudit({
          req,
          action: 'media.update_alt',
          resource: 'media',
          resourceId: mediaId,
          summary: `更新媒体 alt ${mediaId}`,
        });
        sendJson(res, 200, { ok: true, ...result }, origin);
      } catch (err) {
        writeAudit({
          req,
          action: 'media.update_alt',
          resource: 'media',
          resourceId: mediaId,
          summary: `更新媒体 alt 失败 ${mediaId}`,
          detail: { error: err.message },
          ok: false,
        });
        sendJson(res, adminErrorStatus(err.message), { error: safeAdminMessage(err) }, origin);
      }
      return true;
    }
  }

  const catalogListMatch = pathname.match(/^\/api\/v1\/admin\/(products|news|solutions)$/);
  if (catalogListMatch && (req.method === 'GET' || req.method === 'POST')) {
    if (!guard(req, res, origin, sendJson, req.method === 'GET' ? 'content.read' : 'content.write')) {
      return true;
    }
    return handleCatalogAdmin(req, res, catalogListMatch[1], null, origin, sendJson);
  }

  const catalogItemMatch = pathname.match(/^\/api\/v1\/admin\/(products|news|solutions)\/([^/]+)$/);
  if (catalogItemMatch && (req.method === 'GET' || req.method === 'PUT' || req.method === 'DELETE')) {
    if (!guard(req, res, origin, sendJson, req.method === 'GET' ? 'content.read' : 'content.write')) {
      return true;
    }
    return handleCatalogAdmin(req, res, catalogItemMatch[1], catalogItemMatch[2], origin, sendJson);
  }

  const pageMatch = pathname.match(/^\/api\/v1\/admin\/pages\/([^/]+)$/);
  if (pageMatch && (req.method === 'GET' || req.method === 'PUT')) {
    if (!guard(req, res, origin, sendJson, req.method === 'GET' ? 'content.read' : 'content.write')) {
      return true;
    }
    const pageKey = pageMatch[1];
    if (req.method === 'GET') {
      const item = readPageJson(pageKey, 'zh');
      if (!item) {
        sendJson(res, 404, { error: 'not_found' }, origin);
        return true;
      }
      sendJson(res, 200, item, origin);
      return true;
    }
    try {
      const body = await readBody(req);
      const current = readPageJson(pageKey, 'zh') || {};
      const payload = mergeAdminPagePayload(current, body || {});
      payload.pageKey = pageKey;
      payload.lang = 'zh';
      writePageJson(pageKey, 'zh', payload);
      regeneratePageJs(pageKey, 'zh');
      // En/ru are handled by the translation scheduler.
      // Do NOT mirror zh into en/ru here — mirrorAssets cannot safely merge
      // structural array changes (added/removed items) without corrupting
      // existing translations. The scheduler's translateTree properly handles
      // zh→en/ru translation, including change detection via snapshots.
      markStale(`pages:${pageKey}`);
      writeAudit({
        req,
        action: 'pages.update',
        resource: `pages:${pageKey}`,
        resourceId: pageKey,
        summary: `更新页面 ${pageKey}`,
      });
      sendJson(res, 200, { ok: true, pageKey, lang: 'zh' }, origin);
    } catch (err) {
      writeAudit({
        req,
        action: 'pages.update',
        resource: `pages:${pageKey}`,
        resourceId: pageKey,
        summary: `更新页面失败 ${pageKey}`,
        detail: { error: err.message },
        ok: false,
      });
      sendJson(res, adminErrorStatus(err.message), { error: safeAdminMessage(err) }, origin);
    }
    return true;
  }

  if (pathname === '/api/v1/admin/categories' && req.method === 'GET') {
    if (!guard(req, res, origin, sendJson, 'content.read')) {
      return true;
    }
    sendJson(res, 200, getCategoriesBundle(), origin);
    return true;
  }

  if (pathname === '/api/v1/admin/categories/products' && req.method === 'GET') {
    if (!guard(req, res, origin, sendJson, 'content.read')) {
      return true;
    }
    sendJson(res, 200, { items: listProductCategories() }, origin);
    return true;
  }

  if (pathname === '/api/v1/admin/categories/news' && req.method === 'GET') {
    if (!guard(req, res, origin, sendJson, 'content.read')) {
      return true;
    }
    sendJson(res, 200, { items: listNewsCategories() }, origin);
    return true;
  }

  if (pathname === '/api/v1/admin/categories/products' && req.method === 'POST') {
    if (!guard(req, res, origin, sendJson, 'content.write')) {
      return true;
    }
    try {
      const body = await readBody(req);
      const item = upsertProductCategory(body, { isNew: true });
      writeAudit({
        req,
        action: 'categories.product.create',
        resource: 'categories',
        resourceId: item.key,
        summary: `新建产品分类 ${item.name}`,
      });
      sendJson(res, 201, { ok: true, item }, origin);
    } catch (err) {
      sendJson(res, adminErrorStatus(err.message), { error: safeAdminMessage(err) }, origin);
    }
    return true;
  }

  if (pathname === '/api/v1/admin/categories/news' && req.method === 'POST') {
    if (!guard(req, res, origin, sendJson, 'content.write')) {
      return true;
    }
    try {
      const body = await readBody(req);
      const item = upsertNewsCategory(body, { isNew: true });
      writeAudit({
        req,
        action: 'categories.news.create',
        resource: 'categories',
        resourceId: item.key,
        summary: `新建新闻分类 ${item.name}`,
      });
      sendJson(res, 201, { ok: true, item }, origin);
    } catch (err) {
      sendJson(res, adminErrorStatus(err.message), { error: safeAdminMessage(err) }, origin);
    }
    return true;
  }

  const catProductMatch = pathname.match(/^\/api\/v1\/admin\/categories\/products\/([^/]+)$/);
  if (catProductMatch && (req.method === 'PUT' || req.method === 'DELETE')) {
    if (!guard(req, res, origin, sendJson, 'content.write')) {
      return true;
    }
    const key = decodeURIComponent(catProductMatch[1]);
    try {
      if (req.method === 'DELETE') {
        const result = deleteProductCategory(key);
        writeAudit({
          req,
          action: 'categories.product.delete',
          resource: 'categories',
          resourceId: key,
          summary: `删除产品分类 ${key}`,
        });
        sendJson(res, 200, result, origin);
        return true;
      }
      const body = await readBody(req);
      body.key = key;
      const item = upsertProductCategory(body, { isNew: false });
      writeAudit({
        req,
        action: 'categories.product.update',
        resource: 'categories',
        resourceId: key,
        summary: `更新产品分类 ${item.name}`,
      });
      sendJson(res, 200, { ok: true, item }, origin);
    } catch (err) {
      sendJson(res, adminErrorStatus(err.message), { error: safeAdminMessage(err) }, origin);
    }
    return true;
  }

  const catNewsMatch = pathname.match(/^\/api\/v1\/admin\/categories\/news\/([^/]+)$/);
  if (catNewsMatch && (req.method === 'PUT' || req.method === 'DELETE')) {
    if (!guard(req, res, origin, sendJson, 'content.write')) {
      return true;
    }
    const key = decodeURIComponent(catNewsMatch[1]);
    try {
      if (req.method === 'DELETE') {
        const result = deleteNewsCategory(key);
        writeAudit({
          req,
          action: 'categories.news.delete',
          resource: 'categories',
          resourceId: key,
          summary: `删除新闻分类 ${key}`,
        });
        sendJson(res, 200, result, origin);
        return true;
      }
      const body = await readBody(req);
      body.key = key;
      const item = upsertNewsCategory(body, { isNew: false });
      writeAudit({
        req,
        action: 'categories.news.update',
        resource: 'categories',
        resourceId: key,
        summary: `更新新闻分类 ${item.name}`,
      });
      sendJson(res, 200, { ok: true, item }, origin);
    } catch (err) {
      sendJson(res, adminErrorStatus(err.message), { error: safeAdminMessage(err) }, origin);
    }
    return true;
  }

  if (pathname === '/api/v1/admin/categories/solutions' && req.method === 'GET') {
    if (!guard(req, res, origin, sendJson, 'content.read')) {
      return true;
    }
    sendJson(res, 200, { items: listSolutionCategories() }, origin);
    return true;
  }

  if (pathname === '/api/v1/admin/categories/solutions' && req.method === 'POST') {
    if (!guard(req, res, origin, sendJson, 'content.write')) {
      return true;
    }
    try {
      const body = await readBody(req);
      const item = upsertSolutionCategory(body, { isNew: true });
      writeAudit({
        req,
        action: 'categories.solution.create',
        resource: 'categories',
        resourceId: item.key,
        summary: `新建方案分类 ${item.name}`,
      });
      sendJson(res, 201, { ok: true, item }, origin);
    } catch (err) {
      sendJson(res, adminErrorStatus(err.message), { error: safeAdminMessage(err) }, origin);
    }
    return true;
  }

  const catSolutionMatch = pathname.match(/^\/api\/v1\/admin\/categories\/solutions\/([^/]+)$/);
  if (catSolutionMatch && (req.method === 'PUT' || req.method === 'DELETE')) {
    if (!guard(req, res, origin, sendJson, 'content.write')) {
      return true;
    }
    const key = decodeURIComponent(catSolutionMatch[1]);
    try {
      if (req.method === 'DELETE') {
        const result = deleteSolutionCategory(key);
        writeAudit({
          req,
          action: 'categories.solution.delete',
          resource: 'categories',
          resourceId: key,
          summary: `删除方案分类 ${key}`,
        });
        sendJson(res, 200, result, origin);
        return true;
      }
      const body = await readBody(req);
      body.key = key;
      const item = upsertSolutionCategory(body, { isNew: false });
      writeAudit({
        req,
        action: 'categories.solution.update',
        resource: 'categories',
        resourceId: key,
        summary: `更新方案分类 ${item.name}`,
      });
      sendJson(res, 200, { ok: true, item }, origin);
    } catch (err) {
      sendJson(res, adminErrorStatus(err.message), { error: safeAdminMessage(err) }, origin);
    }
    return true;
  }

  if (pathname === '/api/v1/admin/analytics/summary' && req.method === 'GET') {
    if (!guard(req, res, origin, sendJson, 'analytics.read')) {
      return true;
    }
    sendJson(res, 200, getAnalyticsSummary(), origin);
    return true;
  }

  if (pathname === '/api/v1/admin/analytics/report' && req.method === 'GET') {
    if (!guard(req, res, origin, sendJson, 'analytics.read')) {
      return true;
    }
    const url = new URL(req.url || '/', 'http://localhost');
    sendJson(res, 200, getAnalyticsReport({
      from: url.searchParams.get('from'),
      to: url.searchParams.get('to'),
      lang: url.searchParams.get('lang'),
      page: url.searchParams.get('page'),
      pageSize: url.searchParams.get('pageSize'),
    }), origin);
    return true;
  }

  if (pathname === '/api/v1/admin/dashboard/recent-updates' && req.method === 'GET') {
    if (!guard(req, res, origin, sendJson, 'content.read')) {
      return true;
    }
    const url = new URL(req.url || '/', 'http://localhost');
    const limit = url.searchParams.get('limit') || 8;
    sendJson(res, 200, listRecentContentUpdates({ limit }), origin);
    return true;
  }

  return false;
}
