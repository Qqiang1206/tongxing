// scripts/test-breadcrumb-i18n.js
// 验证 footer.js 多语言化是否正确（修复版：每个页面独立 dom）
const fs = require('fs');
const path = require('path');

const ROOT = 'H:\\tongxing';
const FOOTER = fs.readFileSync(path.join(ROOT, 'footer.js'), 'utf-8');

const iifeMatch = FOOTER.match(/\(function\(\)\s*\{[\s\S]*?\}\)\(\);/);
if (!iifeMatch) {
    console.error('FAIL: footer.js 中找不到面包屑 IIFE');
    process.exit(1);
}
const iifeCode = iifeMatch[0];

function makeSessionStorage() {
    const store = {};
    return {
        getItem: (k) => store[k] || null,
        setItem: (k, v) => { store[k] = v; },
        removeItem: (k) => { delete store[k]; },
        clear: () => { Object.keys(store).forEach(k => delete store[k]); }
    };
}

function makeDom(h1Text) {
    return {
        body: { dataset: {} },
        referrer: '',
        querySelector: (sel) => {
            if (sel === 'h1') return h1Text ? { textContent: h1Text.trim() } : null;
            if (sel === '[data-breadcrumb]') return {
                innerHTML: '',
                querySelectorAll: () => [],
                addEventListener: () => {}
            };
            return null;
        },
        querySelectorAll: (sel) => {
            if (sel === '[data-footer-placeholder]') return [];
            return [];
        },
        addEventListener: () => {}
    };
}

