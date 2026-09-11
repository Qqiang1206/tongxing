#!/usr/bin/env node
/**
 * One-shot fixer: replaces residual Chinese strings in en/ru data files with
 * proper translations, then regenerates the auto-generated .js wrappers and
 * per-item JSON files to stay in sync with the generation pipeline
 * (server/src/services/catalog.js).
 *
 * Run:  node scripts/fix-i18n-chinese.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'h:/tongxing';
const DATA = path.join(ROOT, 'data');

const hasChinese = (s) => typeof s === 'string' && /[\u4e00-\u9fff\u3400-\u4dbf]/.test(s);

/* ---- exact full-string translations (Chinese -> target language) ---- */
const EN = {
  // solutions categories
  'TV/商显行业': 'TV / Commercial Displays',
  '家电': 'Home Appliances',
  '物流与包装': 'Logistics & Packaging',
  '储能': 'Energy Storage',
  '3C数码': '3C Electronics',
  '汽车': 'Automotive',
  // products categories
  '光学元件组装': 'Optical Component Assembly',
  '点胶装配': 'Dispensing Assembly',
  '翻转检测': 'Flip Inspection',
  '锁付组装': 'Screw Fastening Assembly',
  '搬运移载': 'Material Handling & Transfer',
  '后段包装': 'End-of-Line Packaging',
  '机器人集成': 'Robot Integration',
  '整线交付': 'Whole-Line Delivery',
  '解决方案': 'Solutions',
  '软件系统': 'Software System',
  // contact page
  '国内业务专线': 'Domestic Business Line',
  '刘经理 (微信同号)': 'Manager Liu (WeChat same number)',
  '官方电子邮箱': 'Official Email',
  '发送包含 CAD/图纸 的需求文档': 'Send a requirement document with CAD/drawings',
  '点击发送邮件 →': 'Click to send email →',
  '深圳总部工厂': 'Shenzhen Headquarters Factory',
  '深圳市龙岗区宝龙街道同德社区吓坑村一区2号（A栋-C栋）': 'Building A-C, Zone 1, Xiakeng Village, Tongde Community, Baolong Street, Longgang District, Shenzhen',
  '高德地图导航': 'Amap Navigation',
  '惠州智能制造基地': 'Huizhou Smart Manufacturing Base',
  '惠州市（6万㎡智能制造基地，已于 2026 年全面投产）。': 'Huizhou (60,000 m² smart manufacturing base, fully operational since 2026).',
  '查看基地规划图': 'View Base Plan',
  '已投产': 'Operational',
  // home / about stats
  '年': 'Years',
  '项': 'Patents',
  '大': 'Industries',
  '万㎡': '0k m²',
  '非标自动化设备制造经验': 'Non-Standard Automation Equipment Manufacturing',
  '核心发明与专利': 'Core Inventions & Patents',
  '重点行业全覆盖': 'Major Industries Covered',
  '深圳+惠州双核工厂': 'Shenzhen + Huizhou Dual Factories',
  // home product tags
  '高精度点胶': 'High-Precision Dispensing',
  '180度翻转': '180° Flipping',
  'UVW对位': 'UVW Alignment',
  // home service steps
  '调研交流 · 方案规划': 'Research & Communication · Solution Planning',
  '方案确认 · 商务合作': 'Solution Confirmation · Business Cooperation',
  '机械设计 · 电气设计': 'Mechanical Design · Electrical Design',
  '软件开发 · 设计评审': 'Software Development · Design Review',
  '图纸下发 · 生产制造': 'Drawing Release · Production',
  '品质检验 · 设备交付': 'Quality Inspection · Equipment Delivery',
  '365*7*24 · 驻场服务': '365*7*24 · On-Site Service',
  '培训交接 · 永久售后': 'Training & Handover · Permanent After-Sales',
  // solutions page pillars
  '100% 柔性定制': '100% Flexible Customization',
  '模块化矩阵设计，从容应对频繁的产品换型与工艺更迭。': 'Modular matrix design, effortlessly handling frequent product changeovers and process iterations.',
  '软硬深度融合': 'Deep Software-Hardware Integration',
  '搭载自研 WMS/WCS 与底层视觉算法，消除所有信息孤岛。': 'Powered by self-developed WMS/WCS and underlying vision algorithms, eliminating all information silos.',
  '极速交付节拍': 'Rapid Delivery Pace',
  '基于 10万㎡ 双基地的超级吞吐量，保障大型产线如期落地。': 'Based on the super throughput of the 100,000 m² dual-base, ensuring large-scale production lines land on schedule.',
  // solutions item 32 process desc
  '自动化物流系统实现部件自动供给，减少人工搬运': 'Automated logistics system enables automatic component supply, reducing manual handling',
  // products page seo (en)
  "Product Center | Tongxing High-Tech TXAM - China's Leading Automation Brand Supplier": "Product Center | TXAM - China's Leading Automation Brand Supplier",
  'Tongxing High-Tech Product Center - 6 Major Product Lines Including Dispensing Assembly, Flip Inspection, Screw Fastening Assembly, Optical Components, Material Handling & Transfer, and End-of-Line Packaging': 'TXAM Product Center - 6 Major Product Lines Including Dispensing Assembly, Flip Inspection, Screw Fastening Assembly, Optical Components, Material Handling & Transfer, and End-of-Line Packaging',
};

