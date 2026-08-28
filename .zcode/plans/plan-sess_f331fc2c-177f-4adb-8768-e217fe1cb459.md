# TXAM 官网 v3 全站铺开计划（第二阶段）

## 总策略（三条原则）

1. **CSS 优先、渲染器少动**：内页现有组件（`.product-card` / `.news-card` / `.filter-btn` / `.detail-*` / `.spec-tag` / `.map-overlay` / `.factory-carousel__caption` / `.patent-marquee` / 正文 prose / 面包屑）全部通过 `html[data-ui="v3"]` 前缀的覆写规则焕新——**页面渲染器零改动，CMS 发布链路零风险**。只有少量新增元素（区块眉标 kicker）需要动 HTML 和文案 JSON。
2. **导航统一注入**：新写批量改造脚本 `scripts/rollout-v3.mjs`（支持 dry-run 预览 diff）：① 给 `<html>` 打 `data-ui="v3"`；② 把每页硬编码的 `<nav id="navbar">…</nav>` + `#mobile-menu` 块替换为 `<div data-header-placeholder></div>`；③ 在脚本区插入 `header.js` 引用（带版本参数）。git 全程兜底可回滚。
3. **header.js 子目录感知升级**：当前模板是中文根目录写死的路径。升级后按所在目录自动加前缀——logo 图片 `../assets/...`、语言切换链接（en 页的 ZH = `../index.html`、RU = `../ru/index.html`；ru 页同理）。导航项 href 本身用同目录相对路径天然正确；site-nav.js 的三语标签水合已兼容此形态。

**文案管理**：新增 kicker 等文案进 `data/pages/*/{zh,en,ru}.json` 与 `data/i18n/*.json`（只增字段不删键）；中文先上，英文/俄文由我出初稿并在交付说明里列出「待你校对」清单。

## 批次划分（中文先行 → 外文，共 5 批）

### 批次 0（基础设施，无可见变化）
- header.js 前缀感知升级；`rollout-v3.mjs` 脚本 + dry-run
- styles.css 追加内页 v3 覆写（约 300 行，全部门控）：列表页 hero 放大（`#list-hero-title` 呼应首页字阶）、过滤按钮玻璃化、产品/新闻卡发丝线+多层阴影、detail 系列（eyebrow/lead/spec-tag/related/prose）、面包屑、地图卡、工厂轮播文字层、专利跑马灯卡
- `npm run build:css` + `check-css-coverage` 零真实缺口

### 批次 1：中文核心区块页（about / contact / products / news / solutions / 404，共 6 页）
- codemod 打标 + 换注入导航；每页 hero 加 kicker（关于同兴 / 产品中心 / 解决方案 / 新闻中心 / 联系我们）
- 浏览器验收：三档宽度（1440 / 1024 / 390）过 6 页 + 移动菜单 → **你过目确认**
- ✅ git commit

### 批次 2：中文详情模板（product-detail / news-detail / solutions-detail）
- codemod 打标换导航；用真实条目验收（每类抽 2 个）
- 处理 `robot-arm.webp`（暗色旧机床，被详情页引用）：换成对应产品的其他可用图或调整裁切
- 面包屑、规格徽章、related 卡、正文 prose 焕新验收 → **你过目确认**
- ✅ git commit

### 批次 3：11 个方案落地页（中文）
- codemod 批量打标换导航；落地页大图壳（`.media-hero`）经门控自动升级圆角阴影，补 kicker
- 抽查 3 页验收 → **你过目确认**
- ✅ git commit

### 批次 4：英文站镜像（en/，约 21 页）
- codemod 批量执行 + en 文案 JSON 补齐（kicker/CTA 等）
- 验收：en 首页 + 抽 4 内页（含 1 详情、1 落地页），确认路径/语言切换无断链 → **你过目确认**
- ✅ git commit

### 批次 5：俄文站镜像（ru/，约 21 页）+ 全站收尾
- 同 codemod + ru 文案补齐
- **全站自动巡检**：脚本断言 63 页全部满足「`data-ui="v3"` 存在 / 旧硬编码 navbar 残留 = 0 / placeholder 唯一 / header.js 已引用」
- **CMS 回归测试**：后台修改一条产品 → `sync:static` → 确认前台仍为 v3 且内容更新（发布链路不回滚标记与样式）
- 素材清理：删除无引用的 `automation-line.webp`
- 汇总验收报告（含英文/俄文新增文案「待校对」清单）→ **你最终过目**
- ✅ git commit

## 风险与对策

| 风险 | 对策 |
|---|---|
| 批量脚本误伤 63 页 | dry-run 预览 + 每批 git diff 审查 + 浏览器抽查；git 兜底可回滚 |
| en/ru 相对路径断链 | header.js 前缀逻辑复用 site-footer 的 assetPrefix 成熟模式；每语言首页 + 内页各验 1 页 |
| CMS 发布回滚样式 | 本轮渲染器不动（CSS 优先）；批次 5 做发布往返实测 |
| 新文案翻译质量 | 我出初稿 + 明确标注待校对清单，你可以逐条改 |

## 涉及文件

新增：`scripts/rollout-v3.mjs`。修改：`assets/js/header.js`（前缀感知）、`assets/css/styles.css`（内页覆写）、63 个 HTML（脚本批量 + kicker 点改）、`data/pages/*` 与 `data/i18n/*`（只增文案）、`server/src/index.js`（MIME 修复已完成）、`DESIGN.md`（铺开记录）。渲染器 JS（products-list / solutions-list / news-list / about-page / contact-page / solution-landing）**不动**。

完成标准：中英俄三语 63 页全部焕新且 CMS 链路无损；每批次你在浏览器验收通过后进入下一批。