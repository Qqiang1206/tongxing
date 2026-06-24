// scripts/demo-breadcrumb.js
// 在 tv-display-solution.html 上 demo 新的面包屑
const fs = require('fs');
const path = require('path');

const target = path.join('H:', 'tongxing', 'tv-display-solution.html');
let content = fs.readFileSync(target, 'utf-8');

// 用 regex 匹配整段（容忍空行和 CRLF）
const oldRegex = /<a href="solutions\.html" class="inline-flex items-center text-\[#86868B\] hover:text-\[#FF6B00\] transition-colors mb-8">\s*<svg[\s\S]*?<\/svg>\s*返回解决方案\s*<\/a>/;

const newText = `<nav class="breadcrumb text-sm text-[#86868B] mb-8 flex items-center flex-wrap" aria-label="面包屑" data-breadcrumb>
                <a href="index.html" class="hover:text-[#FF6B00] transition-colors">首页</a>
                <span class="mx-2 text-[#C7C7CC]">›</span>
                <span data-breadcrumb-insert></span>
                <a href="solutions.html" class="hover:text-[#FF6B00] transition-colors">解决方案</a>
                <span class="mx-2 text-[#C7C7CC]">›</span>
                <span class="text-[#1D1D1F] font-medium">TV/商业显示器柔性生产线</span>
            </nav>`;

if (!oldRegex.test(content)) {
  console.log('ERROR: regex not matched');
  process.exit(1);
}

content = content.replace(oldRegex, newText);
fs.writeFileSync(target, content, 'utf-8');
console.log('✓ tv-display-solution.html: 面包屑已替换');