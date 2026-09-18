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
│   ├── products|solutions|news/{zh,en,ru}.{json,js}   # 列表 + 详情 items/{lang}/{id}.json
│   ├── pages/{home,about,contact,products,news,solutions}/{zh,en,ru}.{json,js}
│   ├── i18n/{zh,en,ru}.{json,js}
│   ├── meta/                    # 翻译状态 / 任务快照
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

## 本地校验（推送前守门）

仓库唯一远端是 Gitee，`.github/workflows/ci.yml` 只在 GitHub Actions 上生效，
所以本地装了等效的 pre-push 钩子：

```bash
npm run hooks:install    # 每台机器装一次：core.hooksPath → .githooks
```

推送前依次跑数据校验、落地页与数据一致性、翻译测试、CSS 覆盖（约 3 秒，
纯 Node 无依赖）。其中 `landings:check` 最关键——`data/**` 快照与生成出来的
HTML 一漂移，前台就会「页面与后台不一致」。确需跳过：`git push --no-verify`。

## Deploy

生产推荐：静态站 + Node CMS（同域反代 `/api/`、`/admin/`）。细节见 [server/DEPLOY.md](server/DEPLOY.md)。

部署按**整目录打包上传**。`data/` 与 `server/data/*.db` 被 `.gitignore` 忽略（SQLite 是内容源，`data/*` 是供前台静态读取的快照），**必须随包一起上传**——纯 git 拉取会丢失全部内容。纯静态托管时需能提供 `data/*.json` 与配套 `*.js`（`web.config` 已配 MIME）。

## Backend path

见 [server/README.md](server/README.md)。前台默认读静态 `data/*.js` / JSON（静态优先）；需走 API 时在页面显式设置 `window.__TXAM_API_BASE='/api/v1'`。

```bash
cd server && npm run import && npm run dev
```
