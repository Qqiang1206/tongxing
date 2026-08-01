# Page templates (source of truth for future build)

This folder documents the page shells. Currently the live HTML under `/`, `/en/`, `/ru/` **is** the template set after restructure.

## Pages

| Template role | ZH | EN | RU |
|---------------|----|----|-----|
| Home | `/index.html` | `/en/index.html` | `/ru/index.html` |
| About | `/about.html` | `/en/about.html` | `/ru/about.html` |
| Products list | `/products.html` | `/en/products.html` | `/ru/products.html` |
| Product detail | `/product-detail.html` | `/en/product-detail.html` | `/ru/product-detail.html` |
| Solutions list | `/solutions.html` | `/en/solutions.html` | `/ru/solutions.html` |
| Solution detail | `/solutions-detail.html` | `/en/solutions-detail.html` | `/ru/solutions-detail.html` |
| News list/detail | `/news.html`, `/news-detail.html` | `/en/news.html`, `/en/news-detail.html` | `/ru/news.html`, `/ru/news-detail.html` |
| Contact | `/contact.html` | `/en/contact.html` | `/ru/contact.html` |
| Solution landing | `/*-solution.html` | `/en/*-solution.html` | `/ru/*-solution.html` |

## Data binding

Detail pages load content via `assets/js/data-loader.js`:
- **Static-first** (default): reads `data/{kind}/{lang}.js` globals, with `data/*.json` fallback
- **API mode** (opt-in): set `window.__TXAM_API_BASE='/api/v1'` on a page to read from the runtime API

Data files are auto-synced from the CMS database (`npm run sync:static`). 注意：`data/` 被 `.gitignore` 忽略，部署需随整目录上传。

## Shared UI

所有页面加载的公共脚本：

- `assets/js/site-chrome.js` / `site-nav.js` / `site-common.js` — 移动菜单开关、导航文案、公共标签、主内容 landmark
- `assets/js/header.js` — 仅 ZH 首页：注入顶栏 + 移动菜单壳（其他页面导航写死在 HTML）
- `assets/js/site-footer.js` — 页脚
- 列表/详情/落地页各自的数据脚本：`*-list.js`、`*-page.js`、`solution-landing.js`、详情页内联渲染

`scripts/build.js` 目前只是构建自检（运行 `validate-data.js` 并统计三语页面数），**并未**做 HTML partial 注入；`/`、`/en/`、`/ru/` 下的 HTML 就是成品页面壳。
