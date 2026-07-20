const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function isDetailFile(name) {
    if (/^product-\d/.test(name)) return true;
    if (/^product-detail/.test(name)) return true;
    if (/^solutions-detail/.test(name)) return true;
    if (/^news-detail/.test(name)) return true;
    if (/-solution(-en|-ru)?\.html$/.test(name) && !name.startsWith('solutions')) return true;
    return false;
}

function walkHtml(dir, files = []) {
    for (const name of fs.readdirSync(dir)) {
        if (name === 'node_modules' || name === 'scripts') continue;
        const full = path.join(dir, name);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) walkHtml(full, files);
        else if (name.endsWith('.html') && isDetailFile(name)) files.push(full);
    }
    return files;
}

function transform(content, file) {
    let s = content;
    const base = path.basename(file);

    // Ensure styles.css on static product pages that only had inline CSS
    if (/^product-\d/.test(base) && !s.includes('href="styles.css"')) {
        if (s.includes('href="tailwind.min.css"')) {
            s = s.replace(
                '<link rel="stylesheet" href="tailwind.min.css">',
                '<link rel="stylesheet" href="tailwind.min.css">\n    <link rel="stylesheet" href="styles.css">'
            );
        } else if (s.includes('<head>')) {
            s = s.replace('<head>', '<head>\n    <link rel="stylesheet" href="tailwind.min.css">\n    <link rel="stylesheet" href="styles.css">');
        }
    }

    s = s.replace(/<article class="pt-40 pb-32 px-6 md:px-24">/g, '<article class="detail-page pt-40 pb-32 px-6 md:px-24">');
    s = s.replace(/<div class="max-w-\[900px\] mx-auto">/g, '<div class="detail-page__inner max-w-[1200px] mx-auto">');
    s = s.replace(
        /(<article class="detail-page[\s\S]*?<nav class="breadcrumb[\s\S]*?<\/nav>\s*\n\s*)<div class="max-w-\[1200px\] mx-auto">/g,
        '$1<div class="detail-page__inner max-w-[1200px] mx-auto">'
    );
    s = s.replace(
        /(<div class="detail-page__inner max-w-\[1200px\] mx-auto">\s*\n\s*<nav class="breadcrumb)/g,
        '<div class="detail-page__inner max-w-[1200px] mx-auto">\n            <nav class="breadcrumb'
    );

    // Fix double detail-page__inner if script run twice
    s = s.replace(/detail-page__inner detail-page__inner/g, 'detail-page__inner');

    if (!s.includes('detail-page__inner') && s.includes('<article class="detail-page')) {
        s = s.replace(/<div class="max-w-\[1200px\] mx-auto">/g, '<div class="detail-page__inner max-w-[1200px] mx-auto">');
    }

    s = s.replace(
        /hero-title text-5xl md:text-\[5rem\] text-\[#1D1D1F\] mb-8 text-gradient/g,
        'detail-title hero-title text-display text-[#1D1D1F] text-gradient'
    );

    s = s.replace(
        /(<span[^>]*id="(?:product-category|solution-category|news-category)"[^>]*)text-\[#FF6B00\] font-bold text-xs tracking-widest uppercase/g,
        '$1detail-eyebrow text-[#FF6B00] font-bold text-xs tracking-widest uppercase'
    );
    s = s.replace(
        /(<span[^>]*class=")text-\[#FF6B00\] font-bold text-xs tracking-widest uppercase label-en/g,
        '$1detail-eyebrow text-[#FF6B00] font-bold text-xs tracking-widest uppercase label-en'
    );

    s = s.replace(
        /id="product-model" class="text-\[#86868B\] font-mono text-sm"/g,
        'id="product-model" class="detail-meta-mono"'
    );

    s = s.replace(
        /(<header class="[^"]*fade-up">\s*\n\s*<span id="news-category" class="detail-eyebrow[^"]*") mb-4 block/g,
        '$1 block mb-4'
    );

    s = s.replace(
        /<div class="flex items-center text-\[#86868B\] text-sm">/g,
        '<div class="detail-meta flex items-center text-sm">'
    );

    s = s.replace(
        /(<div class="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">)/g,
        '<div class="detail-hero-grid grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">'
    );
    s = s.replace(/detail-hero-grid detail-hero-grid/g, 'detail-hero-grid');

    s = s.replace(
        /<h3 class="text-lg font-bold text-\[#1D1D1F\] mb-6">/g,
        '<h3 class="detail-sidebar__label">'
    );
    s = s.replace(
        /<h3 class="text-lg font-bold text-\[#1D1D1F\] mb-4">/g,
        '<h3 class="detail-sidebar__label mb-4">'
    );

    // Related section titles (before generic h3 -> sidebar label would catch them)
    s = s.replace(
        /<section class="detail-related fade-up">\s*\n\s*<h3 class="text-lg font-bold text-\[#1D1D1F\] mb-6">([\s\S]*?)<\/h3>/g,
        '<section class="detail-related fade-up">\n                <h2 class="detail-section__title">$1</h2>'
    );

    s = s.replace(/id="product-specs" class="flex flex-wrap gap-3 mb-8"/g, 'id="product-specs" class="detail-specs mb-8"');
    s = s.replace(/id="solution-specs" class="specs-row mb-8"/g, 'id="solution-specs" class="detail-specs mb-8"');
    s = s.replace(/class="specs-row mb-8"/g, 'class="detail-specs mb-8"');

    s = s.replace(
        /id="product-desc" class="text-\[#86868B\] leading-\[1\.8\]"/g,
        'id="product-desc" class="detail-lead"'
    );
    s = s.replace(
        /id="solution-features" class="text-\[#86868B\] leading-\[1\.8\]"/g,
        'id="solution-features" class="detail-lead"'
    );

    s = s.replace(/class="prose max-w-none"/g, 'class="detail-prose"');
    s = s.replace(/class="prose-content fade-up"/g, 'class="detail-prose detail-prose--article fade-up"');
    s = s.replace(/class="prose-content"/g, 'class="detail-prose detail-prose--article"');

    s = s.replace(
        /<h2 class="section-title text-3xl md:text-4xl text-\[#1D1D1F\] mb-8">/g,
        '<h2 class="detail-section__title">'
    );
    s = s.replace(
        /<h2 class="text-2xl md:text-3xl font-bold text-\[#1D1D1F\] mb-8">/g,
        '<h2 class="detail-section__title">'
    );
    s = s.replace(
        /<h3 class="text-lg font-bold text-\[#1D1D1F\] mb-6">(相关产品|相关解决方案|相关文章|Related)/g,
        '<h2 class="detail-section__title">$1'
    );

    s = s.replace(
        /<section class="fade-up mb-16">\s*\n\s*<h2 class="detail-section__title">行业痛点/g,
        '<section id="solution-pain-points" class="detail-section fade-up mb-16">\n                <h2 class="detail-section__title">行业痛点'
    );
    s = s.replace(
        /<section class="fade-up mb-16">\s*\n\s*<h2 class="detail-section__title">核心工艺流程/g,
        '<section id="solution-process" class="detail-section fade-up mb-16">\n                <h2 class="detail-section__title">核心工艺流程'
    );
    s = s.replace(
        /<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">\s*\n\s*<div class="apple-card p-8">\s*\n\s*<div class="w-12 h-12 bg-\[#FF6B00\]\/10/g,
        '<div id="solution-pain-points-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">\n                    <div class="apple-card p-8">\n                        <div class="w-12 h-12 bg-[#FF6B00]/10'
    );

    // Process grid id - only first 4-col grid after solution-process section
    if (s.includes('id="solution-process"') && !s.includes('id="solution-process-grid"')) {
        s = s.replace(
            /(id="solution-process"[\s\S]*?<h2 class="detail-section__title">核心工艺流程[\s\S]*?<div class=")grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">/,
            '$1grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" id="solution-process-grid">'
        );
        // fix broken replacement - simpler approach below
    }

    s = s.replace(
        /<div class="mt-16 pt-12 border-t border-\[#E5E5EA\] fade-up">/g,
        '<section class="detail-related fade-up">'
    );
    s = s.replace(
        /<section class="detail-related fade-up">\s*\n\s*<h2 class="detail-section__title">([\s\S]*?)<\/h2>\s*\n\s*<div id="related-products" class="grid grid-cols-1 md:grid-cols-3 gap-6">\s*\n\s*<\/div>\s*\n\s*<\/div>/g,
        '<section class="detail-related fade-up">\n                <h2 class="detail-section__title">$1</h2>\n                <div id="related-products" class="detail-related__grid"></div>\n            </section>'
    );
    s = s.replace(
        /<div id="related-solutions" class="specs-grid">/g,
        '<div id="related-solutions" class="detail-related__grid">'
    );

    s = s.replace(
        /<div class="w-full media-h-detail w-full media-hero mb-12 fade-up">/g,
        '<div class="detail-cover w-full media-h-detail media-hero mb-12 fade-up">'
    );

    s = s.replace(/<section class="fade-up">\s*\n\s*<h2 class="detail-section__title">详细说明/g, '<section class="detail-section fade-up">\n                <h2 class="detail-section__title">详细说明');
    s = s.replace(/<section class="fade-up mb-16">\s*\n\s*<h2 class="detail-section__title">详细说明/g, '<section class="detail-section fade-up mb-16">\n                <h2 class="detail-section__title">详细说明');

    s = s.replace(
        /card.className = 'apple-card block p-6 group';/g,
        "card.className = 'detail-related-card apple-card block p-6 group';"
    );
    s = s.replace(
        /card.className = 'group p-6 bg-white rounded-2xl border border-\[#E5E5EA\] hover:shadow-lg transition-all';/g,
        "card.className = 'detail-related-card apple-card block p-6 group';"
    );

    s = s.replace(
        /<div class="w-full h-40 radius-sm overflow-hidden bg-gray-100 mb-4">\s*\n\s*<img loading="lazy" src="\$\{item\.image\}"/g,
        '<div class="detail-related-card__img w-full h-40 radius-sm overflow-hidden bg-gray-100 mb-4">\n                        <img loading="lazy" src="${item.image}"'
    );

    s = s.replace(
        /const painPointsContainer = document\.querySelector\('\.fade-up\.mb-16:nth-of-type\(3\) \.grid'\);/g,
        "const painPointsContainer = document.getElementById('solution-pain-points-grid');"
    );
    s = s.replace(
        /const processContainer = document\.querySelector\('\.fade-up\.mb-16:nth-of-type\(4\) \.grid'\);/g,
        "const processContainer = document.getElementById('solution-process-grid');"
    );

    return s;
}

let changed = 0;
for (const file of walkHtml(root)) {
    const before = fs.readFileSync(file, 'utf8');
    let after = transform(before, file);

    // Add process grid id manually if section exists
    if (after.includes('id="solution-process"') && !after.includes('id="solution-process-grid"')) {
        after = after.replace(
            /(核心工艺流程<\/h2>\s*\n\s*<div class=")grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">/,
            '$1grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" id="solution-process-grid">'
        );
    }
    if (after.includes('行业痛点') && !after.includes('id="solution-pain-points-grid"')) {
        after = after.replace(
            /(行业痛点<\/h2>\s*\n\s*<div class=")grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">/,
            '$1grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="solution-pain-points-grid">'
        );
    }

    if (after !== before) {
        fs.writeFileSync(file, after, 'utf8');
        changed++;
        console.log('Updated', path.basename(file));
    }
}
console.log('Done:', changed, 'detail pages');
