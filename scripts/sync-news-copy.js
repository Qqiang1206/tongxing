/**
 * Sync news list HTML + homepage teasers to data/news JSON titles/dates/categories.
 * Also normalize remaining product-name variants in news JSON.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function loadNews(lang) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'data/news', `${lang}.json`), 'utf8'));
}

function saveNews(lang, data) {
  const jsonPath = path.join(ROOT, 'data/news', `${lang}.json`);
  // normalize content product names
  let s = JSON.stringify(data, null, 2);
  s = s.replace(/循环自动举升机/g, '循环式自动提升机');
  s = s.replace(/Circular Auto Lifter/g, 'Circular Automatic Lifter');
  s = s.replace(/TCL、创维、美的、康佳等/g, 'TCL、创维、美的、康佳、长虹等');
  s = s.replace(
    /TCL, Skyworth, Midea, Konka and other/g,
    'TCL, Skyworth, Midea, Konka, Changhong and other'
  );
  fs.writeFileSync(jsonPath, s + '\n');
}

// Normalize JSON first
for (const lang of ['zh', 'en', 'ru']) {
  const data = loadNews(lang);
  saveNews(lang, data);
}

const zh = loadNews('zh');
const en = loadNews('en');
const ru = loadNews('ru');

// --- ZH news.html ---
let newsZh = fs.readFileSync(path.join(ROOT, 'news.html'), 'utf8');
newsZh = newsZh
  .replace(
    /里程碑：同兴高科 10万㎡ 深圳与惠州双智造基地格局全面成型/,
    zh['4'].title
  )
  .replace(
    /成功交付墨西哥 86寸商用显示全自动总装产线/,
    zh['5'].title
  )
  .replace(
    /同兴高科携"循环式自动提升机"惊艳亮相 CIBF 国际电池展/,
    zh['3'].title
  )
  .replace(
    /高精度机器人装配产线成功入驻国内头部电器厂商/,
    zh['2'].title
  )
  // dates
  .replace(
    /(news-detail\.html\?id=2[\s\S]*?<span class="text-\[#667084\] text-sm font-mono mb-4 block">)2026\.02\.18/,
    `$1${zh['2'].date}`
  )
  // categories on cards
  .replace(
    /(news-detail\.html\?id=4[\s\S]*?<div class="absolute top-6 left-6[^>]*>)企业资讯/,
    `$1${zh['4'].category}`
  )
  .replace(
    /(news-detail\.html\?id=5[\s\S]*?<div class="absolute top-6 left-6[^>]*>)项目新闻/,
    `$1${zh['5'].category}`
  )
  .replace(
    /(news-detail\.html\?id=3[\s\S]*?<div class="absolute top-6 left-6[^>]*>)企业资讯/,
    `$1${zh['3'].category}`
  )
  .replace(
    /(news-detail\.html\?id=2[\s\S]*?<div class="absolute top-6 left-6[^>]*>)项目新闻/,
    `$1${zh['2'].category}`
  )
  .replace(
    /(news-detail\.html\?id=6[\s\S]*?<div class="absolute[^>]*>)行业资讯/,
    `$1${zh['6'].category}`
  );
fs.writeFileSync(path.join(ROOT, 'news.html'), newsZh);
console.log('synced news.html');

// --- EN news.html ---
let newsEn = fs.readFileSync(path.join(ROOT, 'en/news.html'), 'utf8');
newsEn = newsEn
  .replace(
    /Milestone: TXAM's 100,000㎡ Shenzhen & Huizhou Dual Manufacturing Bases Fully Established/,
    en['4'].title
  )
  .replace(
    /Successfully Delivered 86" Commercial Display Full Auto Assembly Line to Mexico/,
    en['5'].title
  )
  .replace(
    /TXAM Stuns at CIBF International Battery Exhibition with "Circular Automatic Lifter"/,
    en['3'].title
  )
  .replace(
    /High-Precision Robot Assembly Line Successfully Deployed at Leading Domestic Appliance Manufacturer/,
    en['2'].title
  )
  .replace(
    /(news-detail\.html\?id=2[\s\S]*?<span class="text-\[#667084\] text-sm font-mono mb-4 block">)2026\.02\.18/,
    `$1${en['2'].date}`
  );
fs.writeFileSync(path.join(ROOT, 'en/news.html'), newsEn);
console.log('synced en/news.html');

// --- RU news.html ---
let newsRu = fs.readFileSync(path.join(ROOT, 'ru/news.html'), 'utf8');
newsRu = newsRu
  .replace(
    /Веха: Две производственные базы TXAM 100,000㎡ в Шэньчжэне и Хуэйчжоу полностью готовы/,
    ru['4'].title
  );
fs.writeFileSync(path.join(ROOT, 'ru/news.html'), newsRu);
console.log('synced ru/news.html');

// --- Index teasers ZH ---
let indexZh = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
indexZh = indexZh
  .replace(
    /(<a href="news-detail\.html\?id=1"[\s\S]*?<h3[^>]*>)[^<]+(<\/h3>)/,
    `$1${zh['1'].title}$2`
  )
  .replace(
    /(<a href="news-detail\.html\?id=1"[\s\S]*?<span class="text-sm font-bold text-\[#667084\] mt-4 md:mt-0">)[^<]+/,
    `$1${zh['1'].date}`
  )
  .replace(
    /(<a href="news-detail\.html\?id=2"[\s\S]*?<h3[^>]*>)[^<]+(<\/h3>)/,
    `$1${zh['2'].title}$2`
  );
fs.writeFileSync(path.join(ROOT, 'index.html'), indexZh);
console.log('synced index.html teasers');

// Expand solutions ZH meta to mention 11 solution themes more accurately
let sol = fs.readFileSync(path.join(ROOT, 'solutions.html'), 'utf8');
sol = sol.replace(
  /content="同兴高科行业解决方案—TV显示、冰箱、空调、洗衣机、微波炉、咖啡机、平板电脑、车灯、电容器等11大行业"/,
  'content="同兴高科行业解决方案—TV显示、冰箱、包装物流、洗衣机、电容器、空调、微波炉、咖啡机、平板、车灯、机器人等11大行业"'
);
fs.writeFileSync(path.join(ROOT, 'solutions.html'), sol);

// regenerate js companions
require('./generate-data-js.js');
console.log('done');
