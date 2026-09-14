/**
 * 收尾 CTA 文案播种（幂等，可反复执行）
 *
 * 背景：CTA 文案存在 site_settings.settings_json 的 common 里，而数据库不进 Git。
 * 换环境重建库时会缺失这段文案，导致全站收尾 CTA 不渲染。本脚本负责补齐。
 *
 * 规则：中文是唯一源。zh 缺失时用内置中文；en/ru 缺失时调用翻译引擎，
 * 并把译法写进术语库，保证后续自动翻译复用同一套说法。
 *
 * 用法：
 *   node scripts/seed-closing-cta.mjs --check   # 只报告，不写入
 *   node scripts/seed-closing-cta.mjs           # 补齐缺失项
 */
import { getDb } from '../src/db.js';
import { translateTexts } from '../src/services/translateProvider.js';
import { rememberTermTranslations } from '../src/services/translationMemory.js';

const ZH_SOURCE = {
  finalCtaTitle: '精工制臻 同兴必达',
  finalCtaSub: '非标自动化产线的咨询、设计、制造与售后，一站式托付。',
  finalCtaButton: '获取定制方案',
};
const KEYS = Object.keys(ZH_SOURCE);
const LANGS = ['zh', 'en', 'ru'];

function readCommon(db) {
  const map = {};
  for (const r of db.prepare('SELECT lang, settings_json FROM site_settings').all()) {
    const obj = JSON.parse(r.settings_json || '{}');
    map[r.lang] = { raw: obj, common: obj.common || {} };
  }
  return map;
}

async function main() {
  const checkOnly = process.argv.includes('--check');
  const db = getDb();
  const store = readCommon(db);
  const missing = {};

  for (const lang of LANGS) {
    const entry = store[lang];
    if (!entry) {
      console.log(`[skip] site_settings 缺少 ${lang} 行`);
      continue;
    }
    const miss = KEYS.filter((k) => !entry.common[k]);
    if (miss.length) missing[lang] = miss;
  }

  if (!Object.keys(missing).length) {
    console.log('✅ 收尾 CTA 文案三语齐全，无需变更');
    return;
  }

  console.log(checkOnly ? '模式: CHECK（不写入）' : '模式: 写入');
  for (const [lang, keys] of Object.entries(missing)) {
    console.log(`  [缺失] ${lang}: ${keys.join(', ')}`);
  }
  if (checkOnly) return;

  // zh 为源：缺失时用内置中文
  const zhCommon = store.zh ? store.zh.common : {};
  const zhValues = {};
  for (const k of KEYS) zhValues[k] = zhCommon[k] || ZH_SOURCE[k];

  const learned = [];
  for (const lang of LANGS) {
    const keys = missing[lang];
    if (!keys || !keys.length) continue;
    const entry = store[lang];
    const next = {};
    if (lang === 'zh') {
      for (const k of keys) next[k] = zhValues[k];
    } else {
      let translated = [];
      try {
        const res = await translateTexts(keys.map((k) => zhValues[k]), lang, {});
        translated = Array.isArray(res) ? res : [];
      } catch (e) {
        console.log(`  [warn] ${lang} 翻译失败: ${e.message}`);
      }
      keys.forEach((k, i) => {
        const v = String(translated[i] || '').trim();
        if (v) next[k] = v;
      });
      for (const k of keys) {
        if (next[k]) learned.push({ source: zhValues[k], lang, translation: next[k] });
      }
    }
    if (!Object.keys(next).length) continue;

    entry.raw.common = Object.assign({}, entry.common, next);
    db.prepare("UPDATE site_settings SET settings_json=?, updated_at=datetime('now') WHERE lang=?")
      .run(JSON.stringify(entry.raw), lang);
    console.log(`  [写入] ${lang}: ${Object.keys(next).join(', ')}`);
  }

  if (learned.length) {
    const n = rememberTermTranslations(learned);
    console.log(`  [术语库] 记住 ${n} 条译法`);
  }
  console.log('✅ 完成，记得执行 sync:static 重新导出 data/');
}

main().catch((e) => {
  console.error('seed-closing-cta 失败:', e.message);
  process.exit(1);
});
