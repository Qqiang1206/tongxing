/**
 * Recompress large static WebP heroes/solutions in place (target ≤400KB display).
 * Run: node scripts/optimize-static-images.mjs
 */
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dirs = [
  path.join(root, 'assets/images/hero'),
  path.join(root, 'assets/images/solutions'),
];

const MAX_WIDTH = 1920;
const TARGET_KB = 400;
const MIN_BYTES = 200 * 1024;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function replaceFileSafe(target, tmp) {
  const backup = target + '.bak';
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      if (fs.existsSync(backup)) fs.unlinkSync(backup);
      if (fs.existsSync(target)) fs.renameSync(target, backup);
      fs.renameSync(tmp, target);
      if (fs.existsSync(backup)) fs.unlinkSync(backup);
      return;
    } catch (err) {
      if ((err.code === 'EBUSY' || err.code === 'EPERM') && attempt < 7) {
        await sleep(80 * (attempt + 1));
        continue;
      }
      throw err;
    }
  }
}

async function recompress(file) {
  const before = fs.statSync(file).size;
  if (before < MIN_BYTES) return null;
  const tmp = file.replace(/\.webp$/i, '.opt.tmp.webp');
  let quality = 78;
  let meta;
  for (let i = 0; i < 8; i++) {
    await sharp(file)
      .rotate()
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality, effort: 6 })
      .toFile(tmp);
    meta = await sharp(tmp).metadata();
    const sizeKb = fs.statSync(tmp).size / 1024;
    if (sizeKb <= TARGET_KB || quality <= 55) break;
    quality -= 5;
  }
  const after = fs.statSync(tmp).size;
  if (after >= before) {
    fs.unlinkSync(tmp);
    return { file, skipped: true, before };
  }
  const backup = file + '.bak';
  await replaceFileSafe(file, tmp);
  return { file, before, after, width: meta?.width, quality };
}

const candidates = [];
for (const dir of dirs) {
  if (!fs.existsSync(dir)) continue;
  for (const name of fs.readdirSync(dir)) {
    if (!/\.webp$/i.test(name)) continue;
    const file = path.join(dir, name);
    if (fs.statSync(file).size >= MIN_BYTES) candidates.push(file);
  }
}

console.log('optimizing', candidates.length, 'files...');
for (const file of candidates.sort()) {
  const rel = path.relative(root, file);
  try {
    const result = await recompress(file);
    if (!result) continue;
    if (result.skipped) {
      console.log('skip', rel, kb(file), '(no gain)');
      continue;
    }
    console.log(
      'ok',
      rel,
      `${Math.round(result.before / 1024)}KB -> ${Math.round(result.after / 1024)}KB`,
      `${result.width}px q~${result.quality}`
    );
  } catch (err) {
    console.error('fail', rel, err.message);
  }
}
console.log('done');
