import fs from 'fs';
import path from 'path';

const ROOT = 'h:/tongxing';

function patchHome(lang, featured) {
  const p = path.join(ROOT, 'data/pages/home', lang + '.json');
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  data.featured = featured;
  const cards = (data.productsSection && data.productsSection.cards) || [];
  const legacyUnit = cards.find((c) => /products\.html/i.test(c.href || ''));
  data.productsSection = {
    title: data.productsSection.title,
    subtitle: data.productsSection.subtitle,
    unitCard: data.productsSection.unitCard || legacyUnit,
  };
  if (data.newsSection) delete data.newsSection.featured;
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
  console.log('patched home', lang);
}

patchHome('en', {
  eyebrow: 'Flagship Solution',
  subtitle: '65~110" compatible | Fully automated assembly',
  cta: 'View Solution →',
});

patchHome('ru', {
  eyebrow: 'Флагманское решение',
  subtitle: '',
  cta: 'Смотреть решение →',
});

// Patch catalog JSON homeSlot / homeFeatured for all langs
for (const lang of ['zh', 'en', 'ru']) {
  const sp = path.join(ROOT, 'data/solutions', lang + '.json');
  const solutions = JSON.parse(fs.readFileSync(sp, 'utf8'));
  for (const id of Object.keys(solutions)) {
    delete solutions[id].homeSlot;
  }
  if (solutions['31']) solutions['31'].homeSlot = 'hero';
  if (solutions['32']) solutions['32'].homeSlot = 'category';
  if (solutions['33']) solutions['33'].homeSlot = 'category';
  fs.writeFileSync(sp, JSON.stringify(solutions, null, 2) + '\n');

  const np = path.join(ROOT, 'data/news', lang + '.json');
  const news = JSON.parse(fs.readFileSync(np, 'utf8'));
  for (const id of Object.keys(news)) {
    news[id].homeFeatured = id === '1' || id === '2';
  }
  fs.writeFileSync(np, JSON.stringify(news, null, 2) + '\n');
  console.log('patched catalog', lang);
}

console.log('ok');
