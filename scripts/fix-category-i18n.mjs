/**
 * 一次性 + 幂等：把分类的英/俄译名统一到一套标准译法，并同步所有产物。
 *
 * 背景：后台只维护中文分类名，en/ru 本应由分类表（xxx_categories.name_en/name_ru）
 * 作为单一真源供给给卡片和筛选按钮。但历史上：
 *   - 方案分类：中文从"冰箱/洗衣机/电容/空调"升级为大类"家电/3C数码/储能/汽车"后，
 *     name_en 仍停在 seed 旧值 → 英文站卡片显示 Refrigerator / Washer / Air Conditioning；
 *   - 产品分类：分类表存的是 seed 短名，页面筛选却演化出了更完整准确的译名，
 *     两边长期不一致（卡片 Packaging vs 按钮 End-of-Line Packaging）。
 *
 * 本脚本：
 *   1) 备份数据库；
 *   2) 把标准译名写入分类表（权威真源）+ translation_memory 术语库（保证后续自动翻译复用）；
 *   3) 同步 data/{products,solutions}/{en,ru}.json 及其 items 的 category；
 *   4) 同步 data/pages/{products,solutions}/{en,ru}.json 的 filters；
 *   5) 删除无方案引用的测试分类。
 *
 * 用法：node scripts/fix-category-i18n.mjs [--check]
 */
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const ROOT = 'H:/tongxing';
const DB_PATH = path.join(ROOT, 'server/data/txam.db');
const CHECK = process.argv.includes('--check');

/** 中 → 英/俄 标准译名。中文是后台唯一真源，这里只锁定译法。 */
const SOLUTION_STANDARD = {
  'tv / 商显': { en: 'TV / Commercial Display', ru: 'ТВ и коммерческие дисплеи' },
  家电: { en: 'Home Appliances', ru: 'Бытовая техника' },
  物流与包装: { en: 'Logistics & Packaging', ru: 'Логистика и упаковка' },
  '3c数码': { en: '3C Electronics', ru: '3C-электроника' },
  储能: { en: 'Energy Storage', ru: 'Накопители энергии' },
  汽车: { en: 'Automotive', ru: 'Автомобильная промышленность' },
  机器人: { en: 'Robotics', ru: 'Робототехника' },
};

const PRODUCT_STANDARD = {
  光学元件组装: { en: 'Optical Component Assembly', ru: 'Сборка оптических компонентов' },
  点胶装配: { en: 'Dispensing Assembly', ru: 'Нанесение клея и сборка' },
  翻转检测: { en: 'Flip Inspection', ru: 'Контроль переворота' },
  锁付组装: { en: 'Screw Fastening Assembly', ru: 'Винтовая сборка' },
  搬运移载: { en: 'Material Handling & Transfer', ru: 'Транспортировка и перемещение' },
  后段包装: { en: 'End-of-Line Packaging', ru: 'Финальная упаковка' },
  机器人集成: { en: 'Robot Integration', ru: 'Интеграция роботов' },
};

const RESOURCES = [
  { table: 'solution_categories', dataDir: 'solutions', page: 'solutions', std: SOLUTION_STANDARD },
  { table: 'product_categories', dataDir: 'products', page: 'products', std: PRODUCT_STANDARD },
];

/** 无方案引用的测试/垃圾分类 */
const JUNK_KEYS = ['solution-s9nqazv'];

/** 与 normalizeForCompare 保持一致（translationFields.js）。 */
function norm(v) {
  return String(v || '')
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .trim()
    .toLowerCase();
}

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const writeJson = (p, data) => fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');

const report = [];

function backupDb() {
  if (CHECK) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = `${DB_PATH}.bak-${stamp}`;
  fs.copyFileSync(DB_PATH, dest);
  report.push(`备份数据库 → ${path.relative(ROOT, dest)}`);
}

function dropJunkCategories(db) {
  for (const key of JUNK_KEYS) {
    const cat = db.prepare('SELECT * FROM solution_categories WHERE key = ?').get(key);
    if (!cat) continue;
    const used =
      db.prepare('SELECT COUNT(*) AS c FROM solutions WHERE filter_key = ? OR category_key = ?')
        .get(key, cat.name)?.c || 0;
    if (used > 0) {
      report.push(`⚠ 分类 ${key} 仍被 ${used} 条方案引用，保留`);
      continue;
    }
    report.push(`删除无引用分类 ${key}（${cat.name}）`);
    if (CHECK) continue;
    db.prepare('DELETE FROM solution_categories WHERE key = ?').run(key);
    for (const lang of ['zh', 'en', 'ru']) {
      const p = path.join(ROOT, `data/pages/solutions/${lang}.json`);
      if (!fs.existsSync(p)) continue;
      const page = readJson(p);
      if (page.filters && page.filters[key]) {
        delete page.filters[key];
        writeJson(p, page);
        report.push(`  清理 pages/solutions/${lang}.json filters.${key}`);
      }
    }
  }
}

