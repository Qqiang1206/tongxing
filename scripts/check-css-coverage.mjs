#!/usr/bin/env node
/**
 * Check that every Tailwind utility referenced by site sources exists in the
 * generated assets/css/tailwind.min.css. Guards the regenerated pipeline
 * against silently dropping classes the old frozen build contained.
 * Usage: node scripts/check-css-coverage.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const CSS_FILES = ['assets/css/tailwind.min.css', 'assets/css/styles.css'];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (/node_modules|\.git/.test(name)) continue;
      yield* walk(p);
    } else if (/\.(html|js|json)$/.test(name) && !/check-css-coverage/.test(name)) {
      yield p;
    }
  }
}

const sources = [];
for (const dir of ['en', 'ru']) {
  try { sources.push(...walk(dir)); } catch { /* missing dir */ }
}
try {
  for (const f of readdirSync('.')) if (f.endsWith('.html')) sources.push(f);
} catch {}
sources.push(...walk(join('assets', 'js')));
try { sources.push(...walk('data')); } catch {}

/* Tokens plausibly Tailwind utilities */
const PREFIXES = [
  'bg-', 'text-', 'border-', 'rounded', 'shadow-', 'ring-', 'grid-', 'flex-',
  'gap-', 'space-', 'divide-', 'pt-', 'pb-', 'pl-', 'pr-', 'px-', 'py-',
  'mt-', 'mb-', 'ml-', 'mr-', 'mx-', 'my-', '-mt-', '-mb-', '-ml-', '-mr-',
  '-mx-', '-my-', '-translate', '-rotate', '-skew', 'p-', 'm-',
  'w-', 'h-', 'min-w', 'min-h', 'max-w', 'max-h', 'top-', 'bottom-', 'left-',
  'right-', 'inset-', 'z-', 'order-', 'col-', 'row-', 'basis-', 'grow', 'shrink',
  'items-', 'justify-', 'self-', 'place-', 'content-', 'font-', 'tracking-',
  'leading-', 'list-', 'decoration-', 'overflow-', 'object-', 'opacity-',
  'scale-', 'rotate-', 'translate-', 'skew-', 'transition', 'duration-',
  'ease-', 'delay-', 'backdrop-', 'blur-', 'grayscale', 'mix-', 'aspect-',
  'align-', 'whitespace-', 'break-', 'columns-', 'outline-', 'caret-', 'fill-',
  'stroke-', 'from-', 'via-', 'to-', 'gradient', 'group-', 'peer-', 'sr-only',
  'container',
];
const EXACT = new Set([
  'block', 'inline-block', 'inline', 'hidden', 'table', 'flow-root', 'grid',
  'contents', 'isolate', 'relative', 'absolute', 'fixed', 'sticky', 'static',
  'truncate', 'italic', 'uppercase', 'lowercase', 'capitalize', 'underline',
  'line-through', 'no-underline', 'antialiased', 'filter', 'grayscale',
  'border-solid', 'border-dashed', 'border-t', 'border-b', 'border-l', 'border-r',
  'visible', 'invisible', 'collapse', 'resize', 'scroll-smooth',
]);

const PREFIX_RE = new RegExp(`^(?:${PREFIXES.join('|')})`);
const looksLikeUrl = (t) =>
  /^(\/\/|https?:)/.test(t) || /\.(html?|json|js|css|webp|png|jpe?g|svg)$/i.test(t);

const candidates = new Set();
for (const file of sources) {
  let text;
  try { text = readFileSync(file, 'utf8'); } catch { continue; }
  const re = /class=["']([^"']+)["']|(?:["'`])([a-zA-Z][a-zA-Z0-9:.[\]#%/_>-]{2,63})(?:["'`])/g;
  for (const m of text.matchAll(re)) {
    const raw = (m[1] ?? m[2] ?? '').trim();
    if (!raw) continue;
    for (let tok of raw.split(/\s+/)) {
      tok = tok.trim().replace(/[,;]+$/, '');
      if (!tok || tok.length < 2 || tok.length > 64) continue;
      if (/[0-9]/.test(tok[0]) || /[)({}<>=;&|+*?,'\s]/.test(tok)) continue;
      if (looksLikeUrl(tok)) continue;
      if (tok.startsWith('--') || tok.startsWith('//')) continue;
      // a lone slash is only legal inside arbitrary values like bg-[url(x)]
      if (tok.includes('/') && !/\[[^\]]*\/[^\]]*\]/.test(tok)) continue;
      const chain = tok.split(':');
      if (PREFIX_RE.test(tok) || EXACT.has(tok)) {
        candidates.add(tok);
        candidates.add(chain[chain.length - 1]);
      }
    }
  }
}

const cssRaw = CSS_FILES.map((f) => readFileSync(f, 'utf8')).join('');
// undo css selector escapes so '.md\:text-lg' -> '.md:text-lg'
const cssPlain = cssRaw.replace(/\\([:./[\]%#()])/g, '$1');

const missing = [];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
for (const tok of [...candidates].sort()) {
  const re = new RegExp('\\.' + esc(tok) + '(?=[,:{ >~+)])');
  if (!re.test(cssPlain)) missing.push(tok);
}

console.log(`scanned ${sources.length} source files, ${candidates.size} utility-class candidates`);
if (missing.length === 0) {
  console.log('CSS COVERAGE OK — every candidate class exists in generated css');
} else {
  console.log(`MISSING (${missing.length}):`);
  for (const t of missing) console.log('  -', t);
  process.exitCode = 1;
}
