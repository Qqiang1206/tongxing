import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getFixedPageTitleTranslation,
  isSharedPageTitlePath,
} from '../src/services/translationMemory.js';

test('only page SEO and hero title paths share translations', () => {
  assert.equal(isSharedPageTitlePath('seo.title'), true);
  assert.equal(isSharedPageTitlePath('hero.title'), true);
  assert.equal(isSharedPageTitlePath('timeline.title'), false);
  assert.equal(isSharedPageTitlePath('title'), false);
});

test('canonical page titles lock the TXAM brand across languages', () => {
  const seo = '同兴高科 TXAM - 中国领先的自动化品牌供应商';
  const hero = '精工制臻 同兴必达';

  assert.equal(
    getFixedPageTitleTranslation('seo.title', seo, 'en'),
    "TXAM - China's Leading Automation Equipment Supplier"
  );
  assert.equal(
    getFixedPageTitleTranslation('seo.title', seo, 'ru'),
    'TXAM - Ведущий поставщик автоматизации в Китае'
  );
  assert.equal(
    getFixedPageTitleTranslation('hero.title', hero, 'en'),
    'Precision Manufacturing, TXAM Delivers'
  );
  assert.equal(
    getFixedPageTitleTranslation('hero.title', hero, 'ru'),
    'Точное производство, TXAM выполняет'
  );
});

test('unrecognized copy is not hardcoded by the glossary', () => {
  assert.equal(getFixedPageTitleTranslation('hero.title', '新的页面标题', 'en'), null);
});
