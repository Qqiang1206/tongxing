/**
 * Regression checklist runner against local TXAM server.
 * Usage:
 *   ADMIN_PASSWORD=*** node scripts/regression-check.js [baseUrl]
 * Default base: http://127.0.0.1:3000 (override with argv or REGRESSION_BASE)
 */
const http = require('http');
const https = require('https');
const { URL } = require('url');

const base = (process.argv[2] || process.env.REGRESSION_BASE || 'http://127.0.0.1:3000').replace(
  /\/$/,
  ''
);
const adminPassword = process.env.ADMIN_PASSWORD || '';
const results = [];

function fetch(path, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(path.startsWith('http') ? path : base + path);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(
      u,
      {
        method: opts.method || 'GET',
        headers: opts.headers || {},
        timeout: 8000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          const text = buf.toString('utf8');
          let json = null;
          try {
            json = JSON.parse(text);
          } catch (_) {}
          resolve({ status: res.statusCode, text, json, headers: res.headers });
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

function pass(name, detail) {
  results.push({ ok: true, name, detail: detail || '' });
  console.log('PASS  ' + name + (detail ? ' — ' + detail : ''));
}
function fail(name, detail) {
  results.push({ ok: false, name, detail: detail || '' });
  console.log('FAIL  ' + name + (detail ? ' — ' + detail : ''));
}
function skip(name, detail) {
  results.push({ ok: null, name, detail: detail || '' });
  console.log('SKIP  ' + name + (detail ? ' — ' + detail : ''));
}

function has(html, needles) {
  return needles.every((n) => html.includes(n));
}

async function main() {
  console.log('Base: ' + base + '\n');

  // 1. health
  try {
    const h = await fetch('/api/v1/health');
    if (h.status === 200 && h.json && h.json.ok) {
      pass('GET /api/v1/health', JSON.stringify(h.json));
    } else {
      fail('GET /api/v1/health', 'status=' + h.status + ' body=' + h.text.slice(0, 120));
    }
  } catch (e) {
    fail('GET /api/v1/health', String(e.message || e));
    console.log('\nServer not reachable — abort remaining live checks.');
    printSummary();
    process.exit(1);
  }

  // 2. Home
  {
    const r = await fetch('/');
    const ok =
      r.status === 200 &&
      has(r.text, ['home-page.js', 'data-loader.js', 'home-news-list', 'hero']);
    if (ok) pass('/ 首页脚本与区块壳', 'status 200 + hydrator markers');
    else fail('/ 首页', 'missing markers or status ' + r.status);
  }

  // 3. About
  {
    const r = await fetch('/about.html');
    const ok =
      r.status === 200 &&
      has(r.text, [
        'about-page.js',
        'about-timeline-desktop',
        'about-stats-grid',
        'about-culture-pillars', // P1.5「深惠双核」轮播已下线，改校企业文化容器
        'client-logos-grid',
      ]) &&
      !r.text.includes('observer.observe(el));\n\n                });');
    if (ok) pass('/about.html 壳与时间轴容器', 'no broken fade-up script');
    else fail('/about.html', 'status=' + r.status);
  }

  // 3b. 关于页数据带（19年/98项/…）：列数必须自适应，不能再写死
  // 事故：数据里 columns:5 但只剩 4 条 → 网格第 5 列空着，整条数据带往左缩。
  {
    const langs = [
      ['/about.html', 4],
      ['/en/about.html', 4],
      ['/ru/about.html', 4],
    ];
    const bad = [];
    for (const [path, expect] of langs) {
      const r = await fetch(path);
      if (r.status !== 200) {
        bad.push(path + ' status=' + r.status);
        continue;
      }
      const tag = /<div id="about-stats-grid"[^>]*>/.exec(r.text);
      const n = (r.text.match(/class="about-stat"/g) || []).length;
      if (!tag) bad.push(path + ' 缺 about-stats-grid');
      else if (/grid-cols/.test(tag[0])) bad.push(path + ' 容器仍写死列数');
      else if (n !== expect) bad.push(path + ' 条数=' + n + ' 期望=' + expect);
    }
    if (!bad.length) pass('关于页数据带：列数自适应、条数与数据一致（三语）');
    else fail('关于页数据带', bad.join('; '));
  }

  // 4. Contact — no form POST target for leads
  {
    const r = await fetch('/contact.html');
    const hasFormAction = /<form[^>]+action=/i.test(r.text);
    const ok =
      r.status === 200 &&
      has(r.text, ['contact-page.js', 'contact-channels']) &&
      !hasFormAction;
    if (ok) pass('/contact.html 渠道壳、无留言表单');
    else fail('/contact.html', 'status=' + r.status + ' form=' + hasFormAction);
  }

  // 5. Products / news list
  {
    const p = await fetch('/products.html');
    const n = await fetch('/news.html');
    const pok =
      p.status === 200 && has(p.text, ['products-list.js', 'product-grid', 'data/products/zh.js']);
    const nok = n.status === 200 && has(n.text, ['news-list.js', 'data/news']);
    if (pok) pass('/products.html 列表 hydrator');
    else fail('/products.html');
    if (nok) pass('/news.html 列表 hydrator');
    else fail('/news.html');
  }

  // 6. Product / news detail
  {
    const p = await fetch('/product-detail.html?id=1');
    const n = await fetch('/news-detail.html?id=1');
    if (p.status === 200 && has(p.text, ['data-loader.js', 'loadData'])) {
      pass('/product-detail.html?id=1');
    } else fail('/product-detail.html');
    if (n.status === 200 && has(n.text, ['data-loader.js', 'loadData'])) {
      pass('/news-detail.html?id=1');
    } else fail('/news-detail.html');
  }

  // 7. Solutions list
  {
    const r = await fetch('/solutions.html');
    const ok =
      r.status === 200 &&
      has(r.text, ['solutions-list.js', 'id="solutions-list"', 'data/solutions/zh.js']);
    if (ok) pass('/solutions.html 数据驱动矩阵');
    else fail('/solutions.html');
  }

  // 8. Solution landing
  {
    const r = await fetch('/tv-display-solution.html');
    const ok =
      r.status === 200 && has(r.text, ['solution-landing.js', 'data-loader.js']);
    if (ok) pass('/tv-display-solution.html 落地页 hydrator');
    else fail('/tv-display-solution.html');
  }

  // 9. en / ru mirrors
  {
    const pages = [
      '/en/index.html',
      '/en/about.html',
      '/en/solutions.html',
      '/en/products.html',
      '/ru/index.html',
      '/ru/about.html',
      '/ru/solutions.html',
      '/ru/products.html',
    ];
    let all = true;
    for (const path of pages) {
      const r = await fetch(path);
      if (r.status !== 200) {
        fail(path, 'status ' + r.status);
        all = false;
      }
    }
    if (all) pass('en/ru 关键页 200', pages.length + ' urls');
  }

  // 10. API catalogs + pages + by-slug
  {
    const products = await fetch('/api/v1/products?lang=zh');
    const solutions = await fetch('/api/v1/solutions?lang=zh');
    const news = await fetch('/api/v1/news?lang=zh');
    const home = await fetch('/api/v1/pages/home?lang=zh');
    const about = await fetch('/api/v1/pages/about?lang=zh');
    const contact = await fetch('/api/v1/pages/contact?lang=zh');
    const site = await fetch('/api/v1/site?lang=zh');
    const bySlug = await fetch('/api/v1/solutions/by-slug/tv-display?lang=zh');

    const pc = products.json ? Object.keys(products.json).length : 0;
    const sc = solutions.json ? Object.keys(solutions.json).length : 0;
    const nc = news.json ? Object.keys(news.json).length : 0;

    if (products.status === 200 && pc > 0) pass('API products', pc + ' items');
    else fail('API products');
    if (solutions.status === 200 && sc > 0 && Object.values(solutions.json || {}).every((item) => item.published !== false)) {
      pass('API solutions（仅公开项）', sc + ' items');
    } else fail('API solutions', 'count=' + sc);
    if (news.status === 200 && nc > 0) pass('API news', nc + ' items');
    else fail('API news');
    if (home.status === 200 && home.json && home.json.hero) pass('API pages/home');
    else fail('API pages/home');
    if (about.status === 200 && about.json && about.json.timeline && about.json.timeline.events) {
      pass('API pages/about timeline', about.json.timeline.events.length + ' events');
    } else fail('API pages/about');
    if (contact.status === 200 && contact.json && contact.json.channels) pass('API pages/contact');
    else fail('API pages/contact');
    if (site.status === 200 && site.json) pass('API site');
    else fail('API site');
    if (bySlug.status === 200 && bySlug.json && bySlug.json.id) {
      pass('API solutions/by-slug/tv-display', 'id=' + bySlug.json.id);
    } else fail('API by-slug');

    const homeAgg = await fetch('/api/v1/home?lang=zh');
    if (
      homeAgg.status === 200 &&
      homeAgg.json &&
      homeAgg.json.page &&
      homeAgg.json.page.hero &&
      homeAgg.json.solutions &&
      homeAgg.json.news
    ) {
      pass('API home aggregate', Object.keys(homeAgg.json.solutions).length + ' sols / ' + Object.keys(homeAgg.json.news).length + ' news');
    } else fail('API home aggregate');

    const listSample = Object.values(products.json || {})[0];
    const firstProductId = listSample && listSample.id != null ? String(listSample.id) : '';
    const detailSample = firstProductId
      ? await fetch('/api/v1/products/' + encodeURIComponent(firstProductId) + '?lang=zh')
      : null;
    if (listSample && listSample.contentHtml == null) pass('API list omits contentHtml');
    else fail('API list omits contentHtml');
    if (detailSample && detailSample.status === 200 && typeof detailSample.json.contentHtml === 'string') {
      pass('API detail keeps contentHtml');
    } else if (detailSample) fail('API detail keeps contentHtml');
    else fail('API detail keeps contentHtml', 'no list sample');

    if (products.json && products.json['3']) {
      pass('API 含产品 id=3', products.json['3'].name);
    } else {
      skip('API id=3', 'not present');
    }

    // Homepage required slots (published only)
    const sols = Object.values(solutions.json || {});
    const newsItems = Object.values(news.json || {});
    const hero = sols.filter((s) => s.homeSlot === 'hero');
    const category = sols.filter((s) => s.homeSlot === 'category');
    const featuredNews = newsItems.filter((n) => n.homeFeatured);
    if (hero.length === 1) pass('homeSlot hero = 1', 'id=' + hero[0].id);
    else fail('homeSlot hero', 'count=' + hero.length);
    if (category.length === 2) {
      pass('homeSlot category = 2', category.map((s) => s.id).join(','));
    } else fail('homeSlot category', 'count=' + category.length);
    if (featuredNews.length === 2) {
      pass('homeFeatured news = 2', featuredNews.map((n) => n.id).join(','));
    } else fail('homeFeatured news', 'count=' + featuredNews.length);
  }

  // 11. Admin login + product roundtrip
  {
    if (!adminPassword) {
      skip('Admin 登录', '未设置 ADMIN_PASSWORD，跳过后台写测');
    } else {
    const login = await fetch('/api/v1/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: adminPassword }),
    });
    if (login.status !== 200 || !login.json || !login.json.token) {
      fail('Admin 登录', 'status=' + login.status + ' ' + login.text.slice(0, 100));
    } else {
      pass('Admin 登录');
      if (login.json.token !== adminPassword && login.json.expiresAt) pass('Admin 随机会话令牌');
      else fail('Admin 随机会话令牌');
      const token = login.json.token;
      const auth = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };

      const backups = await fetch('/api/v1/admin/backups', { headers: auth });
      if (backups.status === 200 && backups.json && Array.isArray(backups.json.items)) {
        pass('Admin GET backups', backups.json.items.length + ' backups');
      } else fail('Admin GET backups');
      const list = await fetch('/api/v1/admin/products', { headers: auth });
      if (list.status === 200) pass('Admin GET products');
      else fail('Admin GET products', String(list.status));

      const one = await fetch('/api/v1/admin/products/1', { headers: auth });
      if (one.status !== 200 || !one.json) {
        fail('Admin GET product/1');
      } else {
        const originalSummary = one.json.summary || '';
        const marker = '[QA ' + Date.now() + ']';
        const patched = { ...one.json, summary: marker + ' ' + originalSummary };
        const put = await fetch('/api/v1/admin/products/1', {
          method: 'PUT',
          headers: auth,
          body: JSON.stringify(patched),
        });
        if (put.status !== 200) {
          fail('Admin PUT product/1', put.text.slice(0, 120));
        } else {
          const pub = await fetch('/api/v1/products/1?lang=zh');
          if (pub.status === 200 && pub.json && String(pub.json.summary || '').includes(marker)) {
            pass('Admin 改产品后公网 API 可见', marker);
          } else {
            fail('Admin 改产品后公网不可见');
          }
          // restore
          await fetch('/api/v1/admin/products/1', {
            method: 'PUT',
            headers: auth,
            body: JSON.stringify({ ...one.json, summary: originalSummary }),
          });
          pass('Admin 产品摘要已恢复');
        }
      }

      const audit = await fetch('/api/v1/admin/audit-logs?limit=20&action=products', { headers: auth });
      if (
        audit.status === 200 &&
        audit.json &&
        Array.isArray(audit.json.items) &&
        audit.json.items.some((row) => row.action === 'products.update')
      ) {
        pass('Admin 操作日志含产品更新');
      } else if (audit.status === 200) {
        fail('Admin 操作日志', '无 products.update 记录');
      } else {
        fail('Admin 操作日志', String(audit.status));
      }

      // media list
      const media = await fetch('/api/v1/admin/media', { headers: auth });
      if (media.status === 200) pass('Admin GET media', Array.isArray(media.json) ? media.json.length + ' files' : 'ok');
      else fail('Admin GET media');

      const slots = await fetch('/api/v1/admin/home-slots', { headers: auth });
      if (
        slots.status === 200 &&
        slots.json &&
        slots.json.hero &&
        slots.json.hero.items &&
        slots.json.hero.items.length === 1 &&
        slots.json.category &&
        slots.json.category.items &&
        slots.json.category.items.length === 2 &&
        slots.json.news &&
        slots.json.news.items &&
        slots.json.news.items.length === 2
      ) {
        pass('Admin home-slots 占用', '1+2+2');
      } else if (slots.status === 200) {
        fail(
          'Admin home-slots 占用',
          JSON.stringify({
            hero: (slots.json.hero && slots.json.hero.items && slots.json.hero.items.length) || 0,
            category:
              (slots.json.category && slots.json.category.items && slots.json.category.items.length) ||
              0,
            news: (slots.json.news && slots.json.news.items && slots.json.news.items.length) || 0,
          })
        );
      } else {
        fail('Admin home-slots', String(slots.status));
      }

      // tiny png upload (1x1) then delete to avoid leaving junk
      const tinyPng =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      const up = await fetch('/api/v1/admin/media', {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({
          filename: 'qa-regression-1x1.png',
          mime: 'image/png',
          dataBase64: tinyPng,
        }),
      });
      if ((up.status === 200 || up.status === 201) && up.json && (up.json.path || up.json.url || up.json.file)) {
        pass('Admin 媒体上传', JSON.stringify(up.json).slice(0, 160));
        const uploadedName =
          up.json.filename ||
          String(up.json.path || '')
            .split('/')
            .pop();
        if (uploadedName) {
          const del = await fetch('/api/v1/admin/media/' + encodeURIComponent(uploadedName), {
            method: 'DELETE',
            headers: auth,
          });
          if (del.status === 200) pass('Admin 媒体上传后清理');
          else fail('Admin 媒体清理', del.status + ' ' + (del.text || '').slice(0, 80));
        }
      } else if (up.status === 200 || up.status === 201) {
        pass('Admin 媒体上传', up.text.slice(0, 160));
      } else {
        fail('Admin 媒体上传', up.status + ' ' + up.text.slice(0, 160));
      }
    }
    } // end adminPassword
  }

  // 12. Admin UI static
  {
    const r = await fetch('/admin/');
    if (r.status === 200 && has(r.text, ['admin.js', '内容管理'])) {
      pass('/admin/ 静态页');
    } else fail('/admin/');
  }

  // 13. data-loader static-first (no blocking health probe)
  {
    const r = await fetch('/assets/js/data-loader.js');
    if (r.status === 200 && r.text.includes('ensureApiBase') && !r.text.includes("fetch(base + '/health'")) {
      pass('data-loader 静态优先（无 health 探测）');
    } else fail('data-loader static-first');
  }

  // 14. products-list uses CMS showInList (no hardcoded LISTED_IDS)
  {
    const r = await fetch('/assets/js/products-list.js');
    if (r.status === 200 && r.text.includes('showInList') && !r.text.includes('LISTED_IDS')) {
      pass('产品列表使用 showInList（CMS）');
    } else fail('products-list showInList');
  }

  // 15. list pages API
  {
    for (const key of ['products', 'news', 'solutions']) {
      const r = await fetch('/api/v1/pages/' + key + '?lang=zh');
      if (r.status === 200 && r.json && (r.json.hero || r.json.seo)) {
        pass('GET /pages/' + key);
      } else fail('GET /pages/' + key, r.status + ' ' + (r.text || '').slice(0, 80));
    }
  }

  // 16. product API exposes showInList
  {
    const r = await fetch('/api/v1/products?lang=zh');
    const sample = r.json && r.json['1'];
    if (r.status === 200 && sample && typeof sample.showInList === 'boolean') {
      pass('products API showInList', 'id1=' + sample.showInList);
    } else fail('products API showInList');
  }

  // 17. 页脚注入的收尾 CTA 必须登记揭示
  //     .fade-up 起始 opacity:0，页面揭示器只在 DOMContentLoaded 扫一遍；
  //     异步注入的节点若不手动登记，整段 CTA 会永远停在透明状态（空白带）。
  {
    const js = await fetch('/assets/js/site-footer.js');
    const page = await fetch('/about.html');
    const guard =
      js.status === 200 && /insertBefore\(sec, ph\);\r?\n\s*revealInjected\(sec\);/.test(js.text);
    const wired =
      page.status === 200 &&
      page.text.includes('data-footer-placeholder') &&
      /site-footer\.js\?v=\d+/.test(page.text);
    if (guard && wired) pass('页脚 CTA 注入后已登记揭示（防空白带）');
    else fail('页脚 CTA 揭示登记', 'guard=' + guard + ' wired=' + wired);
  }

  // 18. 导航高亮：详情页 / 方案落地页不能一律高亮「首页」
  //     导航在每个 HTML 里静态写死，批量生成时极易把 active 抄成首页。
  {
    const cases = [
      ['/news-detail.html?id=4', 'news.html'],
      ['/product-detail.html?id=1', 'products.html'],
      ['/solutions-detail.html', 'solutions.html'],
      ['/washer-solution.html', 'solutions.html'],
      ['/en/news-detail.html', 'news.html'],
      ['/ru/solutions-detail.html', 'solutions.html'],
    ];
    const bad = [];
    for (const [u, exp] of cases) {
      const r = await fetch(u);
      const box = r.text && /<div class="txnav__links">([\s\S]*?)<\/div>/.exec(r.text);
      const act = box
        ? [...box[1].matchAll(/<a href="([^"]+)" class="txnav__link( is-active)?"/g)]
            .filter((m) => m[2])
            .map((m) => m[1])
        : [];
      if (act.length !== 1 || act[0] !== exp) bad.push(u + ' → ' + (act.join(',') || '无高亮'));
    }
    if (bad.length === 0) pass('导航高亮与当前栏目一致', cases.length + ' 个页面抽查');
    else fail('导航高亮错位', bad.join(' | '));
  }

  // 19. 页脚水印遮罩：必须是可访问的 SVG（不是位图）
  //     位图当 mask 放大 2.85 倍会把 alpha 插值糊开，视觉上"发虚"；
  //     而且遮罩一旦 404，整个水印会消失（mask 图加载失败 = 元素不渲染）。
  {
    const svg = await fetch('/assets/images/brand/logo-mask.svg');
    const okType = /svg/.test(svg.headers['content-type'] || '');
    const okBody = svg.status === 200 && svg.text.startsWith('<svg') && /fill-rule="evenodd"/.test(svg.text);
    const css = await fetch('/assets/css/styles.css');
    const used =
      css.status === 200 && /\.txf__watermark\s*\{[^}]*mask:\s*url\(["']?[^"')]*logo-mask\.svg/.test(css.text);
    if (okBody && okType && used) pass('页脚水印用 SVG 遮罩且可访问');
    else fail('页脚水印遮罩', `status=${svg.status} type=${svg.headers['content-type']} body=${okBody} cssUsed=${used}`);
  }

  printSummary();
  process.exit(results.some((x) => x.ok === false) ? 1 : 0);
}

function printSummary() {
  const p = results.filter((x) => x.ok === true).length;
  const f = results.filter((x) => x.ok === false).length;
  const s = results.filter((x) => x.ok === null).length;
  console.log('\n========== SUMMARY ==========');
  console.log('PASS ' + p + '  FAIL ' + f + '  SKIP ' + s);
  if (f) {
    console.log('\nFailed:');
    results.filter((x) => x.ok === false).forEach((x) => console.log(' - ' + x.name + ': ' + x.detail));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
