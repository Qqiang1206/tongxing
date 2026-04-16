const fs = require('fs');
const path = require('path');

const baseDir = __dirname;

// 读取重命名日志
const renameLog = JSON.parse(fs.readFileSync(path.join(baseDir, 'rename-log.json'), 'utf8'));

// 构建替换映射
const replaceMap = {};
renameLog.forEach(item => {
    replaceMap[item.old] = item.new;
    replaceMap[item.folder + item.old] = item.folder + item.new;
});

console.log('=== 更新 HTML 中的图片引用 ===\n');

// 获取所有 HTML 文件
const htmlFiles = fs.readdirSync(baseDir).filter(f => f.endsWith('.html'));

let updated = 0;
let references = 0;

htmlFiles.forEach(htmlFile => {
    const filePath = path.join(baseDir, htmlFile);
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    
    // 替换图片引用
    Object.keys(replaceMap).forEach(oldName => {
        const newName = replaceMap[oldName];
        // 替换 src 和 href 属性中的引用
        const regex = new RegExp(oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        if (content.includes(oldName)) {
            content = content.replace(regex, newName);
        }
    });
    
    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        const count = (originalContent.match(new RegExp(Object.keys(replaceMap).join('|'), 'g')) || []).length;
        console.log(`[更新] ${htmlFile} (${count} 处引用)`);
        updated++;
        references += count;
    }
});

console.log(`\n=== 完成 ===`);
console.log(`更新文件: ${updated} 个`);
console.log(`更新引用: ${references} 处`);
