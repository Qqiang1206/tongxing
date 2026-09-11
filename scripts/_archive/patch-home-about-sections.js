/**
 * Add DOM ids for home/about dynamic sections and empty carousel slide host.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const indexFiles = ['index.html', 'en/index.html', 'ru/index.html'];
for (const rel of indexFiles) {
  const filePath = path.join(ROOT, rel);
  let html = fs.readFileSync(filePath, 'utf8');

  html = html.replace(
    /<h2 class="text-h1 text-\[#1D1D1F\] mb-8 tracking-tighter">[\s\S]*?<\/h2>/,
    '<h2 id="home-about-title" class="text-h1 text-[#1D1D1F] mb-8 tracking-tighter">About</h2>'
  );
  html = html.replace(
    /<p class="text-body-lg text-\[#86868B\][^"]*max-w-4xl">[\s\S]*?<\/p>/,
    '<p id="home-about-body" class="text-body-lg text-[#86868B] leading-relaxed font-light max-w-4xl"></p>'
  );
  html = html.replace(
    /(<section id="about"[\s\S]*?<div class=")(grid grid-cols-2 md:grid-cols-4 gap-8 border-t border-\[#E5E5EA\] pt-16)(">)/,
    '$1grid grid-cols-2 md:grid-cols-4 gap-8 border-t border-[#E5E5EA] pt-16" id="home-stats-grid">'
  );

  fs.writeFileSync(filePath, html);
  console.log('patched', rel);
}

const aboutFiles = ['about.html', 'en/about.html', 'ru/about.html'];
const slideBlock =
  /<div id="factory-carousel" class="factory-carousel">[\s\S]*?<div class="factory-carousel__controls">/;

const carouselHost =
  '<div id="factory-carousel" class="factory-carousel">\n' +
  '                <div id="factory-carousel-slides"></div>\n' +
  '                <div class="factory-carousel__controls">';

for (const rel of aboutFiles) {
  const filePath = path.join(ROOT, rel);
  let html = fs.readFileSync(filePath, 'utf8');

  html = html.replace(slideBlock, carouselHost);

  html = html.replace(
    '<div class="factory-carousel__dots" role="tablist">',
    '<div id="factory-carousel-dots" class="factory-carousel__dots" role="tablist"></div><!-- dots -->'
  );
  html = html.replace(
    /<div id="factory-carousel-dots" class="factory-carousel__dots" role="tablist"><\/div><!-- dots -->[\s\S]*?<\/div>\s*<button type="button" class="factory-carousel__arrow" data-factory-next/,
    '<div id="factory-carousel-dots" class="factory-carousel__dots" role="tablist"></div>\n' +
    '                    <button type="button" class="factory-carousel__arrow" data-factory-next'
  );

  html = html.replace(
    /(<section class="py-20 bg-white px-6 md:px-24">[\s\S]*?<div class=")(grid grid-cols-2 md:grid-cols-5 gap-6 border-t border-\[#E5E5EA\] pt-16)(">)/,
    '$1grid grid-cols-2 md:grid-cols-5 gap-6 border-t border-[#E5E5EA] pt-16" id="about-stats-grid">'
  );

  if (!html.includes('id="about-hero-lead"')) {
    html = html.replace(
      /(<p)( class="text-body-lg text-\[#86868B\][^"]*max-w-4xl[^"]*">)/,
      '$1 id="about-hero-lead"$2'
    );
  }

  fs.writeFileSync(filePath, html);
  console.log('patched', rel);
}

console.log('Done.');
