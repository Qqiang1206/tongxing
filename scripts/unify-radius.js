const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function walkHtml(dir, files = []) {
    for (const name of fs.readdirSync(dir)) {
        if (name === 'node_modules' || name.startsWith('_deploy-package') || name === 'scripts') continue;
        const full = path.join(dir, name);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) walkHtml(full, files);
        else if (name.endsWith('.html')) files.push(full);
    }
    return files;
}

function transform(content) {
    let s = content;

    s = s.replace(/rounded-\[32px\]\s+md:rounded-\[48px\]/g, 'media-hero');
    s = s.replace(/\smd:rounded-\[48px\]/g, '');
    s = s.replace(/rounded-\[32px\]/g, 'media-hero');
    s = s.replace(/rounded-\[24px\]/g, 'radius-lg');

    s = s.replace(/media-hero overflow-hidden border border-\[#E5E5EA\] shadow-\[0_20px_60px_rgba\(0,0,0,0\.06\)\]/g, 'media-hero');
    s = s.replace(/media-hero overflow-hidden border border-\[#E5E5EA\] shadow-xl/g, 'media-hero shadow-xl');
    s = s.replace(/radius-lg overflow-hidden bg-gray-100 apple-card/g, 'media-hero bg-gray-100');
    s = s.replace(/radius-lg overflow-hidden mb-12/g, 'media-hero mb-12');
    s = s.replace(/radius-lg overflow-hidden bg-gray-100(?!\s)/g, 'media-hero bg-gray-100');

    s = s.replace(/h-\[300px\]\s+md:h-\[600px\]/g, 'media-h-index w-full');
    s = s.replace(/h-\[600px\]\s+md:h-\[700px\]/g, 'media-h-map w-full');
    s = s.replace(/h-\[400px\]\s+md:h-\[600px\]/g, 'media-h-solution w-full');
    s = s.replace(/h-\[400px\]\s+md:h-\[500px\]/g, 'media-h-detail w-full');
    s = s.replace(/w-full h-\[400px\](?! md:)/g, 'media-h-detail w-full');

    s = s.replace(/map-overlay radius-lg/g, 'map-overlay');
    s = s.replace(/map-overlay rounded-\[24px\]/g, 'map-overlay');

    s = s.replace(/rounded-3xl/g, 'radius-lg');

    s = s.replace(/w-full h-48 rounded-2xl overflow-hidden/g, 'w-full h-48 radius-sm overflow-hidden');
    s = s.replace(/w-full h-40 rounded-2xl overflow-hidden/g, 'w-full h-40 radius-sm overflow-hidden');
    s = s.replace(/bg-white rounded-2xl overflow-hidden/g, 'bg-white radius-sm overflow-hidden');
    s = s.replace(/rounded-2xl overflow-hidden bg-gray-100/g, 'radius-sm overflow-hidden bg-gray-100');

    s = s.replace(/bg-gray-50 border border-gray-200 rounded-2xl p-8/g, 'bg-gray-50 border border-gray-200 radius-lg p-8');
    s = s.replace(/bg-white\/90 backdrop-blur-md px-6 py-3 rounded-2xl/g, 'bg-white/90 backdrop-blur-md px-6 py-3 radius-lg');
    s = s.replace(/client-card h-28 bg-white border border-\[#E5E5EA\] rounded-2xl/g, 'client-card h-28 bg-white border border-[#E5E5EA] radius-lg');

    s = s.replace(/w-12 h-12 bg-\[#FF6B00\]\/10 rounded-2xl/g, 'w-12 h-12 bg-[#FF6B00]/10 radius-sm');

    s = s.replace(/border-radius:\s*32px/g, 'border-radius: var(--radius-lg)');

    return s;
}

const files = walkHtml(root);
let changed = 0;
for (const file of files) {
    const before = fs.readFileSync(file, 'utf8');
    const after = transform(before);
    if (after !== before) {
        fs.writeFileSync(file, after, 'utf8');
        changed++;
    }
}
console.log('Updated', changed, 'HTML files');
