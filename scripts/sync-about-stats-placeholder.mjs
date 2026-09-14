/**
 * 把 about 三语页里「数据带」的静态占位块，对齐成 about-page.js 新的渲染标记。
 * 背景：这块 HTML 只是无 JS 时的首屏占位，JS 会用 data/pages/about/*.js 覆盖它。
 * 旧占位是 5 项（含已被删除的「15 国」）＋ Tailwind 的 md:grid-cols-5，
 * 与真实数据（4 项）不一致 —— 首屏会闪一下旧内容，且列数对不上。
 *
 * 用法：node scripts/sync-about-stats-placeholder.mjs [--check]
 */
import fs from 'node:fs';

const DATA = {
  'about.html': [
    ['19', '年', '非标自动化设备制造经验'],
    ['98', '项', '核心发明与专利'],
    ['11', '大', '重点行业全覆盖'],
    ['10', '万㎡', '深圳+惠州双核工厂'],
  ],
  'en/about.html': [
    ['19', 'Years', 'Experience in non-standard automation equipment manufacturing'],
    ['98', 'Items', 'Core inventions and patents'],
    ['11', 'Major', 'Full coverage of key industries'],
    ['10', '0,000 m²', 'Shenzhen + Huizhou Dual-Core Factory'],
  ],
  'ru/about.html': [
    ['19', 'лет', 'опыт производства нестандартного автоматизированного оборудования'],
    ['98', 'ед.', 'ключевых изобретений и патентов'],
    ['11', 'крупных', 'отраслей полного охвата'],
    ['10', '0 тыс. м²', 'Двухъядерные заводы в Шэньчжэне и Хуэйчжоу'],
  ],
};

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function buildBlock(items, indent) {
  const cells = items.map(([value, unit, label]) =>
    [
      `${indent}    <div class="about-stat">`,
      `${indent}        <div class="about-stat__num mono-num">${esc(value)}<span class="about-stat__unit">${esc(unit)}</span></div>`,
      `${indent}        <p class="about-stat__label">${esc(label)}</p>`,
      `${indent}    </div>`,
    ].join('\n')
  );
  return (
    `${indent}<div id="about-stats-grid" class="about-stats">\n` +
    cells.join('\n') +
    `\n${indent}</div>`
  );
}

/** 从 `<div id="about-stats-grid"` 起，按 div 嵌套深度找到配对的结束标签 */
function findGridRange(html) {
  const start = html.indexOf('<div id="about-stats-grid"');
  if (start < 0) return null;
  const re = /<div\b|<\/div>/g;
  re.lastIndex = start;
  let depth = 0;
  let m;
  while ((m = re.exec(html))) {
    if (m[0] === '<div') depth++;
    else {
      depth--;
      if (depth === 0) return { start, end: m.index + '</div>'.length };
    }
  }
  return null;
}

const check = process.argv.includes('--check');
let bad = 0;

for (const [file, items] of Object.entries(DATA)) {
  if (!fs.existsSync(file)) {
    console.log('SKIP ' + file + ' (不存在)');
    continue;
  }
  const html = fs.readFileSync(file, 'utf8');
  const range = findGridRange(html);
  if (!range) {
    console.log('FAIL ' + file + ' 未找到 about-stats-grid');
    bad++;
    continue;
  }
  // 替换必须从「行首」开始，否则原行前导缩进会被保留、和 next 里的缩进叠成双份
  const lineStart = html.lastIndexOf('\n', range.start) + 1;
  // 缩进从「上一行」（v3-shell 那层）推 +4，不读被替换行自身的缩进 ——
  // 否则跑一次错位的文件会把错误缩进固化下来。
  const prevLineEnd = html.lastIndexOf('\n', Math.max(0, range.start - 1));
  const prevLineStart = html.lastIndexOf('\n', Math.max(0, prevLineEnd - 1)) + 1;
  const prevIndent = /^[ \t]*/.exec(html.slice(prevLineStart, prevLineEnd))[0].length;
  const indent = ' '.repeat(prevIndent + 4);
  const next = buildBlock(items, indent);
  const current = html.slice(lineStart, range.end);

  if (current === next) {
    console.log('OK   ' + file + ' 已对齐（' + items.length + ' 项）');
    continue;
  }
  if (check) {
    console.log('DRIFT ' + file + ' 占位块与数据不一致');
    bad++;
    continue;
  }
  fs.writeFileSync(file, html.slice(0, lineStart) + next + html.slice(range.end), 'utf8');
  console.log('FIX  ' + file + ' 已对齐（' + items.length + ' 项）');
}

if (check) console.log(bad ? `\n${bad} 个文件需要修正` : '\n全部已对齐');
