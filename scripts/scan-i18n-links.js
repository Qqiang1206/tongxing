// scripts/scan-i18n-links.js
// 扫描所有三语版本里错误的跨语言链接
const fs = require('fs');
const path = require('path');

const root = 'H:\\tongxing';

function scan(htmlPath, sourceLang) {
    const content = fs.readFileSync(htmlPath, 'utf-8');
    const issues = [];

    // 提取所有内部 .html 链接
    const linkRegex = /href=["']([^"'#]+\.html)(#[^"']*)?["']/g;
    let m;
    while ((m = linkRegex.exec(content))) {
        const link = m[1];
        // 跳过外部链接和锚点
        if (link.startsWith('http') || link.startsWith('mailto:') || link.startsWith('/')) continue;
        // 跳过语言切换链接（这是合理的：index-en.html 链接到 index.html 让用户切换语言）
        // 但是其他内部链接应该匹配当前语言

        const fileBase = path.basename(link);
        const isEnLink = fileBase.endsWith('-en.html');
        const isRuLink = fileBase.endsWith('-ru.html');
        const isZhLink = !isEnLink && !isRuLink && fileBase.endsWith('.html');

        if (sourceLang === 'en' && isZhLink && !fileBase.startsWith('solutions-detail')) {
            // 英文版页面指向中文版（除了语言切换链接）
            issues.push({ file: htmlPath, link, type: 'en→zh' });
        } else if (sourceLang === 'ru' && isZhLink && !fileBase.startsWith('solutions-detail')) {
            issues.push({ file: htmlPath, link, type: 'ru→zh' });
        }
    }
    return issues;
}

function main() {
    const htmlFiles = fs.readdirSync(root).filter(f => f.endsWith('.html'));
    const issues = [];

    for (const html of htmlFiles) {
        let lang;
        if (html.endsWith('-en.html')) lang = 'en';
        else if (html.endsWith('-ru.html')) lang = 'ru';
        else lang = 'zh';

        const fp = path.join(root, html);
        const fileIssues = scan(fp, lang);
        issues.push(...fileIssues);
    }

    // 按文件统计
    const byFile = {};
    for (const i of issues) {
        const fname = path.basename(i.file);
        if (!byFile[fname]) byFile[fname] = [];
        byFile[fname].push({ link: i.link, type: i.type });
    }

    console.log(`总问题数: ${issues.length}`);
    console.log(`影响文件: ${Object.keys(byFile).length}`);
    console.log();

    // 按文件统计 top
    const sorted = Object.entries(byFile).sort((a, b) => b[1].length - a[1].length);
    for (const [f, items] of sorted.slice(0, 20)) {
        console.log(`  ${items.length} 处  ${f}`);
        for (const item of items.slice(0, 3)) {
            console.log(`     [${item.type}] ${item.link}`);
        }
        if (items.length > 3) console.log(`     ... 还有 ${items.length - 3} 处`);
    }
}

main();