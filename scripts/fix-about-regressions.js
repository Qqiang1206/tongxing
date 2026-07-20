const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const SKIP = new Set(['node_modules', 'scripts', '_deploy-package-20260717-0820']);

const CLIENT_LOGOS_ZH = `            const clientLogos = [
                { src: 'client-logos/tcl.webp', alt: 'TCL' },
                { src: 'client-logos/chuangwei.webp', alt: '创维' },
                { src: 'client-logos/meide.webp', alt: '美的' },
                { src: 'client-logos/fushikang.webp', alt: '富士康' },
                { src: 'client-logos/jingdongfang.webp', alt: '京东方' },
                { src: 'client-logos/ningdeshidai.webp', alt: '宁德时代' },
                { src: 'client-logos/zhouming.webp', alt: '洲明' },
                { src: 'client-logos/qunchuangguangdian.webp', alt: '群创光电' },
                { src: 'client-logos/lianxiang.webp', alt: '联想' },
                { src: 'client-logos/huake.webp', alt: '华科' },
                { src: 'client-logos/huike.webp', alt: '惠科' },
                { src: 'client-logos/xiwo.webp', alt: '希沃' },
                { src: 'client-logos/kangjia.webp', alt: '康佳' },
                { src: 'client-logos/changhong.gif', alt: '长虹' },
            ];`;

const CLIENT_LOGOS_I18N = `            const clientLogos = [
                { src: 'client-logos/tcl.webp', alt: 'TCL' },
                { src: 'client-logos/chuangwei.webp', alt: 'Skyworth' },
                { src: 'client-logos/meide.webp', alt: 'Midea' },
                { src: 'client-logos/fushikang.webp', alt: 'Foxconn' },
                { src: 'client-logos/jingdongfang.webp', alt: 'BOE' },
                { src: 'client-logos/ningdeshidai.webp', alt: 'CATL' },
                { src: 'client-logos/zhouming.webp', alt: 'Unilumin' },
                { src: 'client-logos/qunchuangguangdian.webp', alt: 'Qunchuang' },
                { src: 'client-logos/lianxiang.webp', alt: 'Lenovo' },
                { src: 'client-logos/huake.webp', alt: 'HUAK' },
                { src: 'client-logos/huike.webp', alt: 'HKC' },
                { src: 'client-logos/xiwo.webp', alt: 'Seewo' },
                { src: 'client-logos/kangjia.webp', alt: 'Kongjia' },
                { src: 'client-logos/changhong.gif', alt: 'Changhong' },
            ];`;

function walk(dir, files = []) {
    for (const name of fs.readdirSync(dir)) {
        if (SKIP.has(name) || name.startsWith('_deploy-package')) continue;
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) walk(full, files);
        else if (name.endsWith('.html')) files.push(full);
    }
    return files;
}

function fixAboutPage(file, logosBlock) {
    let s = fs.readFileSync(file, 'utf8');

    s = s.replace(/\s*<p class="font-bold text-\[#1D1D1F\] text-center text-sm mt-3">[^<]*<\/p>/g, '');

    s = s.replace(/apple-card p-3 pb-5 flex flex-col items-center/g, 'apple-card p-3 flex flex-col items-center');

    s = s.replace(/const clientLogos = \[[\s\S]*?\];/, logosBlock);

    fs.writeFileSync(file, s, 'utf8');
}

let langFixed = 0;
for (const file of walk(root)) {
    let s = fs.readFileSync(file, 'utf8');
    const before = s;
    s = s.replace(/">中<\/a>/g, '">ZH</a>');
    if (s !== before) {
        fs.writeFileSync(file, s, 'utf8');
        langFixed++;
    }
}

fixAboutPage(path.join(root, 'about.html'), CLIENT_LOGOS_ZH);
fixAboutPage(path.join(root, 'about-en.html'), CLIENT_LOGOS_I18N);
fixAboutPage(path.join(root, 'about-ru.html'), CLIENT_LOGOS_I18N);

console.log('Language label fixed in', langFixed, 'HTML files');
console.log('About pages: captions removed, client logos -> webp');
