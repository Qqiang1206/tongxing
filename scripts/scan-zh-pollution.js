// scripts/scan-zh-pollution.js
// 扫描整个项目里的"中文化污染"——中文出现在不该出现的位置（CSS class、URL、JS 关键字）
const fs = require('fs');
const path = require('path');

const root = 'H:\\tongxing';
const htmlFiles = fs.readdirSync(root).filter(f => f.endsWith('.html'));

const issues = [];

for (const html of htmlFiles) {
  const content = fs.readFileSync(path.join(root, html), 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    // 1. CSS class 名里有中文
    const classMatch = line.match(/class=["']([^"']+)["']/g);
    if (classMatch) {
      for (const m of classMatch) {
        const cls = m.slice(6, -1);
        if (/[\u4e00-\u9fff]/.test(cls)) {
          // 提取出含中文的 token
          const tokens = cls.split(/\s+/);
          for (const t of tokens) {
            if (/[\u4e00-\u9fff]/.test(t)) {
              issues.push({ file: html, line: idx + 1, type: 'CLASS', content: t, context: line.trim() });
            }
          }
        }
      }
    }

    // 2. href / src 里有中文
    const hrefMatch = line.match(/(href|src)=["']([^"']+)["']/g);
    if (hrefMatch) {
      for (const m of hrefMatch) {
        const url = m.match(/["']([^"']+)["']/)[1];
        if (/[\u4e00-\u9fff]/.test(url) && !/\.(svg|png|jpg|jpeg|webp|gif)$/i.test(url)) {
          issues.push({ file: html, line: idx + 1, type: 'URL', content: url, context: line.trim() });
        }
      }
    }

    // 3. JS 关键字 / 方法名里有中文
    const jsMethods = ['forEach', 'backdrop', 'tracking', 'space', 'black', 'placeholder', 'contact'];
    for (const m of jsMethods) {
      const zhVersion = {
        'forEach': 'forE空调h',
        'backdrop': 'b空调kdrop',
        'tracking': 'tr空调king',
        'space-x': 'sp空调e-x',
        'space-y': 'sp空调e-y',
        'font-black': 'font-bl空调k',
        'placeholder': 'pl空调eholder',
        'contact': 'cont空调t'
      };
      // 检查这些被污染的字符串
      const patterns = [
        'forE空调h', 'b空调kdrop', 'tr空调king', 'sp空调e-',
        'font-bl空调k', 'pl空调eholder', 'cont空调t'
      ];
      for (const p of patterns) {
        if (line.includes(p)) {
          issues.push({ file: html, line: idx + 1, type: 'JS/CLASS污染', content: p, context: line.trim() });
          break;
        }
      }
    }
  });
}

// 按文件统计
const byFile = {};
for (const i of issues) byFile[i.file] = (byFile[i.file] || 0) + 1;

console.log('========== 中文化污染扫描结果 ==========');
console.log(`总污染数: ${issues.length}`);
console.log(`影响文件: ${Object.keys(byFile).length} 个`);
console.log('\n按文件统计:');
for (const [f, c] of Object.entries(byFile).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${c.toString().padStart(4)} 处  ${f}`);
}

console.log('\n========== 详情（每文件最多 5 个） ==========');
const byFileArr = {};
for (const i of issues) {
  if (!byFileArr[i.file]) byFileArr[i.file] = [];
  byFileArr[i.file].push(i);
}
for (const [f, items] of Object.entries(byFileArr).sort((a, b) => b[1].length - a[1].length).slice(0, 10)) {
  console.log(`\n📄 ${f} (${items.length} 处)`);
  for (const item of items.slice(0, 5)) {
    console.log(`  L${item.line} [${item.type}] ${item.content}`);
    console.log(`     ${item.context.slice(0, 100)}`);
  }
  if (items.length > 5) console.log(`  ... 还有 ${items.length - 5} 处`);
}