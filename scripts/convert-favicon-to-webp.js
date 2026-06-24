// scripts/convert-favicon-to-webp.js
// 把 favicon.png 转 webp，并改 HTML 让浏览器优先用 webp
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const root = 'H:\\tongxing';
const pngRel = 'favicon.png';
const webpRel = 'favicon.webp';
const dryRun = !process.argv.includes('--apply');

async function generateWebp() {
  const pngFp = path.join(root, pngRel);
  const webpFp = path.join(root, webpRel);

  if (fs.existsSync(webpFp)) {
    const s = fs.statSync(webpFp).size;
    console.log(`✓ ${webpRel} 已存在: ${(s/1024).toFixed(1)} KB`);
    return;
  }

  await sharp(pngFp).webp({ quality: 80, effort: 6 }).toFile(webpFp);
  const before = fs.statSync(pngFp).size;
  const after = fs.statSync(webpFp).size;
  console.log(`✓ 生成 ${webpRel}`);
  console.log(`  原: ${(before/1024).toFixed(1)} KB → webp: ${(after/1024).toFixed(1)} KB (-${((1-after/before)*100).toFixed(0)}%)`);
}

function scanHtmlReferences() {
  const htmlFiles = fs.readdirSync(root).filter(f => f.endsWith('.html'));
  const refs = [];
  for (const html of htmlFiles) {
    const content = fs.readFileSync(path.join(root, html), 'utf-8');
    // 检查是否有 image/png favicon link
    const pngLinkRegex = /<link\s+rel=["']icon["']\s+type=["']image\/png["']\s+href=["']favicon\.png["']\s*\/?>/g;
    const matches = [...content.matchAll(pngLinkRegex)];
    if (matches.length > 0) {
      refs.push({
        file: html,
        count: matches.length,
        firstMatch: matches[0][0]
      });
    }
  }
  return refs;
}

function applyHtmlChanges(refs) {
  let changed = 0;
  for (const ref of refs) {
    const fp = path.join(root, ref.file);
    let content = fs.readFileSync(fp, 'utf-8');
    const before = content;
    // 在每个 <link rel="icon" type="image/png" href="favicon.png"> 之前插入 webp 版本
    const pngLinkRegex = /(\s*)(<link\s+rel=["']icon["']\s+type=["']image\/png["']\s+href=["']favicon\.png["']\s*\/?>)/g;
    content = content.replace(pngLinkRegex, (match, indent, link) => {
      const webpLink = `<link rel="icon" type="image/webp" href="favicon.webp">`;
      return `${indent}${webpLink}${indent}${link}`;
    });
    if (content !== before) {
      fs.writeFileSync(fp, content, 'utf-8');
      changed++;
    }
  }
  return changed;
}

async function main() {
  console.log(dryRun ? '========== DRY RUN ==========' : '========== APPLYING ==========');
  console.log();

  console.log('Step 1: 生成 webp');
  await generateWebp();
  console.log();

  console.log('Step 2: 扫描 HTML 引用');
  const refs = scanHtmlReferences();
  console.log(`  找到 ${refs.length} 个 HTML 文件引用 favicon.png`);
  console.log();

  console.log('Step 3: 改动清单');
  if (dryRun) {
    console.log('  将插入 <link rel="icon" type="image/webp" href="favicon.webp">');
    console.log('  在每个 HTML 的 <link rel="icon" type="image/png" href="favicon.png"> 之前');
    console.log();
    console.log(`  影响文件: ${refs.length} 个`);
    console.log();
    console.log('👉 运行 `node scripts/convert-favicon-to-webp.js --apply` 实际执行');
  } else {
    const changed = applyHtmlChanges(refs);
    console.log(`  ✓ 修改 ${changed} 个 HTML 文件`);
    console.log('  ✓ 请运行 `git diff` 查看变更');
  }
}

main().catch(e => { console.error(e); process.exit(1); });