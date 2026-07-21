/**
 * Legacy alias: sync products zh → en/ru.
 * Prefer: npm run sync-catalog-i18n
 */
const { execFileSync } = require('child_process');
const path = require('path');

execFileSync(process.execPath, [path.join(__dirname, 'sync-catalog-i18n.js'), 'products'], {
  stdio: 'inherit',
});
