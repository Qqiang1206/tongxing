#!/usr/bin/env node
/**
 * 从 data/solutions/{lang}.json 重新生成 *-solution.html 静态落地页。
 *
 * 背景：这些落地页是主路径（已被搜索引擎收录、有服务端渲染的正文），
 * 但历史上是手工/脚本一次性生成的，之后后台改内容只更新了数据与 JSON，
 * HTML 里的硬编码正文再也没同步过 —— 爬虫看到的仍是旧文案，
 * 甚至泄漏了机器键（如 meta description 里出现 "TV/comm-display-flex-line"）。
 *
 * 策略：**原地替换已知区块**，其余字节原样保留。
 * 行尾符按区域探测（仓库里 CRLF/LF 混用）、缩进取自开始标签所在行，
 * 因此 diff 只体现真实内容变化，不会出现整块"看起来改了其实没改"的噪音。
 *
 * 用法：
 *   node scripts/generate-solution-landings.js            # 实际写入
 *   node scripts/generate-solution-landings.js --check    # 只体检不写入（有漂移则退出码 1）
 *   node scripts/generate-solution-landings.js --prune    # 连未发布/无数据的孤儿落地页一起删除
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LANGS = ['zh', 'en', 'ru'];
const SITE_ORIGIN = 'https://www.sztxgk.com';
const TITLE_SUFFIX = { zh: ' | 同兴高科', en: ' | TXAM', ru: ' | TXAM' };

/* 区块标题（与 site-common.js 的 FALLBACK_TEXT 一致，运行时还会再本地化一次） */
const SECTION_TITLE = {
  coreProcess: { zh: '核心工艺流程', en: 'Core Process Flow', ru: 'Основной технологический процесс' },
  detailTitle: { zh: '详细说明', en: 'Detailed Description', ru: 'Подробное описание' },
};

const args = process.argv.slice(2);
const CHECK_ONLY = args.includes('--check');
const PRUNE = args.includes('--prune');
const SKIP_EOL_FIX = args.includes('--no-fix-eol');

