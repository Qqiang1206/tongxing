/**
 * Replace static credentials gallery with empty hosts for JS render.
 */
const fs = require('fs');
const path = require('path');

const files = [
  {
    rel: 'about.html',
    startMarker: '<!-- 📍 P4. 真实图片版：企业资质与专利画廊 -->',
    endMarker: '<!-- 📍 P5. 真实的客户 Logo 图片墙 -->',
    title: '企业资质与核心专利',
    subtitle: '真金不怕火炼，用实打实的荣誉证书与 98 项专利图纸证明实力。',
  },
  {
    rel: 'en/about.html',
    startMarker: '<!-- 📍 P4. Qualifications & Patents Gallery -->',
    endMarker: '<!-- 📍 P5.',
    title: 'Corporate Qualifications & Core Patents',
    subtitle: 'Proven strength through genuine honors and 98 patent certificates.',
  },
  {
    rel: 'ru/about.html',
    startMarker: null, // detect by patent-marquee parent section
    endMarker: null,
    title: 'Квалификация и патенты',
    subtitle: 'Реальные сертификаты и 98 патентов подтверждают наши возможности.',
  },
];

function host(title, subtitle) {
  return `    <section class="py-32 bg-white px-6 md:px-24">
        <div class="max-w-[1400px] mx-auto fade-up">
            <div class="text-center mb-20">
                <h2 id="about-credentials-title" class="text-h1 text-[#1D1D1F] tracking-tighter mb-4">${title}</h2>
                <p id="about-credentials-subtitle" class="text-[#86868B] text-xl">${subtitle}</p>
            </div>
            <div id="about-credentials-groups"></div>
        </div>
    </section>

`;
}

function patchWithMarkers(html, startMarker, endMarker, title, subtitle) {
  const startIdx = html.indexOf(startMarker);
  if (startIdx === -1) return null;
  const endIdx = html.indexOf(endMarker, startIdx);
  if (endIdx === -1) return null;
  return html.slice(0, startIdx) + host(title, subtitle) + html.slice(endIdx);
}

function patchRu(html, title, subtitle) {
  // Find first patent-marquee, walk back to its outer <section>, replace until next <section after </section>
  if (html.includes('id="about-credentials-title"')) return html;
  const marquee = html.indexOf('patent-marquee');
  if (marquee === -1) return null;
  const sectionStart = html.lastIndexOf('<section', marquee);
  if (sectionStart === -1) return null;
  // Find closing of this section by scanning for matching depth
  let i = sectionStart;
  let depth = 0;
  let end = -1;
  while (i < html.length) {
    const open = html.indexOf('<section', i);
    const close = html.indexOf('</section>', i);
    if (close === -1) break;
    if (open !== -1 && open < close) {
      depth += 1;
      i = open + 8;
    } else {
      depth -= 1;
      i = close + '</section>'.length;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) return null;
  // Also remove leading comment if present
  let from = sectionStart;
  const commentStart = html.lastIndexOf('<!--', sectionStart);
  if (commentStart !== -1 && sectionStart - commentStart < 200) {
    from = commentStart;
  }
  return html.slice(0, from) + host(title, subtitle) + html.slice(end);
}

const root = path.join(__dirname, '..');

for (const f of files) {
  const filePath = path.join(root, f.rel);
  let html = fs.readFileSync(filePath, 'utf8');
  if (html.includes('id="about-credentials-title"')) {
    console.log('already patched', f.rel);
    continue;
  }

  let next;
  if (f.rel === 'ru/about.html') {
    next = patchRu(html, f.title, f.subtitle);
  } else {
    next = patchWithMarkers(html, f.startMarker, f.endMarker, f.title, f.subtitle);
  }

  if (!next) {
    console.error('failed', f.rel);
    continue;
  }
  fs.writeFileSync(filePath, next);
  console.log('patched', f.rel, 'delta', html.length - next.length);
}
