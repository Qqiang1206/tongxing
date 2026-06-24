// scripts/convert-tv-flex-to-webp.js
// 把 solutions/tv-flex-line.jpg 转 webp + 改 HTML 用 <picture>
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const root = 'H:\\tongxing';
const jpgRel = 'solutions/tv-flex-line.jpg';
const webpRel = 'solutions/tv-flex-line.webp';
const dryRun = !process.argv.includes('--apply');

async function generateWebp() {
  const jpgFp = path.join(root, jpgRel);
  const webpFp = path.join(root, webpRel);

  if (fs.existsSync(webpFp)) {
    console.log(`✓ ${webpRel} 已存在，跳过生成`);
    const s = fs.statSync(webpFp).size;
    console.log(`  当前大小: ${(s/1024).toFixed(1)} KB`);
    return;
  }

  await sharp(jpgFp).webp({ quality: 65, effort: 6 }).toFile(webpFp);
  const before = fs.statSync(jpgFp).size;
  const after = fs.statSync(webpFp).size;
  console.log(`✓ 生成 ${webpRel}`);
  console.log(`  原: ${(before/1024).toFixed(1)} KB → webp: ${(after/1024).toFixed(1)} KB (-${((1-after/before)*100).toFixed(0)}%)`);
}

function scanHtmlReferences() {
  const htmlFiles = fs.readdirSync(root).filter(f => f.endsWith('.html'));
  const refs = [];
  for (const html of htmlFiles) {
    const content = fs.readFileSync(path.join(root, html), 'utf-8');
    // 匹配 <img src="solutions/tv-flex-line.jpg">
    const regex = /<img\s+([^>]*?)src=["']solutions\/tv-flex-line\.jpg["']([^>]*?)>/g;
    let m;
    while ((m = regex.exec(content))) {
      refs.push({
        file: html,
        fullMatch: m[0],
        attrsBefore: m[1],
        attrsAfter: m[2]
      });
    }
    // 也检查 preload
    const preloadRegex = /<link\s+([^>]*?)href=["']solutions\/tv-flex-line\.jpg["']([^>]*?)>/g;
    while ((m = preloadRegex.exec(content))) {
      refs.push({
        file: html,
        fullMatch: m[0],
        type: 'preload',
        attrsBefore: m[1],
        attrsAfter: m[2]
      });
    }
  }
  return refs;
}

function applyHtmlChanges(refs) {
  let changed = 0;
  for (const ref of refs) {
    if (ref.type === 'preload') {
      // preload: 直接把 jpg 换成 webp
      const fp = path.join(root, ref.file);
      let content = fs.readFileSync(fp, 'utf-8');
      const oldStr = ref.fullMatch;
      const newStr = oldStr
        .replace('tv-flex-line.jpg', 'tv-flex-line.webp')
        .replace(/type=["']image\/jpeg["']/gi, 'type="image/webp"');
      content = content.replace(oldStr, newStr);
      fs.writeFileSync(fp, content, 'utf-8');
      changed++;
    } else {
      // <img>: 用 <picture> 包裹
      const fp = path.join(root, ref.file);
      let content = fs.readFileSync(fp, 'utf-8');
      const oldStr = ref.fullMatch;
      const beforeAttrs = ref.attrsBefore.trim();
      const afterAttrs = ref.attrsAfter.trim();
      // 合并属性, 去掉 src
      const allAttrs = (beforeAttrs + ' ' + afterAttrs).trim();
      const cleanedAttrs = allAttrs.replace(/\s*src=["']solutions\/tv-flex-line\.jpg["']\s*/g, ' ').replace(/\s+/g, ' ').trim();
      const newStr = `<picture><source srcset="solutions/tv-flex-line.webp" type="image/webp"><img ${cleanedAttrs} src="solutions/tv-flex-line.jpg"></picture>`;
      content = content.replace(oldStr, newStr);
      fs.writeFileSync(fp, content, 'utf-8');
      changed++;
    }
  }
  return changed;
}

async function main() {
  console.log(dryRun ? '========== DRY RUN ==========' : '========== APPLYING ==========');
  console.log();

  // 1. 生成 webp
  console.log('Step 1: 生成 webp');
  await generateWebp();
  console.log();

  // 2. 扫描 HTML 引用
  console.log('Step 2: 扫描 HTML 引用');
  const refs = scanHtmlReferences();
  const imgRefs = refs.filter(r => r.type !== 'preload');
  const preloadRefs = refs.filter(r => r.type === 'preload');
  console.log(`  <img> 引用: ${imgRefs.length} 处`);
  console.log(`  <link rel=preload> 引用: ${preloadRefs.length} 处`);
  console.log();

  // 3. 列出改动清单
  console.log('Step 3: 改动清单');
  if (dryRun) {
    console.log('  <img> → <picture> 改动 (将改的文件):');
    const byFile = {};
    for (const r of imgRefs) {
      if (!byFile[r.file]) byFile[r.file] = 0;
      byFile[r.file]++;
    }
    for (const [f, c] of Object.entries(byFile)) {
      console.log(`    ${f}: ${c} 处`);
    }
    console.log();
    console.log('  <link rel=preload> 改动 (jpg → webp):');
    for (const r of preloadRefs) {
      console.log(`    ${r.file}`);
    }
    console.log();
    console.log('👉 运行 `node scripts/convert-tv-flex-to-webp.js --apply` 实际执行');
  } else {
    const changed = applyHtmlChanges(refs);
    console.log(`  ✓ 修改 ${changed} 处`);
    console.log('  ✓ 请运行 `git diff` 查看变更');
  }
}

main().catch(e => { console.error(e); process.exit(1); });