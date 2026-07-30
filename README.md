# 同兴高科 TXAM Website

## Structure

```
├── index.html, about.html, …     # Chinese pages (site root)
├── en/                           # English pages
├── ru/                           # Russian pages
├── assets/
│   ├── css/
│   ├── js/
│   └── images/{brand,hero,products,solutions,certifications,clients}
├── data/
│   ├── products/{zh,en,ru}.json
│   ├── solutions/{zh,en,ru}.json
│   ├── news/{zh,en,ru}.json
│   ├── i18n/
│   └── schema/
├── scripts/                      # Dev tooling (not required at runtime)
├── server/                       # CMS + public API（见 server/README.md、DEPLOY.md）
└── DESIGN.md                     # Visual / typography design system
```

## Design system

See [DESIGN.md](DESIGN.md) for colors, type scale, spacing, components, and page conventions.

## Content edits

日常运营以后台为准（见 [server/README.md](server/README.md)）：

- **产品 / 方案 / 新闻**：`/admin/` 中文编辑 → 发布 / 下架；首页标杆与精选在方案/新闻详情里设置（必填坑位，下架须指定替代）
- **首页 / 关于 / 联系文案**：后台「页面」；首页卡片内容来自目录坑位，页面里只改区段文案与固定「单元设备」卡
- `data/**/*.json` + 配套 `.js`：由 CMS 写入同步，供静态 / `file://` 回退；勿与后台并行手改同一条
- 布局壳：`/`、`/en/`、`/ru/` 下 HTML；样式：`assets/css/styles.css`

## Deploy

生产推荐：静态站 + Node CMS（同域反代 `/api/`、`/admin/`）。细节见 [server/DEPLOY.md](server/DEPLOY.md)。

纯静态托管时上传仓库（可排除 `.git/`、`scripts/`）；需能提供 `data/*.json`（`web.config` 已配 MIME）。

## Backend path

见 [server/README.md](server/README.md)。前台默认读静态 `data/*.js` / JSON（静态优先）；需走 API 时在页面显式设置 `window.__TXAM_API_BASE='/api/v1'`。

```bash
cd server && npm run import && npm run dev
```
