#!/usr/bin/env node
/**
 * CDP 精确截图（跨源可用）：截「任意页面里的任意元素」，而不是只有整页。
 *
 * 为什么需要：`shot.mjs` 走 Chrome 命令行 `--screenshot`，只能整页长图 ——
 * 参考别人网站（或自己站点深处）的某个区块时，元素在长图里只有几十像素高，根本看不清。
 * CDP 的 `Page.captureScreenshot` + `clip` 可以把目标元素精确框出来。
 *
 * 用法：
 *   node scripts/cdp-shot.mjs <url> <selector> <outName> [viewportW] [pad] [--css <file>] [--vw <窄屏宽>] [--scale <倍数>]
 *     selector 传 `-` 表示整页
 *     pad      目标元素四周额外留白，默认 0
 *     --css    截图前注入一份 CSS（试方案用：不改源码就能看某个覆盖样式的效果）
 *     --vw     用视口模拟跑窄屏（headless 的 --window-size 有 ~500px 最小宽）
 *     --scale  放大采集倍率，默认 1（看边缘锐度这类细节时用 2~3）
 *   例：node scripts/cdp-shot.mjs "https://www.workbuddy.cn/" "div.footer-brand" wb-brand 1440 40
 *       node scripts/cdp-shot.mjs "http://localhost:8204/about.html" "footer.txf" v2 1440 0 --css /tmp/v2.css
 * 输出：%TEMP%/txam-verify/<outName>.png
 *
 * 注意：这是**读取别人网站**的工具，只用于看一眼布局；别拿它去抓内容。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => fs.existsSync(p));
if (!CHROME) {
  console.error('no chrome/edge found');
  process.exit(1);
}

const args = process.argv.slice(2);
const takeOpt = (name) => {
  const i = args.indexOf(name);
  if (i < 0) return null;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const cssFile = takeOpt('--css');
const emuW = parseInt(takeOpt('--vw') || '0', 10);
const shotScale = parseFloat(takeOpt('--scale') || '1') || 1;
const [url, selector, outName, vwArg = '1440', padArg = '0'] = args;
if (!url || !selector || !outName) {
  console.error('usage: node scripts/cdp-shot.mjs <url> <selector|-> <outName> [viewportW] [pad] [--css <file>] [--vw <窄屏宽>]');
  process.exit(1);
}
const vw = parseInt(vwArg, 10) || 1440;
const pad = parseInt(padArg, 10) || 0;
const injectCss = cssFile ? fs.readFileSync(cssFile, 'utf8') : '';

const OUT_DIR = path.join(os.tmpdir(), 'txam-verify');
fs.mkdirSync(OUT_DIR, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-prof-'));
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--hide-scrollbars',
    '--remote-debugging-port=0',
    '--user-data-dir=' + userDir,
    `--window-size=${vw},900`,
    'about:blank',
  ],
  { stdio: ['ignore', 'pipe', 'pipe'] }
);

let closed = false;
const cleanup = () => {
  if (closed) return;
  closed = true;
  try { chrome.kill(); } catch {}
  try { fs.rmSync(userDir, { recursive: true, force: true }); } catch {}
};
process.on('exit', cleanup);

// headless 会把 "DevTools listening on ws://127.0.0.1:PORT/devtools/browser/xxx" 打到 stderr
const portReady = new Promise((resolve, reject) => {
  let buf = '';
  const timer = setTimeout(() => reject(new Error('Chrome 启动超时（未拿到 DevTools 端口）')), 25000);
  chrome.stderr.on('data', (c) => {
    buf += c.toString();
    const m = /DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//.exec(buf);
    if (m) { clearTimeout(timer); resolve(parseInt(m[1], 10)); }
  });
  chrome.on('exit', (code) => { clearTimeout(timer); reject(new Error('Chrome 提前退出，code=' + code)); });
});

const getJSON = (port, p) =>
  new Promise((res, rej) => {
    http
      .get({ host: '127.0.0.1', port, path: p }, (r) => {
        let d = '';
        r.on('data', (c) => (d += c));
        r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } });
      })
      .on('error', rej);
  });

const main = async () => {
  const port = await portReady;
  await sleep(300); // 等 /json/list 就绪

  let list = [];
  for (let i = 0; i < 20; i++) {
    try { list = await getJSON(port, '/json/list'); } catch {}
    if (list.some((t) => t.type === 'page')) break;
    await sleep(250);
  }
  const page = list.find((t) => t.type === 'page');
  if (!page) throw new Error('没找到可用的 page target');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', () => rej(new Error('WebSocket 连接失败')), { once: true });
  });

  let seq = 0;
  const pending = new Map();
  const waiters = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    } else if (msg.method) {
      const arr = waiters.get(msg.method);
      if (arr) { waiters.delete(msg.method); arr.forEach((f) => f(msg.params)); }
    }
  });
  const send = (method, params = {}) =>
    new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
  const once = (method) => new Promise((res) => { const arr = waiters.get(method) || []; arr.push(res); waiters.set(method, arr); });

  await send('Page.enable');
  // headless 的 --window-size 有 ~500px 最小宽，窄屏得靠 CDP 的视口模拟绕开
  if (emuW) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: emuW,
      height: 900,
      deviceScaleFactor: 1,
      mobile: true,
    });
    console.log(`已模拟视口 ${emuW}x900`);
  }
  const loaded = once('Page.loadEventFired');
  await send('Page.navigate', { url });
  await Promise.race([loaded, sleep(20000)]);
  await sleep(3500); // 给 SPA 渲染 / 懒加载留时间

  if (injectCss) {
    await send('Runtime.evaluate', {
      expression: `(() => {
        const s = document.createElement('style');
        s.id = 'cdp-shot-injected';
        s.textContent = ${JSON.stringify(injectCss)};
        document.head.appendChild(s);
        return s.textContent.length;
      })()`,
      returnByValue: true,
    });
    console.log(`已注入 CSS（${injectCss.length} 字符）`);
  }

  let clip;
  if (selector === '-') {
    const m = await send('Page.getLayoutMetrics');
    const cs = m.result.cssContentSize;
    clip = { x: 0, y: 0, width: cs.width, height: cs.height, scale: 1 };
    console.log(`整页 ${Math.round(cs.width)}x${Math.round(cs.height)}`);
  } else {
    const r = await send('Runtime.evaluate', {
      expression: `(() => {
        const e = document.querySelector(${JSON.stringify(selector)});
        if (!e) return null;
        const b = e.getBoundingClientRect();
        const cs = getComputedStyle(e);
        return {
          tag: e.tagName, cls: String(e.className), w: b.width, h: b.height,
          x: b.left + window.scrollX, y: b.top + window.scrollY,
          text: (e.innerText || '').replace(/\\s+/g, ' ').slice(0, 200),
          color: cs.color, bg: cs.backgroundColor, fs: cs.fontSize,
        };
      })()`,
      returnByValue: true,
    });
    const v = r.result && r.result.result && r.result.result.value;
    if (!v) throw new Error('未找到元素：' + selector);
    console.log(`元素 <${v.tag.toLowerCase()}> .${v.cls.split(' ').join('.')}`);
    console.log(`  盒子 ${Math.round(v.w)}x${Math.round(v.h)}  页面坐标 ${Math.round(v.x)},${Math.round(v.y)}`);
    console.log(`  color=${v.color} bg=${v.bg} fontSize=${v.fs}`);
    console.log(`  文本 ${JSON.stringify(v.text)}`);
    clip = {
      x: Math.max(0, v.x - pad),
      y: Math.max(0, v.y - pad),
      width: v.w + pad * 2,
      height: v.h + pad * 2,
      scale: 1,
    };
  }

  const shot = await send('Page.captureScreenshot', {
    format: 'png',
    clip: { ...clip, scale: shotScale },
    captureBeyondViewport: true,
  });
  const out = path.join(OUT_DIR, `${outName}.png`);
  fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
  console.log('OK ' + out);

  ws.close();
  cleanup();
  process.exit(0);
};

main().catch((e) => {
  console.error('FAILED: ' + e.message);
  cleanup();
  process.exit(1);
});
