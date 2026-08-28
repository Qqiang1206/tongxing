#!/usr/bin/env node
/**
 * v3 全站铺开批量改造脚本。
 *
 * 对每个目标页面：
 *   1. <html> 打 data-ui="v3"（不存在时）
 *   2. 硬编码 <nav id="navbar">…</nav> → <div data-header-placeholder></div>
 *   3. 硬编码 <div id="mobile-menu">…（平衡扫描到配对 </div>）→ 删除
 *   4. 注入 <script src="[../]assets/js/header.js?v=..." defer></script>
 *
 * 用法：
 *   node scripts/rollout-v3.mjs --dry <files...>     预览将要发生的变化
 *   node scripts/rollout-v3.mjs --apply <files...>   写入
 *   node scripts/rollout-v3.mjs --verify <files...>  巡检断言（铺开后）
 */
import { readFileSync, writeFileSync } from 'node:fs';

const VERSION = '20260827v3';
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
  const prefix = isSubDir(file) ? '../' : '';
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

  // 2. 硬编码 navbar 块 → placeholder
  const navStart = out.indexOf('<nav id="navbar"');
  if (navStart !== -1) {
    const navEnd = out.indexOf('</nav>', navStart);
    if (navEnd === -1) throw new Error(`${file}: navbar 未闭合`);
    out = out.slice(0, navStart) + '<div data-header-placeholder></div>' + out.slice(navEnd + '</nav>'.length);
    changes.push('navbar→placeholder');
  }

  // 3. 硬编码 mobile-menu 块 → 删除
  const mmStart = out.indexOf('<div id="mobile-menu"');
  if (mmStart !== -1) {
    const mmEnd = findDivEnd(out, mmStart);
    if (mmEnd === -1) throw new Error(`${file}: mobile-menu 未闭合`);
    out = out.slice(0, mmStart) + out.slice(mmEnd);
    changes.push('mobile-menu removed');
  }

  // 4. header.js 引用（不存在时，插到 </body> 前的第一个 script 前）
  if (!/header\.js/.test(out)) {
    const tag = `<script src="${prefix}assets/js/header.js?v=${VERSION}" defer></script>\n`;
    const firstScript = out.indexOf('<script');
    if (firstScript !== -1) {
      out = out.slice(0, firstScript) + tag + out.slice(firstScript);
    } else {
      out = out.replace('</body>', tag + '</body>');
    }
    changes.push('header.js injected');
  }

  return { out, changes };
}

if (mode === '--verify') {
  let bad = 0;
  for (const f of files) {
    const html = readFileSync(f, 'utf8');
    const problems = [];
    if (!/\<html[^>]*\bdata-ui="v3"/.test(html)) problems.push('missing data-ui');
    if (/<nav id="navbar"/.test(html)) problems.push('hardcoded navbar remains');
    if (/<div id="mobile-menu"/.test(html)) problems.push('hardcoded mobile-menu remains');
    const ph = (html.match(/data-header-placeholder/g) || []).length;
    if (ph !== 1) problems.push(`placeholder x${ph}`);
    if (!/header\.js/.test(html)) problems.push('header.js missing');
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
