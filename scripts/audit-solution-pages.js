// scripts/audit-solution-pages.js
// 检查方案详情页完整性
const fs = require('fs');
const path = require('path');

const root = 'H:\\tongxing';
const issues = [];

// ============ Part 1: 三语版本检查 ============
console.log('========== Part 1: 三语版本齐全性 ==========');
const expectedSchemes = [
  'ac', 'capacitor', 'coffee', 'headlight', 'microwave', 'packaging',
  'refrigerator', 'robot', 'tablet', 'tv-display', 'washer'
];
const langs = ['', '-en', '-ru'];

const allHtml = fs.readdirSync(root).filter(f => f.endsWith('.html'));
const solutionPages = allHtml.filter(f =>
  /^(refrigerator|washer|coffee|tv-display|packaging|capacitor|microwave|headlight|tablet|robot|ac)-solution(-en|-ru)?\.html$/i.test(f)
  || /^solutions-detail(-en|-ru)?\.html$/i.test(f)
);

for (const scheme of expectedSchemes) {
  for (const lang of langs) {
    const expected = `${scheme}-solution${lang}.html`;
    const exists = allHtml.includes(expected);
    if (!exists) {
      issues.push({ level: 'ERROR', msg: `缺失方案页: ${expected}` });
    }
  }
}
for (const lang of langs) {
  const expected = `solutions-detail${lang}.html`;
  const exists = allHtml.includes(expected);
  if (!exists) {
    issues.push({ level: 'ERROR', msg: `缺失方案页: ${expected}` });
  }
}
console.log(`找到 ${solutionPages.length} 个方案详情页 (期望 36 = 12×3)`);
if (solutionPages.length < 36) {
  console.log('缺失文件:');
  for (const scheme of expectedSchemes) {
    for (const lang of langs) {
      const expected = `${scheme}-solution${lang}.html`;
      if (!allHtml.includes(expected)) console.log(`  - ${expected}`);
    }
  }
  for (const lang of langs) {
    const expected = `solutions-detail${lang}.html`;
    if (!allHtml.includes(expected)) console.log(`  - ${expected}`);
  }
}