/* ------------------------------------------------------------------ utils */

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 属性值转义：正文里已有的实体（&nbsp; 等）保持原样 */
function escapeAttr(str) {
  return String(str == null ? '' : str)
    .replace(/&(?!(amp|lt|gt|quot|nbsp|#\d+|#x[0-9a-f]+);)/gi, '&amp;')
    .replace(/"/g, '&quot;');
}

function truncate(text, max) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  return s.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
}

/** 按区域内实际出现的行尾符决定新增内容用什么，避免 CRLF/LF 混用仓库产生噪音 diff */
function regionEol(text) {
  return /\r\n/.test(text) ? '\r\n' : '\n';
}

/** 取 idx 所在行的缩进（即开始标签前面的空白） */
function lineIndentBefore(html, idx) {
  const lineStart = html.lastIndexOf('\n', idx - 1) + 1;
  const m = /^[ \t]*/.exec(html.slice(lineStart, idx));
  return m ? m[0] : '';
}

function tagEnd(html, from) {
  const gt = html.indexOf('>', from);
  if (gt === -1) throw new Error('unbalanced tag');
  return gt;
}

/** 从 <div ...> 起始位置做括号配对，返回内层范围 */
function divRange(html, openIdx) {
  const openEnd = tagEnd(html, openIdx);
  let depth = 1;
  let i = openEnd + 1;
  const openRe = /<div\b/gi;
  const closeRe = /<\/div>/gi;
  while (depth > 0 && i < html.length) {
    openRe.lastIndex = i;
    closeRe.lastIndex = i;
    const o = openRe.exec(html);
    const c = closeRe.exec(html);
    if (c && (!o || c.index < o.index)) {
      depth -= 1;
      i = c.index + c.length;
    } else if (o) {
      depth += 1;
      i = o.index + o.length;
    } else {
      throw new Error('unbalanced div');
    }
  }
  return { innerStart: openEnd + 1, innerEnd: i - '</div>'.length };
}

/**
 * 替换某个 div 的内部 HTML。
 * buildInner(itemIndent) 返回用 '\n' 拼接的字符串，这里再按区域行尾符转换。
 */
/**
 * 替换某个 div 的内部 HTML。
 *
 * 逐行继承原区域的行尾符：仓库里同一区块内 CRLF/LF 混用，
 * 若整块统一成一种，diff 会冒出上百行"内容没变、只是行尾变了"的幻影改动，
 * 让真正的文案变更没法审阅。
 * 行数变多时用区域主行尾符兜底。
 */
function replaceDivInner(html, openIdx, buildInner) {
  const r = divRange(html, openIdx);
  const indent = lineIndentBefore(html, openIdx);
  const origInner = html.slice(r.innerStart, r.innerEnd);
  const eols = origInner.match(/\r?\n/g) || [];
  const dom = regionEol(origInner);

  const parts = [''].concat(buildInner(indent + '    ').split('\n'), [indent]);
  let out = '';
  for (let i = 0; i < parts.length - 1; i += 1) {
    out += parts[i] + (eols[i] || dom);
  }
  out += parts[parts.length - 1];

  return { html: html.slice(0, r.innerStart) + out + html.slice(r.innerEnd), ok: true };
}

function replaceDivById(html, id, buildInner) {
  const at = html.indexOf('id="' + id + '"');
  if (at === -1) return { html: html, ok: false };
  const openIdx = html.lastIndexOf('<div', at);
  if (openIdx === -1) return { html: html, ok: false };
  return replaceDivInner(html, openIdx, buildInner);
}

function replaceDivByClass(html, cls, buildInner) {
  const re = /<div\b[^>]*class="([^"]*)"/gi;
  let m;
  while ((m = re.exec(html))) {
    if (m[1].split(/\s+/).indexOf(cls) === -1) continue;
    return replaceDivInner(html, m.index, buildInner);
  }
  return { html: html, ok: false };
}

/* ------------------------------------------------------------- 区块构造器 */
/* 全部返回 '\n' 拼接的字符串，缩进由调用方传入 */

function specTagsHtml(specs, indent) {
  return (specs || [])
    .map(function (s) { return indent + '<span class="spec-tag">' + escapeHtml(s) + '</span>'; })
    .join('\n');
}

function painPointsHtml(points, indent) {
  return (points || [])
    .map(function (p) {
      return [
        indent + '<div class="apple-card p-8">',
        indent + '    <div class="w-12 h-12 bg-[#FF6B00]/10 radius-sm flex items-center justify-center mb-4">',
        indent + '        <svg class="w-6 h-6 text-[#FF6B00]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
        indent + '    </div>',
        indent + '    <h4 class="font-bold text-[#14161B] mb-2">' + escapeHtml(p.title) + '</h4>',
        indent + '    <p class="text-sm text-[#667084]">' + escapeHtml(p.desc) + '</p>',
        indent + '</div>',
      ].join('\n');
    })
    .join('\n');
}

function processCardsHtml(steps, indent) {
  return (steps || [])
    .map(function (p) {
      return [
        indent + '<div class="apple-card p-6 text-center">',
        indent + '    <div class="w-16 h-16 bg-[#FF6B00] rounded-full flex items-center justify-center mx-auto mb-4">',
        indent + '        <span class="text-white font-black text-xl mono-num">' +
          escapeHtml(String(p.step == null ? '' : p.step).padStart(2, '0')) + '</span>',
        indent + '    </div>',
        indent + '    <h4 class="font-bold text-[#14161B] mb-2">' + escapeHtml(p.title) + '</h4>',
        indent + '    <p class="text-sm text-[#667084]">' + escapeHtml(p.desc) + '</p>',
        indent + '</div>',
      ].join('\n');
    })
    .join('\n');
}

function relatedHtml(picks, prefix, indent) {
  return picks
    .map(function (item) {
      const href = prefix + item.slug + '-solution.html';
      const img = prefix + item.image;
      return [
        indent + '<a href="' + escapeAttr(href) + '" class="apple-card block p-6 group">',
        indent + '    <div class="w-full h-40 radius-sm overflow-hidden bg-gray-100 mb-4">',
        indent + '        <picture><source srcset="' + escapeAttr(img) + '" type="image/webp"><img loading="lazy" decoding="async" src="' + escapeAttr(img) + '" alt="' + escapeAttr(item.name) + '" class="img-zoom"></picture>',
        indent + '    </div>',
        indent + '    <h4 class="font-bold text-[#14161B] mb-2 group-hover:text-[#FF6B00] transition-colors">' + escapeHtml(item.name) + '</h4>',
        indent + '    <p class="text-sm text-[#667084] line-clamp-2">' + escapeHtml(truncate(item.summary, 90)) + '</p>',
        indent + '</a>',
      ].join('\n');
    })
    .join('\n');
}

/**
 * 定位工艺流程栅格。
 * en/ru 页面历史上就有这个区块，只是少了 id="solution-process-grid"，
 * 导致 solution-landing.js 找不到它、无法注水，也让我早先误判成"缺失"。
 * 优先返回没有 id 的那个（有 id 的是本脚本生成的）。
 */
function findProcessGridIdx(html) {
  const re = /<div\b[^>]*class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"[^>]*>/g;
  let m;
  let withId = -1;
  while ((m = re.exec(html))) {
    if (!/\bid=/.test(m[0])) return m.index;
    if (withId === -1) withId = m.index;
  }
  return withId;
}

/**
 * 在「相关解决方案」section 之前插入缺失的 section。
 * 调用方必须先确认区块真的不存在 —— 否则会插出重复区块。
 */
function ensureSection(html, kind, title, buildInner) {
  const anchor = /[ \t]*<section class="fade-up">[\s\S]*?specs-grid/.exec(html);
  if (!anchor) return { html: html, ok: false };

  const eol = regionEol(anchor[0]);
  const indent = lineIndentBefore(html, anchor.index) || '            ';
  const inner = buildInner(indent + '    ').split('\n').join(eol);
  const block =
    indent + '<section class="detail-section fade-up mb-16"' +
    (kind === 'process' ? ' id="solution-process"' : '') + '>' + eol +
    indent + '    <h2 class="detail-section__title">' + escapeHtml(title) + '</h2>' + eol +
    inner + eol +
    indent + '</section>' + eol;

  return { html: html.slice(0, anchor.index) + block + html.slice(anchor.index), ok: true };
}

/* ------------------------------------------------------------------- main */

function loadData(lang) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'solutions', lang + '.json'), 'utf8'));
}

