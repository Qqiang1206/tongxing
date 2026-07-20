const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

const relatedNewsJs = (lang) => {
    const href = lang === 'en' ? 'news-detail-en.html' : lang === 'ru' ? 'news-detail-ru.html' : 'news-detail.html';
    const titleSuffix = lang === 'en' ? ' | TXAM' : lang === 'ru' ? ' | Тунсин Гаотек' : ' | 同兴高科';
    return `
            const relatedContainer = document.getElementById('related-news');
            if (relatedContainer) {
                const relatedHtml = Object.keys(newsData)
                    .filter(nid => nid !== id)
                    .slice(0, 3)
                    .map(nid => {
                        const item = newsData[nid];
                        return \`
                            <a href="${href}?id=\${nid}" class="detail-related-card apple-card block p-6 group">
                                <div class="detail-related-card__img w-full h-40 radius-sm overflow-hidden bg-gray-100 mb-4">
                                    <img loading="lazy" src="\${item.cover}" alt="\${item.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                                </div>
                                <span class="detail-related-card__eyebrow">\${item.category}</span>
                                <h4 class="detail-related-card__title mt-1 mb-2">\${item.title}</h4>
                                <span class="detail-meta-mono text-xs">\${item.date}</span>
                            </a>
                        \`;
                    }).join('');
                relatedContainer.innerHTML = relatedHtml;
            }
`.trim();
};

function fixRelatedSection(content, title, gridId) {
    const blockRe = new RegExp(
        `<section class="detail-related fade-up">\\s*<h3 class="detail-sidebar__label">${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</h3>\\s*<div id="${gridId}" class="grid grid-cols-1 md:grid-cols-3 gap-6">\\s*</div>\\s*</div>`,
        'g'
    );
    return content.replace(
        blockRe,
        `<section class="detail-related fade-up">\n                <h2 class="detail-section__title">${title}</h2>\n                <div id="${gridId}" class="detail-related__grid"></div>\n            </section>`
    );
}

function fixNewsRelated(content, lang) {
    const titles = { en: 'Related Articles', ru: 'Связанные статьи' };
    const title = titles[lang];
    const start = content.indexOf('<section class="detail-related fade-up">');
    if (start === -1) return content;
    const end = content.indexOf('</div>\n        </div>\n    </article>', start);
    if (end === -1) return content;
    const replacement = `<section class="detail-related fade-up">
                <h2 class="detail-section__title">${title}</h2>
                <div id="related-news" class="detail-related__grid"></div>
            </section>`;
    let out = content.slice(0, start) + replacement + content.slice(end);

    const marker = "document.title = news.title + '";
    const idx = out.indexOf(marker);
    if (idx !== -1 && !out.includes("getElementById('related-news')")) {
        const lineEnd = out.indexOf('\n', idx);
        const insert = '\n\n            ' + relatedNewsJs(lang);
        out = out.slice(0, lineEnd) + insert + out.slice(lineEnd);
    }
    return out;
}

function fixSolutionsEnRelatedJs(content) {
    return content.replace(
        /return `\s*<a href="solutions-detail-en\.html\?id=\$\{sid\}" class="group p-6 bg-white[\s\S]*?<\/a>\s*`;/g,
        `return \`
                        <a href="solutions-detail-en.html?id=\${sid}" class="detail-related-card apple-card block p-6 group">
                            <div class="detail-related-card__img w-full h-40 radius-sm overflow-hidden bg-gray-100 mb-4">
                                <img loading="lazy" src="\${s.image}" alt="\${s.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                            </div>
                            <span class="detail-related-card__eyebrow">\${s.model}</span>
                            <h4 class="detail-related-card__title mt-1">\${s.name}</h4>
                        </a>
                    \`;`
    );
}

const files = [
    ['product-detail.html', '相关产品', 'related-products'],
    ['product-detail-en.html', 'Related Products', 'related-products'],
    ['product-detail-ru.html', 'Связанные продукты', 'related-products'],
    ['solutions-detail-en.html', 'Related Solutions', 'related-products'],
];

let changed = 0;
for (const [name, title, gridId] of files) {
    const file = path.join(root, name);
    let s = fs.readFileSync(file, 'utf8');
    const before = s;
    s = fixRelatedSection(s, title, gridId);
    if (name === 'solutions-detail-en.html') s = fixSolutionsEnRelatedJs(s);
    if (s !== before) {
        fs.writeFileSync(file, s, 'utf8');
        changed++;
        console.log('Fixed', name);
    }
}

for (const lang of ['en', 'ru']) {
    const name = `news-detail-${lang}.html`;
    const file = path.join(root, name);
    let s = fs.readFileSync(file, 'utf8');
    const before = s;
    s = fixNewsRelated(s, lang);
    if (s !== before) {
        fs.writeFileSync(file, s, 'utf8');
        changed++;
        console.log('Fixed', name);
    }
}

// solutions-detail ZH related section class
for (const name of ['solutions-detail.html', 'solutions-detail-ru.html']) {
    const file = path.join(root, name);
    let s = fs.readFileSync(file, 'utf8');
    const before = s;
    s = s.replace(
        /<section class="fade-up">\s*\n\s*<h2 class="detail-section__title">(相关解决方案|Сопутствующие решения)<\/h2>/g,
        '<section class="detail-related fade-up">\n                <h2 class="detail-section__title">$1</h2>'
    );
    if (s !== before) {
        fs.writeFileSync(file, s, 'utf8');
        changed++;
        console.log('Fixed', name);
    }
}

console.log('Done:', changed, 'files');
