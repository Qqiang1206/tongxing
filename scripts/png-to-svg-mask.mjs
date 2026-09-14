#!/usr/bin/env node
/**
 * PNG → 单色 SVG 轮廓（用于 CSS mask / 水印这类"只要形状、不要颜色"的场景）。
 *
 * 为什么需要：位图当 mask 用、又被放大显示时，浏览器会对 alpha 做双线性插值 ——
 * 边缘糊开一大片，看着就是"模糊"。矢量轮廓在任意缩放下的边缘都是 1px 抗锯齿，锐利。
 *
 * 做法：不粗暴二值化，而是对 alpha 通道跑 **marching squares**（阈值处线性插值），
 * 得到亚像素精度的等值轮廓；再用 Douglas–Peucker 抽稀掉共线点。
 * 多个闭合环（含内孔）合进一条 path，用 fill-rule=evenodd 挖洞。
 *
 * 用法：
 *   node scripts/png-to-svg-mask.mjs <in.png> <out.svg> [--eps 0.35] [--min-area 1.5] [--debug]
 *     --eps       抽稀容差（源图像素），越小越贴合、文件越大。默认 0.35
 *     --min-area  丢弃面积小于该值（平方像素）的碎片，滤噪点。默认 1.5
 *     --debug     打印线段/环数/环面积分布（排查"全被丢弃"这类问题）
 *
 * 也可当模块用：`import { trace, decodePNG, contours, chain } from './png-to-svg-mask.mjs'`
 *
 * 说明：只处理 8-bit 非隔行 PNG（0/2/3/4/6 型都支持），取 alpha 通道（无 alpha 用亮度）。
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import { pathToFileURL } from 'node:url';

/* ---------------- PNG 解码 ---------------- */
export function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('不是 PNG');
  let pos = 8;
  let W = 0, H = 0, bd = 0, ct = 0, interlace = 0;
  const idat = [];
  let palette = null, trns = null;
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      W = data.readUInt32BE(0); H = data.readUInt32BE(4);
      bd = data[8]; ct = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'PLTE') palette = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (bd !== 8) throw new Error('只支持 8-bit，当前 ' + bd + '-bit');
  if (interlace) throw new Error('不支持隔行 PNG');
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ct];
  if (!ch) throw new Error('不支持的颜色类型 ' + ct);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = W * ch;
  const px = Buffer.alloc(W * H * 4);
  let prev = Buffer.alloc(stride);
  let cur = Buffer.alloc(stride);
  let p = 0;
  for (let y = 0; y < H; y++) {
    const ft = raw[p++];
    raw.copy(cur, 0, p, p + stride); p += stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0;
      const b = prev[i];
      const c = i >= ch ? prev[i - ch] : 0;
      let v = cur[i];
      if (ft === 1) v = (v + a) & 255;
      else if (ft === 2) v = (v + b) & 255;
      else if (ft === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (ft === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        v = (v + pr) & 255;
      } else if (ft !== 0) throw new Error('未知 filter ' + ft);
      cur[i] = v;
    }
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      if (ct === 6) {
        px[o] = cur[x * 4]; px[o + 1] = cur[x * 4 + 1];
        px[o + 2] = cur[x * 4 + 2]; px[o + 3] = cur[x * 4 + 3];
      } else if (ct === 2) {
        px[o] = cur[x * 3]; px[o + 1] = cur[x * 3 + 1]; px[o + 2] = cur[x * 3 + 2]; px[o + 3] = 255;
      } else if (ct === 0) {
        px[o] = px[o + 1] = px[o + 2] = cur[x]; px[o + 3] = 255;
      } else if (ct === 4) {
        px[o] = px[o + 1] = px[o + 2] = cur[x * 2]; px[o + 3] = cur[x * 2 + 1];
      } else {
        const idx = cur[x];
        px[o] = palette[idx * 3]; px[o + 1] = palette[idx * 3 + 1]; px[o + 2] = palette[idx * 3 + 2];
        px[o + 3] = trns && idx < trns.length ? trns[idx] : 255;
      }
    }
    prev = Buffer.from(cur);
  }
  return { W, H, px };
}

