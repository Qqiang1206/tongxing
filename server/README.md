# TXAM Backend

Corporate site CMS + public read API. **Chinese (`zh`) is the source language** — admin creates/edits/publishes in Chinese only; English and Russian are synced via translation jobs (AI or other tools), not hand-edited in the normal workflow.

Static front-end shells (`/`, `/en/`, `/ru/`) stay as HTML + CSS; **content** comes from this API.

---

## 1. Principles

| Rule | Detail |
|------|--------|
| Frontend-first contract | API responses use **camelCase** and match shapes already consumed by detail pages (`assets/js/data-loader.js`). |
| Source language | **`zh` only** for admin CRUD and preview. |
| Derived languages | `en` / `ru` written by translation pipeline; mark `stale` when `zh` changes. |
| List/detail map shape | `GET /products?lang=zh` returns `{ "1": {...}, "2": {...} }` so related-item logic keeps working. |
| No contact form (current site) | Contact page uses `tel:` / `mailto:` / WhatsApp / map — no `POST /contact` until product adds a form. |

---

## 2. What the front-end needs from the backend

### A. Catalog + detail pages

| Front-end page | Data | Fields used |
|----------------|------|-------------|
| `product-detail.html` | `products` | `id`, `category`, `model`, `name`, `image`, `specs[]`, `summary`, `contentHtml`, `published`, `showInList` |
| `solutions-detail.html` | `solutions` | above + `slug`, `painPoints[{title,desc}]`, `process[{step,title,desc}]`, **`homeSlot`** |
| `news-detail.html` | `news` | `id`, `category`, `title`, `date`, `cover`, `contentHtml`, `published`, **`homeFeatured`** |
| `index.html` | `pages/home` + solutions + news | 文案来自 `pages/home`；标杆/精选方案与精选新闻来自目录字段（见 §3） |

Loader: `TXAM.loadData(kind, lang)` in `assets/js/data-loader.js` — static-first (reads `data/*.js` / JSON); set `window.__TXAM_API_BASE='/api/v1'` to opt into API mode.

### B. Front-end content wiring (done)

| Area | Status |
|------|--------|
| `products.html` / `news.html` / `solutions.html` | ✅ `*-list.js` + catalog map |
| `*-solution.html` (11 landing pages) | ✅ `solution-landing.js` + `by-slug` |
| `index` / `about` / `contact` | ✅ `*-page.js` + `GET /pages/:key`（首页方案/新闻卡由目录坑位驱动） |
| Nav / footer | ✅ `site-footer.js` + `GET /site` |
| Detail pages | ✅ inline + `loadData` |

### C. Not content-API (stay static / env)

- CSS, layout, `assets/images/` (uploads via admin media)
- AMap key → server env `AMAP_KEY`, not DB

### D. Solution slug map

User flow: `solutions.html` → `{slug}-solution.html` (hydrated from same catalog row).

| id | slug | Landing HTML |
|----|------|-------------|
| 31 | `tv-display` | `tv-display-solution.html` |
| 32 | `refrigerator` | `refrigerator-solution.html` |
| 33 | `packaging` | `packaging-solution.html` |
| 34 | `washer` | `washer-solution.html` |
| 35 | `capacitor` | `capacitor-solution.html` |
| 36 | `ac` | `ac-solution.html` |
| 37 | `microwave` | `microwave-solution.html` |
| 38 | `coffee` | `coffee-solution.html` |
| 39 | `tablet` | `tablet-solution.html` |
| 40 | `headlight` | `headlight-solution.html` |
| 41 | `robot` | `robot-solution.html` |

---

## 3. Homepage featured slots（必填坑位）

首页「标杆方案 / 精选方案 / 精选新闻」**不在** `pages/home` 里手工点选卡片，而是目录字段驱动；`pages/home` 只存区段文案、CTA，以及固定的「单元设备」卡（`productsSection.unitCard`）。

| 坑位 | 字段 | 容量 | 前台 |
|------|------|------|------|
| 标杆方案 | `solutions.homeSlot = "hero"` | **1** | 首页首屏大图方案 |
| 精选方案 | `solutions.homeSlot = "category"` | **2** | 「三大核心类目」中的两张方案卡（另有固定单元设备卡） |
| 精选新闻 | `news.homeFeatured = true` | **2** | 首页新闻区 |

