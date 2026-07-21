/**
 * Merge clients logo wall into about page JSON (zh/en/ru).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const logos = [
  { image: 'assets/images/clients/tcl.webp', alts: { zh: 'TCL', en: 'TCL', ru: 'TCL' } },
  { image: 'assets/images/clients/chuangwei.webp', alts: { zh: '创维', en: 'Skyworth', ru: 'Skyworth' } },
  { image: 'assets/images/clients/meide.webp', alts: { zh: '美的', en: 'Midea', ru: 'Midea' } },
  { image: 'assets/images/clients/fushikang.webp', alts: { zh: '富士康', en: 'Foxconn', ru: 'Foxconn' } },
  { image: 'assets/images/clients/jingdongfang.webp', alts: { zh: '京东方', en: 'BOE', ru: 'BOE' } },
  { image: 'assets/images/clients/ningdeshidai.webp', alts: { zh: '宁德时代', en: 'CATL', ru: 'CATL' } },
  { image: 'assets/images/clients/zhouming.webp', alts: { zh: '洲明', en: 'Unilumin', ru: 'Unilumin' } },
  { image: 'assets/images/clients/qunchuangguangdian.webp', alts: { zh: '群创光电', en: 'Innolux', ru: 'Innolux' } },
  { image: 'assets/images/clients/lianxiang.webp', alts: { zh: '联想', en: 'Lenovo', ru: 'Lenovo' } },
  { image: 'assets/images/clients/huake.webp', alts: { zh: '华科', en: 'HUAK', ru: 'HUAK' } },
  { image: 'assets/images/clients/huike.webp', alts: { zh: '惠科', en: 'HKC', ru: 'HKC' } },
  { image: 'assets/images/clients/xiwo.webp', alts: { zh: '希沃', en: 'Seewo', ru: 'Seewo' } },
  { image: 'assets/images/clients/kangjia.webp', alts: { zh: '康佳', en: 'Konka', ru: 'Konka' } },
  { image: 'assets/images/clients/changhong.gif', alts: { zh: '长虹', en: 'Changhong', ru: 'Changhong' } },
];

const copy = {
  zh: { title: '合作客户', subtitle: '世界一流制造企业的一致选择。' },
  en: { title: 'Our Clients', subtitle: 'The Choice of World-Class Manufacturing Enterprises.' },
  ru: { title: 'Клиенты', subtitle: 'Выбор ведущих мировых производственных предприятий.' },
};

for (const lang of ['zh', 'en', 'ru']) {
  const filePath = path.join(root, 'data/pages/about', `${lang}.json`);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  data.clients = {
    title: copy[lang].title,
    subtitle: copy[lang].subtitle,
    items: logos.map((l) => ({ image: l.image, imageAlt: l.alts[lang] })),
  };
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('updated', lang, 'clients', data.clients.items.length);
}
