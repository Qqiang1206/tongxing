/**
 * Build / health-check for TXAM site.
 * Currently validates data + reports structure. Extend later to inject partials.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
execSync('node scripts/validate-data.js', { cwd: root, stdio: 'inherit' });

const zh = fs.readdirSync(root).filter(f => f.endsWith('.html')).length;
const en = fs.readdirSync(path.join(root, 'en')).filter(f => f.endsWith('.html')).length;
const ru = fs.readdirSync(path.join(root, 'ru')).filter(f => f.endsWith('.html')).length;
console.log(`Pages: zh=${zh} en=${en} ru=${ru}`);
console.log('Build OK — site is deployable as-is (root = public).');