function main() {
  const db = new DatabaseSync(DB_PATH);
  dropJunkCategories(db);

  for (const res of RESOURCES) {
    const cats = db.prepare(`SELECT * FROM ${res.table}`).all();
    // 条目 → 分类键（产品/方案表都用 filter_key 关联分类）
    const items = db
      .prepare(`SELECT id, filter_key FROM ${res.dataDir}`)
      .all();
    const nameByKey = { en: {}, ru: {} };

    const upd = db.prepare(
      `UPDATE ${res.table} SET name_en = ?, name_ru = ?, updated_at = datetime('now') WHERE key = ?`
    );
    for (const c of cats) {
      const std = res.std[norm(c.name)];
      if (!std) {
        report.push(`⚠ 未定义标准译名，跳过：${res.table} ${c.key} / ${c.name}`);
        nameByKey.en[c.key] = c.name_en || c.name;
        nameByKey.ru[c.key] = c.name_ru || c.name;
        continue;
      }
      if (c.name_en !== std.en || c.name_ru !== std.ru) {
        report.push(
          `[${res.page}] ${c.key}（${c.name}） en: ${c.name_en || '(空)'} → ${std.en} | ru: ${c.name_ru || '(空)'} → ${std.ru}`
        );
        if (!CHECK) upd.run(std.en, std.ru, c.key);
      }
      nameByKey.en[c.key] = std.en;
      nameByKey.ru[c.key] = std.ru;
    }

    // 术语库 UPSERT：后续自动翻译（含新条目）都会复用这套译法
    const upsertTerm = db.prepare(
      `INSERT INTO translation_memory (scope, source_norm, lang, translation, updated_at)
       VALUES ('term', ?, ?, ?, datetime('now'))
       ON CONFLICT(scope, source_norm, lang) DO UPDATE SET
         translation = excluded.translation, updated_at = datetime('now')`
    );
    for (const c of cats) {
      const std = res.std[norm(c.name)];
      if (!std) continue;
      for (const lang of ['en', 'ru']) {
        const cur = db
          .prepare(
            `SELECT translation FROM translation_memory WHERE scope='term' AND source_norm=? AND lang=?`
          )
          .get(norm(c.name), lang);
        if (!cur || cur.translation !== std[lang]) {
          report.push(`术语库 ${lang}「${c.name}」: ${cur ? cur.translation : '(无)'} → ${std[lang]}`);
          if (!CHECK) upsertTerm.run(norm(c.name), lang, std[lang]);
        }
      }
    }

    // 同步已生成的数据产物
    for (const lang of ['en', 'ru']) {
      const listPath = path.join(ROOT, `data/${res.dataDir}/${lang}.json`);
      if (fs.existsSync(listPath)) {
        const data = readJson(listPath);
        let changed = 0;
        for (const it of items) {
          const item = data[it.id];
          if (!item) continue;
          const want = nameByKey[lang][it.filter_key];
          if (want && item.category !== want) {
            report.push(`data/${res.dataDir}/${lang}.json #${it.id} category: ${item.category} → ${want}`);
            item.category = want;
            changed++;
          }
        }
        if (changed && !CHECK) writeJson(listPath, data);

        for (const it of items) {
          const itemPath = path.join(ROOT, `data/${res.dataDir}/items/${lang}/${it.id}.json`);
          if (!fs.existsSync(itemPath)) continue;
          const item = readJson(itemPath);
          const want = nameByKey[lang][it.filter_key];
          if (want && item.category !== want) {
            if (!CHECK) {
              item.category = want;
              writeJson(itemPath, item);
            }
          }
        }
      }

      const pagePath = path.join(ROOT, `data/pages/${res.page}/${lang}.json`);
      if (fs.existsSync(pagePath)) {
        const page = readJson(pagePath);
        const filters = page.filters || {};
        let changed = 0;
        for (const c of cats) {
          const want = nameByKey[lang][c.key];
          if (want && filters[c.key] !== want) {
            report.push(`pages/${res.page}/${lang} filters.${c.key}: ${filters[c.key]} → ${want}`);
            filters[c.key] = want;
            changed++;
          }
        }
        if (changed && !CHECK) {
          page.filters = filters;
          writeJson(pagePath, page);
        }
      }
    }
  }

  db.close();
}

backupDb();
main();
const body = report.join('\n') || '无需更改，数据已一致';
fs.writeFileSync(
  path.join(ROOT, '.tmp-probe.txt'),
  (CHECK ? '[CHECK MODE] 未写入任何更改\n\n' : '') + body + '\n',
  'utf8'
);
