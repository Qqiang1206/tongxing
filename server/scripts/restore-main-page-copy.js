import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readPageJson, writePageJsonAny } from '../src/services/catalog.js';
import {
  collectStrings,
  snapshotEntries,
} from '../src/services/translationFields.js';
import { replaceSnapshotBatch } from '../src/services/translationSnapshot.js';
import { rememberSharedPageTitleTranslations } from '../src/services/translationMemory.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PAGES = [
  { key: 'home', html: 'index.html', titleId: 'home-hero-title', leadId: 'home-hero-lead' },
  { key: 'solutions', html: 'solutions.html', titleId: 'list-hero-title', leadId: 'list-hero-lead' },
  { key: 'products', html: 'products.html', titleId: 'list-hero-title', leadId: 'list-hero-lead' },
  { key: 'news', html: 'news.html', titleId: 'list-hero-title', leadId: 'list-hero-lead' },
  { key: 'about', html: 'about.html', titleId: 'about-hero-title', leadId: 'about-hero-lead', leadKey: 'leadHtml' },
  { key: 'contact', html: 'contact.html', titleId: 'contact-hero-title', leadId: 'contact-hero-lead' },
];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function innerHtmlById(html, id) {
  const escaped = escapeRegex(id);
  const match = html.match(
    new RegExp(`<([a-z][a-z0-9]*)[^>]*\\bid=["']${escaped}["'][^>]*>([\\s\\S]*?)<\\/\\1>`, 'i')
  );
  if (!match) throw new Error(`missing_element:${id}`);
  return match[2].trim();
}

function textOnly(html) {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactHtml(html) {
  return html.replace(/\r?\n\s*/g, '').trim();
}

function documentTitle(html) {
  const match = html.match(/<title>([\s\S]*?)<\/title>/i);
  if (!match) throw new Error('missing_document_title');
  return textOnly(match[1]);
}

function metaDescription(html) {
  const match = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
  if (!match) throw new Error('missing_meta_description');
  return match[1].trim();
}

const scopes = [];
const changes = [];
const memoryEntries = [];
let records = 0;

for (const lang of ['zh', 'en', 'ru']) {
  for (const page of PAGES) {
    const htmlPath = path.join(ROOT, lang === 'zh' ? page.html : path.join(lang, page.html));
    const html = fs.readFileSync(htmlPath, 'utf8');
    const data = readPageJson(page.key, lang);
    if (!data) throw new Error(`missing_page_data:${page.key}:${lang}`);

    data.seo = data.seo || {};
    data.hero = data.hero || {};
    data.seo.title = documentTitle(html);
    data.seo.description = metaDescription(html);
    data.hero.title = textOnly(innerHtmlById(html, page.titleId));
    data.hero[page.leadKey || 'lead'] = compactHtml(innerHtmlById(html, page.leadId));
    if (page.leadKey === 'leadHtml') delete data.hero.lead;

    writePageJsonAny(page.key, lang, data);
    records++;

    if (lang !== 'zh') {
      const source = readPageJson(page.key, 'zh');
      for (const title of [
        ['seo.title', source?.seo?.title, data.seo.title],
        ['hero.title', source?.hero?.title, data.hero.title],
      ]) {
        memoryEntries.push({
          path: title[0],
          source: title[1],
          lang,
          translation: title[2],
        });
      }

      const paths = [];
      const values = [];
      collectStrings(source, '', paths, values, null);
      scopes.push([`pages:${page.key}`, lang, '']);
      changes.push(...snapshotEntries(`pages:${page.key}`, lang, '', paths, values));
    }
  }
}

rememberSharedPageTitleTranslations(memoryEntries);
replaceSnapshotBatch(scopes, changes);
console.log(`Restored page-specific P1 and SEO copy for ${records} page/language records.`);
