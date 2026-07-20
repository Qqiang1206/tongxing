const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const SKIP = new Set(['node_modules', 'scripts']);
const SKIP_PREFIX = '_deploy-package';

function walk(dir, files = []) {
    for (const name of fs.readdirSync(dir)) {
        if (SKIP.has(name) || name.startsWith(SKIP_PREFIX)) continue;
        const full = path.join(dir, name);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) walk(full, files);
        else if (/\.(html|js)$/.test(name)) files.push(full);
    }
    return files;
}

function transform(content) {
    const kept = [];
    let s = content;

    function keepCircle(match) {
        const token = `__ROUND_FULL_${kept.length}__`;
        kept.push(match);
        return token;
    }

    s = s.replace(/w-(3|4|5|6|12|14|16) h-\1[^"'`]*?rounded-full/g, keepCircle);

    s = s.replace(/rounded-full/g, 'radius-sm');

    kept.forEach((match, i) => {
        s = s.split(`__ROUND_FULL_${i}__`).join(match);
    });

    s = s.replace(/filter-btn([^"']*?)radius-sm/g, 'filter-btn$1');

    return s;
}

let changed = 0;
for (const file of walk(root)) {
    const before = fs.readFileSync(file, 'utf8');
    const after = transform(before);
    if (after !== before) {
        fs.writeFileSync(file, after, 'utf8');
        changed++;
    }
}
console.log('Updated controls in', changed, 'files');
