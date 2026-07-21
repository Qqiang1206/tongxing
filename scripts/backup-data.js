/**
 * Backup data/ (JSON content) + server uploads meta to _backups/txam-data-TIMESTAMP/
 * Does not copy images under assets/ (large); only content JSON and meta.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outDir = path.join(root, '_backups', `txam-data-${stamp}`);

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return 0;
  fs.mkdirSync(dest, { recursive: true });
  let n = 0;
  for (const name of fs.readdirSync(src)) {
    const from = path.join(src, name);
    const to = path.join(dest, name);
    const st = fs.statSync(from);
    if (st.isDirectory()) {
      n += copyDir(from, to);
    } else if (st.isFile() && /\.(json|js)$/i.test(name)) {
      fs.copyFileSync(from, to);
      n++;
    }
  }
  return n;
}

fs.mkdirSync(outDir, { recursive: true });
const count = copyDir(path.join(root, 'data'), path.join(outDir, 'data'));

const readme = `TXAM data backup
Created: ${new Date().toISOString()}
Files: ${count} (.json / .js under data/)

Restore:
  1. Stop the API server if running
  2. Copy data/ from this folder over the site data/ directory
  3. Run: npm run generate-data-js
  4. Restart server
`;
fs.writeFileSync(path.join(outDir, 'RESTORE.txt'), readme, 'utf8');
console.log(`Backup written: ${path.relative(root, outDir)} (${count} files)`);