规则（与后台实现一致）：

1. **新建默认不上首页**：方案不选坑位（`homeSlot: ""`）、新闻不勾精选；新建默认 `published: false`。
2. **一个方案只能占一个坑位**（`hero` / `category` / 空 互斥）。
3. **仅已发布**内容计入坑位；下架会清空占用（须先满足下一条）。
4. **必填**：三个坑位必须始终满员。下架、取消精选、删除占用项，或从坑位撤出时，必须指定 `replaceId`（另一条**已发布且未占其他首页坑位**的同类型条目）顶替，否则 API 返回 **409** `unpublish_needs_replace`。
5. **认领满员**：往已满坑位精选时，返回 **409** `home_slot_full`，须指定要让出的占用项 `replaceId`。
6. 导入后会 `reconcileHomeSlots()`（清未发布上的脏标记、裁剪超额）；空库种子：方案 `31=hero`、`32/33=category`，新闻 `1`/`3` 精选（`homeSlots.js → seedHomeSlotsIfEmpty`）。

Admin：

```
GET /api/v1/admin/home-slots   → 当前占用与上限（首页编辑页只读展示）
```

写目录时在 body 或 DELETE query 带 `replaceId`：

```
PUT  /api/v1/admin/solutions/:id   { ..., "homeSlot": "hero", "replaceId": "34" }
PUT  /api/v1/admin/news/:id        { ..., "published": false, "replaceId": "5" }
DELETE /api/v1/admin/solutions/:id?replaceId=34
```

实现：`src/services/homeSlots.js`；前台：`assets/js/home-page.js`。

---

## 4. Publish / 下架

| 操作 | 行为 |
|------|------|
| 发布 | `published: true`；出现在公网 API / 列表 / 落地页（产品另受 `showInList` 控制是否进产品中心列表） |
| 下架 | `published: false`；前台不再展示。后台详情有「下架」按钮，等同取消勾选「已发布」后保存 |
| 删除 | 物理删除；若占用首页必填坑位，同样需要 `replaceId` |

公网 `GET` 只返回 `published = true` 的行。

---

## 5. Translation workflow (zh source)

```
Admin saves zh  →  translation_status(en,ru) = stale
       ↓
Translation job (AI / script)  →  writes en + ru  →  status = current
       ↓
Public API serves all langs; preview UI only renders zh
```

`translation_status` values: `source` (zh), `current`, `stale`, `missing`.

**翻译提示词实际保护的内容**（见 `translateProvider.js` 的 system prompt）：`contentHtml` 的 HTML 标签/属性必须原样保留；品牌 `同兴高科` 必须译为 `TXAM`（不得音译）；URL、文件路径、邮箱不得翻译。

> ⚠️ 产品型号（`TX-NS-*`）、单位（`±0.075mm`）**不在**提示词的硬性保护清单里，靠术语表 + 人工抽检兜底。翻译结果若仍有中文残留，调度器只打 `console.warn`（`translateResource.js`），不会自动拒绝——上线前请抽查 en/ru。

---

## 6. Public API

```
GET /api/v1/health

GET /api/v1/products?lang=zh|en|ru
GET /api/v1/products/:id?lang=...

GET /api/v1/solutions?lang=...
GET /api/v1/solutions/:id?lang=...
GET /api/v1/solutions/by-slug/:slug?lang=...

GET /api/v1/news?lang=...
GET /api/v1/news/:id?lang=...

GET /api/v1/site?lang=zh|en|ru
  → data/i18n/{lang}.json (nav, footer, common labels)

GET /api/v1/pages/:key?lang=zh|en|ru
  → data/pages/{key}/{lang}.json (home / about / contact)
```

Query `lang` defaults to `zh`. Only `published = true` rows are returned.

Catalog extras on public payloads:

- solutions: `homeSlot` — `""` | `"hero"` | `"category"`
- news: `homeFeatured` — boolean

### Example product (single record)

```json
{
  "id": "1",
  "category": "光学元件组装",
  "model": "TX-NS-ALM-01",
  "name": "全自动高精密贴胶机",
  "image": "assets/images/products/auto-lamination-001.webp",
  "specs": ["±0.075mm 精度", "80s 节拍"],
  "summary": "...",
  "contentHtml": "<p>...</p>",
  "published": true,
  "showInList": true
}
```

