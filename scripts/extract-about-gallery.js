const fs = require('fs');
const html = fs.readFileSync('h:/tongxing/about.html', 'utf8');
const section = html.split('企业资质与核心专利')[1].split('<!-- 📍')[0];

function imgs(block) {
  const out = [];
  const re = /src="(assets\/images\/certifications\/[^"]+)"[^>]*alt="([^"]*)"/g;
  let m;
  while ((m = re.exec(block))) {
    out.push({ image: m[1], imageAlt: m[2] || '' });
  }
  return out;
}

const honors = section.split('荣誉资质')[1].split('质量资质')[0];
const quality = section.split('质量资质')[1].split('专利资质')[0];
const patents = section.split('专利资质')[1];
console.log(JSON.stringify({
  honors: imgs(honors),
  quality: imgs(quality),
  patents: imgs(patents),
}, null, 2));
