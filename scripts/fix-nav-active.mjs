#!/usr/bin/env node
/**
 * 修复导航高亮（active）错位。
 *
 * 背景：导航是每个 HTML 静态写死的 —— 桌面 `class="txnav__link is-active"`，
 * 移动端全屏菜单（`.txnav-sheet__link`）用 inline `style="color:#FF6B00"` 标记当前项。
 * 详情页 / 方案落地页批量生成时一律照抄成「首页」，于是
 * news-detail 打开后导航高亮的是「首页」而不是「新闻中心」。
 *
 * 用法：
 *   node scripts/fix-nav-active.mjs           # 修复
 *   node scripts/fix-nav-active.mjs --check   # 只体检（有问题 exit 1）
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CHECK = process.argv.includes('--check');
const SKIP_DIRS = new Set([
  '.git', 'node_modules', 'assets', 'output', 'server', 'videos',
  '.workbuddy', 'scripts', 'data', 'admin', 'logs', 'tmp',
]);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

/** 页面 → 应高亮的导航项 href（null = 不参与，如 404） */
function expectedHref(file) {
  const b = path.basename(file);
  if (b === '404.html') return null;
  if (b === 'index.html') return 'index.html';
  if (b === 'about.html') return 'about.html';
  if (b === 'solutions.html') return 'solutions.html';
  if (b === 'products.html') return 'products.html';
  if (b === 'news.html') return 'news.html';
  if (b === 'contact.html') return 'contact.html';
  if (b === 'solutions-detail.html') return 'solutions.html';
  if (b === 'product-detail.html') return 'products.html';
  if (b === 'news-detail.html') return 'news.html';
  if (/-solution\.html$/.test(b)) return 'solutions.html';
  return null;
}

function currentActive(html) {
  const box = /<div class="txnav__links">([\s\S]*?)<\/div>/.exec(html);
  if (!box) return [];
  return [...box[1].matchAll(/<a href="([^"]+)" class="txnav__link( is-active)?"/g)]
    .filter((m) => m[2])
    .map((m) => m[1]);
}

function fix(html, exp) {
  // 桌面：is-active 类
  let out = html.replace(
    /<a href="([^"]+)" class="txnav__link(?: is-active)?"/g,
    (m, href) => `<a href="${href}" class="txnav__link${href === exp ? ' is-active' : ''}"`
  );
  // 移动端：inline 橙色
  out = out.replace(
    /<a href="([^"]+)" class="txnav-sheet__link"(?: style="color:#FF6B00")?>/g,
    (m, href) => `<a href="${href}" class="txnav-sheet__link"${href === exp ? ' style="color:#FF6B00"' : ''}>`
  );
  return out;
}

const files = walk(ROOT).sort();
const problems = [];
let changed = 0;

for (const f of files) {
  const exp = expectedHref(f);
  if (exp === null) continue;
  const rel = path.relative(ROOT, f);
  const html = fs.readFileSync(f, 'utf8');
  const now = currentActive(html);
  if (now.length === 1 && now[0] === exp) continue;
  problems.push({ rel, now: now.join(',') || '(无)', exp });
  if (!CHECK) {
    const fixed = fix(html, exp);
    if (fixed !== html) {
      fs.writeFileSync(f, fixed, 'utf8');
      changed++;
    }
  }
}

if (problems.length === 0) {
  console.log('OK  全部页面的导航高亮都正确');
} else {
  console.log(
    `${CHECK ? '发现' : '已修复'} ${problems.length} 个页面导航高亮错位` +
    `${CHECK ? '' : `（写入 ${changed} 个文件）`}：`
  );
  for (const p of problems) {
    console.log(`  ${p.rel.padEnd(40)} 当前=${p.now.padEnd(16)} 应为=${p.exp}`);
  }
}
process.exit(CHECK && problems.length ? 1 : 0);
