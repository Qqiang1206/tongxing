/**
 * align-copy-to-html.mjs — 以前端 HTML 为准，回写 DB 文案差异。
 *
 * 背景：前端 HTML 改版后，部分文案与 DB（内容源）漂移，页面加载时
 * JS 会用 DB 数据覆盖 HTML 初始文案，导致前端改动"看起来没生效"。
 * 本脚本把 HTML 的最新文案写回 DB；随后运行 `npm run sync:static`
 * 同步 data/ 快照。
 *
 * 覆盖项：
 *   1. about/{en,ru} hero.lead   ← 各自 about.html #about-hero-lead innerHTML
 *   2. home/ru seo_json.title    ← ru/index.html <title>
 *   3. solutions/{zh,en,ru} filters 删除脏键 solution-s9nqazv
 *   4. site_settings/{en,ru} footer.wechatImage ← 与 zh 对齐
 *
 * 用法: node scripts/align-copy-to-html.js
 */
import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');        // repo root
const DB_PATH = path.join(__dirname, '..', 'data', 'txam.db');
const DIRTY_FILTER_KEY = 'solution-s9nqazv';

const changes = [];
function note(msg) { changes.push(msg); console.log('CHANGE ' + msg); }
function same(msg) { console.log('same   ' + msg); }

function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
function strip(s) { return String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }

/** 提取元素 innerHTML（到匹配的闭合标签，非贪婪） */
function innerHTML(html, id) {
  const m = html.match(new RegExp(`id="${id}"[^>]*>([\\s\\S]*?)</(h1|h2|p|div)>`, 'i'));
  return m ? m[1].trim() : null;
}

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA busy_timeout = 5000;');

// ---------- 1. about/{en,ru} hero.lead ----------
for (const lang of ['en', 'ru']) {
  const htmlFile = lang === 'en' ? 'en/about.html' : 'ru/about.html';
  const htmlLead = innerHTML(read(htmlFile), 'about-hero-lead');
  if (!htmlLead) { console.log(`skip   ${htmlFile} 未找到 #about-hero-lead`); continue; }

  const row = db.prepare("SELECT sections_json FROM pages WHERE page_key='about' AND lang=?").get(lang);
  if (!row) { console.log(`skip   pages about/${lang} 不存在`); continue; }
  const sections = JSON.parse(row.sections_json);
  const dbLead = sections.hero && (sections.hero.leadHtml || sections.hero.lead) || '';
  if (strip(dbLead) === strip(htmlLead)) { same(`about/${lang} hero.lead 一致`); continue; }

  sections.hero = sections.hero || {};
  // 前端渲染优先 leadHtml；保留 <strong> 等内联标签则写 leadHtml，纯文本写 lead
  if (/<[a-z][^>]*>/i.test(htmlLead)) {
    sections.hero.leadHtml = htmlLead;
    delete sections.hero.lead;
  } else {
    sections.hero.lead = htmlLead;
    delete sections.hero.leadHtml;
  }
  db.prepare("UPDATE pages SET sections_json=? WHERE page_key='about' AND lang=?")
    .run(JSON.stringify(sections), lang);
  note(`about/${lang} hero.lead 已更新:\n    - ${strip(dbLead).slice(0, 90)}\n    + ${strip(htmlLead).slice(0, 90)}`);
}

// ---------- 2. home/ru seo.title ----------
{
  const htmlTitle = (read('ru/index.html').match(/<title>([^<]*)<\/title>/i) || [])[1];
  if (htmlTitle) {
    const title = htmlTitle.trim();
    const row = db.prepare("SELECT seo_json, sections_json FROM pages WHERE page_key='home' AND lang='ru'").get();
    if (row) {
      const seo = row.seo_json ? JSON.parse(row.seo_json) : {};
      if (seo.title !== title) {
        const old = seo.title;
        seo.title = title;
        db.prepare("UPDATE pages SET seo_json=? WHERE page_key='home' AND lang='ru'")
          .run(JSON.stringify(seo));
        note(`home/ru seo.title:\n    - ${old}\n    + ${title}`);
      } else same('home/ru seo.title 一致');
    }
  }
}

// ---------- 3. solutions filters 脏键 ----------
for (const lang of ['zh', 'en', 'ru']) {
  const row = db.prepare('SELECT sections_json FROM pages WHERE page_key=? AND lang=?').get('solutions', lang);
  if (!row) continue;
  const sections = JSON.parse(row.sections_json);
  if (sections.filters && DIRTY_FILTER_KEY in sections.filters) {
    const val = sections.filters[DIRTY_FILTER_KEY];
    delete sections.filters[DIRTY_FILTER_KEY];
    db.prepare('UPDATE pages SET sections_json=? WHERE page_key=? AND lang=?')
      .run(JSON.stringify(sections), 'solutions', lang);
    note(`solutions/${lang} filters 删除脏键 ${DIRTY_FILTER_KEY}="${val}"`);
  } else same(`solutions/${lang} filters 无脏键`);
}

// ---------- 4. site_settings footer.wechatImage ----------
{
  const zh = db.prepare("SELECT settings_json FROM site_settings WHERE lang='zh'").get();
  const zhImg = zh ? (JSON.parse(zh.settings_json).footer || {}).wechatImage : null;
  for (const lang of ['en', 'ru']) {
    const row = db.prepare('SELECT settings_json FROM site_settings WHERE lang=?').get(lang);
    if (!row) continue;
    const settings = JSON.parse(row.settings_json);
    settings.footer = settings.footer || {};
    if (zhImg && settings.footer.wechatImage !== zhImg) {
      const old = settings.footer.wechatImage;
      settings.footer.wechatImage = zhImg;
      db.prepare('UPDATE site_settings SET settings_json=? WHERE lang=?')
        .run(JSON.stringify(settings), lang);
      note(`i18n/${lang} footer.wechatImage: ${JSON.stringify(old)} -> ${JSON.stringify(zhImg)}`);
    } else same(`i18n/${lang} footer.wechatImage 一致`);
  }
}

db.close();

console.log(`\n完成：${changes.length} 处变更。`);
if (changes.length) {
  console.log('下一步: npm run sync:static  同步 data/ 快照；API 缓存 45s 内自动过期。');
}
