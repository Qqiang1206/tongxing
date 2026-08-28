#!/usr/bin/env node
/**
 * v3 全站铺开批量改造脚本。
 *
 * 对每个目标页面：
 *   1. <html> 打 data-ui="v3"（不存在时）
 *   2. 移除 scroll-smooth（返回长页面时平滑滚动回放造成闪屏）
 *   3. 硬编码旧导航 / data-header-placeholder → 内联 v3 导航（静态首帧直出，无 JS 弹入）
 *   4. 移除 header.js 引用（导航已静态化，滚动玻璃态由 site-chrome.js 接管）
 *
 * 用法：
 *   node scripts/rollout-v3.mjs --dry <files...>     预览将要发生的变化
 *   node scripts/rollout-v3.mjs --apply <files...>   写入
 *   node scripts/rollout-v3.mjs --verify <files...>  巡检断言（铺开后）
 */
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const mode = args[0];
const files = args.slice(1).filter((f) => f.endsWith('.html'));

if (!['--dry', '--apply', '--verify'].includes(mode) || files.length === 0) {
  console.error('usage: node scripts/rollout-v3.mjs --dry|--apply|--verify <html files...>');
  process.exit(2);
}

function isSubDir(file) {
  return /^(en|ru)[/\\]/.test(file.replace(/\\/g, '/'));
}

const ACTIVE_MAP = {
  'index.html': 'home', 'about.html': 'about', 'solutions.html': 'solutions',
  'products.html': 'products', 'news.html': 'news', 'contact.html': 'contact',
};

const NAV_ITEMS = [
  ['index.html', 'home', '首页'], ['about.html', 'about', '关于我们'],
  ['solutions.html', 'solutions', '解决方案'], ['products.html', 'products', '产品中心'],
  ['news.html', 'news', '新闻中心'], ['contact.html', 'contact', '联系我们'],
];
const CTA_LABEL = { zh: '获取方案', en: 'Get a Quote', ru: 'Получить решение' };

/** 生成与 header.js v3 模板一致的静态导航（首帧直出，无弹入） */
function buildNav(file) {
  const norm = file.replace(/\\/g, '/');
  const subLang = /\/en\//i.test(norm) ? 'en' : /\/ru\//i.test(norm) ? 'ru' : 'zh';
  const prefix = isSubDir(file) ? '../' : '';
  const page = norm.split('/').pop();
  const activeKey = ACTIVE_MAP[page] || 'home';
  const LANG_HREFS = {
    zh: { zh: 'index.html', en: 'en/index.html', ru: 'ru/index.html' },
    en: { zh: '../index.html', en: 'index.html', ru: '../ru/index.html' },
    ru: { zh: '../index.html', en: '../en/index.html', ru: 'index.html' },
  }[subLang];

  const link = (href, key, label, i) =>
    `<a href="${href}" class="txnav__link${activeKey === key ? ' is-active' : ''}">${label}</a>`;
  const sheetLink = (href, key, label, i) =>
    `<a href="${href}" class="txnav-sheet__link${activeKey === key ? '" style="color:#FF6B00' : ''}">${label}<span>0${i}</span></a>`;
  const langA = (code) => {
    const active = subLang === code;
    const cls = code === subLang ? (code === 'zh' ? 'text-[#FF6B00]' : 'text-[#FF6B00]') : 'text-[#667084] hover:text-[#14161B] transition-colors';
    return `<a href="${LANG_HREFS[code]}" class="${active ? `px-2 py-1 ${cls} ${code === subLang ? 'is-active' : ''}` : `px-2 py-1 ${cls}`}">${code.toUpperCase()}</a>`;
  };

  return `<nav id="navbar" class="txnav">
            <div class="v3-shell txnav__inner">
                <a href="${LANG_HREFS[subLang]}" class="txnav__brand" aria-label="TXAM 同兴高科 首页">
                    <picture><source srcset="${prefix}assets/images/brand/logo.webp" type="image/webp"><img src="${prefix}assets/images/brand/logo.png" alt="TXAM 同兴高科 官网logo" class="txnav__logo"></picture>
                </a>

                <div class="txnav__links">
                    ${NAV_ITEMS.map(([href, key, label], i) => link(href, key, label, i + 1)).join('\n                    ')}
                </div>

                <div class="txnav__cta">
                    <div class="hidden lg:flex items-center gap-1 text-xs font-bold tracking-wide">
                        ${langA('zh')}
                        <span class="text-[#E7EAF0]">|</span>
                        ${langA('en')}
                        <span class="text-[#E7EAF0]">|</span>
                        ${langA('ru')}
                    </div>
                    <a href="contact.html" class="v3-btn v3-btn--primary txnav__cta-btn">
                        ${CTA_LABEL[subLang]}
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 8h11M9 3.5 13.5 8 9 12.5"/></svg>
                    </a>
                    <button id="mobile-menu-btn" class="txnav__burger" type="button" aria-label="打开菜单">
                        <i></i><i></i><i></i>
                    </button>
                </div>
            </div>
        </nav>

        <!-- 📱 移动端全屏菜单（白色玻璃） -->
        <div id="mobile-menu" class="txnav-sheet menu-closed" role="dialog" aria-label="站内导航">
            <nav class="flex flex-col w-full max-w-md mx-auto">
                ${NAV_ITEMS.map(([href, key, label], i) => sheetLink(href, key, label, i + 1)).join('\n                ')}
            </nav>
            <div class="txnav-sheet__langs">
                <a href="${LANG_HREFS.zh}" class="${subLang === 'zh' ? 'is-active' : ''}">ZH</a>
                <a href="${LANG_HREFS.en}" class="${subLang === 'en' ? 'is-active' : ''}">EN</a>
                <a href="${LANG_HREFS.ru}" class="${subLang === 'ru' ? 'is-active' : ''}">RU</a>
            </div>
        </div>`;
}

