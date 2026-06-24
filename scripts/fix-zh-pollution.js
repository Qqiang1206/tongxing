// scripts/fix-zh-pollution.js
// 精准修复中文化污染
// dry-run 模式：只输出，不修改文件
// node scripts/fix-zh-pollution.js --dry-run   (默认)
// node scripts/fix-zh-pollution.js --apply     (实际修改)

const fs = require('fs');
const path = require('path');

const root = 'H:\\tongxing';
const dryRun = !process.argv.includes('--apply');

// ============================================================
// 替换规则
// ============================================================

// 类型 A: CSS class / JS 关键字（这些片段不会出现在正常中文文本，可以全局替换）
const typeAReplacements = [
  { search: /pl空调eholder/g, replace: 'placeholder', desc: 'data-header-placeholder 等' },
  { search: /b空调kdrop/g, replace: 'backdrop', desc: 'backdrop-blur-xl 等' },
  { search: /tr空调king/g, replace: 'tracking', desc: 'tracking-wide/widest 等' },
  { search: /sp空调e-/g, replace: 'space-', desc: 'space-x-12 / space-y-8 等' },
  { search: /font-bl空调k/g, replace: 'font-black', desc: 'font-black 类' },
  { search: /forE空调h/g, replace: 'forEach', desc: 'JS forEach 方法' },
  { search: /cont空调t/g, replace: 'contact', desc: 'contact.html 链接' },
];

// 类型 B: URL 链接污染（只在 href 和 src 属性内替换，避免误伤文本）
const typeBUrlMap = {
  '洗衣机-solution': 'washer-solution',
  '电容器-solution': 'capacitor-solution',
  '空调-solution': 'ac-solution',
  '微波炉-solution': 'microwave-solution',
  '咖啡机机-solution': 'coffee-solution',
  '咖啡机-solution': 'coffee-solution',
  '平板电脑电脑-solution': 'tablet-solution',
  '平板电脑-solution': 'tablet-solution',
  '车灯-solution': 'headlight-solution',
  '冰箱-solution': 'refrigerator-solution',
  '机器人-solution': 'robot-solution',
  'TV/comm-display-flex-line-solution': 'tv-display-solution',
  'TV/商业显示器柔性生产线-solution': 'tv-display-solution',
};

// ============================================================
// 执行
// ============================================================

const htmlFiles = fs.readdirSync(root).filter(f => f.endsWith('.html'));
let totalChanges = 0;
let totalFiles = 0;

console.log(dryRun ? '========== DRY RUN (不修改文件) ==========\n' : '========== APPLYING ==========\n');

for (const html of htmlFiles) {
  const fp = path.join(root, html);
  let content = fs.readFileSync(fp, 'utf-8');
  let original = content;
  const fileChanges = [];

  // ---- 类型 A: 全局替换（CSS class / JS 关键字）----
  for (const rule of typeAReplacements) {
    const matches = content.match(rule.search);
    if (matches && matches.length > 0) {
      fileChanges.push(`  [A] ${rule.desc}: ${matches.length} 处 → "${rule.replace}"`);
      content = content.replace(rule.search, rule.replace);
    }
  }

  // ---- 类型 B: 只在 href 和 src 属性内替换 URL ----
  const attrRegex = /(href|src)=(["'])([^"']+)\2/g;
  content = content.replace(attrRegex, (match, attr, quote, url) => {
    let newUrl = url;
    const appliedReplacements = [];
    for (const [zhKey, enVal] of Object.entries(typeBUrlMap)) {
      if (newUrl.includes(zhKey)) {
        newUrl = newUrl.split(zhKey).join(enVal);
        appliedReplacements.push(`${zhKey} → ${enVal}`);
      }
    }
    if (appliedReplacements.length > 0) {
      fileChanges.push(`  [B] ${attr}="${url}" → ${attr}="${newUrl}"`);
      return `${attr}=${quote}${newUrl}${quote}`;
    }
    return match;
  });

  // 统计
  const changes = (content.match(/placeholder|backdrop|tracking|space-|font-black|forEach|contact\.html/g) || []).length;
  if (fileChanges.length > 0) {
    totalFiles++;
    totalChanges += fileChanges.length;
    console.log(`📄 ${html} (${fileChanges.length} 处修改):`);
    fileChanges.forEach(c => console.log(c));
    console.log();

    if (!dryRun) {
      fs.writeFileSync(fp, content, 'utf-8');
    }
  }
}

console.log('========== 总结 ==========');
console.log(`模式: ${dryRun ? 'DRY RUN (未修改)' : 'APPLIED (已修改)'}`);
console.log(`影响文件: ${totalFiles} 个`);
console.log(`修改次数: ${totalChanges} 处`);
console.log();
if (dryRun) {
  console.log('👉 如果输出符合预期，运行 `node scripts/fix-zh-pollution.js --apply` 实际执行');
} else {
  console.log('✅ 已修改。请运行 `git diff` 查看变更。');
}