### Example solution (homepage fields)

```json
{
  "id": "31",
  "slug": "tv-display",
  "name": "TV/商业显示器生产线解决方案",
  "homeSlot": "hero",
  "published": true,
  "filterKey": "tv-display"
}
```

> **`filterKey` / `filterKeyEn`**: Grouping key for the frontend filter bar on `solutions.html`. Multiple solutions that share the same `filterKey` appear under one filter button. The human-readable label is defined in `data/pages/solutions/{lang}.json → filters`. For example, solutions with `filterKey: "refrigerator"` appear under the "家电" (Home Appliances) filter. See `assets/js/solutions-list.js → collectCategories()` and `scripts/fix-solutions-filterkey.mjs`.

### Example product (filterKey)

Products also use `filterKey`/`filterKeyEn` as a grouping key for the products list filter bar, following the same pattern.

---

## 7. Admin API

Set `ADMIN_PASSWORD` in the environment. On first boot, this creates a `super_admin` account (username: `admin` by default, or set `ADMIN_USERNAME`). Login returns a session token with the user's role and permissions.

```
POST /api/v1/admin/login   { "actor": "username", "password": "..." }
  → { "token": "...", "expiresAt": "...", "user": { "id", "username", "displayName", "role", "roleLabel", "permissions": [...] } }
GET  /api/v1/admin/me      → { "user": { ... } }  (restore session on refresh)
```

Session TTL: 8 hours by default; set `ADMIN_SESSION_HOURS` to adjust.

### 7a. RBAC — 角色与权限

后台通过 4 个角色控制操作权限，每个 API 端点都有对应的权限检查：

| 角色 | 权限 |
|------|------|
| `super_admin`（超级管理员） | 全部功能，含账号管理、备份恢复 |
| `editor`（内容编辑） | 产品/方案/新闻/页面/分类/素材的增删改发布；可看访问概况和操作记录 |
| `translator`（翻译运营） | 翻译同步、术语表、翻译引擎配置；可查看内容 |
| `viewer`（只读访客） | 只能查看，不能修改 |

精细权限矩阵见 `server/src/services/adminUsers.js` → `ROLES`。前端按权限隐藏无权限的导航和按钮（后端是权限的真实来源）。

账号管理 API（仅 `super_admin`）：

```
GET    /api/v1/admin/accounts        → { accounts: [...] }
POST   /api/v1/admin/accounts        → 创建账号 { username, displayName, password, role }
PUT    /api/v1/admin/accounts/:id     → 更新角色/显示名/密码/状态
DELETE /api/v1/admin/accounts/:id     → 停用账号
GET    /api/v1/admin/roles            → { roles: [...] }
```

### 7b. 术语表（翻译记忆）

后台「系统管理 → 术语表」：

```
GET    /api/v1/admin/glossary?q=&scope=&page=&size=   → { total, items[], stats }
PUT    /api/v1/admin/glossary                          → 新增/更新术语 { source, en, ru, scope }
DELETE /api/v1/admin/glossary?source=&scope=           → 删除术语
```

翻译流程会优先命中术语表里的标准译法，再调用 AI。相同的中文在不同产品里保证译法一致。

### 7c. 翻译调度（自动）

翻译由调度器每 30 秒自动处理（`translationScheduler.js`），无需手动操作。`POST /api/v1/admin/translation-jobs/:id/run` 和 `/:id/apply` 已禁用（返回 405）。

```
GET  /api/v1/admin/translation-status
GET  /api/v1/admin/translation-jobs
GET  /api/v1/admin/translation-config
GET  /api/v1/admin/translation-api-logs
GET  /api/v1/admin/translation-api-usage
GET|POST /api/v1/admin/translation-engines
```

### 7d. 全量 Admin API

