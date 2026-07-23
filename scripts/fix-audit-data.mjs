/**
 * Fix audit report data issues: remove duplicate solution entries from products catalog.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const REMOVE_IDS = ['31', '32', '33', '34', '35', '36', '37', '38', '39'];

const ROBOT_41_HTML_ZH =
  '<p>机器人单元设备是同兴高科自主研发的模块化智能装备，以工业机器人为核心，可根据产线工艺灵活配置周边模块，快速集成到现有或新建自动化产线中。</p>\n' +
  '<h3>方案特点</h3>\n<ul>\n<li>模块化设计，支持按需扩展与组合</li>\n<li>标准化接口，便于与输送、视觉、夹具等系统对接</li>\n<li>支持多品牌机器人与多种末端工具定制</li>\n<li>配套控制系统，实现单元内多设备协同</li>\n</ul>\n<h3>应用场景</h3>\n<p>广泛应用于搬运、码垛、装配、检测等工位，可作为整线方案中的标准单元快速部署。</p>';

const ROBOT_41_HTML_EN =
  '<p>TXAM robot unit systems are modular automation cells built around industrial robots, configurable for line processes and fast integration into new or existing production lines.</p>\n' +
  '<h3>Highlights</h3>\n<ul>\n<li>Modular architecture for flexible expansion</li>\n<li>Standard interfaces for conveyors, vision, and tooling</li>\n<li>Multi-brand robot support with custom end effectors</li>\n<li>Integrated control for coordinated cell operation</li>\n</ul>\n<h3>Applications</h3>\n<p>Transfer, palletizing, assembly, and inspection stations in display, appliance, and general manufacturing lines.</p>';

const ROBOT_41_HTML_RU =
  '<p>Роботизированные модульные ячейки TXAM строятся вокруг промышленных роботов и быстро интегрируются в новые или существующие линии.</p>\n' +
  '<h3>Особенности</h3>\n<ul>\n<li>Модульная архитектура</li>\n<li>Стандартные интерфейсы для периферии</li>\n<li>Поддержка разных роботов и сменных инструментов</li>\n<li>Интегрированное управление ячейкой</li>\n</ul>\n<h3>Применение</h3>\n<p>Перемещение, паллетирование, сборка и контроль на производственных линиях.</p>';

for (const lang of ['zh', 'en', 'ru']) {
  const jsonPath = path.join(root, 'data', 'products', `${lang}.json`);
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  let removed = 0;
  for (const id of REMOVE_IDS) {
    if (data[id]) {
      delete data[id];
      removed += 1;
    }
    const itemPath = path.join(root, 'data', 'products', 'items', lang, `${id}.json`);
    if (fs.existsSync(itemPath)) {
      fs.unlinkSync(itemPath);
      console.log('deleted', path.relative(root, itemPath));
    }
  }
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2) + '\n');
  console.log(`products/${lang}.json: removed ${removed} duplicate solution entries`);

  const solPath = path.join(root, 'data', 'solutions', `${lang}.json`);
  const sol = JSON.parse(fs.readFileSync(solPath, 'utf8'));
  if (sol['41']) {
    const html =
      lang === 'en' ? ROBOT_41_HTML_EN : lang === 'ru' ? ROBOT_41_HTML_RU : ROBOT_41_HTML_ZH;
    sol['41'].contentHtml = html;
    fs.writeFileSync(solPath, JSON.stringify(sol, null, 2) + '\n');
    console.log(`solutions/${lang}.json: fixed id=41 contentHtml`);
  }
}

console.log('done');
