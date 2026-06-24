// scripts/fix-en-product-names.js
// 把中文版 HTML 里的英文产品名替换为中文
// 只在文本节点 (alt / h*/p/div 文本) 和 HTML 注释里替换
// 不动 src/href 里的 URL 路径
const fs = require('fs');
const path = require('path');

const root = 'H:\\tongxing';
const dryRun = !process.argv.includes('--apply');

// 替换规则（长的优先，避免 coffee + 机 → 咖啡机机的重复）
const rules = [
  { from: /coffee机/g, to: '咖啡机' },
  { from: /tablet电脑/g, to: '平板电脑' },
  // 普通产品名映射
  { from: /\brefrigerator\b/g, to: '冰箱' },
  { from: /\bwasher\b/g, to: '洗衣机' },
  { from: /\bcoffee\b/g, to: '咖啡机' },
  { from: /\bheadlight\b/g, to: '车灯' },
  { from: /\bmicrowave\b/g, to: '微波炉' },
  { from: /\bcapacitor\b/g, to: '电容器' },
  { from: /\btablet\b/g, to: '平板电脑' },
  { from: /\btv-display\b/g, to: 'TV/商业显示器' },
  { from: /\brobot\b/g, to: '机器人' },
  { from: /\bpkg-logistics\b/g, to: '包装与物流' },
  { from: /\bac\b/g, to: '空调' },
];

function fixAlt(content) {
  return content.replace(/alt="([^"]+)"/g, (m, inner) => {
    let newInner = inner;
    for (const { from, to } of rules) {
      newInner = newInner.replace(from, to);
    }
    if (newInner !== inner) return `alt="${newInner}"`;
    return m;
  });
}

function fixComment(content) {
  // <!-- (空格可选) 方案 X：英文产品名生产线 -->
  return content.replace(/<!--\s*(方案\s*\d+：)([^<>]+?)-->/g, (m, prefix, name) => {
    let newName = name;
    for (const { from, to } of rules) {
      newName = newName.replace(from, to);
    }
    if (newName !== name) return `<!-- ${prefix}${newName}-->`;
    return m;
  });
}

function fixTextInHTML(content) {
  // 只在文本节点 (>...<之间) 替换，不在属性引号内
  return content.replace(/>([^<]+)</g, (m, text) => {
    let newText = text;
    for (const { from, to } of rules) {
      newText = newText.replace(from, to);
    }
    if (newText !== text) return `>${newText}<`;
    return m;
  });
}

function fix(content) {
  let result = content;
  result = fixAlt(result);
  result = fixComment(result);
  result = fixTextInHTML(result);
  return result;
}

function main() {
  console.log(dryRun ? '========== DRY RUN ==========' : '========== APPLYING ==========');
  console.log();

  // 只处理中文版（不带 -en/-ru）
  const targets = fs.readdirSync(root).filter(f =>
    f.endsWith('.html') && !f.includes('-en') && !f.includes('-ru')
  );

  let totalChanges = 0;
  const fileChanges = [];

  for (const html of targets) {
    const fp = path.join(root, html);
    const original = fs.readFileSync(fp, 'utf-8');
    const fixed = fix(original);

    if (fixed !== original) {
      // 统计替换次数（简单数行/字符差异）
      const changes = countChanges(original, fixed);
      fileChanges.push({ file: html, changes });
      totalChanges += changes;
      if (!dryRun) {
        fs.writeFileSync(fp, fixed, 'utf-8');
      }
    }
  }

  console.log('修改文件:');
  for (const { file, changes } of fileChanges) {
    console.log(`  ${changes} 处  ${file}`);
  }
  console.log();
  console.log(`总计: ${totalChanges} 处替换`);

  if (dryRun) {
    console.log();
    console.log('👉 运行 `node scripts/fix-en-product-names.js --apply` 实际执行');
  } else {
    console.log('✓ 已修改。请运行 `git diff` 查看变更');
  }
}

function countChanges(original, fixed) {
  // 简单数修改的行数（每个修改至少影响一行）
  const origLines = original.split('\n');
  const fixedLines = fixed.split('\n');
  let count = 0;
  for (let i = 0; i < Math.max(origLines.length, fixedLines.length); i++) {
    if (origLines[i] !== fixedLines[i]) count++;
  }
  return count;
}

main();