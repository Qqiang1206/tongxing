/**
 * verify-db-vs-static.mjs — 只读校验：DB(SQLite) vs 静态文件 data/*.json
 *
 * A. 列表一致性: readCatalogJson(kind,lang) vs data/{kind}/{lang}.json
 * B. items 残留: data/{kind}/items/{lang}/*.json vs DB 全部 id / 已发布 id
 * C. 字段语义: solutions.filterKey==slug; products.filterKeyEn 有效性
 * D. 同步开关: SYNC_JSON_ON_WRITE 状态
 *
 * 不修改任何数据（仅写报告 data/meta/verify-report.json）。
 * 用法: node server/scripts/verify-db-vs-static.mjs
 */
import fs from 'fs';
import path from 'path';
import { DATA_DIR, LANGS } from '../src/config.js';
import { getDb } from '../src/db.js';
import { readCatalogJson } from '../src/services/catalog.js';

const KINDS = ['products', 'solutions', 'news'];
const TABLE = { products: 'products', solutions: 'solutions', news: 'news' };

const errors = [];
const warns = [];
const infos = [];

function deepDiff(a, b, prefix = '') {
  const diffs = [];
  if (a === b) return diffs;
  const ta = Object.prototype.toString.call(a);
  const tb = Object.prototype.toString.call(b);
  if (ta !== tb || typeof a !== 'object' || a == null || b == null) {
    diffs.push(`${prefix}: DB=${JSON.stringify(a)} <> 静态=${JSON.stringify(b)}`);
    return diffs;
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (!(k in a)) diffs.push(`${p}: DB缺失, 静态=${JSON.stringify(b[k]).slice(0, 80)}`);
    else if (!(k in b)) diffs.push(`${p}: 静态缺失, DB=${JSON.stringify(a[k]).slice(0, 80)}`);
    else diffs.push(...deepDiff(a[k], b[k], p));
  }
  return diffs;
}

// ---------- D. 同步开关 ----------
const syncRaw = process.env.SYNC_JSON_ON_WRITE;
const syncEnabled = syncRaw == null || syncRaw === ''
  ? true
  : !['0', 'false', 'no'].includes(String(syncRaw).toLowerCase());
infos.push(`[D] SYNC_JSON_ON_WRITE=${syncRaw ?? '(未设置→默认开启)'} → 同步${syncEnabled ? '开启' : '关闭(断链风险!)'}`);
if (!syncEnabled) warns.push('[D] JSON 同步开关处于关闭状态：admin 修改 DB 不会回写静态文件');

const db = getDb();

for (const kind of KINDS) {
  // DB 全部 id（含未发布）与已发布 id
  const allIds = new Set(db.prepare(`SELECT id FROM ${TABLE[kind]}`).all().map((r) => String(r.id)));
  const pubIds = new Set(
    db.prepare(`SELECT id FROM ${TABLE[kind]} WHERE published = 1`).all().map((r) => String(r.id))
  );
  infos.push(`[DB] ${kind}: 总计 ${allIds.size} 条, 已发布 ${pubIds.size} 条, 未发布 ${allIds.size - pubIds.size} 条`);

  for (const lang of LANGS) {
    const dbView = readCatalogJson(kind, lang);
    const dbIds = new Set(Object.keys(dbView));

    // ---------- A. 列表一致性 ----------
    const listPath = path.join(DATA_DIR, kind, `${lang}.json`);
    if (!fs.existsSync(listPath)) {
      errors.push(`[A] ${kind}/${lang}.json 文件不存在`);
      continue;
    }
    const disk = JSON.parse(fs.readFileSync(listPath, 'utf8'));
    const diskIds = new Set(Object.keys(disk));
    for (const id of dbIds)
      if (!diskIds.has(id)) errors.push(`[A] ${kind}/${lang}: DB有 id=${id} 但静态列表缺失（同步缺失）`);
    for (const id of diskIds)
      if (!dbIds.has(id)) errors.push(`[A] ${kind}/${lang}: 静态列表多出 id=${id}（DB无此已发布条目）`);
    for (const id of dbIds) {
      if (!diskIds.has(id)) continue;
      const d = deepDiff(dbView[id], disk[id], `${kind}/${lang}/id=${id}`);
      for (const line of d) errors.push(`[A] 字段差异 ${line}`);
    }

    // ---------- B. items 残留 ----------
    const itemsDir = path.join(DATA_DIR, kind, 'items', lang);
    if (!fs.existsSync(itemsDir)) {
      warns.push(`[B] ${kind}/items/${lang} 目录不存在`);
      continue;
    }
    const files = fs.readdirSync(itemsDir).filter((f) => f.endsWith('.json'));
    const fileIds = files.map((f) => f.replace(/\.json$/, ''));
    for (const id of fileIds) {
      if (!allIds.has(id)) {
        errors.push(`[B] 孤儿文件 ${kind}/items/${lang}/${id}.json（DB 中已无此 id，应删除）`);
      } else if (!pubIds.has(id)) {
        // Unpublished items may keep their item file (re-publish ready);
        // the front-end guardPublishedCatalogItem() redirects visitors.
        // Only an error if the file's published flag doesn't match DB.
        const raw = JSON.parse(fs.readFileSync(path.join(itemsDir, `${id}.json`), 'utf8'));
        if (raw.published !== false)
          errors.push(`[B] ${kind}/items/${lang}/${id}.json published=${JSON.stringify(raw.published)}，DB published=0（守卫无法拦截，应改为 false）`);
        else
          infos.push(`[B] ${kind}/items/${lang}/${id}.json 已下架，published=false，守卫可拦截 ✓`);
      } else if (dbIds.has(id)) {
        // 已发布：内容比对
        const item = JSON.parse(fs.readFileSync(path.join(itemsDir, `${id}.json`), 'utf8'));
        const d = deepDiff(dbView[id], item, `${kind}/items/${lang}/${id}`);
        for (const line of d) errors.push(`[B] item内容差异 ${line}`);
      }
    }
    // DB 已发布但缺 item 文件
    for (const id of dbIds)
      if (!fileIds.includes(id)) errors.push(`[B] ${kind}/items/${lang}/${id}.json 缺失（DB 已发布但无 item 文件）`);
  }
}

