const fs = require('fs');
const path = require('path');

const baseDir = __dirname;
const files = [
    "about.html", "about-en.html", "about-ru.html",
    "products.html", "products-en.html", "products-ru.html",
    "news.html", "news-en.html", "news-ru.html",
    "news-detail.html", "news-detail-en.html", "news-detail-ru.html",
    "contact.html", "contact-en.html", "contact-ru.html",
    "solutions.html", "solutions-en.html", "solutions-ru.html",
    "solutions-detail.html", "solutions-detail-en.html", "solutions-detail-ru.html",
    "product-detail.html", "product-detail-en.html", "product-detail-ru.html",
    "ac-solution.html", "ac-solution-en.html", "ac-solution-ru.html",
    "capacitor-solution.html", "capacitor-solution-en.html", "capacitor-solution-ru.html",
    "coffee-solution.html", "coffee-solution-en.html", "coffee-solution-ru.html",
    "headlight-solution.html", "headlight-solution-en.html", "headlight-solution-ru.html",
    "microwave-solution.html", "microwave-solution-en.html", "microwave-solution-ru.html",
    "refrigerator-solution.html", "refrigerator-solution-en.html", "refrigerator-solution-ru.html",
    "robot-solution.html", "robot-solution-en.html", "robot-solution-ru.html",
    "tablet-solution.html", "tablet-solution-en.html", "tablet-solution-ru.html",
    "tv-display-solution.html", "tv-display-solution-en.html", "tv-display-solution-ru.html",
    "washer-solution.html", "washer-solution-en.html", "washer-solution-ru.html",
    "packaging-solution.html", "packaging-solution-en.html", "packaging-solution-ru.html"
];

let processed = 0;
let skipped = 0;

console.log('=== TXAM 批量优化 (Node.js) ===\n');

files.forEach(f => {
    const filePath = path.join(baseDir, f);
    
    if (!fs.existsSync(filePath)) {
        return;
    }
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 跳过已优化的
    if (content.includes('href="styles.css"')) {
        console.log('[跳过]', f);
        skipped++;
        return;
    }
    
    // 移除内联 <style>...</style>
    content = content.replace(/<style>[\s\S]*?<\/style>/g, '');
    
    // 添加 styles.css
    if (content.includes('src="https://cdn.tailwindcss.com"')) {
        content = content.replace(
            '<script src="https://cdn.tailwindcss.com"></script>',
            '<script src="https://cdn.tailwindcss.com"></script>\n    <link rel="stylesheet" href="styles.css">'
        );
    }
    
    // 添加 header placeholder
    if (!content.includes('data-header-placeholder')) {
        content = content.replace(
            /(<body[^>]*>)/,
            '$1\n    <div data-header-placeholder></div>'
        );
    }
    
    // 添加 header.js
    if (content.includes('footer') && content.includes('.js" defer></script>')) {
        content = content.replace(
            /<script src="(footer[^"]*\.js)" defer><\/script>/,
            '<script src="header.js" defer></script>\n    <script src="$1" defer></script>'
        );
    }
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('[处理]', f);
    processed++;
});

console.log('\n=== 完成 ===');
console.log('处理:', processed, '个文件');
console.log('跳过:', skipped, '个文件');
