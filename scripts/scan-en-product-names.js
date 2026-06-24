// scripts/scan-en-product-names.js
// 扫描所有方案详情页"相关解决方案"区域的英文产品名残留
const fs = require('fs');
const path = require('path');

const root = 'H:\\tongxing';

// 中英文映射
const enToZh = {
  'refrigerator': '冰箱',
  'washer': '洗衣机',
  'coffee': '咖啡机',
  'headlight': '车灯',
  'microwave': '微波炉',
  'capacitor': '电容器',
  'tablet': '平板电脑',
  'tv-display': 'TV/商业显示器',
  'robot': '机器人',
  'pkg-logistics': '包装与物流',
  'ac': '空调',
};

function main() {
  const htmlFiles = fs.readdirSync(root).filter(f => f.endsWith('.html') && !f.includes('-en') && !f.includes('-ru'));
  const issues = [];

  for (const html of htmlFiles) {
    const content = fs.readFileSync(path.join(root, html), 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      // 1. 扫 alt="<en-name>"
      const altMatch = line.match(/alt=["']([^"']+)["']/g);
      if (altMatch) {
        for (const m of altMatch) {
          const alt = m.match(/["']([^"']+)["']/)[1];
          for (const [en, zh] of Object.entries(enToZh)) {
            // 检查 alt 里是不是纯英文产品名（单词或带连字符的）
            const re = new RegExp(`(^|[^a-z])${en}([^a-z]|$)`, 'i');
            if (re.test(alt) && !alt.includes(zh) && alt.toLowerCase().includes(en)) {
              issues.push({ file: html, line: idx + 1, type: 'alt', content: alt, fix: `alt="${zh}"` });
            }
          }
        }
      }

      // 2. 扫 h2/h3/h4/p/span/div 等可见文本里的英文产品名
      // 匹配: <h2>...en-name...</h2> 或 <p>...en-name...</p>
      const textMatch = line.match(/<(h[1-6]|p|span|li|div)[^>]*>([^<]+)<\/\1>/g);
      if (textMatch) {
        for (const m of textMatch) {
          const text = m.match(/>([^<]+)</)[1];
          for (const [en, zh] of Object.entries(enToZh)) {
            // 检查是否包含纯英文产品名（单词边界）
            const re = new RegExp(`\\b${en}\\b`, 'i');
            // 排除 URL 和路径
            if (re.test(text) && !text.includes(zh) && !/^[a-z\.\/\-_]+$/i.test(text.trim())) {
              issues.push({ file: html, line: idx + 1, type: 'text', content: m.slice(0, 200), fix: `替换 ${en} → ${zh}` });
            }
          }
        }
      }

      // 3. 扫 HTML 注释里的英文产品名
      const commentMatch = line.match(/<!--(.+?)-->/g);
      if (commentMatch) {
        for (const m of commentMatch) {
          const text = m.slice(4, -3);
          for (const [en, zh] of Object.entries(enToZh)) {
            const re = new RegExp(`\\b${en}\\b`, 'i');
            if (re.test(text) && !text.includes(zh)) {
              issues.push({ file: html, line: idx + 1, type: 'comment', content: m.slice(0, 200), fix: `替换 ${en} → ${zh}` });
            }
          }
        }
      }
    });
  }

  console.log(`========== 英文产品名残留扫描 ==========`);
  console.log(`总问题数: ${issues.length}`);
  console.log();

  // 按文件统计
  const byFile = {};
  for (const i of issues) {
    if (!byFile[i.file]) byFile[i.file] = [];
    byFile[i.file].push(i);
  }
  console.log('按文件统计:');
  for (const [f, items] of Object.entries(byFile).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${items.length} 处  ${f}`);
  }
  console.log();

  // 显示每个文件的问题
  console.log('========== 详情 ==========');
  for (const [f, items] of Object.entries(byFile).sort((a, b) => b[1].length - a[1].length).slice(0, 20)) {
    console.log(`\n📄 ${f} (${items.length} 处)`);
    for (const item of items.slice(0, 5)) {
      console.log(`  L${item.line} [${item.type}] ${item.fix}`);
      console.log(`     ${item.content}`);
    }
    if (items.length > 5) console.log(`  ... 还有 ${items.length - 5} 处`);
  }
}

main();