// ---------- C. 字段语义 ----------
{
  // C1. solutions: filter_key is a category grouping key (not a slug mirror).
  // Validate it exists in the solutions page filters map.
  const solFiltersPath = path.join(DATA_DIR, 'pages', 'solutions', 'zh.json');
  const solFilters = fs.existsSync(solFiltersPath)
    ? Object.keys(JSON.parse(fs.readFileSync(solFiltersPath, 'utf8')).filters || {})
    : [];
  const validSolFilterKeys = new Set(solFilters.filter((k) => k !== 'all'));
  const rows = db.prepare('SELECT id, slug, filter_key FROM solutions').all();
  for (const r of rows) {
    if (r.filter_key && validSolFilterKeys.size && !validSolFilterKeys.has(r.filter_key))
      errors.push(`[C] solutions id=${r.id}: filterKey='${r.filter_key}' 不在方案页 filters 中（有效值: ${[...validSolFilterKeys].join(', ')}）`);
  }
  if (validSolFilterKeys.size)
    infos.push(`[C] solutions filterKey 有效分类: ${[...validSolFilterKeys].join(', ')}`);

  // C2. products: filter_key is language-neutral and used by the front-end.
  // filterKeyEn is a legacy unused field — report as info only.
  const prodFiltersPath = path.join(DATA_DIR, 'pages', 'products', 'zh.json');
  const prodFilters = fs.existsSync(prodFiltersPath)
    ? Object.keys(JSON.parse(fs.readFileSync(prodFiltersPath, 'utf8')).filters || {})
    : [];
  const validProdFilterKeys = new Set(prodFilters.filter((k) => k !== 'all'));
  const prows = db.prepare('SELECT id, filter_key, filter_key_en FROM products WHERE published = 1 AND show_in_list = 1').all();
  for (const r of prows) {
    if (r.filter_key && validProdFilterKeys.size && !validProdFilterKeys.has(r.filter_key))
      errors.push(`[C] products id=${r.id}: filterKey='${r.filter_key}' 不在产品页 filters 中（有效值: ${[...validProdFilterKeys].join(', ')}）`);
  }
  if (validProdFilterKeys.size)
    infos.push(`[C] products filterKey 有效分类: ${[...validProdFilterKeys].join(', ')}`);
  const legacyEn = prows.filter((r) => r.filter_key_en && r.filter_key_en !== r.filter_key);
  if (legacyEn.length)
    infos.push(`[C] products filterKeyEn 为废弃字段（前端未使用），${legacyEn.length} 条与 filterKey 不一致，不影响功能`);
}

// ---------- 输出 ----------
const report = {
  generatedAt: new Date().toISOString(),
  syncJsonOnWrite: syncRaw ?? null,
  summary: { errors: errors.length, warns: warns.length, infos: infos.length },
  errors,
  warns,
  infos,
};
const metaDir = path.join(DATA_DIR, 'meta');
fs.mkdirSync(metaDir, { recursive: true });
fs.writeFileSync(path.join(metaDir, 'verify-report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');

console.log('====== DB ↔ 静态文件 一致性校验 ======\n');
for (const l of infos) console.log('INFO  ' + l);
console.log('');
for (const l of warns) console.log('WARN  ' + l);
console.log('');
for (const l of errors) console.log('ERROR ' + l);
console.log(`\n结果: ${errors.length} 个错误, ${warns.length} 个警告`);
console.log(`报告: data/meta/verify-report.json`);
process.exit(errors.length ? 1 : 0);
