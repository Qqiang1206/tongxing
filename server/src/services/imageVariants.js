import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

export const DISPLAY_MAX_WIDTH = 1920;
export const THUMB_MAX_WIDTH = 480;
export const DISPLAY_TARGET_KB = 400;
export const THUMB_TARGET_KB = 80;

const SKIP_VARIANT_EXT = new Set(['.svg', '.gif']);

export function isRasterImageExt(ext) {
  const lower = String(ext || '').toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.webp'].includes(lower);
}

export function shouldBuildVariants(ext) {
  return isRasterImageExt(ext) && !SKIP_VARIANT_EXT.has(String(ext || '').toLowerCase());
}

async function writeWebpVariant(input, outPath, maxWidth, targetKb, startQuality = 80) {
  let quality = startQuality;
  let meta;
  let bestBuf;
  // Encode to buffer in the quality loop — avoids Windows file-handle
  // issues when overwriting the same path repeatedly via toFile().
  for (let i = 0; i < 8; i += 1) {
    let pipeline = sharp(input).rotate();
    if (maxWidth) pipeline = pipeline.resize({ width: maxWidth, withoutEnlargement: true });
    const buf = await pipeline.webp({ quality, effort: 6 }).toBuffer();
    meta = await sharp(buf).metadata();
    const sizeKb = buf.length / 1024;
    bestBuf = buf;
    if (sizeKb <= targetKb || quality <= 55) break;
    quality -= 5;
  }
  // Single disk write — no overwrite loop, no file-lock contention
  fs.writeFileSync(outPath, bestBuf);
  return meta;
}

/**
 * Build display + thumb WebP variants for an uploaded raster image buffer.
 * Returns absolute paths and metadata; caller writes DB rows.
 */
export async function buildUploadVariants(inputBuffer, opts) {
  const { uploadDir, originalsDir, stamp, baseName, originalExt } = opts;
  fs.mkdirSync(uploadDir, { recursive: true });
  fs.mkdirSync(originalsDir, { recursive: true });

  const id = `${stamp}-${baseName}`;
  const originalFile = `${id}${originalExt}`;
  const originalAbs = path.join(originalsDir, originalFile);
  fs.writeFileSync(originalAbs, inputBuffer);
  const originalBytes = inputBuffer.length;

  const displayName = `${id}-display.webp`;
  const thumbName = `${id}-thumb.webp`;
  const displayAbs = path.join(uploadDir, displayName);
  const thumbAbs = path.join(uploadDir, thumbName);

  const displayMeta = await writeWebpVariant(
    inputBuffer,
    displayAbs,
    DISPLAY_MAX_WIDTH,
    DISPLAY_TARGET_KB
  );
  await writeWebpVariant(inputBuffer, thumbAbs, THUMB_MAX_WIDTH, THUMB_TARGET_KB, 78);

  const displayBytes = fs.statSync(displayAbs).size;
  const thumbBytes = fs.statSync(thumbAbs).size;

  return {
    id,
    path: `assets/images/uploads/${displayName}`,
    thumbPath: `assets/images/uploads/${thumbName}`,
    originalPath: `assets/images/uploads/_originals/${originalFile}`,
    width: displayMeta.width || null,
    height: displayMeta.height || null,
    originalBytes,
    displayBytes,
    thumbBytes,
    mime: 'image/webp',
  };
}

/** Re-process an existing upload file on disk (migration). */
export async function buildVariantsFromFile(absPath, opts) {
  const buf = fs.readFileSync(absPath);
  return buildUploadVariants(buf, opts);
}
