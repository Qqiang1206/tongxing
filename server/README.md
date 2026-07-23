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

Loader: `TXAM.loadData(kind, lang)` in `assets/js/data-loader.js` — auto-probes `/api/v1` on http(s), or set `window.__TXAM_API_BASE`.

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
6. 导入后会 `reconcileHomeSlots()`（清未发布上的脏标记、裁剪超额）；空库种子：方案 `31=hero`、`32/33=category`，新闻 `1`/`2` 精选。

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

**Do-not-translate** list (pass to AI): product models (`TX-NS-*`), units (`±0.075mm`), brand `TXAM`, URLs, HTML tag structure in `contentHtml`.

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
  "published": true
}
```

---

## 7. Admin API

Set `ADMIN_PASSWORD` in the environment to enable. Login returns a random in-memory session token (8 hours by default; set `ADMIN_SESSION_HOURS` to adjust).

```
POST /api/v1/admin/login          { "password": "..." } → { "token": "...", "expiresAt": "..." }
GET  /api/v1/admin/pages/:key     Authorization: Bearer <token>  (zh only)
PUT  /api/v1/admin/pages/:key     Authorization: Bearer <token>  (zh body only)
```

Allowed page keys: `contact`, `home`, `about`, plus list landing keys used by the UI. PUT regenerates `data/pages/{key}/zh.js` for file:// preview.

Admin UI: `http://localhost:3000/admin/` — products, news, solutions（含首页坑位与下架）, pages, site, media, translation, complete backup/restore, audit log.

```
GET|POST /api/v1/admin/products
GET|PUT|DELETE /api/v1/admin/products/:id

GET|POST /api/v1/admin/news
GET|PUT|DELETE /api/v1/admin/news/:id

GET|POST /api/v1/admin/solutions
GET|PUT|DELETE /api/v1/admin/solutions/:id

GET  /api/v1/admin/home-slots

GET|PUT /api/v1/admin/site
GET|POST /api/v1/admin/media

GET  /api/v1/admin/translation-status
POST /api/v1/admin/translation-status/mark-current  { "resource", "lang" }
GET  /api/v1/admin/translation-jobs
POST /api/v1/admin/translation-jobs  { "resource" } | { "enqueueStale": true }
POST /api/v1/admin/translation-jobs/:id/run
POST /api/v1/admin/translation-jobs/:id/apply

GET|POST /api/v1/admin/backups
POST /api/v1/admin/backups/:id/restore
```

**409 冲突（首页坑位）**

| `error` | 何时 | body 要点 |
|---------|------|-----------|
| `home_slot_full` | 认领已满坑位 | `occupants[]`, `slot`, `action: "claim"` → 传 `replaceId` 让出占用项 |
| `unpublish_needs_replace` | 下架/撤坑/删除占用必填坑位 | `candidates[]`, `slot`, `action: "vacate"` → 传 `replaceId` 顶替 |

Translation: set `TRANSLATION_PROVIDER=deepseek` and `TRANSLATION_API_KEY` (or `DEEPSEEK_API_KEY`). Defaults: `https://api.deepseek.com` + `deepseek-v4-flash` (thinking off). OpenAI also works via `TRANSLATION_PROVIDER=openai`. Without a key, `echo` mode writes prefixed placeholders. `POST .../translation-jobs/:id/run` writes en/ru and marks current.

---

## 8. Database

- **Current:** SQLite via Node built-in `node:sqlite` (`server/data/txam.db`). Requires **Node ≥ 22.5**.
- Import once from existing JSON: `cd server && npm run import` (or `npm run import:reset` to wipe DB first).
- Admin/API read & write SQLite; by default also syncs `data/*.json` + companion `.js` for static/`file://` fallback (`SYNC_JSON_ON_WRITE=1`).
- **Production optional:** PostgreSQL — use `schema/tables.sql` (same logical model; adapter not wired yet).

Core tables: `products`, `product_i18n`, `solutions`（含 `home_slot`）, `solution_i18n`, `news`（含 `home_featured`）, `news_i18n`, `pages`, `site_settings`, `media`, `resource_translation_status`, `translation_job_store`, `admin_audit_log`.

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

Front-end: `data-loader.js` auto-probes same-origin `/api/v1/health` on http(s). Override with:

```html
<script>window.__TXAM_API_BASE = 'http://localhost:3000/api/v1';</script>
```

Production: same-origin `/api/v1` via nginx reverse proxy (see repo root `nginx.conf`).

---

## 10. Import & known data issues

- `npm run import` reads `data/{products,solutions,news}/{zh,en,ru}.json`，并调用 `reconcileHomeSlots()`。
- After adding zh-only catalog rows, run `npm run sync-catalog-i18n` so en/ru share the same ids (text stays zh until translation).
- Slugs for solutions assigned by id map in `scripts/import-from-json.js`.
- JSON 中的 `homeSlot` / `homeFeatured` 会写入 SQLite；勿手改与后台冲突。

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

---

## 12. Repo layout

```
server/
├── README.md                 ← this file
├── DEPLOY.md
├── package.json
├── schema/
│   ├── tables.sql            ← PostgreSQL reference
│   └── sqlite-init.sql       ← SQLite DDL（含 home_slot / home_featured）
├── scripts/
│   └── import-from-json.js
├── admin/                    ← CMS UI（admin.js / index.html）
└── src/
    ├── index.js              ← HTTP entry (zero deps)
    ├── config.js
    ├── admin.js
    ├── db.js
    ├── mappers/toApi.js
    └── services/
        ├── catalog.js
        └── homeSlots.js      ← 首页坑位容量与下架守卫
```
