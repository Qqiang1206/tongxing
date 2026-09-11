/**
 * Merge credentials gallery into about page JSON (zh/en/ru).
 */
const fs = require('fs');
const path = require('path');

const gallery = {
  honors: [
    { image: 'assets/images/certifications/rongyuzizhi/guanfangzizhi-gaoxinjishuqiyezhengshu.webp', imageAlt: '高新技术企业证书' },
    { image: 'assets/images/certifications/rongyuzizhi/guanfangzizhi-chuangxinxingzhongxiaoqiye.jpg', imageAlt: '创新型中小企业' },
    { image: 'assets/images/certifications/rongyuzizhi/guanfangzizhi-zhuanjingtexinzhongxiaoqiye.webp', imageAlt: '专精特新中小企业' },
  ],
  quality: [
    '97_27', '107_27', '108_27', '109_27', '110_27', '111_27', '112_27',
  ].map((id, i) => ({
    image: `assets/images/certifications/zhiliangzizhi/weixintupian_20260330114${i === 0 ? '404' : '50' + (i + 2)}_${id}.jpg`.replace(
      /weixintupian_20260330114\d+_/,
      i === 0
        ? 'weixintupian_20260330114404_'
        : `weixintupian_2026033011450${i + 2}_`
    ),
    imageAlt: '质量资质',
  })),
};

// Fix quality paths explicitly
gallery.quality = [
  { image: 'assets/images/certifications/zhiliangzizhi/weixintupian_20260330114404_97_27.jpg', imageAlt: '质量资质' },
  { image: 'assets/images/certifications/zhiliangzizhi/weixintupian_20260330114503_107_27.jpg', imageAlt: '质量资质' },
  { image: 'assets/images/certifications/zhiliangzizhi/weixintupian_20260330114504_108_27.jpg', imageAlt: '质量资质' },
  { image: 'assets/images/certifications/zhiliangzizhi/weixintupian_20260330114505_109_27.jpg', imageAlt: '质量资质' },
  { image: 'assets/images/certifications/zhiliangzizhi/weixintupian_20260330114506_110_27.jpg', imageAlt: '质量资质' },
  { image: 'assets/images/certifications/zhiliangzizhi/weixintupian_20260330114507_111_27.jpg', imageAlt: '质量资质' },
  { image: 'assets/images/certifications/zhiliangzizhi/weixintupian_20260330114508_112_27.jpg', imageAlt: '质量资质' },
];

gallery.patents = [
  { image: 'assets/images/certifications/zhuanlizizhi/weixintupian_20260330114509_113_27.webp', imageAlt: '专利证书' },
  { image: 'assets/images/certifications/zhuanlizizhi/weixintupian_20260330114511_115_27.webp', imageAlt: '专利证书' },
  { image: 'assets/images/certifications/zhuanlizizhi/weixintupian_20260330114513_117_27.jpg', imageAlt: '专利证书' },
  { image: 'assets/images/certifications/zhuanlizizhi/weixintupian_20260330114515_119_27.jpg', imageAlt: '专利证书' },
  { image: 'assets/images/certifications/zhuanlizizhi/weixintupian_20260330114516_121_27.jpg', imageAlt: '专利证书' },
  { image: 'assets/images/certifications/zhuanlizizhi/weixintupian_20260330114517_122_27.jpg', imageAlt: '专利证书' },
  { image: 'assets/images/certifications/zhuanlizizhi/weixintupian_20260330114518_123_27.jpg', imageAlt: '专利证书' },
  { image: 'assets/images/certifications/zhuanlizizhi/weixintupian_20260330114519_124_27.jpg', imageAlt: '专利证书' },
  { image: 'assets/images/certifications/zhuanlizizhi/weixintupian_20260330114519_125_27.jpg', imageAlt: '专利证书' },
  { image: 'assets/images/certifications/zhuanlizizhi/weixintupian_20260330114520_126_27.jpg', imageAlt: '专利证书' },
];

const i18n = {
  zh: {
    title: '企业资质与核心专利',
    subtitle: '真金不怕火炼，用实打实的荣誉证书与 98 项专利图纸证明实力。',
    groups: [
      { id: 'honors', title: '荣誉资质', layout: 'grid', items: gallery.honors },
      { id: 'quality', title: '质量资质', layout: 'marquee', marqueeDuration: '40s', items: gallery.quality },
      { id: 'patents', title: '专利资质', layout: 'marquee', marqueeDuration: '60s', items: gallery.patents.map((p) => ({ ...p, imageAlt: '专利证书' })) },
    ],
  },
  en: {
    title: 'Corporate Qualifications & Core Patents',
    subtitle: 'Proven strength through genuine honors and 98 patent certificates.',
    groups: [
      {
        id: 'honors',
        title: 'Honors & Qualifications',
        layout: 'grid',
        items: [
          { image: gallery.honors[0].image, imageAlt: 'High-Tech Enterprise Certificate' },
          { image: gallery.honors[1].image, imageAlt: 'Innovation SME Certificate' },
          { image: gallery.honors[2].image, imageAlt: 'Specialized & Distinctive SME Certificate' },
        ],
      },
      {
        id: 'quality',
        title: 'Quality Certifications',
        layout: 'marquee',
        marqueeDuration: '40s',
        items: gallery.quality.map((p) => ({ ...p, imageAlt: 'Quality certification' })),
      },
      {
        id: 'patents',
        title: 'Patent Certificates',
        layout: 'marquee',
        marqueeDuration: '60s',
        items: gallery.patents.map((p) => ({ ...p, imageAlt: 'Patent Certificate' })),
      },
    ],
  },
  ru: {
    title: 'Квалификации и патенты',
    subtitle: 'Подтверждённая сила: официальные награды и почти 100 патентов.',
    groups: [
      {
        id: 'honors',
        title: 'Награды и статусы',
        layout: 'grid',
        items: gallery.honors.map((p, i) => ({
          ...p,
          imageAlt: ['Сертификат высокотехнологичного предприятия', 'Инновационное МСП', 'Специализированное МСП'][i],
        })),
      },
      {
        id: 'quality',
        title: 'Сертификаты качества',
        layout: 'marquee',
        marqueeDuration: '40s',
        items: gallery.quality.map((p) => ({ ...p, imageAlt: 'Сертификат качества' })),
      },
      {
        id: 'patents',
        title: 'Патенты',
        layout: 'marquee',
        marqueeDuration: '60s',
        items: gallery.patents.map((p) => ({ ...p, imageAlt: 'Патент' })),
      },
    ],
  },
};

for (const lang of ['zh', 'en', 'ru']) {
  const file = path.join('h:/tongxing/data/pages/about', `${lang}.json`);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  data.credentials = i18n[lang];
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  console.log('updated', lang);
}
