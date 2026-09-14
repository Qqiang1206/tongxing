#!/usr/bin/env node
/**
 * 区块裁切预览页（站点根 __preview.html）的生成 / 清理。
 *
 * 为什么需要它：改某个区块的样式时，"整页截图"太粗（看不清细节），
 * "读 CSS 猜"又不可靠（父级 padding、伪元素、栅格空列都看不出来）。
 * 这个预览页把真实页面塞进 iframe、按选择器精确裁切，并用探针把
 * 边框 / padding / 栅格列宽 / 子元素伪元素全部打印出来 —— 拿去截图或 dump-dom 即可。
 *
 * 用法：
 *   node scripts/preview-section.mjs            生成 __preview.html
 *   node scripts/preview-section.mjs --clean    清理（顺带清掉历史遗留的 _*preview*.html）
 *
 * 生成后（服务需在 8204 跑着）：
 *   node scripts/shot.mjs img "http://localhost:8204/__preview.html?src=about.html&sel=%23about-stats-grid&pad=110" my-shot 1440 440
 *   node scripts/shot.mjs dom "http://localhost:8204/__preview.html?src=about.html&sel=%23about-stats-grid" 1440 800
 *
 * query 参数：src / sel / w / h / pad（# 在 URL 里要写成 %23，或直接省掉让脚本补）
 * ⚠️ 生成物落在部署目录，验证完务必 --clean，别让它跟着部署上去。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const template = path.join(here, 'section-preview.html');
const target = path.join(root, '__preview.html');

if (process.argv.includes('--clean')) {
  const leftovers = fs
    .readdirSync(root)
    .filter((n) => /^_.*preview.*\.html$/i.test(n) || n === '__preview.html');
  if (!leftovers.length) {
    console.log('没有需要清理的预览页');
  } else {
    for (const n of leftovers) {
      fs.rmSync(path.join(root, n), { force: true });
      console.log('已删除 ' + n);
    }
  }
  process.exit(0);
}

if (!fs.existsSync(template)) {
  console.error('模板缺失：' + template);
  process.exit(1);
}
fs.copyFileSync(template, target);
console.log('已生成 __preview.html（模板：scripts/section-preview.html）');
console.log('示例：node scripts/shot.mjs img "http://localhost:8204/__preview.html?src=about.html&sel=%23about-stats-grid&pad=110" shot 1440 440');
console.log('用完记得：node scripts/preview-section.mjs --clean');