const RU = {
  // solutions categories
  'TV/商显行业': 'ТВ / Коммерческие дисплеи',
  '家电': 'Бытовая техника',
  '物流与包装': 'Логистика и упаковка',
  '储能': 'Системы хранения энергии',
  '3C数码': '3C-электроника',
  '汽车': 'Автомобильная промышленность',
  // products categories
  '光学元件组装': 'Сборка оптических компонентов',
  '点胶装配': 'Диспенсерная сборка',
  '翻转检测': 'Инспекция с переворотом',
  '锁付组装': 'Сборка с завинчиванием',
  '搬运移载': 'Транспортировка и перенос',
  '后段包装': 'Финальная упаковка',
  '机器人集成': 'Интеграция роботов',
  '整线交付': 'Комплексная поставка линии',
  '解决方案': 'Решения',
  '软件系统': 'Программная система',
  // contact page
  '国内业务专线': 'Внутренняя бизнес-линия',
  '刘经理 (微信同号)': 'Менеджер Лю (WeChat: тот же номер)',
  '官方电子邮箱': 'Официальная электронная почта',
  '发送包含 CAD/图纸 的需求文档': 'Отправьте документ с требованиями, включая CAD/чертежи',
  '点击发送邮件 →': 'Нажмите, чтобы отправить письмо →',
  '深圳总部工厂': 'Штаб-квартира в Шэньчжэне',
  '深圳市龙岗区宝龙街道同德社区吓坑村一区2号（A栋-C栋）': 'Здание A-C, Зона 1, деревня Сиакэн, община Тундэ, ул. Баолун, район Лунган, Шэньчжэнь',
  '高德地图导航': 'Навигация Amap',
  '惠州智能制造基地': 'Производственная база в Хуэйчжоу',
  '惠州市（6万㎡智能制造基地，已于 2026 年全面投产）。': 'Хуэйчжоу (база интеллектуального производства 60 000 м², полностью введена в эксплуатацию с 2026 года).',
  '查看基地规划图': 'Просмотреть план базы',
  '已投产': 'В эксплуатации',
  // home / about stats
  '年': 'лет',
  '项': 'патентов',
  '大': 'отраслей',
  '万㎡': '0 тыс. м²',
  '非标自动化设备制造经验': 'Опыт производства нестандартного оборудования',
  '核心发明与专利': 'Ключевых изобретений и патентов',
  '重点行业全覆盖': 'Охват основных отраслей',
  '深圳+惠州双核工厂': 'Два завода: Шэньчжэнь + Хуэйчжоу',
  // home product tags
  '高精度点胶': 'Высокоточное нанесение клея',
  '180度翻转': 'Поворот на 180°',
  'UVW对位': 'Юстировка UVW',
  // home service steps
  '调研交流 · 方案规划': 'Исследование и общение · Планирование решения',
  '方案确认 · 商务合作': 'Подтверждение решения · Деловое сотрудничество',
  '机械设计 · 电气设计': 'Механическое проектирование · Электротехническое проектирование',
  '软件开发 · 设计评审': 'Разработка ПО · Проверка проекта',
  '图纸下发 · 生产制造': 'Выпуск чертежей · Производство',
  '品质检验 · 设备交付': 'Контроль качества · Поставка оборудования',
  '365*7*24 · 驻场服务': '365*7*24 · Выездное обслуживание',
  '培训交接 · 永久售后': 'Обучение и передача · Постоянное обслуживание',
  // solutions page pillars
  '100% 柔性定制': '100% Гибкая кастомизация',
  '模块化矩阵设计，从容应对频繁的产品换型与工艺更迭。': 'Модульная матричная конструкция, легко справляющаяся с частой сменой продуктов и технологических итераций.',
  '软硬深度融合': 'Глубокая интеграция ПО и оборудования',
  '搭载自研 WMS/WCS 与底层视觉算法，消除所有信息孤岛。': 'На базе собственных WMS/WCS и базовых алгоритмов машинного зрения, устраняющих все информационные барьеры.',
  '极速交付节拍': 'Быстрый темп поставки',
  '基于 10万㎡ 双基地的超级吞吐量，保障大型产线如期落地。': 'На базе сверхвысокой пропускной способности двух баз площадью 100 000 м², обеспечивая своевременный запуск крупных линий.',
  // solutions item 32 process desc
  '自动化物流系统实现部件自动供给，减少人工搬运': 'Автоматизированная логистическая система обеспечивает автоматическую подачу компонентов, снижая ручной труд',
  // products page seo (ru)
  'Центр продукции | 同兴高科 TXAM — ведущий китайский поставщик автоматизационных брендов': 'Центр продукции | TXAM — ведущий китайский поставщик автоматизации',
  'Центр продукции 同兴高科: 6 основных категорий продукции, включая диспенсерную сборку, инспекцию с переворотом, сборку с завинчиванием, оптические компоненты, транспортировку и перенос, финальную упаковку и др.': 'Центр продукции TXAM: 6 основных категорий продукции, включая диспенсерную сборку, инспекцию с переворотом, сборку с завинчиванием, оптические компоненты, транспортировку и перенос, финальную упаковку и др.',
  // solutions page seo (ru) — fallback if substring not enough
  'Решения | TXAM (同兴高科)': 'Решения | TXAM',
};

