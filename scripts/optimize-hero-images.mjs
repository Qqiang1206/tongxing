import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const hero = path.join(root, 'assets/images/hero');
const sol = path.join(root, 'assets/images/solutions');
const unused = path.join(root, '_unused-images/hero');
fs.mkdirSync(unused, { recursive: true });

function kb(p) {
  return (fs.statSync(p).size / 1024).toFixed(1) + 'KB';
}

async function writeWebp(input, out, width, quality = 78) {
  let pipeline = sharp(input).rotate();
  if (width) pipeline = pipeline.resize({ width, withoutEnlargement: true });
  await pipeline.webp({ quality, effort: 6 }).toFile(out);
  const meta = await sharp(out).metadata();
  console.log('wrote', path.basename(out), meta.width + 'x' + meta.height, kb(out), 'q' + quality);
  return meta;
}

async function writeWebpTarget(input, out, width, targetKb, startQ = 80) {
  let q = startQ;
  let meta;
  for (let i = 0; i < 8; i++) {
    meta = await writeWebp(input, out, width, q);
    const sizeKb = fs.statSync(out).size / 1024;
    if (sizeKb <= targetKb || q <= 55) break;
    q -= 5;
  }
  return meta;
}

const szSrcCandidates = [
  path.join(hero, 'szgc1.png'),
  path.join(unused, 'szgc1.png'),
  path.join(hero, 'szgc1.webp'),
];
const hzSrcCandidates = [
  path.join(hero, 'hzgc2.jpg'),
  path.join(unused, 'hzgc2.jpg'),
  path.join(hero, 'hzgc2.webp'),
];

const szSrc = szSrcCandidates.find((p) => fs.existsSync(p));
const hzSrc = hzSrcCandidates.find((p) => fs.existsSync(p));
if (!szSrc || !hzSrc) {
  throw new Error('Missing hero source images');
}

await writeWebpTarget(szSrc, path.join(hero, 'szgc1-960.webp'), 960, 120, 78);
await writeWebpTarget(szSrc, path.join(hero, 'szgc1.webp'), 1600, 220, 78);

await writeWebpTarget(hzSrc, path.join(hero, 'hzgc2-960.webp'), 960, 150, 78);
await writeWebpTarget(hzSrc, path.join(hero, 'hzgc2-1440.webp'), 1440, 280, 78);
await writeWebpTarget(hzSrc, path.join(hero, 'hzgc2.webp'), 1920, 380, 78);

const pkg = path.join(sol, 'pkg-logistics-line.webp');
const pkgTmp = path.join(sol, 'pkg-logistics-line.tmp.webp');
await writeWebpTarget(pkg, pkgTmp, 1600, 260, 78);
fs.copyFileSync(pkgTmp, pkg);
fs.unlinkSync(pkgTmp);
console.log('pkg final', kb(pkg));

for (const name of ['szgc1.png', 'hzgc2.jpg']) {
  const from = path.join(hero, name);
  const to = path.join(unused, name);
  if (fs.existsSync(from)) {
    if (fs.existsSync(to)) fs.unlinkSync(to);
    fs.renameSync(from, to);
    console.log('moved', name, '-> _unused-images/hero/', kb(to));
  }
}
