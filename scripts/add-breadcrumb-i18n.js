// scripts/add-breadcrumb-i18n.js
// 给英文版/俄文版方案详情页添加面包屑容器
// 替换原来的 "Back to Solutions" / "Назад к решениям" 返回链接

const fs = require('fs');
const path = require('path');

const ROOT = 'H:\\tongxing';

// 找到所有英文版/俄文版方案详情页
function getTargetFiles() {
    return fs.readdirSync(ROOT)
        .filter(f => /-solution-(en|ru)\.html$/.test(f))
        .map(f => path.join(ROOT, f));
}

// 匹配两种排版格式的"返回链接"
// 注意：SVG 里可能有 <path/>，所以 SVG 内容用 [\s\S]*? 非贪婪匹配
const PATTERN = /<a href="solutions-(en|ru)\.html"[^>]*>\s*<svg[\s\S]*?<\/svg>\s*(?:Back to Solutions|Назад к решениям)\s*<\/a>/g;

function getBreadcrumbHtml(lang) {
    const ariaLabel = lang === 'en' ? 'Breadcrumb' : 'Хлебные крошки';
    return `<nav class="breadcrumb text-sm text-[#86868B] mb-8 flex items-center flex-wrap" aria-label="${ariaLabel}" data-breadcrumb></nav>`;
}

function fixFile(filepath, dryRun = false) {
    const filename = path.basename(filepath);
    const langMatch = filename.match(/-(en|ru)\.html$/);
    const lang = langMatch[1];

    let content = fs.readFileSync(filepath, 'utf-8');
    const matches = [...content.matchAll(PATTERN)];

    if (matches.length === 0) {
        return { file: filename, matches: 0, action: 'no-match' };
    }

    if (dryRun) {
        return { file: filename, matches: matches.length, action: 'would-replace' };
    }

    const replacement = getBreadcrumbHtml(lang);
    const newContent = content.replace(PATTERN, replacement);
    fs.writeFileSync(filepath, newContent, 'utf-8');
    return { file: filename, matches: matches.length, action: 'replaced' };
}

function main() {
    const args = process.argv.slice(2);
    const dryRun = !args.includes('--apply');

    if (dryRun) {
        console.log('===== DRY-RUN: 给英文/俄文版方案详情页添加面包屑 =====\n');
        console.log('使用 --apply 参数真正修改文件\n');
    } else {
        console.log('===== APPLY: 给英文/俄文版方案详情页添加面包屑 =====\n');
    }

    const files = getTargetFiles();
    let totalMatches = 0;
    let totalReplaced = 0;

    for (const filepath of files) {
        const result = fixFile(filepath, dryRun);
        totalMatches += result.matches;
        if (result.action === 'replaced') totalReplaced++;

        if (result.matches > 0) {
            const lang = result.file.match(/-(en|ru)\.html$/)[1];
            console.log(`  [${lang}] ${result.file}: ${result.matches} 处 ${dryRun ? '(待替换)' : '已替换'}`);
        } else {
            console.log(`  [SKIP] ${result.file}: 无匹配 (可能已经有面包屑?)`);
        }
    }

    console.log();
    console.log(`总计: ${totalReplaced}/${files.length} 文件有改动`);
    console.log(`修改数: ${totalMatches} 处`);
}

main();