function assetPrefix(lang) { return lang === 'zh' ? '' : '../'; }
function pagePath(lang, slug) {
  return lang === 'zh' ? slug + '-solution.html' : lang + '/' + slug + '-solution.html';
}

/** 用新行重建一段文本，逐行继承原文的行尾符 */
function rebuildLines(orig, lines) {
  const eols = orig.match(/\r?\n/g) || [];
  const dom = regionEol(orig);
  let out = '';
  for (let i = 0; i < lines.length - 1; i += 1) out += lines[i] + (eols[i] || dom);
  return out + lines[lines.length - 1];
}

/**
 * 历史遗留缺陷：这些落地页几乎每行都是 \r\r\n（被做过一次 \n→\r\n 的二次转换）。
 * 多出来的 CR 浏览器会忽略，但会让 diff 永远无法审阅 —— 任何改动都会连带整块行尾。
 *
 * 统一收敛成 LF：与 .gitattributes 的 `* text=auto eol=lf` 保持一致。
 * 曾经这里收敛成 CRLF，结果在按 LF 检出的环境里反而制造出整文件 diff，方向搞反了。
 */
function normalizeEol(text) {
  return text.replace(/\r\r\n/g, '\n').replace(/\r\n/g, '\n');
}

function buildPage(lang, item, all, src) {
  const prefix = assetPrefix(lang);
  const suffix = TITLE_SUFFIX[lang] || ' | TXAM';
  const title = item.name + suffix;
  const desc = truncate(item.name + ' - ' + (item.summary || ''), 160);
  const ogImage = SITE_ORIGIN + '/' + String(item.image || '').replace(/^\.?\//, '');
  const steps = [];

  let html = src;

  /* ---- head: SEO ---- */
  html = html.replace(/<title>[\s\S]*?<\/title>/, '<title>' + escapeHtml(title) + '</title>');
  html = html.replace(/(<meta name="description" content=")[^"]*(")/, '$1' + escapeAttr(desc) + '$2');
  html = html.replace(/(<meta property="og:title" content=")[^"]*(")/, '$1' + escapeAttr(title) + '$2');
  html = html.replace(/(<meta property="og:description" content=")[^"]*(")/, '$1' + escapeAttr(desc) + '$2');
  if (/<meta property="og:image"/.test(html) && item.image) {
    html = html.replace(/(<meta property="og:image" content=")[^"]*(")/, '$1' + escapeAttr(ogImage) + '$2');
  }

  const zhUrl = SITE_ORIGIN + '/' + pagePath('zh', item.slug);
  const enUrl = SITE_ORIGIN + '/' + pagePath('en', item.slug);
  const ruUrl = SITE_ORIGIN + '/' + pagePath('ru', item.slug);
  html = html.replace(
    /<link rel="canonical"[^>]*>/,
    '<link rel="canonical" href="' + SITE_ORIGIN + '/' + pagePath(lang, item.slug) + '">'
  );
  html = html.replace(/<link rel="alternate" hreflang="zh-CN"[^>]*>/, '<link rel="alternate" hreflang="zh-CN" href="' + zhUrl + '">');
  html = html.replace(/<link rel="alternate" hreflang="en-US"[^>]*>/, '<link rel="alternate" hreflang="en-US" href="' + enUrl + '">');
  html = html.replace(/<link rel="alternate" hreflang="ru-RU"[^>]*>/, '<link rel="alternate" hreflang="ru-RU" href="' + ruUrl + '">');
  html = html.replace(/<link rel="alternate" hreflang="x-default"[^>]*>/, '<link rel="alternate" hreflang="x-default" href="' + zhUrl + '">');

  /* ---- 标题 / 摘要 ---- */
  const h1Re = /<h1 class="detail-title[^"]*">[\s\S]*?<\/h1>/;
  html = html.replace(h1Re, function (m) {
    const open = m.slice(0, m.indexOf('>') + 1);
    return rebuildLines(m, [open, '                ' + escapeHtml(item.name), '            </h1>']);
  });
  html = html.replace(/(<p class="detail-lead">)[\s\S]*?(<\/p>)/, '$1' + escapeHtml(item.summary || '') + '$2');

  /* ---- hero 图 ---- */
  const heroAt = html.indexOf('detail-hero-grid');
  if (heroAt !== -1) {
    const picAt = html.indexOf('<picture>', heroAt);
    const picEnd = html.indexOf('</picture>', picAt);
    if (picAt !== -1 && picEnd !== -1) {
      const img = prefix + item.image;
      html =
        html.slice(0, picAt) +
        '<picture><source srcset="' + img + '" type="image/webp"><img decoding="async" fetchpriority="high" alt="' +
        escapeAttr(item.name) + '" class="img-zoom" src="' + img + '"></picture>' +
        html.slice(picEnd + '</picture>'.length);
      steps.push('hero-image');
    }
  }

  /* ---- 核心参数 ---- */
  let r = replaceDivByClass(html, 'detail-specs', function (i) { return specTagsHtml(item.specs, i); });
  if (r.ok) { html = r.html; steps.push('specs'); }

  /* ---- 侧栏「方案特点」正文 ---- */
  const sideAt = html.indexOf('detail-sidebar__label mb-4');
  if (sideAt !== -1) {
    const pRe = /<p class="text-\[#667084\] leading-\[1\.8\]">[\s\S]*?<\/p>/;
    const pm = pRe.exec(html.slice(sideAt));
    if (pm) {
      const absStart = sideAt + pm.index;
      const ind = lineIndentBefore(html, absStart);
      html =
        html.slice(0, absStart) +
        rebuildLines(pm[0], [
          '<p class="text-[#667084] leading-[1.8]">',
          ind + '    ' + escapeHtml(item.summary || ''),
          ind + '</p>',
        ]) +
        html.slice(absStart + pm[0].length);
      steps.push('sidebar');
    }
  }

  /* ---- 行业痛点 ---- */
  r = replaceDivById(html, 'solution-pain-points-grid', function (i) { return painPointsHtml(item.painPoints, i); });
  if (!r.ok) r = replaceDivById(html, 'pain-points', function (i) { return painPointsHtml(item.painPoints, i); });
  if (r.ok) { html = r.html; steps.push('painPoints'); }

  /* ---- 核心工艺流程：优先补齐已有栅格的 id 再换内容，真没有才补插 section ---- */
  if ((item.process || []).length) {
    const pgIdx = findProcessGridIdx(html);
    if (pgIdx !== -1) {
      const openEnd = tagEnd(html, pgIdx);
      if (!/\bid=/.test(html.slice(pgIdx, openEnd + 1))) {
        html = html.slice(0, openEnd) + ' id="solution-process-grid"' + html.slice(openEnd);
        steps.push('process-id');
      }
      const rp = replaceDivInner(html, pgIdx, function (i) { return processCardsHtml(item.process, i); });
      html = rp.html;
      steps.push('process');
    } else {
      const ins = ensureSection(html, 'process', SECTION_TITLE.coreProcess[lang], function (i) {
        return (
          i + '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" id="solution-process-grid">\n' +
          processCardsHtml(item.process, i + '    ') + '\n' +
          i + '</div>'
        );
      });
      if (ins.ok) { html = ins.html; steps.push('process+'); }
    }
  }

  /* ---- 详细说明 ---- */
  if (String(item.contentHtml || '').trim()) {
    if (!/class="detail-prose"/.test(html)) {
      const ins = ensureSection(html, 'prose', SECTION_TITLE.detailTitle[lang], function (i) {
        return i + '<div class="detail-prose">\n' + i + '    ' + String(item.contentHtml).trim() + '\n' + i + '</div>';
      });
      if (ins.ok) { html = ins.html; steps.push('prose+'); }
    } else {
      r = replaceDivByClass(html, 'detail-prose', function (i) { return i + String(item.contentHtml || '').trim(); });
      if (r.ok) { html = r.html; steps.push('prose'); }
    }
  }

  /* ---- 相关方案：取同语言紧接着的 3 个（确定性，便于 diff） ---- */
  const idx = all.findIndex(function (x) { return x.slug === item.slug; });
  const order = all.filter(function (x) { return x.slug !== item.slug; });
  const picks = [0, 1, 2].map(function (k) { return order[(idx + k) % order.length]; });
  r = replaceDivByClass(html, 'specs-grid', function (i) { return relatedHtml(picks, prefix, i); });
  if (r.ok) { html = r.html; steps.push('related'); }

  return { html: html, steps: steps };
}

function main() {
  let drift = 0;
  const report = [];
  const publishedByLang = {};

  /* 磁盘上现有落地页清单：孤儿检测 + 从模板克隆新页 */
  const diskPages = {};
  for (const lg of LANGS) {
    const dir = lg === 'zh' ? ROOT : path.join(ROOT, lg);
    diskPages[lg] = fs
      .readdirSync(dir)
      .filter(function (f) { return /-solution\.html$/.test(f); })
      .map(function (f) { return pagePath(lg, f.replace(/-solution\.html$/, '')); });
  }

  for (const lang of LANGS) {
    const data = loadData(lang);
    const items = Object.keys(data)
      .map(function (k) { return data[k]; })
      .filter(function (it) { return it && it.published !== false && it.slug; })
      .sort(function (a, b) { return (a.sortOrder || 0) - (b.sortOrder || 0); });
    publishedByLang[lang] = items;

    for (const item of items) {
      const rel = pagePath(lang, item.slug);
      const abs = path.join(ROOT, rel);
      if (!fs.existsSync(abs)) {
        // 后台新增并发布的方案还没有落地页 → 以同语言任一落地页为模板克隆一份。
        // buildPage 会替换掉全部内容区块，所以骨架/导航/页脚可直接复用。
        const tpl = (diskPages[lang] || [])[0];
        if (!tpl) {
          report.push(['MISSING', rel, '数据里有方案，但磁盘上没有任何同语言落地页可作为模板']);
          drift += 1;
          continue;
        }
        const built = buildPage(lang, item, items, fs.readFileSync(path.join(ROOT, tpl), 'utf8'));
        report.push(['CREATE', rel, '从模板 ' + tpl + ' 克隆：' + built.steps.join(', ')]);
        drift += 1;
        if (!CHECK_ONLY) fs.writeFileSync(abs, built.html, 'utf8');
        continue;
      }
      const steps = { eol: false };
      const rawSrc = fs.readFileSync(abs, 'utf8');
      let src = rawSrc;
      // check 模式也要归一化，否则与 write 模式结论不一致（同一页两种模式给出不同漂移判断）
      if (!SKIP_EOL_FIX) {
        const normalized = normalizeEol(rawSrc);
        if (normalized !== rawSrc) {
          src = normalized;
          steps.eol = true;
        }
      }
      const out = buildPage(lang, item, items, src);
      if (out.html !== src || steps.eol) {
        report.push(['UPDATE', rel, (steps.eol ? 'eol, ' : '') + out.steps.join(', ')]);
        drift += 1;
        if (!CHECK_ONLY) fs.writeFileSync(abs, out.html, 'utf8');
      } else {
        report.push(['ok    ', rel, '']);
      }
    }
  }

  /* 孤儿检测：磁盘上有落地页，但数据里已没有对应已发布方案 */
  for (const lang of LANGS) {
    const dir = lang === 'zh' ? ROOT : path.join(ROOT, lang);
    const files = fs.readdirSync(dir).filter(function (f) { return /-solution\.html$/.test(f); });
    const live = {};
    publishedByLang[lang].forEach(function (it) { live[it.slug] = true; });
    files.forEach(function (f) {
      const slug = f.replace(/-solution\.html$/, '');
      if (live[slug]) return;
      const rel = pagePath(lang, slug);
      report.push(['ORPHAN', rel, '磁盘上有落地页，但方案未发布或已被删除']);
      drift += 1;
      if (PRUNE && !CHECK_ONLY) {
        fs.unlinkSync(path.join(ROOT, rel));
        report.push(['PRUNED', rel, '已删除']);
      }
    });
  }

  /* 校验前台与后台的落地页清单都与数据一致（三处硬编码清单，必须同步） */
  const expected = publishedByLang.zh.map(function (it) { return it.slug; });
  const LIST_SOURCES = [
    ['assets/js/site-common.js', /var SOLUTION_LANDING_SLUGS = \[([\s\S]*?)\];/],
    ['server/admin/admin.js', /var staticSlugs = \[([^\]]*)\]/],
  ];
  for (const [relFile, re] of LIST_SOURCES) {
    const src = fs.readFileSync(path.join(ROOT, relFile), 'utf8');
    const block = re.exec(src);
    const declared = block
      ? block[1].split(',').map(function (s) { return s.trim().replace(/^['"]|['"]$/g, ''); }).filter(Boolean)
      : [];
    const missingInJs = expected.filter(function (s) { return declared.indexOf(s) === -1; });
    const staleInJs = declared.filter(function (s) { return expected.indexOf(s) === -1; });
    if (missingInJs.length || staleInJs.length) {
      report.push([
        'DESYNC',
        relFile,
        '缺少 ' + JSON.stringify(missingInJs) + '，多余 ' + JSON.stringify(staleInJs),
      ]);
      drift += 1;
    }
  }

  console.log('模式: ' + (CHECK_ONLY ? 'CHECK（不写入）' : 'WRITE') + (PRUNE ? ' + PRUNE' : ''));
  console.log('');
  report.forEach(function (r) { console.log('  [' + r[0] + '] ' + r[1] + (r[2] ? '  — ' + r[2] : '')); });
  console.log('');
  console.log(drift === 0 ? '✅ 全部落地页与数据一致' : '⚠️  ' + drift + ' 处需要处理');
  if (CHECK_ONLY) process.exit(drift === 0 ? 0 : 1);
}

main();