/* ---------------- marching squares ---------------- */
export function contours(field, W, H, T) {
  // field(x,y) 越界取 0
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : field[y * W + x];
  const segs = [];
  const lerp = (v0, v1) => (T - v0) / (v1 - v0);

  for (let y = -1; y < H; y++) {
    for (let x = -1; x < W; x++) {
      const tl = at(x, y), tr = at(x + 1, y), br = at(x + 1, y + 1), bl = at(x, y + 1);
      let idx = 0;
      if (tl >= T) idx |= 8;
      if (tr >= T) idx |= 4;
      if (br >= T) idx |= 2;
      if (bl >= T) idx |= 1;
      if (idx === 0 || idx === 15) continue;

      const top = () => ({ x: x + lerp(tl, tr), y: y });
      const right = () => ({ x: x + 1, y: y + lerp(tr, br) });
      const bottom = () => ({ x: x + lerp(bl, br), y: y + 1 });
      const left = () => ({ x: x, y: y + lerp(tl, bl) });

      const push = (a, b) => segs.push({ a, b });
      switch (idx) {
        case 1: case 14: push(left(), bottom()); break;
        case 2: case 13: push(bottom(), right()); break;
        case 3: case 12: push(left(), right()); break;
        case 4: case 11: push(right(), top()); break;
        case 6: case 9: push(bottom(), top()); break;
        case 7: case 8: push(left(), top()); break;
        case 5: case 10: {
          // 鞍点：看四角均值决定连法，避免连线穿越错误
          const avg = (tl + tr + br + bl) / 4;
          const centerInside = avg >= T;
          if (idx === 5) {
            if (centerInside) { push(left(), top()); push(bottom(), right()); }
            else { push(left(), bottom()); push(right(), top()); }
          } else {
            if (centerInside) { push(left(), bottom()); push(right(), top()); }
            else { push(left(), top()); push(bottom(), right()); }
          }
          break;
        }
      }
    }
  }
  return segs;
}

/* 把线段串成闭合环 */
export function chain(segs) {
  const Q = 1000;
  const K = (p) => Math.round(p.x * Q) + '|' + Math.round(p.y * Q);
  const adj = new Map();
  segs.forEach((s, i) => {
    for (const k of ['a', 'b']) {
      const key = K(s[k]);
      if (!adj.has(key)) adj.set(key, []);
      adj.get(key).push(i);
    }
  });
  const used = new Uint8Array(segs.length);
  const loops = [];
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    const start = segs[i].a;
    const pts = [segs[i].a, segs[i].b];
    let cur = segs[i].b;
    for (;;) {
      const key = K(cur);
      const cand = (adj.get(key) || []).filter((j) => !used[j]);
      if (!cand.length) break;
      const j = cand[0];
      used[j] = 1;
      const other = K(segs[j].a) === key ? segs[j].b : segs[j].a;
      if (K(other) === K(start)) { pts.push(start); break; }
      pts.push(other);
      cur = other;
    }
    if (pts.length >= 4) loops.push(pts);
  }
  return loops;
}

