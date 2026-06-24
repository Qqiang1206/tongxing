// scripts/fix-i18n-links.js
// 自动修复三语版本里的跨语言链接
// 规则：对 x-en.html / x-ru.html 里 href="y.html"，如果 y-en.html / y-ru.html 存在，
//       就替换为同语言版本。但排除"语言切换链接"（用户在英文版里点切换到中文版）。

const fs = require('fs');
const path = require('path');

const ROOT = 'H:\\tongxing';

// ===== 列出所有 HTML 文件名（含三语） =====
function listAllHtmlFiles() {
    return fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
}

const allHtml = listAllHtmlFiles();

// ===== 构建"基础名 -> 三语版本"映射 =====
// 例: { 'index': { zh: 'index.html', en: 'index-en.html', ru: 'index-ru.html' }, ... }
function buildLangMap() {
    const map = {};
    for (const file of allHtml) {
        let base, lang;
        if (file.endsWith('-en.html')) {
            base = file.replace(/-en\.html$/, '');
            lang = 'en';
        } else if (file.endsWith('-ru.html')) {
            base = file.replace(/-ru\.html$/, '');
            lang = 'ru';
        } else {
            base = file.replace(/\.html$/, '');
            lang = 'zh';
        }
        if (!map[base]) map[base] = {};
        map[base][lang] = file;
    }
    return map;
}

const langMap = buildLangMap();

// ===== 检测文件语言 =====
function detectLang(filename) {
    if (filename.endsWith('-en.html')) return 'en';
    if (filename.endsWith('-ru.html')) return 'ru';
    return 'zh';
}

// ===== 修复单个文件，返回 { changes: [...], skipped: [...] } =====
function fixFile(filename) {
    const lang = detectLang(filename);
    if (lang === 'zh') return { changes: [], skipped: [] };  // 中文版不需要修

    const filepath = path.join(ROOT, filename);
    let content = fs.readFileSync(filepath, 'utf-8');
    const changes = [];
    const skipped = [];

    // 提取所有 href="..."，找出 .html 内部链接
    const linkRegex = /href=["']([^"'#?]+\.html)([^"']*)["']/g;
    let m;
    const replacements = [];

    while ((m = linkRegex.exec(content))) {
        const fullMatch = m[0];
        const linkPath = m[1];
        const tail = m[2]; // 锚点或查询参数

        // 跳过绝对路径、外部链接
        if (linkPath.startsWith('http') || linkPath.startsWith('mailto:') || linkPath.startsWith('/')) continue;

        const linkFile = path.basename(linkPath);

        // ===== 例外规则：同 base 名的链接是语言切换 =====
        // 例如 about-en.html 里的 about.html / about-ru.html 都是语言切换（让用户切到中/俄版关于页）
        const currentBase = filename.replace(/-(en|ru)\.html$/, '').replace(/\.html$/, '');
        const linkBase = linkFile.replace(/-(en|ru)\.html$/, '').replace(/\.html$/, '');
        if (currentBase === linkBase) {
            // 是同 base 的不同语言版本 → 语言切换链接，保留
            skipped.push({ link: linkPath, reason: 'language-switcher' });
            continue;
        }

        // 提取基础名
        let base;
        if (linkFile.endsWith('-en.html')) base = linkFile.replace(/-en\.html$/, '');
        else if (linkFile.endsWith('-ru.html')) base = linkFile.replace(/-ru\.html$/, '');
        else base = linkFile.replace(/\.html$/, '');

        // 已经是对的语言，跳过
        if (linkFile.endsWith(`-${lang}.html`)) continue;

        // 看 langMap[base] 有没有当前语言版本
        const targetFile = langMap[base] && langMap[base][lang];
        if (!targetFile) {
            skipped.push({ link: linkPath, reason: 'no-' + lang + '-version' });
            continue;
        }

        const dir = path.dirname(linkPath);
        const newLinkPath = dir && dir !== '.' ? path.join(dir, targetFile).replace(/\\/g, '/') : targetFile;
        const newFullMatch = `href="${newLinkPath}${tail}"`;
        replacements.push({
            old: fullMatch,
            new: newFullMatch,
            oldLink: linkPath,
            newLink: newLinkPath,
            index: m.index
        });
    }

    // 应用替换（从后往前，避免 index 错位）
    for (let i = replacements.length - 1; i >= 0; i--) {
        const r = replacements[i];
        if (content.includes(r.old)) {
            content = content.replace(r.old, r.new);
            changes.push({ from: r.oldLink, to: r.newLink });
        }
    }

    if (changes.length > 0) {
        fs.writeFileSync(filepath, content, 'utf-8');
    }

    return { changes, skipped };
}

// ===== 主流程 =====
function main() {
    const args = process.argv.slice(2);
    const dryRun = !args.includes('--apply');

    if (dryRun) {
        console.log('===== DRY-RUN 模式 =====');
        console.log('使用 --apply 参数真正修改文件');
        console.log();
    } else {
        console.log('===== APPLY 模式 =====');
    }

    let totalChanges = 0;
    let totalFiles = 0;
    const byFile = {};

    for (const file of allHtml.sort()) {
        if (detectLang(file) === 'zh') continue;
        if (dryRun) {
            // dry-run 模式：复制文件读但不写
            const filepath = path.join(ROOT, file);
            let content = fs.readFileSync(filepath, 'utf-8');
            const linkRegex = /href=["']([^"'#?]+\.html)([^"']*)["']/g;
            let m;
            const changes = [];
            while ((m = linkRegex.exec(content))) {
                const linkPath = m[1];
                const linkFile = path.basename(linkPath);
                if (linkFile.startsWith('http')) continue;

                // 例外规则：同 base 名的链接是语言切换
                const currentBase = file.replace(/-(en|ru)\.html$/, '').replace(/\.html$/, '');
                const linkBase = linkFile.replace(/-(en|ru)\.html$/, '').replace(/\.html$/, '');
                if (currentBase === linkBase) continue;

                let base;
                if (linkFile.endsWith('-en.html')) base = linkFile.replace(/-en\.html$/, '');
                else if (linkFile.endsWith('-ru.html')) base = linkFile.replace(/-ru\.html$/, '');
                else base = linkFile.replace(/\.html$/, '');
                const lang = detectLang(file);
                if (linkFile.endsWith(`-${lang}.html`)) continue;
                const targetFile = langMap[base] && langMap[base][lang];
                if (targetFile) changes.push({ from: linkPath, to: targetFile });
            }
            if (changes.length > 0) {
                totalChanges += changes.length;
                totalFiles++;
                byFile[file] = changes;
            }
        } else {
            const { changes } = fixFile(file);
            if (changes.length > 0) {
                totalChanges += changes.length;
                totalFiles++;
                byFile[file] = changes;
            }
        }
    }

    console.log(`受影响文件: ${totalFiles}`);
    console.log(`总修改数: ${totalChanges}`);
    console.log();

    // 按文件统计 top
    const sorted = Object.entries(byFile).sort((a, b) => b[1].length - a[1].length);
    for (const [f, changes] of sorted.slice(0, 15)) {
        console.log(`  ${changes.length} 处  ${f}`);
        for (const c of changes.slice(0, 4)) {
            console.log(`     ${c.from}  →  ${c.to}`);
        }
        if (changes.length > 4) console.log(`     ... 还有 ${changes.length - 4} 处`);
    }

    if (dryRun) {
        console.log();
        console.log('确认无误后运行: node scripts/fix-i18n-links.js --apply');
    }
}

main();