/** 找到自 start 起的平衡 </div> 结束位置（处理嵌套） */
function findDivEnd(html, start) {
  const re = /<\/?div\b[^>]*>/gi;
  re.lastIndex = start;
  let depth = 0;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (/^<\/div/i.test(m[0])) {
      depth -= 1;
      if (depth === 0) return m.index + m[0].length;
    } else if (!/\/>$/.test(m[0])) {
      depth += 1;
    }
  }
  return -1;
}

function transform(html, file) {
  const changes = [];
  let out = html;

  // 0. 移除 scroll-smooth：返回长页面时平滑滚动回放会造成"闪一下"
  if (/\bscroll-smooth\b/.test(out)) {
    out = out.replace(/<html([^>]*)>/, (m0, attrs) => `<html${attrs.replace(/\s*scroll-smooth/g, '')}>`);
    changes.push('scroll-smooth removed');
  }

  // 1. data-ui 标记
  if (!/\<html[^>]*\bdata-ui="v3"/.test(out)) {
    out = out.replace(/<html(\s[^>]*)?>/, (m0, attrs) => `<html${attrs || ''} data-ui="v3">`);
    changes.push('html[data-ui=v3]');
  }

  // 2. 旧硬编码 navbar 块 / placeholder → 内联 v3 导航（静态首帧直出）
  const navHTML = buildNav(file);
  const legacyNavStart = out.indexOf('<nav id="navbar"');
  const placeholderIdx = out.indexOf('<div data-header-placeholder></div>');
  if (legacyNavStart !== -1) {
    const navEnd = out.indexOf('</nav>', legacyNavStart);
    if (navEnd === -1) throw new Error(`${file}: navbar 未闭合`);
    out = out.slice(0, legacyNavStart) + navHTML + out.slice(navEnd + '</nav>'.length);
    changes.push('legacy navbar → v3 nav');
    // 连带的旧 mobile-menu 块删除
    const mmStart = out.indexOf('<div id="mobile-menu"', navEnd);
    if (mmStart !== -1 && /menu-closed|bg-\[#FBFBFD\]|flex flex-col items-center/.test(out.slice(mmStart, mmStart + 400))) {
      const mmEnd = findDivEnd(out, mmStart);
      if (mmEnd !== -1) {
        out = out.slice(0, mmStart) + out.slice(mmEnd);
        changes.push('legacy mobile-menu removed');
      }
    }
  } else if (placeholderIdx !== -1) {
    out = out.replace('<div data-header-placeholder></div>', navHTML);
    changes.push('placeholder → v3 nav');
  } else if (!out.includes('class="txnav"')) {
    throw new Error(`${file}: 找不到导航插入点（既无旧 navbar 也无 placeholder）`);
  }

  // 3. 移除 header.js 引用（导航已静态化；滚动玻璃态由 site-chrome.js 处理）
  const reHeader = /\s*<script src="[^"]*header\.js[^"]*"[^>]*><\/script>/g;
  if (reHeader.test(out)) {
    out = out.replace(reHeader, '');
    changes.push('header.js include removed');
  }

  // 3.5 页面渲染器从 DOMContentLoaded 改为同步执行：
  //     首绘后再填充内容会造成"骨架→内容"的布局跳动
  const reDcl = /document\.addEventListener\((["'])DOMContentLoaded\1,\s*function\s*\(\)\s*\{\s*(TXAM\.init[A-Za-z]+\([^)]*\);?)\s*\}\s*\);?/g;
  if (reDcl.test(out)) {
    out = out.replace(reDcl, '$2');
    changes.push('renderer init synced');
  }

  // 3.6 引入跨页 View Transitions 样式（styles.css 链接之后）
  if (!/tx-view-transitions\.css/.test(out)) {
    const vtTag = `\n    <link rel="stylesheet" href="${prefix}assets/css/tx-view-transitions.css?v=${VERSION}">`;
    const reStyles = /(<link rel="stylesheet" href="[^"]*styles\.css[^"]*">)/;
    if (reStyles.test(out)) {
      out = out.replace(reStyles, `$1${vtTag}`);
      changes.push('view-transitions css linked');
    }
  }

  return { out, changes };
}

if (mode === '--verify') {
  let bad = 0;
  for (const f of files) {
    const html = readFileSync(f, 'utf8');
    const problems = [];
    if (!/\<html[^>]*\bdata-ui="v3"/.test(html)) problems.push('missing data-ui');
    if (/\bscroll-smooth\b/.test(html)) problems.push('scroll-smooth remains');
    if (!/class="txnav"/.test(html)) problems.push('v3 nav missing');
    if (/data-header-placeholder/.test(html)) problems.push('placeholder remains');
    if (/<script[^>]*header\.js/.test(html)) problems.push('header.js include remains');
    const mm = (html.match(/id="mobile-menu"/g) || []).length;
    if (mm !== 1) problems.push(`mobile-menu x${mm}`);
    const nav = (html.match(/id="navbar"/g) || []).length;
    if (nav !== 1) problems.push(`navbar x${nav}`);
    if (problems.length) {
      bad += 1;
      console.log(`FAIL ${f}: ${problems.join('; ')}`);
    }
  }
  console.log(bad === 0 ? `VERIFY OK — ${files.length} pages clean` : `VERIFY — ${bad}/${files.length} pages have problems`);
  process.exitCode = bad === 0 ? 0 : 1;
} else {
  for (const f of files) {
    const html = readFileSync(f, 'utf8');
    try {
      const { out, changes } = transform(html, f);
      if (changes.length === 0) {
        console.log(`skip  ${f} (already v3)`);
        continue;
      }
      if (mode === '--apply') {
        writeFileSync(f, out, 'utf8');
        console.log(`apply ${f}: ${changes.join(', ')}`);
      } else {
        console.log(`dry   ${f}: ${changes.join(', ')}`);
      }
    } catch (e) {
      console.error(`ERROR ${f}: ${e.message}`);
      process.exitCode = 1;
    }
  }
}