/* Douglas–Peucker */
function rdp(pts, e) {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [i0, i1] = stack.pop();
    let maxD = -1, maxI = -1;
    const a = pts[i0], b = pts[i1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1e-9;
    for (let i = i0 + 1; i < i1; i++) {
      const p = pts[i];
      const d = Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len;
      if (d > maxD) { maxD = d; maxI = i; }
    }
    if (maxD > e && maxI > 0) {
      keep[maxI] = 1;
      stack.push([i0, maxI], [maxI, i1]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

function area(pts) {
  let s = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    s += p.x * q.y - q.x * p.y;
  }
  return Math.abs(s) / 2;
}

/**
 * 闭合环的抽稀（不能直接喂给 rdp）。
 * rdp 是"开放折线"算法，靠首尾两点定基准线；闭合环首尾是同一点，
 * 基准线退化成零长度 → 所有内点到该线的距离全为 0 → 整环被压成 1 个点全丢。
 * 正确做法：取环上最远的一对点当两个锚，把环切成两条开放弧，各自抽稀再拼起来。
 */
function rdpClosed(ring, e) {
  const n = ring.length;
  if (n < 4) return ring.slice();
  let bi = 0, bj = 0, best = -1;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = ring[i].x - ring[j].x, dy = ring[i].y - ring[j].y;
      const d = dx * dx + dy * dy;
      if (d > best) { best = d; bi = i; bj = j; }
    }
  }
  const arc = (from, to) => {
    const out = [];
    for (let k = from; ; k = (k + 1) % n) { out.push(ring[k]); if (k === to) break; }
    return out;
  };
  const a = rdp(arc(bi, bj), e);
  const b = rdp(arc(bj, bi), e);
  if (a.length < 2 || b.length < 2) return ring.slice();
  // 两段弧共享两个锚点，各去掉一个端点避免重复
  return a.slice(0, -1).concat(b.slice(0, -1));
}

/* ---------------- 主流程 ---------------- */
/**
 * 描摹：PNG → 单色 SVG。
 * @param {string} inFile  源 PNG 路径
 * @param {string} outFile 输出 SVG 路径
 * @param {{eps?:number, minArea?:number, debug?:boolean}} [opt]
 * @returns {{W:number,H:number,kept:number,dropped:number,svg:string}}
 */
export function trace(inFile, outFile, opt = {}) {
  const eps = opt.eps ?? 0.35;
  const minArea = opt.minArea ?? 1.5;
  const debug = !!opt.debug;

  const { W, H, px } = decodePNG(fs.readFileSync(inFile));
  const field = new Float64Array(W * H);
  let hasAlpha = false;
  for (let i = 0; i < W * H; i++) if (px[i * 4 + 3] !== 255) { hasAlpha = true; break; }
  for (let i = 0; i < W * H; i++) {
    const o = i * 4;
    // 有透明通道就用 alpha；完全是不透明的图退化为用"离白底的距离"当显著度
    field[i] = hasAlpha
      ? px[o + 3]
      : 255 - Math.round(0.299 * px[o] + 0.587 * px[o + 1] + 0.114 * px[o + 2]);
  }

  const T = 127.5;
  const segs = contours(field, W, H, T);
  const raw = chain(segs);
  if (debug) {
    console.log(`[debug] 线段 ${segs.length} 条 → 闭合环 ${raw.length} 个`);
    const stats = raw.map((l) => ({ n: l.length, a: area(l.slice(0, -1)) }));
    stats.sort((p, q) => q.a - p.a);
    console.log('[debug] 环面积（降序，前 15）：' + stats.slice(0, 15).map((s) => s.a.toFixed(1) + '(' + s.n + 'pt)').join(' '));
    console.log('[debug] 最大环面积 ' + (stats[0] ? stats[0].a.toFixed(1) : 0));
  }

  const fmt = (v) => {
    const r = Math.round(v * 10) / 10;
    return String(r);
  };
  let path = '';
  let kept = 0, dropped = 0;
  for (const loop of raw) {
    const ring = loop.slice(0, -1); // 去掉重复的收尾点
    if (area(ring) < minArea) { dropped++; continue; }
    const simple = rdpClosed(ring, eps);
    if (simple.length < 3) { dropped++; continue; }
    kept++;
    path += 'M' + simple.map((p) => fmt(p.x) + ' ' + fmt(p.y)).join('L') + 'Z';
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    `<path fill="#000" fill-rule="evenodd" d="${path}"/></svg>\n`;
  fs.writeFileSync(outFile, svg, 'utf8');

  console.log(`源图 ${W}x${H}  取${hasAlpha ? 'alpha' : '亮度'}通道`);
  console.log(`轮廓环：保留 ${kept} / 丢弃 ${dropped}（面积 < ${minArea}）`);
  console.log(`输出 ${outFile}  ${(svg.length / 1024).toFixed(1)}KB  eps=${eps}`);
  return { W, H, kept, dropped, svg };
}

/* ---------------- CLI ---------------- */
function main() {
  const argv = process.argv.slice(2);
  const takeOpt = (name, def) => {
    const i = argv.indexOf(name);
    if (i < 0) return def;
    const v = argv[i + 1];
    argv.splice(i, 2);
    return v;
  };
  const eps = parseFloat(takeOpt('--eps', '0.35'));
  const minArea = parseFloat(takeOpt('--min-area', '1.5'));
  const debug = argv.includes('--debug');
  if (debug) argv.splice(argv.indexOf('--debug'), 1);
  const [inFile, outFile] = argv;
  if (!inFile || !outFile) {
    console.error('usage: node scripts/png-to-svg-mask.mjs <in.png> <out.svg> [--eps 0.35] [--min-area 1.5] [--debug]');
    process.exit(1);
  }
  trace(inFile, outFile, { eps, minArea, debug });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
