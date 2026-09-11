/**
 * 验证：分类译名修复后，页面筛选同步逻辑是否幂等。
 * 对比调用 sync* 前后 data/pages/{solutions,products,news}/{zh,en,ru}.json 的内容差异。
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = 'H:/tongxing';
const out = [];
const log = (s) => out.push(s);

try {
  const cats = await import(pathToFileURL(path.join(ROOT, 'server/src/services/categories.js')).href);

  const snapshot = () => {
    const snap = {};
    for (const page of ['solutions', 'products', 'news']) {
      for (const lang of ['zh', 'en', 'ru']) {
        const p = path.join(ROOT, `data/pages/${page}/${lang}.json`);
        if (fs.existsSync(p)) snap[`${page}/${lang}`] = fs.readFileSync(p, 'utf8');
      }
    }
    return snap;
  };

  const before = snapshot();

  // 触发同步（内部会走 ensureCategoryTables → syncProduct/News/Solution）
  const solCats = cats.listSolutionCategories();
  const prodCats = cats.listProductCategories();
  cats.syncSolutionPageFilters();
  cats.syncProductPageFilters();
  cats.syncNewsPageFilters();

  const after = snapshot();

  log('=== 方案分类表（修复后） ===');
  for (const c of solCats) {
    log(`${c.key.padEnd(14)} zh=${c.name.padEnd(10)} en=${(c.nameEn || '(空)').padEnd(26)} ru=${c.nameRu || '(空)'}`);
  }
  log('\n=== 产品分类表 ===');
  for (const c of prodCats) {
    log(`${c.key.padEnd(14)} zh=${c.name.padEnd(10)} en=${(c.nameEn || '(空)').padEnd(26)} ru=${c.nameRu || '(空)'}`);
  }

  log('\n=== 同步前后页面 JSON 差异 ===');
  let diffCount = 0;
  for (const key of Object.keys(before)) {
    if (before[key] !== after[key]) {
      diffCount++;
      const b = JSON.parse(before[key]).filters || {};
      const a = JSON.parse(after[key]).filters || {};
      const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
      const changes = [...keys].filter((k) => b[k] !== a[k]).map((k) => `  ${k}: ${b[k]} → ${a[k]}`);
      log(`[变化] ${key}`);
      log(changes.join('\n') || '  (非 filters 字段变化)');
    }
  }
  log(diffCount === 0 ? '无差异 —— 同步逻辑幂等 ✅' : `共 ${diffCount} 个文件发生变化`);

  log('\n=== 当前页面筛选（三语） ===');
  for (const page of ['solutions', 'products', 'news']) {
    for (const lang of ['zh', 'en', 'ru']) {
      const j = JSON.parse(fs.readFileSync(path.join(ROOT, `data/pages/${page}/${lang}.json`), 'utf8'));
      log(`[${page}/${lang}] ` + JSON.stringify(j.filters));
    }
  }
} catch (e) {
  log('ERROR: ' + (e && e.stack ? e.stack : String(e)));
}

fs.writeFileSync(path.join(ROOT, '.tmp-probe.txt'), out.join('\n'), 'utf8');
