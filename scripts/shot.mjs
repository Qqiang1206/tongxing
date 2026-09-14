/**
 * 本地渲染取证工具（零依赖）：用本机 Chrome headless 抓 dump-dom 或整页长图。
 * 用途：验证 JS 注入的区块是否真的被揭示（.fade-up 停在 opacity:0 这类问题
 *       纯静态看代码看不出来，必须看渲染结果）。
 * 用法：
 *   node scripts/shot.mjs dom <url>             → 打印渲染后的 DOM 片段
 *   node scripts/shot.mjs img <url> <name> [w] [h]
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => fs.existsSync(p));
if (!CHROME) {
  console.error('no chrome/edge found');
  process.exit(1);
}

const COMMON = ['--headless=new', '--disable-gpu', '--no-first-run', '--virtual-time-budget=10000'];

const [, , mode, url, name, w = '1440', h = '6400'] = process.argv;
if (!mode || !url) {
  console.error('usage: node scripts/shot.mjs dom <url> [w] [h] | img <url> <name> [w] [h]');
  process.exit(1);
}

if (mode === 'dom') {
  // 注意：dump-dom 默认视口只有 800x600，不传 --window-size 量到的是移动端栅格。
  // 用法：dom <url> [宽] [高]，宽高都要是纯数字。
  const vw = name && /^\d+$/.test(name) ? name : '1440';
  const vh = w && /^\d+$/.test(w) ? w : '1250';
  const r = spawnSync(CHROME, [...COMMON, `--window-size=${vw},${vh}`, '--dump-dom', url], {
    encoding: 'utf8',
    timeout: 90000,
    maxBuffer: 64 * 1024 * 1024,
  });
  const dom = r.stdout || '';
  fs.mkdirSync(path.join(os.tmpdir(), 'txam-verify'), { recursive: true });
  fs.writeFileSync(path.join(os.tmpdir(), 'txam-verify', 'dump.html'), dom, 'utf8');
  // 只输出关键片段，避免刷屏
  const probe = /<div id="probe">([\s\S]*?)<\/div>/.exec(dom);
  if (probe) console.log(probe[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim());
  for (const m of dom.matchAll(/<section class="v3-final[^>]*>[\s\S]{0,600}?<\/section>/g)) {
    console.log('--- v3-final section ---');
    console.log(m[0].replace(/\s+/g, ' ').slice(0, 700));
  }
  const fadeTotal = (dom.match(/fade-up/g) || []).length;
  const fadeVisible = (dom.match(/fade-up[^"]*visible/g) || []).length;
  console.log(`fade-up 总数=${fadeTotal} 其中已 visible=${fadeVisible}`);
  if (fadeTotal === 0) console.log('(未找到 v3-final，可能页面是静态内联版本)');
} else {
  const outDir = path.join(os.tmpdir(), 'txam-verify');
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, `${name}.png`);
  fs.rmSync(out, { force: true });
  spawnSync(
    CHROME,
    [...COMMON, '--hide-scrollbars', `--window-size=${w},${h}`, `--screenshot=${out}`, url],
    { encoding: 'utf8', timeout: 90000 }
  );
  console.log(fs.existsSync(out) ? 'OK ' + out : 'FAILED');
}