/* substring replacements (applied after exact match), brand/series cleanup */
const SUBSTR_BOTH = [
  ['(同兴高科)', ''],
  ['同兴高科', 'TXAM'],
  ['系列', 'Series'],
];

function translateValue(str, lang) {
  if (typeof str !== 'string' || !hasChinese(str)) return str;
  const dict = lang === 'ru' ? RU : EN;
  if (Object.prototype.hasOwnProperty.call(dict, str)) return dict[str];
  let out = str;
  for (const [from, to] of SUBSTR_BOTH) out = out.split(from).join(to);
  return out;
}

function walk(obj, lang) {
  if (Array.isArray(obj)) return obj.map((v) => walk(v, lang));
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = walk(v, lang);
    return out;
  }
  return translateValue(obj, lang);
}

const SLIM_OMIT = {
  products: new Set(['contentHtml', 'detail']),
  solutions: new Set(['contentHtml', 'detail', 'painPoints', 'process']),
  news: new Set(['contentHtml', 'content']),
};
const CATALOG_GLOBAL = {
  products: '__TXAM_PRODUCTS',
  news: '__TXAM_NEWS',
  solutions: '__TXAM_SOLUTIONS',
};

function slimItem(kind, item) {
  const omit = SLIM_OMIT[kind];
  const out = {};
  for (const [k, v] of Object.entries(item || {})) if (!omit.has(k)) out[k] = v;
  return out;
}

