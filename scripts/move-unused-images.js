// scripts/move-unused-images.js
// 把所有未被 HTML 引用的图片移到 _unused-images/
// - 完全未引用的（100% 不被下载）
// - 有 webp 替代的 fallback PNG/JPG（99.99% 不被下载）
const fs = require('fs');
const path = require('path');

const root = 'H:\\tongxing';
const dryRun = !process.argv.includes('--apply');

function scanHtmlReferences() {
  const htmlFiles = fs.readdirSync(root).filter(f => f.endsWith('.html'));
  const refs = new Map(); // base name -> set<exts referenced>
  const referencedRelative = new Set();
  for (const html of htmlFiles) {
    const content = fs.readFileSync(path.join(root, html), 'utf-8');
    const collect = (regex) => {
      for (const m of content.matchAll(regex)) {
        const ref = m[1].replace(/\\/g, '/');
        referencedRelative.add(ref);
        const base = path.basename(ref).replace(/\.(jpe?g|png|webp|svg|gif)$/i, '');
        const ext = path.extname(ref).toLowerCase();
        if (!refs.has(base)) refs.set(base, new Set());
        refs.get(base).add(ext);
      }
    };
    collect(/src=["']([^"']+\.(jpe?g|png|webp|svg|gif))["']/gi);
    collect(/srcset=["']([^"']+\.(jpe?g|png|webp|svg|gif))["']/gi);
    collect(/href=["']([^"']+\.(jpe?g|png|webp|svg|gif))["']/gi);
    collect(/image:\s*['"]([^'"]+\.(jpe?g|png|webp|svg|gif))['"]/gi);
    collect(/cover:\s*['"]([^'"]+\.(jpe?g|png|webp|svg|gif))['"]/gi);
    collect(/content=["']([^'"]+\.(jpe?g|png|webp|svg|gif))["']/gi);
  }
  return { refs, referencedRelative };
}

function classifyImages() {
  const { refs, referencedRelative } = scanHtmlReferences();
  const dirs = ['solutions', 'products', 'certifications', 'client-logos'];
  const candidates = { totallyUnused: [], fallback: [], directRef: [] };

  function walk(p) {
    for (const item of fs.readdirSync(p, { withFileTypes: true })) {
      const fp = path.join(p, item.name);
      if (item.isDirectory()) walk(fp);
      else if (/\.(jpe?g|png)$/i.test(item.name)) {
        const rel = path.relative(root, fp).replace(/\\/g, '/');
        const ext = path.extname(rel).toLowerCase();
        const base = path.basename(rel).replace(/\.(jpe?g|png|webp)$/i, '');
        const referencedExts = refs.get(base) || new Set();

        if (!referencedRelative.has(rel)) {
          // 完全未引用
          candidates.totallyUnused.push({ rel, size: fs.statSync(fp).size });
        } else if (referencedExts.has('.webp')) {
          // 有 webp 替代 + 当前文件被引用 (作为 fallback)
          // 检查实际是否真在 <picture> 标签里被引用为 fallback
          // 简化：只要有 webp 且引用了同名 png/jpg，就算 fallback
          candidates.fallback.push({ rel, size: fs.statSync(fp).size });
        } else {
          candidates.directRef.push({ rel, size: fs.statSync(fp).size });
        }
      }
    }
  }
  for (const d of dirs) {
    const fp = path.join(root, d);
    if (fs.existsSync(fp)) walk(fp);
  }
  return candidates;
}

function moveFile(rel) {
  const src = path.join(root, rel);
  const dst = path.join(root, '_unused-images', rel);
  const dstDir = path.dirname(dst);
  fs.mkdirSync(dstDir, { recursive: true });
  fs.renameSync(src, dst);
}

function main() {
  console.log(dryRun ? '========== DRY RUN ==========' : '========== APPLYING ==========');
  console.log();

  const candidates = classifyImages();
  const totalBytes = (arr) => arr.reduce((s, i) => s + i.size, 0);

  console.log('扫描结果:');
  console.log(`  完全未引用: ${candidates.totallyUnused.length} 个, ${(totalBytes(candidates.totallyUnused)/1024/1024).toFixed(2)} MB`);
  console.log(`  Fallback (有 webp 替代): ${candidates.fallback.length} 个, ${(totalBytes(candidates.fallback)/1024/1024).toFixed(2)} MB`);
  console.log(`  直接引用 (保留): ${candidates.directRef.length} 个, ${(totalBytes(candidates.directRef)/1024/1024).toFixed(2)} MB`);
  console.log();

  const toMove = [...candidates.totallyUnused, ...candidates.fallback];
  console.log(`将移动到 _unused-images/: ${toMove.length} 个, ${(totalBytes(toMove)/1024/1024).toFixed(2)} MB`);
  console.log();

  // Top 20 by size
  toMove.sort((a, b) => b.size - a.size);
  console.log('Top 20 (按大小):');
  for (const item of toMove.slice(0, 20)) {
    console.log(`  ${(item.size/1024).toFixed(1).padStart(10)} KB  ${item.rel}`);
  }
  console.log();

  if (dryRun) {
    console.log('👉 运行 `node scripts/move-unused-images.js --apply` 实际执行');
  } else {
    let moved = 0, totalSaved = 0;
    for (const item of toMove) {
      try {
        moveFile(item.rel);
        moved++;
        totalSaved += item.size;
      } catch (e) {
        console.error(`❌ 移动失败: ${item.rel}: ${e.message}`);
      }
    }
    console.log(`✓ 移动 ${moved} 个文件，节省 ${(totalSaved/1024/1024).toFixed(2)} MB`);
    console.log('  请运行 git status 确认');
  }
}

main();