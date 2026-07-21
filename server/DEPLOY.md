# TXAM 部署与上线清单

中文为源语言；静态站 + Node API（后台 `/admin/`）。**不做在线留言。**

---

## 1. 目录与进程

| 角色 | 路径 / 命令 |
|------|-------------|
| **一体化（推荐本地）** | `cd server && ADMIN_PASSWORD=*** npm run dev` → 同端口提供站点 `/`、API `/api/v1`、后台 `/admin/` |
| 静态站根目录 | 仓库根（也可用 nginx 单独托管） |
| 反向代理 | 见根目录 `nginx.conf`（生产可用 nginx 托管静态，只反代 `/api/` `/admin/`） |

推荐生产用进程管理：`systemd` / `pm2`，勿直接挂交互终端长期跑。

后台新建/删除产品、新闻、方案时，会自动在 en/ru 补齐或删除同 ID（文案先用中文占位，待翻译任务更新）。

**发布与首页坑位（与实现一致）：**

- 新建默认未发布、不上首页；方案落地页/列表只展示已发布项。
- 首页标杆方案 ×1、精选方案 ×2、精选新闻 ×2 为**必填**；在方案/新闻详情设置，不在「页面 → 首页」里点选卡片。
- 下架或删除占用坑位的内容时，后台会要求先选一条已发布替代；无替代则无法下架。
- 「页面 → 首页」可改 Hero / 区段文案 / 固定「单元设备」卡，并只读查看当前坑位占用。

---

## 2. 环境变量（`server/.env` 或进程环境）

复制 `server/.env.example`，至少设置：

```bash
PORT=3000
ADMIN_PASSWORD=换成足够长的随机密码
CORS_ORIGIN=https://www.sztxgk.com
```

- **切勿**把真实 `ADMIN_PASSWORD` 提交进 Git。
- 公网部署时建议限制后台访问（VPN / IP 白名单 / Basic Auth 外层）。

---

## 3. Nginx（同域）

同域部署后，前台在 http(s) 下会自动探测 `/api/v1/health`；成功则用 `/api/v1`，失败回退 `data/*.js` / JSON（file:// 与纯静态仍可用）。

也可显式控制：

```html
<script>window.__TXAM_API_BASE = '/api/v1';</script>
<!-- 或强制静态：window.__TXAM_API_BASE = false -->
```

关键片段已写入仓库根 `nginx.conf`：`/` 静态，`/api/` 与 `/admin/` 反代到 `127.0.0.1:3000`。

---

## 4. 发布步骤

1. 备份：`npm run backup-data`
2. 上传/同步代码（排除 `node_modules`、`_unused-images`、`_backups`、`.git`）
3. `cd server && npm run import`（JSON → SQLite；首次或数据大改用 `import:reset`）
4. 根目录：`npm run generate-data-js` 与 `npm run generate-sitemap`（或直接 `npm run build`；DB 写入默认也会同步 JSON）
5. 重启 Node（带 `ADMIN_PASSWORD`）
6. 打开 `https://域名/admin/` 登录；抽查中/英/俄首页与产品详情
7. 确认 `sitemap.xml` 可访问（域名根）；提交搜索引擎（可选）
8. 确认 `GET /api/v1/health` 中 `"storage":"sqlite"`

---

## 5. 日常运维命令

```bash
# 中文新增产品后，给 en/ru 补同 ID 占位
npm run sync-catalog-i18n

# 再生 file:// 用的 *.js
npm run generate-data-js

# 按产品/新闻/方案目录重写 sitemap.xml（SITEMAP_BASE 可改域名）
npm run generate-sitemap

# 备份 data/
npm run backup-data
```

翻译：后台「翻译状态 / 任务」

```bash
# DeepSeek（推荐，OpenAI 兼容）
TRANSLATION_PROVIDER=deepseek
TRANSLATION_API_KEY=sk-...          # 或 DEEPSEEK_API_KEY
# 默认 BASE_URL=https://api.deepseek.com  MODEL=deepseek-v4-flash（已关 thinking）

# 或 OpenAI
# TRANSLATION_PROVIDER=openai
# TRANSLATION_API_KEY=sk-...
# TRANSLATION_BASE_URL=https://api.openai.com/v1
# TRANSLATION_MODEL=gpt-4o-mini
```

未配置 Key 时默认为 **echo**（给文案加 `[EN]`/`[RU]` 前缀，用于联调，勿用于生产）。  
点「运行」会写 en/ru JSON 并再生 `.js`，成功后自动标 current。