function writeJson(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

/* ---- process pages ---- */
const pagesDir = path.join(DATA, 'pages');
let pagesDone = 0;
for (const pageKey of fs.readdirSync(pagesDir)) {
  const dir = path.join(pagesDir, pageKey);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const lang of ['en', 'ru']) {
    const jsonPath = path.join(dir, `${lang}.json`);
    if (!fs.existsSync(jsonPath)) continue;
    const page = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const fixed = walk(page, lang);
    writeJson(jsonPath, fixed);
    const globalName = `__TXAM_PAGE_${pageKey.toUpperCase()}_${lang.toUpperCase()}`;
    const js = `/* auto-generated from sqlite — do not edit */\nwindow.${globalName}=${JSON.stringify(fixed)};\n`;
    fs.writeFileSync(path.join(dir, `${lang}.js`), js, 'utf8');
    pagesDone++;
  }
}

/* ---- process catalog (solutions / products / news) ---- */
let catalogDone = 0;
for (const kind of ['solutions', 'products', 'news']) {
  const dir = path.join(DATA, kind);
  const itemsDir = path.join(dir, 'items');
  for (const lang of ['en', 'ru']) {
    const jsonPath = path.join(dir, `${lang}.json`);
    if (!fs.existsSync(jsonPath)) continue;
    const map = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const fixedMap = {};
    for (const [id, item] of Object.entries(map)) fixedMap[id] = walk(item, lang);
    writeJson(jsonPath, fixedMap);

    // regenerate slim .js
    const globalName = CATALOG_GLOBAL[kind];
    const slim = {};
    for (const [id, item] of Object.entries(fixedMap)) slim[id] = slimItem(kind, item);
    const js = `/* auto-generated from sqlite (list-slim) — do not edit */\nwindow.${globalName}_${lang.toUpperCase()}=${JSON.stringify(slim)};\n`;
    fs.writeFileSync(path.join(dir, `${lang}.js`), js, 'utf8');

    // regenerate per-item files
    const langItemsDir = path.join(itemsDir, lang);
    fs.mkdirSync(langItemsDir, { recursive: true });
    for (const [id, item] of Object.entries(fixedMap)) {
      writeJson(path.join(langItemsDir, `${id}.json`), item);
    }
    catalogDone++;
  }
}

/* ---- report remaining Chinese ---- */
const remaining = [];
function scanRemaining(obj, p) {
  if (Array.isArray(obj)) obj.forEach((v, i) => scanRemaining(v, `${p}[${i}]`));
  else if (obj && typeof obj === 'object') for (const [k, v] of Object.entries(obj)) scanRemaining(v, `${p}.${k}`);
  else if (hasChinese(obj)) remaining.push(`${p} = ${JSON.stringify(obj)}`);
}
for (const pageKey of fs.readdirSync(pagesDir)) {
  const dir = path.join(pagesDir, pageKey);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const lang of ['en', 'ru']) {
    const jp = path.join(dir, `${lang}.json`);
    if (fs.existsSync(jp)) scanRemaining(JSON.parse(fs.readFileSync(jp, 'utf8')), `pages/${pageKey}/${lang}`);
  }
}
for (const kind of ['solutions', 'products', 'news']) {
  for (const lang of ['en', 'ru']) {
    const jp = path.join(DATA, kind, `${lang}.json`);
    if (fs.existsSync(jp)) scanRemaining(JSON.parse(fs.readFileSync(jp, 'utf8')), `${kind}/${lang}`);
  }
}

console.log(`Pages processed: ${pagesDone}`);
console.log(`Catalog langs processed: ${catalogDone}`);
if (remaining.length) {
  console.log(`\n⚠️  Remaining Chinese strings (${remaining.length}):`);
  for (const r of remaining) console.log('  ' + r);
  process.exit(1);
} else {
  console.log('\n✅ No residual Chinese strings in en/ru data files.');
}
