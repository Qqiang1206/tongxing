import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PAGES = [
  { key: 'home', html: 'index.html', renderer: 'home-page.js', heroId: 'home-hero-title' },
  { key: 'solutions', html: 'solutions.html', renderer: 'solutions-list.js', heroId: 'list-hero-title' },
  { key: 'products', html: 'products.html', renderer: 'products-list.js', heroId: 'list-hero-title' },
  { key: 'news', html: 'news.html', renderer: 'news-list.js', heroId: 'list-hero-title' },
  { key: 'about', html: 'about.html', renderer: 'about-page.js', heroId: 'about-hero-title' },
  { key: 'contact', html: 'contact.html', renderer: 'contact-page.js', heroId: 'contact-hero-title' },
];

for (const lang of ['zh', 'en', 'ru']) {
  for (const page of PAGES) {
    test(`${lang}/${page.key} binds title copy to exported page data`, () => {
      const htmlPath = path.join(ROOT, lang === 'zh' ? page.html : path.join(lang, page.html));
      const html = fs.readFileSync(htmlPath, 'utf8');
      const prefix = lang === 'zh' ? '' : '../';
      const dataSrc = `${prefix}data/pages/${page.key}/${lang}.js`;
      const rendererSrc = `${prefix}assets/js/${page.renderer}`;

      assert.ok(html.includes(`id="${page.heroId}"`), `missing #${page.heroId}`);
      assert.ok(html.includes(`src="${dataSrc}"`), `missing ${dataSrc}`);
      assert.ok(html.includes(`src="${rendererSrc}"`), `missing ${rendererSrc}`);
      assert.ok(
        html.indexOf(`src="${dataSrc}"`) < html.indexOf(`src="${rendererSrc}"`),
        'page data must load before its renderer'
      );

      const jsonPath = path.join(ROOT, 'data', 'pages', page.key, `${lang}.json`);
      const jsPath = path.join(ROOT, 'data', 'pages', page.key, `${lang}.js`);
      const exported = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      const companion = fs.readFileSync(jsPath, 'utf8');
      const globalName = `__TXAM_PAGE_${page.key.toUpperCase()}_${lang.toUpperCase()}`;

      assert.equal(exported.pageKey, page.key);
      assert.equal(exported.lang, lang);
      assert.equal(typeof exported.seo?.title, 'string');
      assert.equal(typeof exported.hero?.title, 'string');

      // 核心不变量：HTML 静态兜底标题必须与导出的 CMS 数据逐字一致，
      // 否则刷新瞬间会先显示旧文案再被水合覆盖（用户可见的文案跳变）。
            const tagStart = html.indexOf('>', html.indexOf(`id="${page.heroId}"`)) + 1;
      const tagEnd = html.indexOf('</h1>', tagStart);
      const staticTitle = html.slice(tagStart, tagEnd);
      const normalize = (s) => String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      assert.equal(
        normalize(staticTitle),
        normalize(exported.hero.title),
        `${lang}/${page.key}: 静态兜底标题与 CMS 数据不一致`
      );
      assert.ok(companion.includes(`window.${globalName}=`), `missing ${globalName}`);
    });
  }
}

for (const page of PAGES) {
  test(`${page.renderer} hydrates SEO and hero title from loadPage`, () => {
    const source = fs.readFileSync(path.join(ROOT, 'assets', 'js', page.renderer), 'utf8');
    assert.match(source, new RegExp(`loadPage\\(['"]${page.key}['"]`));
    assert.match(source, /applySeo/);
    assert.ok(source.includes(page.heroId));
  });
}