```
POST   /api/v1/admin/login
GET    /api/v1/admin/me
POST   /api/v1/admin/logout

GET|POST    /api/v1/admin/products
GET|PUT|DELETE /api/v1/admin/products/:id
GET|POST    /api/v1/admin/news
GET|PUT|DELETE /api/v1/admin/news/:id
GET|POST    /api/v1/admin/solutions
GET|PUT|DELETE /api/v1/admin/solutions/:id

GET  /api/v1/admin/pages/:key      (zh only)
PUT  /api/v1/admin/pages/:key      (zh body only)

GET  /api/v1/admin/home-slots
GET|PUT /api/v1/admin/site
GET|POST /api/v1/admin/media

GET|POST|PUT|DELETE /api/v1/admin/categories/products
GET|POST|PUT|DELETE /api/v1/admin/categories/news
GET|POST|PUT|DELETE /api/v1/admin/categories/solutions

GET|POST /api/v1/admin/backups
POST /api/v1/admin/backups/:id/restore

GET  /api/v1/admin/analytics/summary
GET  /api/v1/admin/analytics/report

GET  /api/v1/admin/audit-logs
GET  /api/v1/admin/dashboard/recent-updates
```

**409 冲突（首页坑位）**

| `error` | 何时 | body 要点 |
|---------|------|-----------|
| `home_slot_full` | 认领已满坑位 | `occupants[]`, `slot`, `action: "claim"` → 传 `replaceId` 让出占用项 |
| `unpublish_needs_replace` | 下架/撤坑/删除占用必填坑位 | `candidates[]`, `slot`, `action: "vacate"` → 传 `replaceId` 顶替 |

Translation engines: `TRANSLATION_PROVIDER=deepseek|openai|qianwen|echo`（实现见 `translateProvider.js`）。DeepSeek 默认 `https://api.deepseek.com` + `deepseek-v4-flash`（自动关闭 thinking）；OpenAI 默认 `gpt-4o-mini`；通义千问默认 `qwen-plus`。无 key 时回退 `echo`：**默认只读、不写库**；仅当 `TRANSLATION_ALLOW_ECHO_WRITE=1` 时才写入 `[EN]`/`[RU]` 前缀占位（限本地联调，勿用于生产）。Translation runs automatically via scheduler every 30s.

> **引擎优先级**：`translation_engine_config` 表中**已激活且带 key** 的引擎配置优先于环境变量（`getTranslationConfig()` 先查表、后兜底 env）；后台「翻译引擎」页面改配置即生效，仅改 `.env` 不一定会生效。

---

## 8. Database

- **Current:** SQLite via Node built-in `node:sqlite` (`server/data/txam.db`). Requires **Node ≥ 22.5**.
- Import once from existing JSON: `cd server && npm run import` (or `npm run import:reset` to wipe DB first).
- Admin/API read & write SQLite; by default also syncs `data/*.json` + companion `.js` for static/`file://` fallback (`SYNC_JSON_ON_WRITE=1`).
- **Production optional:** PostgreSQL — use `schema/tables.sql` (same logical model; adapter not wired yet).

Core tables: `admin_users`（RBAC）, `products`, `product_i18n`（含 `model`）, `solutions`（含 `home_slot`）, `solution_i18n`, `news`（含 `home_featured`）, `news_i18n`, `pages`, `site_settings`, `media`, `product_categories`, `solution_categories`, `news_categories`, `resource_translation_status`, `translation_job_store`, `translation_jobs`, `translation_memory`（术语表 + 页面标题记忆）, `translation_engine_config`, `translation_api_log`, `admin_audit_log`, `page_view_daily`.

See `schema/sqlite-init.sql` and `schema/tables.sql`.

---

## 9. Local development

See **[DEPLOY.md](./DEPLOY.md)** for production nginx, env, backup, and regression checklist.

```bash
cd server
# copy .env.example → .env and set ADMIN_PASSWORD
# (server loads server/.env automatically on boot)
npm run import:reset     # load data/*.json → SQLite
npm run dev              # site + API + admin on one port
```

- Site: `http://localhost:3000/`
- Admin: `http://localhost:3000/admin/`
- Health: `http://localhost:3000/api/v1/health` → `"storage":"sqlite"`

Root helpers:

```bash
npm run sync-catalog-i18n   # fill missing en/ru catalog ids from zh (JSON tooling)
npm run generate-data-js
npm run backup-data        # SQLite + static fallback data + uploaded images
```

Test:

```bash
curl "http://localhost:3000/api/v1/health"
curl "http://localhost:3000/api/v1/products?lang=zh" | head
```

Front-end: static-first by default (reads `data/*.js` / JSON). To opt into API mode:

```html
<script>window.__TXAM_API_BASE = 'http://localhost:3000/api/v1';</script>
```

