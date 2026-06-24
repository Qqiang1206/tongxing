// scripts/fix-tv-comm-display.js
// 把方案详情页"相关解决方案"区里的 TV/comm-display-flex-line 英文标题改成中文
const fs = require('fs');
const path = require('path');

const root = 'H:\\tongxing';
const dryRun = !process.argv.includes('--apply');

const targets = [
  'capacitor-solution.html', 'headlight-solution.html', 'microwave-solution.html',
  'packaging-solution.html', 'refrigerator-solution.html', 'robot-solution.html',
  'washer-solution.html'
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
    content = content.replace(/>TV\/comm-display-flex-line</g, '>TV/商业显示器柔性装配产线<');
    if (content !== before) {
      const matches = (before.match(/>TV\/comm-display-flex-line</g) || []).length;
      console.log(`  ${html}: ${matches} 处`);
      totalFixed += matches;
      if (!dryRun) {
        fs.writeFileSync(fp, content, 'utf-8');
      }
    }
  }

  console.log();
  console.log(`总计: ${totalFixed} 处`);
  if (dryRun) {
    console.log('👉 运行 `node scripts/fix-tv-comm-display.js --apply` 实际执行');
  } else {
    console.log('✓ 已修改');
  }
}

main();