/**
 * Establish the current en/ru content as the translation baseline.
 * No translation API is called and target-language content is never rewritten.
 * Run without --apply for a dry run; use --apply once after reviewing counts.
 */
import fs from 'fs';
import path from 'path';
import { DATA_DIR } from '../src/config.js';
import {
  collectStrings,
  getByPath,
  snapshotEntries,
} from '../src/services/translationFields.js';
import {
  replaceSnapshotBatch,
  snapshotFilePath,
} from '../src/services/translationSnapshot.js';

const apply = process.argv.includes('--apply');
const LANGS = ['en', 'ru'];
const CATALOGS = ['products', 'solutions', 'news'];
const PAGES = ['home', 'about', 'contact', 'products', 'news', 'solutions'];

function readJson(...parts) {
  const file = path.join(DATA_DIR, ...parts);
  if (!fs.existsSync(file)) throw new Error(`missing_data_file:${file}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function collectScope(resource, lang, itemId, source, target, scopes, entries) {
  const paths = [];
  const values = [];
  collectStrings(source, '', paths, values, itemId);
  scopes.push([resource, lang, itemId || '']);

  const completePaths = [];
  const completeValues = [];
  let missing = 0;
  paths.forEach((fieldPath, index) => {
    const lookup = itemId ? fieldPath.slice(fieldPath.indexOf(':') + 1) : fieldPath;
    const translated = getByPath(target, lookup);
    if (typeof translated === 'string') {
      completePaths.push(fieldPath);
      completeValues.push(values[index]);
    } else {
      missing++;
    }
  });
  entries.push(...snapshotEntries(resource, lang, itemId || '', completePaths, completeValues));
  return { fields: paths.length, seeded: completePaths.length, missing };
}

const scopes = [];
const entries = [];
const rows = [];

for (const resource of CATALOGS) {
  const source = readJson(resource, 'zh.json');
  for (const lang of LANGS) {
    const target = readJson(resource, `${lang}.json`);
    let fields = 0;
    let seeded = 0;
    let missing = 0;
    for (const itemId of Object.keys(source)) {
      const result = collectScope(
        resource,
        lang,
        itemId,
        source[itemId],
        target[itemId],
        scopes,
        entries
      );
      fields += result.fields;
      seeded += result.seeded;
      missing += result.missing;
    }
    rows.push({ resource, lang, fields, seeded, missing });
  }
}

for (const pageKey of PAGES) {
  const resource = `pages:${pageKey}`;
  const source = readJson('pages', pageKey, 'zh.json');
  for (const lang of LANGS) {
    const target = readJson('pages', pageKey, `${lang}.json`);
    rows.push({
      resource,
      lang,
      ...collectScope(resource, lang, '', source, target, scopes, entries),
    });
  }
}

const siteSource = readJson('i18n', 'zh.json');
for (const lang of LANGS) {
  const target = readJson('i18n', `${lang}.json`);
  rows.push({
    resource: 'site',
    lang,
    ...collectScope('site', lang, '', siteSource, target, scopes, entries),
  });
}

for (const row of rows) {
  console.log(
    `${row.resource}/${row.lang}: fields=${row.fields} seeded=${row.seeded} missing=${row.missing}`
  );
}

if (!apply) {
  console.log('\nDry run only. Re-run with --apply to write the snapshot baseline.');
  process.exit(0);
}

const snapshotPath = snapshotFilePath();
if (fs.existsSync(snapshotPath)) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(DATA_DIR, '..', '_backups', 'translation-snapshots');
  fs.mkdirSync(backupDir, { recursive: true });
  const backup = path.join(backupDir, `translation-snapshot-${stamp}.json`);
  fs.copyFileSync(snapshotPath, backup);
  console.log(`backup=${backup}`);
}

replaceSnapshotBatch(scopes, entries);
console.log(`\nSnapshot baseline written: ${snapshotPath}`);
console.log('No en/ru content files were modified.');
