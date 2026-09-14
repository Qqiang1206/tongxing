/**
 * 静态资源缓存破坏版本号统一工具。
 *
 * 背景：IIS 的 web.config 给 css/js 设了 365 天强缓存，改了文件不改 URL
 * 等于没改 —— 老访客永远拿不到新版本（本项目页脚/CTA 改版就踩过）。
 *
 * 用法：
 *   node scripts/bump-asset-version.mjs <版本号> <资源名...>            应用
 *   node scripts/bump-asset-version.mjs <版本号> <资源名...> --check    只体检不改
 * 例：
 *   node scripts/bump-asset-version.mjs 20260915 site-footer.js data-loader.js
 *
 * 行为：
 *   - 扫描站点页（根目录 / en / ru 下的 .html，跳过 output、server）；
 *   - 把 `assets/.../<资源名>?v=旧值` 统一改成新值；
 *   - 没有 ?v= 的引用也补上（缓存键跟着变，才会重新下载）。
 * 版本号建议用 YYYYMMDD，便于人眼比对新旧。
 */
import fs from 'node:fs';
import path from 'node:path';

const [, , version, ...rest] = process.argv;
const check = rest.includes('--check');
const assets = rest.filter((a) => !a.startsWith('--'));

if (!version || !/^\d{6,}$/.test(version) || !assets.length) {
  console.error('usage: node scripts/bump-asset-version.mjs <version> <asset...> [--check]');
  process.exit(1);
}

const SKIP_DIRS = new Set(['.git', 'node_modules', 'assets', 'output', 'server', 'videos', '.workbuddy']);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

const pages = walk('.');
let touchedFiles = 0;
let touchedRefs = 0;
const stale = [];

for (const file of pages) {
  const src = fs.readFileSync(file, 'utf8');
  let next = src;

  for (const asset of assets) {
    const escaped = asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // 1) 已有 ?v=xxx → 换版本号
    const withVer = new RegExp(`(${escaped})\\?v=\\d+`, 'g');
    // 2) 裸引用（后跟引号）→ 补版本号
    const bare = new RegExp(`(${escaped})(")`, 'g');

    const found = (src.match(withVer) || []).length;
    if (found && !src.includes(`${asset}?v=${version}`)) {
      stale.push(`${file} → ${asset} (旧版本)`);
    }
    if (!found && bare.test(src)) {
      stale.push(`${file} → ${asset} (无版本号)`);
    }
    bare.lastIndex = 0;

    next = next.replace(withVer, `$1?v=${version}`).replace(bare, `$1?v=${version}$2`);
  }

  if (next !== src) {
    if (!check) fs.writeFileSync(file, next, 'utf8');
    touchedFiles++;
    touchedRefs += assets.reduce((n, a) => n + (src.match(new RegExp(a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 0);
  }
}

if (check) {
  if (!stale.length) {
    console.log(`OK  全部站点页的缓存版本号已是 ${version}（资源：${assets.join(', ')}）`);
  } else {
    console.log(`发现 ${stale.length} 处需要升版本：`);
    for (const s of stale.slice(0, 20)) console.log('  ' + s);
    if (stale.length > 20) console.log(`  ...另有 ${stale.length - 20} 处`);
    process.exitCode = 1;
  }
} else {
  console.log(`已更新 ${touchedFiles} 个页面 / ${touchedRefs} 处引用 → v=${version}（${assets.join(', ')}）`);
}
