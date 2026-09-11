/**
 * Unify site copy: industry count = 11 (solutions page),
 * client mentions = logo wall brands, plus other known conflicts.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function walk(dir, acc = []) {
  for (const n of fs.readdirSync(dir)) {
    if (['.git', 'node_modules', 'scripts'].includes(n)) continue;
    const p = path.join(dir, n);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(html|js|json|md)$/.test(n)) acc.push(p);
  }
  return acc;
}

function patchText(s, file) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  let out = s;

  // --- Industry count: 7 → 11 (stats digits) ---
  // about/index big number blocks
  out = out.replace(
    /(mono-num leading-none mb-2">)7(<span class="text-3xl ml-1 text-gray-[34]00">大<\/span>)/g,
    '$111$2'
  );
  out = out.replace(
    /(mono-num leading-none mb-2">)7(<\/div>\s*<p class="text-xs font-bold[^>]*>重点行业)/g,
    '$111$2'
  );
  out = out.replace(
    /(mono-num leading-none mb-2">)7(<span class="text-3xl ml-1 text-gray-400">Industries<\/span>)/g,
    '$111$2'
  );
  out = out.replace(
    /(mono-num leading-none mb-2">)7(<span class="text-3xl ml-1 text-gray-400">отр\.<\/span>)/g,
    '$111$2'
  );
  // bare 7 in about en/ru (no 大 suffix)
  if (/about\.html$/.test(rel) && (rel.startsWith('en/') || rel.startsWith('ru/'))) {
    out = out.replace(
      /(<div class="text-\[3\.5rem\] md:text-\[4\.5rem\] font-black text-\[#1D1D1F\] mono-num leading-none mb-2">)7(<\/div>\s*\n\s*<p class="text-xs[^>]*>[^<]*(Industr|отрасл|Key industr|Ключев))/gi,
      '$111$2'
    );
    // simpler: the third stat is industries - replace standalone >7</div> before industries label
    out = out.replace(
      /(mono-num leading-none mb-2">)7(<\/div>\s*<p class="text-xs font-bold text-\[#86868B\] tracking-widest uppercase">)/g,
      (m, a, b, offset) => {
        // only if following label mentions industry
        const slice = out.slice(offset, offset + 200);
        if (/Industr|отрасл|Key|Ключ|Focus|отр/i.test(slice)) return a + '11' + b;
        return m;
      }
    );
  }

  // meta: 七大/9大 → 11大；9 industries → 11
  out = out.replace(/等七大行业/g, '等11大行业');
  out = out.replace(/七大行业/g, '11大行业');
  out = out.replace(/等9大行业/g, '等11大行业');
  out = out.replace(/9大行业/g, '11大行业');
  out = out.replace(/9 industries/g, '11 industries');
  out = out.replace(/9 отраслей/g, '11 отраслей');

  // Fix dirty solutions ZH meta
  out = out.replace(
    /同兴高科行业解决方案-TV显示、refrigerator、ac、洗衣机、微波炉、咖啡机机、平板电脑电脑、车灯、电容器等11大行业/g,
    '同兴高科行业解决方案—TV显示、冰箱、空调、洗衣机、微波炉、咖啡机、平板电脑、车灯、电容器等11大行业'
  );
  // if still 9 version with dirty text
  out = out.replace(
    /同兴高科行业解决方案-TV显示、refrigerator、ac、洗衣机、微波炉、咖啡机机、平板电脑电脑、车灯、电容器等9大行业/g,
    '同兴高科行业解决方案—TV显示、冰箱、空调、洗衣机、微波炉、咖啡机、平板电脑、车灯、电容器等11大行业'
  );

  // EN solutions meta industries list + count
  out = out.replace(
    /TV display, refrigerator, air conditioner, washing machine, microwave oven, coffee machine, tablet, lamp, capacitor\. 11 industries/g,
    'TV display, refrigerator, packaging, washer, capacitor, AC, microwave, coffee machine, tablet, headlight, robot. 11 industries'
  );
  out = out.replace(
    /TV display, refrigerator, air conditioner, washing machine, microwave oven, coffee machine, tablet, lamp, capacitor\. 9 industries/g,
    'TV display, refrigerator, packaging, washer, capacitor, AC, microwave, coffee machine, tablet, headlight, robot. 11 industries'
  );

  // index og dirty English words
  out = out.replace(
    /TV\/商用显示器、refrigerator、ac等11大行业解决方案/g,
    'TV/商用显示器、冰箱、空调等11大行业解决方案'
  );
  out = out.replace(
    /TV\/商用显示器、refrigerator、ac等七大行业解决方案/g,
    'TV/商用显示器、冰箱、空调等11大行业解决方案'
  );

  // --- Client list (logo wall subset for prose) ---
  const clientsZh = 'TCL、创维、美的、康佳、长虹';
  const clientsEn = 'TCL, Skyworth, Midea, Konka, and Changhong';
  const clientsEnMeta = 'TCL, Skyworth, Midea, Konka, Changhong';
  const clientsRu = 'TCL, Skyworth, Midea, Konka, Changhong';

  // Longer / legacy variants first; avoid re-replacing the canonical string.
  out = out.replace(/TCL、长虹、康佳、美的、创维/g, clientsZh);
  out = out.replace(/TCL、创维、康佳、美的/g, clientsZh);
  out = out.replace(/TCL、创维、美的、康佳(?!、长虹)/g, clientsZh);
  out = out.replace(/TCL、长虹、康佳(?!、)/g, clientsZh);
  out = out.replace(
    /TCL, Changhong, Konka, Midea, and Skyworth/g,
    clientsEn
  );
  out = out.replace(
    /TCL, Skyworth, Konka, and Midea/g,
    clientsEn
  );
  out = out.replace(
    /TCL, Skyworth, Konka, Midea(?!, Changhong)/g,
    clientsRu
  );
  out = out.replace(/TCL, Hisense, Konka/g, clientsEnMeta);
  out = out.replace(
    /TCL, Changhong, Konka, Midea, Skyworth/g,
    clientsRu
  );

  out = out.replace(
    /including TCL, Skyworth, Konka, and Midea/g,
    'including TCL, Skyworth, Midea, Konka, and Changhong'
  );
  // Deduplicate accidental double 长虹 / Changhong from stacked replaces
  out = out.replace(/长虹、长虹/g, '长虹');
  out = out.replace(/Changhong, and Changhong/g, 'Changhong');
  out = out.replace(/Changhong, Changhong/g, 'Changhong');

  // --- Patents / years ---
  out = out.replace(/斩获近百项专利/g, '斩获 98 项专利');
  out = out.replace(/近百项专利/g, '98 项专利');
  out = out.replace(/在近二十年，/g, '19 年来，');
  out = out.replace(/近二十年/g, '19 年');
  out = out.replace(/For nearly twenty years,/gi, 'For 19 years,');
  out = out.replace(/nearly twenty years/gi, '19 years');
  out = out.replace(/За почти двадцать лет/g, 'На протяжении 19 лет');

  // --- Company legal name (EN/RU timeline) ---
  out = out.replace(
    /"Shenzhen TXAM Industrial Automation Equipment Co\., Ltd\."/g,
    '"Guangdong TXAM Intelligent Equipment Co., Ltd."'
  );
  out = out.replace(
    /Registered "Shenzhen TXAM"/g,
    'Registered "Guangdong TXAM Intelligent Equipment Co., Ltd."'
  );
  out = out.replace(
    /"Шэньчжэнь TXAM Промышленная Автоматизация"/g,
    '"Guangdong TXAM Intelligent Equipment Co., Ltd."'
  );

  // --- Product name CIBF ---
  out = out.replace(/循环举升机/g, '循环式自动提升机');
  out = out.replace(/循环式提升机/g, '循环式自动提升机');
  out = out.replace(/"Circular Lifter"/g, '"Circular Automatic Lifter"');
  out = out.replace(/Circular Lifter/g, 'Circular Automatic Lifter');

  // --- Slogan ---
  out = out.replace(/提供优质智能装备/g, '提供卓越的智能装备');
  out = out.replace(
    /Providing Exceptional Intelligent Equipment to World-Class Enterprises/g,
    'Providing Exceptional Intelligent Equipment to World-Class Enterprises'
  ); // already ok if 卓越 maps to Exceptional
  // ZH news title with 优质
  out = out.replace(
    /为世界一流企业提供优质智能装备/g,
    '为世界一流企业提供卓越的智能装备'
  );

  // --- Huizhou status (align with news: in production) ---
  out = out.replace(
    /<span class="ml-3 bg-gray-100 text-xs px-2 py-1 rounded text-\[#86868B\] font-bold">建设中<\/span>/g,
    '<span class="ml-3 bg-[#FF6B00]/10 text-xs px-2 py-1 rounded text-[#FF6B00] font-bold">已投产</span>'
  );
  out = out.replace(
    /惠州市（6万㎡全新超级工厂，预计 2026 年下半年全面投产）。/g,
    '惠州市（6万㎡智能制造基地，已于 2026 年全面投产）。'
  );
  out = out.replace(
    /Huizhou \(60,000㎡ brand new super factory, expected full production in H2 2026\)\./g,
    'Huizhou (60,000㎡ intelligent manufacturing base, fully operational since 2026).'
  );
  out = out.replace(
    /Хуэйчжоу \(совершенно новый супер-завод 60,000㎡, ожидаемое полное производство во H2 2026\)\./g,
    'Хуэйчжоу (база умного производства 60,000㎡, полностью введена в эксплуатацию в 2026 году).'
  );
  // EN/RU badge Under Construction if present
  out = out.replace(/>Under Construction</g, '>In Production<');
  out = out.replace(/>Строится</g, '>В эксплуатации<');
  out = out.replace(/>в строительстве</gi, '>В эксплуатации<');

  return out;
}

let n = 0;
for (const f of walk(ROOT)) {
  // skip generated tooling noise in data products for "7 light bars"
  if (/data\/products\//.test(f.replace(/\\/g, '/'))) continue;
  const before = fs.readFileSync(f, 'utf8');
  const after = patchText(before, f);
  if (after !== before) {
    fs.writeFileSync(f, after);
    n++;
    console.log('patched', path.relative(ROOT, f));
  }
}
console.log('files', n);

// Sync news JSON titles then regenerate .js
const newsZh = path.join(ROOT, 'data/news/zh.json');
const newsEn = path.join(ROOT, 'data/news/en.json');
const newsRu = path.join(ROOT, 'data/news/ru.json');
for (const p of [newsZh, newsEn, newsRu]) {
  let j = fs.readFileSync(p, 'utf8');
  const b = j;
  j = j.replace(/循环举升机/g, '循环式自动提升机');
  j = j.replace(/为世界一流企业提供优质智能装备/g, '为世界一流企业提供卓越的智能装备');
  j = j.replace(/"Circular Lifter"/g, '"Circular Automatic Lifter"');
  j = j.replace(/Circular Lifter/g, 'Circular Automatic Lifter');
  j = j.replace(/Circular Auto Lifter/g, 'Circular Automatic Lifter');
  if (j !== b) {
    fs.writeFileSync(p, j);
    console.log('news json', path.basename(path.dirname(p)) + '/' + path.basename(p));
  }
}
