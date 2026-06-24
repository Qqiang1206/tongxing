// scripts/apply-breadcrumb-all.js
// 把面包屑 HTML 批量应用到所有 11 个方案详情页
const fs = require('fs');
const path = require('path');

const root = 'H:\\tongxing';
const dryRun = !process.argv.includes('--apply');

// 方案文件名 -> 当前页面中文名
const schemeNames = {
  'ac-solution.html': '空调生产线',
  'capacitor-solution.html': '电容器生产线',
  'coffee-solution.html': '咖啡机生产线',
  'headlight-solution.html': '车灯生产线',
  'microwave-solution.html': '微波炉生产线',
  'packaging-solution.html': '包装与物流自动化产线',
  'refrigerator-solution.html': '冰箱生产线',
  'robot-solution.html': '机器人单元',
  'tablet-solution.html': '平板电脑生产线',
  'washer-solution.html': '洗衣机生产线',
  'tv-display-solution.html': 'TV/商业显示器柔性生产线',  // 已改
};

function makeBreadcrumb(currentPageName) {
  return `<nav class="breadcrumb text-sm text-[#86868B] mb-8 flex items-center flex-wrap" aria-label="面包屑" data-breadcrumb>
                <a href="index.html" class="hover:text-[#FF6B00] transition-colors">首页</a>
                <span class="mx-2 text-[#C7C7CC]">›</span>
                <span data-breadcrumb-insert></span>
                <span class="text-[#1D1D1F] font-medium">${currentPageName}</span>
            </nav>`;
}

// 匹配旧的"返回解决方案"按钮（容忍 CRLF 和空行）
const oldRegex = /<a href="solutions\.html" class="inline-flex items-center text-\[#86868B\] hover:text-\[#FF6B00\] transition-colors mb-8">\s*<svg[\s\S]*?<\/svg>\s*返回解决方案\s*<\/a>/;

function main() {
  console.log(dryRun ? '========== DRY RUN ==========' : '========== APPLYING ==========');
  console.log();

  let totalFixed = 0;
  for (const [html, currentPageName] of Object.entries(schemeNames)) {
    const fp = path.join(root, html);
    if (!fs.existsSync(fp)) {
      console.log(`  ${html}: 不存在，跳过`);
      continue;
    }

    let content = fs.readFileSync(fp, 'utf-8');

    // 已改过？检查 data-breadcrumb 是否存在
    if (content.includes('data-breadcrumb')) {
      console.log(`  ${html}: 已包含面包屑，跳过`);
      continue;
    }

    if (!oldRegex.test(content)) {
      console.log(`  ${html}: 未找到旧的"返回解决方案"按钮，跳过`);
      continue;
    }

    const newBreadcrumb = makeBreadcrumb(currentPageName);
    content = content.replace(oldRegex, newBreadcrumb);
    console.log(`  ${html}: ${currentPageName} ✓`);
    totalFixed++;

    if (!dryRun) {
      fs.writeFileSync(fp, content, 'utf-8');
    }
  }

  console.log();
  console.log(`总计: ${totalFixed} 个文件`);
  if (dryRun) {
    console.log('👉 运行 `node scripts/apply-breadcrumb-all.js --apply` 实际执行');
  } else {
    console.log('✓ 已修改');
  }
}

main();