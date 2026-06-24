// scripts/convert-index-pkg-logistics.js
// 把首页 index.html 系列里 pkg-logistics-line.jpg 改 picture 切 webp
const fs = require('fs');
const path = require('path');

const root = 'H:\\tongxing';
const dryRun = !process.argv.includes('--apply');

function scan() {
  const targets = ['index.html', 'index-en.html', 'index-ru.html'];
  const refs = [];
  for (const html of targets) {
    const fp = path.join(root, html);
    if (!fs.existsSync(fp)) continue;
    const content = fs.readFileSync(fp, 'utf-8');
    const regex = /<img\s+([^>]*?)src=["']pkg-logistics-line\.jpg["']([^>]*?)>/g;
    let m;
    while ((m = regex.exec(content))) {
      refs.push({ file: html, fullMatch: m[0], attrsBefore: m[1], attrsAfter: m[2] });
    }
  }
  return refs;
}

function apply(refs) {
  let changed = 0;
  for (const ref of refs) {
    const fp = path.join(root, ref.file);
    let content = fs.readFileSync(fp, 'utf-8');
    const oldStr = ref.fullMatch;
    const allAttrs = (ref.attrsBefore + ' ' + ref.attrsAfter).trim();
    const cleanedAttrs = allAttrs.replace(/\s*src=["']pkg-logistics-line\.jpg["']\s*/g, ' ').replace(/\s+/g, ' ').trim();
    const newStr = `<picture><source srcset="pkg-logistics-line.webp" type="image/webp"><img ${cleanedAttrs} src="pkg-logistics-line.jpg"></picture>`;
    if (content.replace(oldStr, newStr) !== content) {
      content = content.replace(oldStr, newStr);
      fs.writeFileSync(fp, content, 'utf-8');
      changed++;
    }
  }
  return changed;
}

function main() {
  console.log(dryRun ? '========== DRY RUN ==========' : '========== APPLYING ==========');
  console.log();

  console.log('Step 1: 验证 webp');
  const webpFp = path.join(root, 'pkg-logistics-line.webp');
  if (!fs.existsSync(webpFp)) {
    console.log(`❌ ${webpFp} 不存在`);
    return;
  }
  const jpgSize = fs.statSync(path.join(root, 'pkg-logistics-line.jpg')).size / 1024;
  const webpSize = fs.statSync(webpFp).size / 1024;
  console.log(`✓ jpg: ${jpgSize.toFixed(1)} KB → webp: ${webpSize.toFixed(1)} KB (-${((1-webpSize/jpgSize)*100).toFixed(0)}%)`);
  console.log();

  console.log('Step 2: 扫描首页引用');
  const refs = scan();
  console.log(`  找到 ${refs.length} 个 HTML 引用 pkg-logistics-line.jpg`);
  for (const r of refs) console.log(`    ${r.file}`);
  console.log();

  if (dryRun) {
    console.log('Step 3: 改动预览');
    console.log('  <img src="pkg-logistics-line.jpg" ...>');
    console.log('  ↓');
    console.log('  <picture><source srcset="pkg-logistics-line.webp" type="image/webp"><img ... src="pkg-logistics-line.jpg"></picture>');
    console.log();
    console.log('👉 运行 `node scripts/convert-index-pkg-logistics.js --apply` 实际执行');
  } else {
    const changed = apply(refs);
    console.log(`Step 3: ✓ 修改 ${changed} 个 HTML 文件`);
  }
}

main();