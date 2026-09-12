/**
 * One-off content patch: unify page content with the v3 design language.
 *
 *  - Replace legacy Apple-palette hex inside page rich text with v3 tokens
 *  - Home service steps: unify badgeStyle to 'neutral' (admin now emits this too)
 *  - Home unitCard eyebrow: localize per language (was English on zh/ru)
 *  - Footer: add phone / email / dual-base address fields (editable in admin)
 *
 * Writes the SQLite DB through the same writers the admin uses, which also
 * re-export data/**.{json,js}. Safe to run while the server is up.
 *
 *   cd server && node scripts/patch-v3-unify.mjs
 */
import { LANGS } from '../src/config.js';
import {
  readPageJson,
  writePageJsonAny,
  loadSiteSettings,
  writeSiteSettingsAny,
} from '../src/services/catalog.js';

const HEX_MAP = [
  [/#1d1d1f/gi, '#14161B'],
  [/#86868b/gi, '#667084'],
  [/#f5f5f7/gi, '#F7F8FA'],
  [/#e5e5ea/gi, '#E7EAF0'],
  [/#6e6e73/gi, '#667084'],
  [/#fbfbfd/gi, '#FFFFFF'],
];

function replaceHexDeep(value) {
  if (typeof value === 'string') {
    let out = value;
    for (const [re, to] of HEX_MAP) out = out.replace(re, to);
    return out;
  }
  if (Array.isArray(value)) return value.map(replaceHexDeep);
  if (value && typeof value === 'object') {
    const o = {};
    for (const [k, v] of Object.entries(value)) o[k] = replaceHexDeep(v);
    return o;
  }
  return value;
}

const EYEBROW = {
  zh: '单机单元',
  en: 'Single Machines',
  ru: 'Отдельные машины',
};

const FOOTER_CONTACT = {
  zh: {
    phone: '+86 136 3264 3748',
    email: 'txgk@sztxgk.com',
    addressShenzhen: '深圳市龙岗区宝龙街道同德社区吓坑村一区2号（A栋-C栋）',
    addressHuizhou: '惠州市（6万㎡智能制造基地，将于 2026 年年底全面投产）',
  },
  en: {
    phone: '+86 136 3264 3748',
    email: 'txgk@sztxgk.com',
    addressShenzhen:
      'No.2, Zone 1, Xiakeng Village, Tongde Community, Baolong Street, Longgang District, Shenzhen (Bldg A-C)',
    addressHuizhou:
      'Huizhou (60,000 m² smart manufacturing base, fully operational by end of 2026)',
  },
  ru: {
    phone: '+86 136 3264 3748',
    email: 'txgk@sztxgk.com',
    addressShenzhen:
      '№2, зона 1, дер. Сякэн, р-н Баолун, р-н Лунган, Шэньчжэнь (корп. A-C)',
    addressHuizhou:
      'Хуэйчжоу (умный производственный комплекс 60 000 м², полный запуск к концу 2026 г.)',
  },
};

const PAGES = ['home', 'about', 'contact', 'products', 'news', 'solutions'];

let writes = 0;
for (const lang of LANGS) {
  for (const pageKey of PAGES) {
    const page = readPageJson(pageKey, lang);
    if (!page) {
      console.log(`skip pages/${pageKey}/${lang} (missing)`);
      continue;
    }
    const patched = replaceHexDeep(page);

    if (pageKey === 'home') {
      const steps = patched.serviceSection && patched.serviceSection.steps;
      if (Array.isArray(steps)) steps.forEach((s) => { s.badgeStyle = 'neutral'; });
      if (patched.productsSection && patched.productsSection.unitCard) {
        patched.productsSection.unitCard.eyebrow = EYEBROW[lang];
      }
    }

    writePageJsonAny(pageKey, lang, patched);
    writes += 1;
    console.log(`patched pages/${pageKey}/${lang}`);
  }

  const site = loadSiteSettings(lang) || {};
  site.footer = Object.assign({}, site.footer || {}, FOOTER_CONTACT[lang]);
  writeSiteSettingsAny(lang, site);
  writes += 1;
  console.log(`patched site/${lang} (footer contact fields)`);
}

console.log(`\ndone: ${writes} writes (DB updated + static data/ re-exported)`);
