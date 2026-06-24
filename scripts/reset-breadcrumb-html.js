// scripts/reset-breadcrumb-html.js
// 把所有方案详情页的面包屑 HTML 改成空容器，让 footer.js 完全渲染
const fs = require('fs');
const path = require('path');

const root = 'H:\\tongxing';
const dryRun = !process.argv.includes('--apply');

const newBreadcrumb = `<nav class="breadcrumb text-sm text-[#86868B] mb-8 flex items-center flex-wrap" aria-label="面包屑" data-breadcrumb></nav>`;

// 匹配旧的多层结构（最多 8 行）
const oldRegex = /<nav class="breadcrumb[\s\S]*?data-breadcrumb>[\s\S]*?<\/nav>/;

const targets = [
  'ac-solution.html', 'capacitor-solution.html', 'coffee-solution.html',
  'headlight-solution.html', 'microwave-solution.html', 'packaging-solution.html',
  'refrigerator-solution.html', 'robot-solution.html', 'tablet-solution.html',
  'washer-solution.html', 'tv-display-solution.html',
];

function main() {
  console.log(dryRun ? '========== DRY RUN ==========' : '========== APPLYING ==========');
  console.log();

  let totalFixed = 0;
  for (const html of targets) {
    const fp = path.join(root, html);
    if (!fs.existsSync(fp)) continue;

    let content = fs.readFileSync(fp, 'utf-8');
    const before = content;
    content = content.replace(oldRegex, newBreadcrumb);
    if (content !== before) {
      console.log(`  ${html}: 已更新为空容器`);
      totalFixed++;
      if (!dryRun) {
        fs.writeFileSync(fp, content, 'utf-8');
      }
    } else {
      console.log(`  ${html}: 未找到旧结构，跳过`);
    }
  }
  console.log();
  console.log(`总计: ${totalFixed} 个文件`);
  if (dryRun) {
    console.log('👉 运行 `node scripts/reset-breadcrumb-html.js --apply` 实际执行');
  } else {
    console.log('✓ 已修改');
  }
}

main();