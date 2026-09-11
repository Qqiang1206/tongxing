/**
 * Patch about pages: clients section hosts + remove inline logo arrays.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

const patches = [
  {
    rel: 'about.html',
    sectionRe: /<!-- 📍 P5\.[\s\S]*?<div id="client-logos-grid"[^>]*><\/div>[\s\S]*?<\/section>/,
    sectionHtml: `<!-- 📍 P5. 真实的客户 Logo 图片墙 -->
    <section class="py-32 bg-[#F5F5F7] px-6 md:px-24 border-t border-[#E5E5EA]">
        <div class="max-w-[1400px] mx-auto fade-up text-center">
            <h2 id="about-clients-title" class="text-h1 text-[#1D1D1F] tracking-tighter mb-4">合作客户</h2>
            <p id="about-clients-subtitle" class="text-[#86868B] text-xl mb-16">世界一流制造企业的一致选择。</p>
            <div id="client-logos-grid" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-6"></div>
        </div>
    </section>`,
  },
  {
    rel: 'en/about.html',
    sectionRe: /<!-- 📍 P5\.[\s\S]*?<div id="client-logos-grid"[^>]*><\/div>[\s\S]*?<\/section>/,
    sectionHtml: `<!-- 📍 P5. Client Logo Wall -->
    <section class="py-32 bg-[#F5F5F7] px-6 md:px-24 border-t border-[#E5E5EA]">
        <div class="max-w-[1400px] mx-auto fade-up text-center">
            <h2 id="about-clients-title" class="text-h1 text-[#1D1D1F] tracking-tighter mb-4">Our Clients</h2>
            <p id="about-clients-subtitle" class="text-[#86868B] text-xl mb-16">The Choice of World-Class Manufacturing Enterprises.</p>
            <div id="client-logos-grid" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-6"></div>
        </div>
    </section>`,
  },
  {
    rel: 'ru/about.html',
    sectionRe: /<section class="py-32 bg-\[#F5F5F7\][\s\S]*?<div id="client-logos-grid"[^>]*><\/div>[\s\S]*?<\/section>/,
    sectionHtml: `<section class="py-32 bg-[#F5F5F7] px-6 md:px-24 border-t border-[#E5E5EA]">
        <div class="max-w-[1400px] mx-auto fade-up text-center">
            <h2 id="about-clients-title" class="text-h1 text-[#1D1D1F] tracking-tighter mb-4">Клиенты</h2>
            <p id="about-clients-subtitle" class="text-[#86868B] text-xl mb-16">Выбор ведущих мировых производственных предприятий.</p>
            <div id="client-logos-grid" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-6"></div>
        </div>
    </section>`,
  },
];

const logoBlockRe = /\n\s*const clientLogos = \[[\s\S]*?\];\s*\n\s*const (?:grid|logoGrid) = document\.getElementById\('client-logos-grid'\);[\s\S]*?(?=\n\s*\}\);)/;

for (const p of patches) {
  const fp = path.join(root, p.rel);
  let html = fs.readFileSync(fp, 'utf8');
  if (!html.includes('id="about-clients-title"')) {
    if (!p.sectionRe.test(html)) {
      console.error('section not found', p.rel);
    } else {
      html = html.replace(p.sectionRe, p.sectionHtml);
      console.log('section hosts', p.rel);
    }
  } else {
    console.log('hosts already', p.rel);
  }

  if (logoBlockRe.test(html)) {
    html = html.replace(logoBlockRe, '\n');
    console.log('removed inline logos', p.rel);
  } else if (html.includes('clientLogos')) {
    console.error('logo block pattern miss', p.rel);
  } else {
    console.log('no inline logos', p.rel);
  }

  fs.writeFileSync(fp, html);
}