// ============ Part 2: 图片引用是否存在 ============
console.log('\n========== Part 2: 图片引用完整性 ==========');
const imgRefRegex = /src=["']([^"']+\.(jpe?g|png|webp|svg|gif))["']/gi;
const srcsetRegex = /srcset=["']([^"']+\.(jpe?g|png|webp|svg|gif))["']/gi;
const hrefImgRegex = /href=["']([^"']+\.(jpe?g|png|webp|svg|gif))["']/gi;
const jsImageRegex = /image:\s*['"]([^'"]+\.(jpe?g|png|webp|svg|gif))['"]/gi;
const jsCoverRegex = /cover:\s*['"]([^'"]+\.(jpe?g|png|webp|svg|gif))['"]/gi;
const metaContentRegex = /content=["']([^'"]+\.(jpe?g|png|webp|svg|gif))["']/gi;

const referencedImages = new Map(); // img -> [{page, type}]
for (const html of solutionPages) {
  const content = fs.readFileSync(path.join(root, html), 'utf-8');
  const checkRef = (regex, type) => {
    for (const m of content.matchAll(regex)) {
      const ref = m[1].replace(/\\/g, '/');
      if (!referencedImages.has(ref)) referencedImages.set(ref, []);
      referencedImages.get(ref).push({ page: html, type });
    }
  };
  checkRef(imgRefRegex, 'img-src');
  checkRef(srcsetRegex, 'srcset');
  checkRef(hrefImgRegex, 'href');
  checkRef(jsImageRegex, 'js-image');
  checkRef(jsCoverRegex, 'js-cover');
  checkRef(metaContentRegex, 'meta-content');
}

let missingFiles = 0;
let chineseNamedFiles = 0;
for (const [img, refs] of referencedImages) {
  const fp = path.join(root, img);
  if (!fs.existsSync(fp)) {
    // 中文文件名特别关注
    const isChinese = /[\u4e00-\u9fff]/.test(img);
    if (isChinese) chineseNamedFiles++;
    missingFiles++;
    issues.push({
      level: isChinese ? 'WARN' : 'ERROR',
      msg: `引用了不存在的文件: ${img} (被 ${refs.length} 处引用, 首次: ${refs[0].page}:${refs[0].type})`
    });
  }
}
console.log(`共 ${referencedImages.size} 个不同图片引用`);
console.log(`其中 ${missingFiles} 个文件不存在 (含 ${chineseNamedFiles} 个中文文件名)`);

// ============ Part 3: webp 替代检查 ============
console.log('\n========== Part 3: webp 替代完整性 ==========');
let noWebpAlt = [];
for (const [img, refs] of referencedImages) {
  if (!/\.(jpe?g|png)$/i.test(img)) continue; // 跳过 svg/gif/webp 自身
  const webpPath = img.replace(/\.(jpe?g|png)$/i, '.webp');
  const webpFp = path.join(root, webpPath);
  if (!fs.existsSync(webpFp)) {
    noWebpAlt.push({ img, refs: refs.length });
    issues.push({
      level: 'WARN',
      msg: `缺少 webp 版本: ${img} (被 ${refs.length} 处引用)`
    });
  }
}
console.log(`${noWebpAlt.length} 个图没有 webp 替代:`);
for (const item of noWebpAlt) console.log(`  - ${item.img} (被 ${item.refs} 处引用)`);

// ============ Part 4: solutions-detail.html 的 JS 引用 ============
console.log('\n========== Part 4: solutions-detail.html JS 引用 ==========');
const detailPages = solutionPages.filter(p => p.startsWith('solutions-detail'));
for (const dp of detailPages) {
  const content = fs.readFileSync(path.join(root, dp), 'utf-8');
  const imageRefs = [];
  for (const m of content.matchAll(jsImageRegex)) imageRefs.push(m[1]);
  const chineseRefs = imageRefs.filter(r => /[\u4e00-\u9fff]/.test(r));
  console.log(`${dp}:`);
  console.log(`  JS image 引用: ${imageRefs.length} 个, 其中中文文件名: ${chineseRefs.length} 个`);
  if (chineseRefs.length > 0) {
    console.log(`  ⚠ 中文文件名引用（实际不存在）:`);
    for (const r of chineseRefs) {
      const actual = r.replace(/[\u4e00-\u9fff]+/g, m => {
        const map = {
          '洗衣机': 'washer', '电容器': 'capacitor', '空调': 'ac',
          '微波炉': 'microwave', '咖啡机': 'coffee', '平板电脑': 'tablet',
          '车灯': 'headlight', '机器人': 'robot', '冰箱': 'refrigerator',
          '包装与物流': 'pkg-logistics'
        };
        return map[m] || m;
      });
      const exists = fs.existsSync(path.join(root, actual));
      console.log(`    ${r} → 猜测实际名: ${actual} ${exists ? '✓' : '✗'}`);
    }
  }
}

// ============ Part 5: "光秃秃"详情页检查 ============
console.log('\n========== Part 5: 内容稀薄的详情页 ==========');
for (const page of solutionPages) {
  if (page.startsWith('solutions-detail')) continue;
  const content = fs.readFileSync(path.join(root, page), 'utf-8');
  const text = content.replace(/<script[\s\S]*?<\/script>/g, '')
                     .replace(/<style[\s\S]*?<\/style>/g, '')
                     .replace(/<[^>]+>/g, ' ')
                     .replace(/\s+/g, ' ').trim();
  if (text.length < 300) {
    issues.push({ level: 'WARN', msg: `内容过少: ${page} (${text.length} 字符)` });
    console.log(`  ⚠ ${page}: 仅 ${text.length} 字符正文`);
  }
}

// ============ 总结 ============
console.log('\n========== 总结 ==========');
const errors = issues.filter(i => i.level === 'ERROR');
const warns = issues.filter(i => i.level === 'WARN');
console.log(`错误: ${errors.length}`);
console.log(`警告: ${warns.length}`);
if (errors.length > 0) {
  console.log('\n错误列表:');
  for (const e of errors) console.log(`  ❌ ${e.msg}`);
}
if (warns.length > 0) {
  console.log('\n警告列表:');
  for (const w of warns) console.log(`  ⚠️  ${w.msg}`);
}