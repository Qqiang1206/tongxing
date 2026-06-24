// scripts/convert-pkg-logistics-to-webp.js
// 把 16 个方案详情页的 <img src="solutions/pkg-logistics-line.png"> 改成 <picture> 切 webp
const fs = require('fs');
const path = require('path');

const root = 'H:\\tongxing';
const dryRun = !process.argv.includes('--apply');

function scanDirectPngRefs() {
  const htmlFiles = fs.readdirSync(root).filter(f => f.endsWith('.html'));
  const refs = [];
  for (const html of htmlFiles) {
    const content = fs.readFileSync(path.join(root, html), 'utf-8');
    // 匹配 <img src="solutions/pkg-logistics-line.png">
    const regex = /<img\s+([^>]*?)src=["']solutions\/pkg-logistics-line\.png["']([^>]*?)>/g;
    let m;
    while ((m = regex.exec(content))) {
      refs.push({
        file: html,
        fullMatch: m[0],
        attrsBefore: m[1],
        attrsAfter: m[2]
      });
    }
  }
  return refs;
}

function applyChanges(refs) {
  let changed = 0;
  for (const ref of refs) {
    const fp = path.join(root, ref.file);
    let content = fs.readFileSync(fp, 'utf-8');
    const oldStr = ref.fullMatch;
    const beforeAttrs = ref.attrsBefore.trim();
    const afterAttrs = ref.attrsAfter.trim();
    const allAttrs = (beforeAttrs + ' ' + afterAttrs).trim();
    // 去掉 src 属性（移到 picture 后保留为 fallback）
    const cleanedAttrs = allAttrs.replace(/\s*src=["']solutions\/pkg-logistics-line\.png["']\s*/g, ' ').replace(/\s+/g, ' ').trim();
    const newStr = `<picture><source srcset="solutions/pkg-logistics-line.webp" type="image/webp"><img ${cleanedAttrs} src="solutions/pkg-logistics-line.png"></picture>`;
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

  console.log('Step 1: 验证 webp 文件存在');
  const webpFp = path.join(root, 'solutions', 'pkg-logistics-line.webp');
  if (!fs.existsSync(webpFp)) {
    console.log(`❌ ${webpFp} 不存在，需要先生成`);
    return;
  }
  const webpSize = fs.statSync(webpFp).size / 1024;
  console.log(`✓ ${webpFp} 存在: ${webpSize.toFixed(1)} KB`);
  console.log();

  console.log('Step 2: 扫描 HTML 引用');
  const refs = scanDirectPngRefs();
  console.log(`  找到 ${refs.length} 个 HTML 直接引用 solutions/pkg-logistics-line.png`);
  console.log();

  console.log('Step 3: 改动清单');
  if (dryRun) {
    const byFile = {};
    for (const r of refs) byFile[r.file] = (byFile[r.file] || 0) + 1;
    for (const [f, c] of Object.entries(byFile)) {
      console.log(`  ${f}: ${c} 处`);
    }
    console.log();
    console.log('改动模式:');
    console.log('  <img src="solutions/pkg-logistics-line.png" ...>');
    console.log('  ↓');
    console.log('  <picture>');
    console.log('    <source srcset="solutions/pkg-logistics-line.webp" type="image/webp">');
    console.log('    <img ... src="solutions/pkg-logistics-line.png">');
    console.log('  </picture>');
    console.log();
    console.log(`收益: 每个页面从下载 16.5 MB PNG 改为 1.1 MB webp`);
    console.log(`总计: ${refs.length} 个页面 × 15.4 MB 节省 = ${(refs.length * 15.4).toFixed(0)} MB 首次访问传输`);
    console.log();
    console.log('👉 运行 `node scripts/convert-pkg-logistics-to-webp.js --apply` 实际执行');
  } else {
    const changed = applyChanges(refs);
    console.log(`  ✓ 修改 ${changed} 个 HTML 文件`);
    console.log('  ✓ 请运行 `git diff` 查看变更');
  }
}

main();