function makeLocation(pathname) {
    const url = new URL('http://localhost/' + pathname.replace(/^\//, ''));
    return { pathname: url.pathname, origin: url.origin };
}

// 在指定页面（currentPath）执行 breadcrumb
function visit(session, dom, currentPath, referrer) {
    const loc = makeLocation(currentPath);
    dom.referrer = referrer || '';
    const fn = new Function('sessionStorage', 'document', 'location', iifeCode);
    fn(session, dom, loc);
}

// 从 sessionStorage 读取对应语言的 history
function readHistory(session, lang) {
    return JSON.parse(session.getItem('txam-nav-history-' + lang) || '[]');
}

// ====== 测试用例 ======
const tests = [];
function test(name, fn) {
    tests.push({ name, fn });
}

// 测试 1: 中文版首页 → tv-display 详情
test('中文版: 首页 → tv-display 详情', () => {
    const s = makeSessionStorage();

    // 访问首页（首页没有 h1）
    visit(s, makeDom(null), 'index.html', '');
    // 访问 tv-display
    visit(s, makeDom('TV/商业显示器柔性装配产线'), 'tv-display-solution.html', 'http://localhost/index.html');

    const history = readHistory(s, 'zh');
    return {
        history,
        pass: history.length === 2 &&
              history[0].page === 'index.html' &&
              history[0].name === '首页' &&
              history[1].page === 'tv-display-solution.html' &&
              history[1].name === 'TV/商业显示器柔性装配产线'
    };
});

// 测试 2: 英文版首页 → tv-display (用户报错的场景)
test('英文版: 首页 → tv-display 详情 (用户报错场景)', () => {
    const s = makeSessionStorage();
    visit(s, makeDom(null), 'index-en.html', '');
    visit(s, makeDom('TV/Commercial Display Flexible Assembly Line'), 'tv-display-solution-en.html', 'http://localhost/index-en.html');

    const history = readHistory(s, 'en');
    return {
        history,
        pass: history.length === 2 &&
              history[0].page === 'index-en.html' &&
              history[0].name === 'Home' &&
              history[1].page === 'tv-display-solution-en.html' &&
              history[1].name === 'TV/Commercial Display Flexible Assembly Line'
    };
});

// 测试 3: 俄文版首页 → tv-display
test('俄文版: 首页 → tv-display 详情', () => {
    const s = makeSessionStorage();
    visit(s, makeDom(null), 'index-ru.html', '');
    visit(s, makeDom('Гибкая сборочная линия для ТВ/коммерческих дисплеев'), 'tv-display-solution-ru.html', 'http://localhost/index-ru.html');

    const history = readHistory(s, 'ru');
    return {
        history,
        pass: history.length === 2 &&
              history[0].page === 'index-ru.html' &&
              history[0].name === 'Главная' &&
              history[1].page === 'tv-display-solution-ru.html' &&
              history[1].name === 'Гибкая сборочная линия для ТВ/коммерческих дисплеев'
    };
});

// 测试 4: sessionStorage 不互相污染
test('sessionStorage 三语言互相独立', () => {
    const s = makeSessionStorage();
    visit(s, makeDom(null), 'index.html', '');
    visit(s, makeDom(null), 'about.html', 'http://localhost/index.html');
    visit(s, makeDom(null), 'index-en.html', '');
    visit(s, makeDom(null), 'about-en.html', 'http://localhost/index-en.html');
    visit(s, makeDom(null), 'index-ru.html', '');
    visit(s, makeDom(null), 'about-ru.html', 'http://localhost/index-ru.html');

    const zhPages = readHistory(s, 'zh').map(h => h.page);
    const enPages = readHistory(s, 'en').map(h => h.page);
    const ruPages = readHistory(s, 'ru').map(h => h.page);
    return {
        zh: zhPages,
        en: enPages,
        ru: ruPages,
        pass: zhPages.length === 2 && enPages.length === 2 && ruPages.length === 2 &&
              zhPages.every(p => p.endsWith('.html') && !p.endsWith('-en.html') && !p.endsWith('-ru.html')) &&
              enPages.every(p => p.endsWith('-en.html')) &&
              ruPages.every(p => p.endsWith('-ru.html'))
    };
});

// 测试 5: 中文版访问层次
test('中文版: 首页 → 解决方案 → tv-display (3 层)', () => {
    const s = makeSessionStorage();
    visit(s, makeDom(null), 'index.html', '');
    visit(s, makeDom('解决方案'), 'solutions.html', 'http://localhost/index.html');
    visit(s, makeDom('TV/商业显示器柔性装配产线'), 'tv-display-solution.html', 'http://localhost/solutions.html');

    const history = readHistory(s, 'zh');
    return {
        history: history.map(h => `${h.page}(${h.name})`),
        pass: history.length === 3 &&
              history[0].page === 'index.html' &&
              history[1].page === 'solutions.html' &&
              history[2].page === 'tv-display-solution.html'
    };
});

// 测试 6: 英文版访问层次（验证面包屑中英文名显示）
test('英文版: 首页 → 解决方案 → tv-display (3 层英文名)', () => {
    const s = makeSessionStorage();
    visit(s, makeDom(null), 'index-en.html', '');
    visit(s, makeDom('Solutions'), 'solutions-en.html', 'http://localhost/index-en.html');
    visit(s, makeDom('TV/Commercial Display Flexible Assembly Line'), 'tv-display-solution-en.html', 'http://localhost/solutions-en.html');

    const history = readHistory(s, 'en');
    return {
        history: history.map(h => `${h.page}(${h.name})`),
        pass: history.length === 3 &&
              history[0].name === 'Home' &&
              history[1].name === 'Solutions' &&
              history[2].name === 'TV/Commercial Display Flexible Assembly Line'
    };
});

// ====== 运行 ======
console.log('=== 三语面包屑测试 ===\n');
let passCount = 0;
for (const t of tests) {
    const result = t.fn();
    const status = result.pass ? '✓ PASS' : '✗ FAIL';
    if (result.pass) passCount++;
    console.log(`[${status}] ${t.name}`);
    if (!result.pass) {
        console.log('  Result:', JSON.stringify(result, null, 2).substring(0, 800));
    } else if (result.history && Array.isArray(result.history) && result.history.length > 0 && typeof result.history[0] === 'string') {
        console.log(`  history: ${result.history.join(' → ')}`);
    }
    console.log();
}

console.log(`\n总计: ${passCount}/${tests.length} 通过`);
process.exit(passCount === tests.length ? 0 : 1);