Production: same-origin `/api/v1` via nginx reverse proxy (see repo root `nginx.conf`).

---

## 10. Import & known data issues

- `npm run import` reads `data/{products,solutions,news}/{zh,en,ru}.json`，并调用 `reconcileHomeSlots()`。
- **import 仅用于首次建库 / 部署初始化**：它用静态 JSON 覆盖当前内容（列表标记/排序/筛选键随 JSON 写入，不再有 seed 覆盖），日常内容改动以数据库为准，**不要在运行期重复 import**，以免覆盖后台操作。
- `sync-catalog-i18n` 是数据库之前的遗留 JSON 工具：现在新建条目由 `ensureDerivedCatalogRow` 自动补 en/ru 同 ID（`missing` 占位、调度器自动翻译），**正常流程不需要再跑它**。
- Slugs for solutions assigned by id map in `scripts/import-from-json.js`.
- JSON 中的 `homeSlot` / `homeFeatured` 会写入 SQLite；勿手改与后台冲突。

**并发访问禁忌**：服务运行期间勿用其他进程直接写同一 `txam.db`，尤其避免 WSL 与 Windows 两侧不同 SQLite 版本同时读写；替换/恢复数据库文件后必须重启服务（否则可能出现 `database disk image is malformed` 这类不一致视图）。

---

## 11. Roadmap

| Phase | Status | Deliverable |
|-------|--------|-------------|
| **1** | ✅ | JSON-backed read API + `data-loader` API switch |
| **2** | ✅ | List pages + solution landing from API/JSON |
| **3** | ✅ | `pages` + `site` API; zh-only admin |
| **4** | ✅ | Translation job + media upload |
| **5** | ✅ | Deploy hardening + backup; contact form cancelled |
| **6** | ✅ | AI translation (OpenAI-compatible; echo without key) |
| **SEO** | ✅ | Client `applySeo` + generated `sitemap.xml` (no SSR) |
| **DB** | ✅ | SQLite (`node:sqlite`); Postgres schema reserved |
| **Home slots** | ✅ | `home_slot` / `home_featured`；必填坑位；下架须替代 |
| **RBAC** | ✅ | 4 roles, 11 permissions, `admin_users` table |
| **Glossary** | ✅ | `translation_memory`；术语表管理页；翻译一致性保障 |
| **Scheduler** | ✅ | 翻译自动调度（30s）；术语优先匹配 |

---

## 12. Repo layout

```
server/
├── README.md                 ← this file
├── DEPLOY.md
├── package.json
├── .env.example
├── schema/
│   ├── tables.sql            ← PostgreSQL reference
│   └── sqlite-init.sql       ← SQLite DDL
├── scripts/
│   ├── import-from-json.js
│   ├── sync-static-from-db.js  ← DB → 静态文件全量导出
│   └── verify-db-vs-static.mjs ← DB ↔ 静态文件一致性校验
├── admin/                    ← CMS UI（admin.js / index.html / admin.css）
└── src/
    ├── index.js              ← HTTP entry
    ├── config.js
    ├── admin.js              ← 全部 admin API 路由 + RBAC 守卫
    ├── db.js                 ← SQLite 连接 + boot migration
    ├── mappers/toApi.js       ← API 响应映射（含多语言 category/model）
    └── services/
        ├── adminUsers.js      ← RBAC 账号/角色/权限/密码哈希
        ├── catalog.js         ← 目录/页面/站点 CRUD + 静态导出
        ├── categories.js      ← 产品/方案/新闻分类管理
        ├── homeSlots.js       ← 首页坑位容量与下架守卫
        ├── translationMemory.js ← 术语表 + 页面标题一致性记忆
        ├── translateResource.js ← 翻译执行（术语优先 + 快照比对 + 中文残留检测）
        ├── translationScheduler.js ← 自动翻译调度（30s 轮询）
        ├── translationFields.js / translateProvider.js / translationJobs.js
        ├── translationEngines.js / translationMemory.js / translationSnapshot.js
        ├── translationApiLog.js / translationStatus.js
        ├── homeSlots.js / categories.js / adminUsers.js
        ├── publicCache.js / rateLimit.js / imageVariants.js / detailPageRenderer.js
        ├── analytics.js / audit.js / backup.js / media.js / sitemap.js
        └── ...
```
