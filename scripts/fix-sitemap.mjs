/**
 * Regenerate sitemap.xml from server/src/services/sitemap.js (canonical homepage URLs, static solution landings).
 * Run: node scripts/fix-sitemap.mjs
 */
import { generateSitemap } from '../server/src/services/sitemap.js';

const result = generateSitemap();
console.log(`Wrote ${result.path} (${result.count} urls)`);