---

## 6. 安全要点

| 项 | 要求 |
|----|------|
| Admin 密码 | 强密码，仅环境变量 |
| 上传目录 | `assets/images/uploads/` 可写但勿执行脚本 |
| CORS | 生产改为具体站点 Origin，勿长期 `*` |
| 备份 | 定期跑 `backup-data`，备份目录勿暴露 Web |
| 操作日志 | 写操作与登录写入 `admin_audit_log`；默认保留 90 天（`AUDIT_RETENTION_DAYS`）；不含密码与上传二进制 |

---

## 7. 上线回归清单

自动化脚本：`ADMIN_PASSWORD=你的密码 npm run regression -- http://127.0.0.1:PORT`（需先 `npm run server:dev`）。未设 `ADMIN_PASSWORD` 时跳过后台写测，仍检查公网 API 与首页坑位。

最近一次本地跑通（2026-07-21，PORT=3030）：**34 PASS / 0 FAIL**（随后已增补 home-slots 断言与上传后清理；请用当前脚本重跑）。

- [x] `/` 首页区块正常（hero、标杆方案、三大核心类目、产品、服务、新闻）— 标杆/精选来自 `homeSlot` / `homeFeatured`，单元设备卡来自 `pages/home`
- [x] `/about.html` 轮播、统计、文化、时间轴、资质、客户 Logo — 容器 + API timeline 4 条；视觉再确认
- [x] `/contact.html` 渠道卡片 + 地图（无留言表单）
- [x] `/products.html` → 详情、`/news.html` → 详情 — 列表由 CMS `showInList` / `published` 过滤
- [x] `/solutions.html` 方案矩阵由目录数据渲染（仅已发布）
- [x] 方案落地页（如 `tv-display-solution.html`）
- [x] `/en/`、`/ru/` 对应页与语言切换 — 关键页 HTTP 200（8 URL）
- [x] 同域有后端时自动走 `/api/v1`（Network 可见）；无后端时静态 fallback — `ensureApiBase` 代码存在；浏览器 Network 需肉眼确认
- [x] `/admin/` 登录；产品/方案/新闻可发布与**下架**；占用首页坑位下架须选替代；「操作日志」可见写操作与登录
- [x] 媒体上传一张图，路径可复制使用 — 返回 `assets/images/uploads/…png`
- [x] `GET /api/v1/health` 返回 ok；`GET /api/v1/admin/home-slots` 显示 1+2+2 占用

**仍建议人工点一遍：** 关于页时间轴动画、方案页 Z 布局、三语切换链接是否跳对；后台改 nav / 产品「列表显示」/ 首页坑位后刷新前台。产品/新闻/方案详情已支持富文本编辑（无需手写 HTML）。

---

## 阶段进度（CMS）

| 阶段 | 状态 |
|------|------|
| A–E API / Admin / 翻译 / 媒体 / 同端口 | 完成 |
| SQLite 存储 | 完成 |
| Admin UI 改版 | 完成 |
| 一期～四期对接补齐（列表 CMS、slug、nav/common、排序、地图、媒体删除） | 完成 |
| 首页精选坑位（`home_slot` / `home_featured`，必填，下架须替代） | 完成 |
| 操作审计日志（写操作 + 登录，后台只读） | 完成 |
| E SEO | 详情页动态 meta；`npm run generate-sitemap` |
| 前台对接 | 同源自动探测 `/api/v1`；产品列表由 `showInList` 控制 |

| 现象 | 处理 |
|------|------|
| 后台 `not_found` / 空白 | 确认反代到正确端口；强刷 `/admin/` |
| 列表空（file://） | 跑 `npm run generate-data-js`，确认页面引入了 `data/*/*.js` |
| API 404 但静态正常 | 检查 nginx `/api/` location 与 Node 是否在听 |
| EADDRINUSE | 换 `PORT` 或结束占用进程 |
| en/ru 缺产品 | `npm run sync-catalog-i18n` |
| 产品中心看不到已发布项 | 后台勾选「在产品中心列表显示」 |
| 下架失败 / 409 `unpublish_needs_replace` | 该项占用首页必填坑位：在弹窗中选替代，或先发布其他可顶替条目 |
| 精选失败 / 409 `home_slot_full` | 该类坑位已满：弹窗中选要让出的占用项 |
| 首页标杆/精选空白 | 确认对应方案/新闻已发布且 `homeSlot`/`homeFeatured` 已设；看 `GET /admin/home-slots` |
