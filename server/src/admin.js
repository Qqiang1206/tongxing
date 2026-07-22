import {
  readPageJson,
  listCatalogItemsRaw,
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
  markCurrent,
} from './services/translationStatus.js';
import { getAnalyticsSummary } from './services/analytics.js';
import {
  listTranslationJobs,
  createTranslationJob,
  enqueueStaleJobs,
  runTranslationJob,
  applyTranslationJob,
  getTranslationJob,
} from './services/translationJobs.js';
import { getTranslationConfig } from './services/translateProvider.js';
import { saveUploadedMedia, listUploadedMedia, deleteUploadedMedia, updateMediaAlt } from './services/media.js';
import { writeAudit, listAuditLogs, getAuditLog } from './services/audit.js';
import {
  getCategoriesBundle,
  listProductCategories,
  listNewsCategories,
  upsertProductCategory,
  upsertNewsCategory,
  deleteProductCategory,
  deleteNewsCategory,
  resolveProductCategoryFields,
} from './services/categories.js';
import { getHomeSlotsStatus } from './services/homeSlots.js';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

function catalogNoun(kind) {
  return kind === 'products' ? '产品' : kind === 'news' ? '新闻' : '方案';
}

function normalizeCatalogBody(kind, body) {
  const next = { ...body };
  if (kind === 'products') {
    const pick = body.categoryKey || body.filterKey || body.category || '';
    if (pick) Object.assign(next, resolveProductCategoryFields(pick));
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
    req.on('data', (c) => chunks.push(c));
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

function authOk(req) {
  if (!ADMIN_PASSWORD) return false;
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  return token === ADMIN_PASSWORD;
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

function adminErrorStatus(message) {
  if (
    message === 'invalid_page_key' ||
    message === 'invalid_catalog_kind' ||
    message === 'invalid_lang' ||
    message === 'invalid_file_type' ||
    message === 'missing_data' ||
    message === 'empty_file' ||
    message === 'file_too_large' ||
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
    String(message || '').startsWith('translation_api_error')
  ) {
    return 400;
  }
  if (message === 'not_found') return 404;
  if (message === 'home_slot_full' || message === 'unpublish_needs_replace') return 409;
  return 500;
}

function sendCatalogError(res, err, origin, sendJson) {
  if (err && (err.message === 'home_slot_full' || err.message === 'unpublish_needs_replace') && err.payload) {
    sendJson(res, 409, err.payload, origin);
    return;
  }
  sendJson(res, adminErrorStatus(err.message), { error: err.message, message: err.message }, origin);
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
    const items = listCatalogItemsRaw(kind);
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
      const item = updateCatalogItemRaw(kind, id, normalizeCatalogBody(kind, body));
      regenerateCatalogJs(kind, 'zh');
      markStale(kind);
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
  if (!ADMIN_PASSWORD) {
    sendJson(res, 503, { error: 'admin_disabled', message: 'Set ADMIN_PASSWORD env' }, origin);
    return true;
  }

  if (pathname === '/api/v1/admin/login' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const actor = body.actor || body.operator || body.name || '';
      if (body.password !== ADMIN_PASSWORD) {
        writeAudit({
          req,
          actor,
          action: 'login.fail',
          resource: 'auth',
          summary: actor ? `登录失败（${String(actor).slice(0, 40)}）` : '登录失败',
          ok: false,
        });
        sendJson(res, 401, { error: 'unauthorized' }, origin);
        return true;
      }
      const safeActor = String(actor || '').trim().slice(0, 40) || undefined;
      writeAudit({
        req,
        actor: safeActor,
        action: 'login.ok',
        resource: 'auth',
        summary: safeActor ? `${safeActor} 登录成功` : '登录成功',
      });
      sendJson(
        res,
        200,
        { token: ADMIN_PASSWORD, sourceLang: 'zh', actor: safeActor || '管理员' },
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
      sendJson(res, 400, { error: 'bad_request', message: err.message }, origin);
    }
    return true;
  }

  if (pathname === '/api/v1/admin/audit-logs' && req.method === 'GET') {
    if (!authOk(req)) {
      sendJson(res, 401, { error: 'unauthorized' }, origin);
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
    if (!authOk(req)) {
      sendJson(res, 401, { error: 'unauthorized' }, origin);
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
    if (!authOk(req)) {
      sendJson(res, 401, { error: 'unauthorized' }, origin);
      return true;
    }
    sendJson(res, 200, readTranslationStatus(), origin);
    return true;
  }

  if (pathname === '/api/v1/admin/translation-status/mark-current' && req.method === 'POST') {
    if (!authOk(req)) {
      sendJson(res, 401, { error: 'unauthorized' }, origin);
      return true;
    }
    try {
      const body = await readBody(req);
      const status = markCurrent(body.resource, body.lang);
      writeAudit({
        req,
        action: 'translation.mark_current',
        resource: body.resource,
        summary: `标记翻译已同步 ${body.resource}/${body.lang}`,
        detail: { lang: body.lang },
      });
      sendJson(res, 200, { ok: true, status }, origin);
    } catch (err) {
      writeAudit({
        req,
        action: 'translation.mark_current',
        resource: 'translation',
        summary: '标记翻译同步失败',
        detail: { error: err.message },
        ok: false,
      });
      sendJson(res, adminErrorStatus(err.message), { error: err.message }, origin);
    }
    return true;
  }

  if (pathname === '/api/v1/admin/translation-jobs' && req.method === 'GET') {
    if (!authOk(req)) {
      sendJson(res, 401, { error: 'unauthorized' }, origin);
      return true;
    }
    sendJson(res, 200, listTranslationJobs(), origin);
    return true;
  }

  if (pathname === '/api/v1/admin/translation-config' && req.method === 'GET') {
    if (!authOk(req)) {
      sendJson(res, 401, { error: 'unauthorized' }, origin);
      return true;
    }
    sendJson(res, 200, getTranslationConfig(), origin);
    return true;
  }

  if (pathname === '/api/v1/admin/translation-jobs' && req.method === 'POST') {
    if (!authOk(req)) {
      sendJson(res, 401, { error: 'unauthorized' }, origin);
      return true;
    }
    try {
      const body = await readBody(req);
      if (body.enqueueStale) {
        const result = enqueueStaleJobs();
        writeAudit({
          req,
          action: 'translation.enqueue_stale',
          resource: 'translation',
          summary: `为待同步资源建任务 (${result.created ?? result.count ?? '?'})`,
          detail: result,
        });
        sendJson(res, 201, { ok: true, ...result }, origin);
        return true;
      }
      const job = createTranslationJob(body);
      writeAudit({
        req,
        action: 'translation.create_job',
        resource: body.resource || 'translation',
        resourceId: job.id,
        summary: `创建翻译任务 #${job.id}`,
        detail: { resource: body.resource, targetLangs: body.targetLangs },
      });
      sendJson(res, 201, { ok: true, job }, origin);
    } catch (err) {
      writeAudit({
        req,
        action: 'translation.create_job',
        resource: 'translation',
        summary: '创建翻译任务失败',
        detail: { error: err.message },
        ok: false,
      });
      sendJson(res, adminErrorStatus(err.message), { error: err.message }, origin);
    }
    return true;
  }

  const jobMatch = pathname.match(/^\/api\/v1\/admin\/translation-jobs\/([^/]+)(?:\/(run|apply))?$/);
  if (jobMatch) {
    if (!authOk(req)) {
      sendJson(res, 401, { error: 'unauthorized' }, origin);
      return true;
    }
    const jobId = jobMatch[1];
    const action = jobMatch[2];
    try {
      if (req.method === 'GET' && !action) {
        sendJson(res, 200, getTranslationJob(jobId), origin);
        return true;
      }
      if (req.method === 'POST' && action === 'run') {
        const job = await runTranslationJob(jobId);
        writeAudit({
          req,
          action: 'translation.run',
          resource: 'translation',
          resourceId: jobId,
          summary: `运行翻译任务 #${jobId}`,
          detail: { status: job.status },
          ok: job.status !== 'failed',
        });
        sendJson(res, 200, { ok: true, job }, origin);
        return true;
      }
      if (req.method === 'POST' && action === 'apply') {
        const result = applyTranslationJob(jobId);
        writeAudit({
          req,
          action: 'translation.apply',
          resource: 'translation',
          resourceId: jobId,
          summary: `应用翻译任务 #${jobId}`,
          detail: result,
        });
        sendJson(res, 200, { ok: true, ...result }, origin);
        return true;
      }
    } catch (err) {
      writeAudit({
        req,
        action: action ? `translation.${action}` : 'translation.job',
        resource: 'translation',
        resourceId: jobId,
        summary: `翻译任务操作失败 #${jobId}`,
        detail: { error: err.message },
        ok: false,
      });
      sendJson(res, adminErrorStatus(err.message), { error: err.message }, origin);
      return true;
    }
  }

  if (pathname === '/api/v1/admin/home-slots' && req.method === 'GET') {
    if (!authOk(req)) {
      sendJson(res, 401, { error: 'unauthorized' }, origin);
      return true;
    }
    sendJson(res, 200, getHomeSlotsStatus(), origin);
    return true;
  }

  if (pathname === '/api/v1/admin/site' && (req.method === 'GET' || req.method === 'PUT')) {
    if (!authOk(req)) {
      sendJson(res, 401, { error: 'unauthorized' }, origin);
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
      sendJson(res, adminErrorStatus(err.message), { error: err.message }, origin);
    }
    return true;
  }

  if (pathname === '/api/v1/admin/media' && req.method === 'GET') {
    if (!authOk(req)) {
      sendJson(res, 401, { error: 'unauthorized' }, origin);
      return true;
    }
    sendJson(res, 200, { items: listUploadedMedia() }, origin);
    return true;
  }

  if (pathname === '/api/v1/admin/media' && req.method === 'POST') {
    if (!authOk(req)) {
      sendJson(res, 401, { error: 'unauthorized' }, origin);
      return true;
    }
    try {
      const body = await readBody(req);
      const saved = saveUploadedMedia({
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
      sendJson(res, adminErrorStatus(err.message), { error: err.message }, origin);
    }
    return true;
  }

  const mediaItemMatch = pathname.match(/^\/api\/v1\/admin\/media\/([^/]+)$/);
  if (mediaItemMatch) {
    if (!authOk(req)) {
      sendJson(res, 401, { error: 'unauthorized' }, origin);
      return true;
    }
    const mediaId = decodeURIComponent(mediaItemMatch[1]);
    if (req.method === 'DELETE') {
      try {
        const result = deleteUploadedMedia(mediaId);
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
        sendJson(res, adminErrorStatus(err.message), { error: err.message }, origin);
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
        sendJson(res, adminErrorStatus(err.message), { error: err.message }, origin);
      }
      return true;
    }
  }

  const catalogListMatch = pathname.match(/^\/api\/v1\/admin\/(products|news|solutions)$/);
  if (catalogListMatch && (req.method === 'GET' || req.method === 'POST')) {
    if (!authOk(req)) {
      sendJson(res, 401, { error: 'unauthorized' }, origin);
      return true;
    }
    return handleCatalogAdmin(req, res, catalogListMatch[1], null, origin, sendJson);
  }

  const catalogItemMatch = pathname.match(/^\/api\/v1\/admin\/(products|news|solutions)\/([^/]+)$/);
  if (catalogItemMatch && (req.method === 'GET' || req.method === 'PUT' || req.method === 'DELETE')) {
    if (!authOk(req)) {
      sendJson(res, 401, { error: 'unauthorized' }, origin);
      return true;
    }
    return handleCatalogAdmin(req, res, catalogItemMatch[1], catalogItemMatch[2], origin, sendJson);
  }

  const pageMatch = pathname.match(/^\/api\/v1\/admin\/pages\/([^/]+)$/);
  if (pageMatch && (req.method === 'GET' || req.method === 'PUT')) {
    if (!authOk(req)) {
      sendJson(res, 401, { error: 'unauthorized' }, origin);
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
      body.pageKey = pageKey;
      body.lang = 'zh';
      writePageJson(pageKey, 'zh', body);
      regeneratePageJs(pageKey, 'zh');
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
      sendJson(res, adminErrorStatus(err.message), { error: err.message }, origin);
    }
    return true;
  }

  if (pathname === '/api/v1/admin/categories' && req.method === 'GET') {
    if (!authOk(req)) {
      sendJson(res, 401, { error: 'unauthorized' }, origin);
      return true;
    }
    sendJson(res, 200, getCategoriesBundle(), origin);
    return true;
  }

  if (pathname === '/api/v1/admin/categories/products' && req.method === 'GET') {
    if (!authOk(req)) {
      sendJson(res, 401, { error: 'unauthorized' }, origin);
      return true;
    }
    sendJson(res, 200, { items: listProductCategories() }, origin);
    return true;
  }

  if (pathname === '/api/v1/admin/categories/news' && req.method === 'GET') {
    if (!authOk(req)) {
      sendJson(res, 401, { error: 'unauthorized' }, origin);
      return true;
    }
    sendJson(res, 200, { items: listNewsCategories() }, origin);
    return true;
  }

  if (pathname === '/api/v1/admin/categories/products' && req.method === 'POST') {
    if (!authOk(req)) {
      sendJson(res, 401, { error: 'unauthorized' }, origin);
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
      sendJson(res, adminErrorStatus(err.message), { error: err.message }, origin);
    }
    return true;
  }

  if (pathname === '/api/v1/admin/categories/news' && req.method === 'POST') {
    if (!authOk(req)) {
      sendJson(res, 401, { error: 'unauthorized' }, origin);
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
      sendJson(res, adminErrorStatus(err.message), { error: err.message }, origin);
    }
    return true;
  }

  const catProductMatch = pathname.match(/^\/api\/v1\/admin\/categories\/products\/([^/]+)$/);
  if (catProductMatch && (req.method === 'PUT' || req.method === 'DELETE')) {
    if (!authOk(req)) {
      sendJson(res, 401, { error: 'unauthorized' }, origin);
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
      sendJson(res, adminErrorStatus(err.message), { error: err.message }, origin);
    }
    return true;
  }

  const catNewsMatch = pathname.match(/^\/api\/v1\/admin\/categories\/news\/([^/]+)$/);
  if (catNewsMatch && (req.method === 'PUT' || req.method === 'DELETE')) {
    if (!authOk(req)) {
      sendJson(res, 401, { error: 'unauthorized' }, origin);
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
      sendJson(res, adminErrorStatus(err.message), { error: err.message }, origin);
    }
    return true;
  }

  if (pathname === '/api/v1/admin/analytics/summary' && req.method === 'GET') {
    if (!authOk(req)) {
      sendJson(res, 401, { error: 'unauthorized' }, origin);
      return true;
    }
    sendJson(res, 200, getAnalyticsSummary(), origin);
    return true;
  }

  return false;
}
