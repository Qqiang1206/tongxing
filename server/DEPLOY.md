# TXAM 部署与上线清单

中文为源语言；静态站 + Node API（后台 `/admin/`）。**不做在线留言。**

---

## 1. 目录与进程

| 角色 | 路径 / 命令 |
|------|-------------|
| **一体化（推荐本地）** | `cd server && ADMIN_PASSWORD=*** npm run dev` → 同端口提供站点 `/`、API `/api/v1`、后台 `/admin/` |
| 静态站根目录 | 仓库根（也可用 nginx 单独托管） |
| 反向代理 | 见根目录 `nginx.conf`（生产可用 nginx 托管静态，只反代 `/api/` `/admin/`） |

推荐生产用进程管理：**本项目自带的 `scripts/watchdog.mjs`**（零依赖，Windows / Linux 通用）。
崩溃自动重启 + 每 30 秒心跳探测，详见下方「进程守护」一节。
（Linux 也可用 `systemd` / `pm2`；本项目仓库内不含 pm2 依赖，勿直接挂交互终端长期跑。）

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
# 首次启动（空库）时用它创建 super_admin；要求 ≥10 位、非纯数字、非常见弱口令
ADMIN_PASSWORD=换成足够长的随机密码
# 本地开发想放宽口令强度时设为 1；生产务必删除或设为 0
# ALLOW_WEAK_CREDENTIALS=0
# 首次启动时会自动创建 super_admin 账号，用户名默认 admin
ADMIN_USERNAME=admin        # 可选，自定义初始管理员用户名
ADMIN_DISPLAY_NAME=超级管理员  # 可选
# 支持逗号分隔多个源；非白名单的请求不会拿到可用的跨域头。
# 留空或 "*" 放行全部（生产启动时会在日志里告警）
CORS_ORIGIN=https://www.sztxgk.com,https://sztxgk.com
# 生产环境 Node 只监听本机，由 Nginx 反代
HOST=127.0.0.1
# 公开内容 API 内存缓存毫秒（后台写入会立即清除）
PUBLIC_CACHE_TTL_MS=45000
# 会话有效期（小时，默认 8）
# ADMIN_SESSION_HOURS=8
# admin 请求体上限（字节，默认 12MB，与 nginx client_max_body_size 对齐）
# MAX_BODY_BYTES=12582912
# 登录限流（每 IP 每分钟，默认 8）
# ADMIN_LOGIN_MAX_ATTEMPTS=8
# 访问统计打点限流（每 IP 每分钟，默认 120）
# ANALYTICS_MAX_HITS_PER_MIN=120
# SQLite 路径（相对 server/）与是否同步 data/* 静态快照
# SQLITE_PATH=./data/txam.db
# SYNC_JSON_ON_WRITE=1
# 审计日志保留天数（0 关闭清理，默认 90）
# AUDIT_RETENTION_DAYS=90
```

- 完整环境变量清单以 `server/.env.example` 为准；**切勿**把真实 `ADMIN_PASSWORD` 提交进 Git。
- 后台支持多账号 RBAC（4 个角色：超级管理员/内容编辑/翻译运营/只读访客）。首次启动后登录后台「系统管理 → 账号管理」创建团队成员的账号。
- 公网部署时建议限制后台访问（VPN / IP 白名单 / Basic Auth 外层）。

---

---

## 2.1 进程守护（watchdog）

服务不再裸跑 `node src/index.js`。用守护脚本拉起，进程崩溃或被误杀会自动重启：

```bash
node scripts/watchdog.mjs start     # 前台运行（由 systemd / NSSM / 计划任务托管）
node scripts/watchdog.mjs stop      # 停止守护及其子进程
node scripts/watchdog.mjs status    # 查看运行状态与健康检查地址
```

行为说明：

| 能力 | 说明 |
|------|------|
| 崩溃重启 | 子进程退出后 1s → 2s → 4s… 指数退避重启，上限 30s；稳定运行超过 60s 后重置退避计数 |
| 心跳探测 | 每 30s 请求 `GET /api/v1/health`（含 `ok:true` 校验），连续 3 次失败则重启子进程 |
| 日志 | 服务 stdout/stderr → `logs/server.log`；守护事件 → `logs/watchdog.log`（各 5MB 滚动，保留 3 代） |
| 单实例 | `logs/watchdog.pid` 作为锁，重复启动会直接退出并提示已在运行的 PID |

> `logs/` 已加入 `.gitignore`，不进版本库。

**Windows 开机自启**（任选其一）：

```powershell
# A. NSSM（推荐，真正的服务，支持开机自启与自动拉起）
nssm install TXAM-CMS "C:\Program Files\nodejs\node.exe" "H:\tongxing\scripts\watchdog.mjs"
nssm set TXAM-CMS AppDirectory H:\tongxing
nssm set TXAM-CMS AppStdout H:\tongxing\logs\nssm.log
nssm set TXAM-CMS AppStderr H:\tongxing\logs\nssm.log
nssm start TXAM-CMS

# B. 计划任务（无额外软件）
schtasks /create /tn "TXAM-CMS" /sc onstart /ru SYSTEM ^
  /tr "\"C:\Program Files\nodejs\node.exe\" \"H:\tongxing\scripts\watchdog.mjs\" start"
```

**Linux（systemd）**：

```ini
[Unit]
Description=TXAM CMS watchdog
After=network.target

[Service]
Type=simple
WorkingDirectory=/srv/txam
ExecStart=/usr/bin/node scripts/watchdog.mjs start
ExecStop=/usr/bin/node scripts/watchdog.mjs stop
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

---

## 3. Nginx（同域）

前台默认**静态数据优先**；需要 API 时可显式设置 `window.__TXAM_API_BASE='/api/v1'`。

关键片段：`nginx.conf` + `nginx/txam-locations.conf`（部署时复制到 `/etc/nginx/conf.d/`）。`/` 静态，`/api/` 与 `/admin/` 反代到 `127.0.0.1:3000`。
已包含 `/_backups/`、`/server/`、`/assets/images/uploads/_originals/` 等 **deny** 规则，以及基础安全响应头。
证书就绪后：注释掉 HTTP server，启用文件内 HTTPS 模板（含 HSTS）。

访问统计在内存攒批约 5 秒再写 SQLite；**默认忽略 `localhost`/`127.0.0.1`/`::1` 的 Host**（开发/QA 流量不进统计），如需本地也计数把 `ANALYTICS_IGNORE_HOSTS` 置空；`ANALYTICS_ENABLED=0` 可整体关闭。生产用单个 Node 进程（勿 PM2 cluster），backup-data 产物请再同步到 OSS。

### 图片上传（运营素材）

- 后台上传 ≤8MB 的 PNG/JPG/JPEG/WebP 会自动生成 **display WebP（≤1920px）** 与 **thumb WebP**；前台只引用 display 路径。GIF 允许上传但**原样保存、不生成变体**；**SVG 禁止上传**（内联返回有存储型 XSS 面，`media.js → ALLOWED_EXT`）。
- 原图归档在 `assets/images/uploads/_originals/`（Nginx/Node 均不可公开访问）。
- 已有旧上传：`cd server && npm run migrate:uploads`
- 列表页数据：`npm run generate-data-js` 会生成 slim 列表 JS + `data/*/items/{lang}/{id}.json` 详情分文件。
- 公开 API 500 在生产环境不返回内部错误详情；`/api/v1/analytics/hit` 默认每 IP 120 次/分钟（`ANALYTICS_MAX_HITS_PER_MIN`）。

---

## 4. 发布步骤

1. 备份：`npm run backup-data`
2. 上传/同步代码（排除 `node_modules`、`_unused-images`、`_backups`、`.git`）。注意：`data/`（JSON/JS 快照）与 `server/data/*.db` 按 `.gitignore` 不进 git，但**必须随整目录一起打包上传**，否则纯 git 拉取会丢失全部内容
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

# 完整备份 SQLite、静态回退数据和运营上传图片
npm run backup-data

# 可选：将 _backups/ 同步到阿里云 OSS（示例，需安装 ossutil 并配置 AK）
# ossutil cp -r _backups/ oss://your-bucket/txam-backups/ --update
# 建议 cron：每日 03:00 backup-data + ossutil sync；保留 OSS 生命周期 30 天。
```

翻译：系统每 30 秒自动调度（无需手动操作）。中文源修改后自动标记 en/ru 为 stale，调度器依次翻译并回写。翻译前优先匹配术语表，保证同一中文译法一致。

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

# 或通义千问
# TRANSLATION_PROVIDER=qianwen
# TRANSLATION_API_KEY=sk-...
# 默认 MODEL=qwen-plus
```

未配置 Key 时默认为 **echo**：默认只读不写库；仅当 `TRANSLATION_ALLOW_ECHO_WRITE=1` 时才给文案加 `[EN]`/`[RU]` 前缀写入（限本地联调，勿用于生产）。

> **引擎优先级**：后台「翻译引擎」表（`translation_engine_config`）里**已激活且带 key** 的配置优先于环境变量；环境变量仅在无有效表配置时兜底。改引擎请到后台「系统管理 → 翻译引擎」，只改 `.env` 可能不生效。

---

## 6. 安全要点

| 项 | 要求 |
|----|------|
| Admin 密码 | 强密码（≥10 位、非纯数字、非常见弱口令、不与账号同名），仅环境变量；后台建号/改密在服务端强制校验 |
| 上传目录 | `assets/images/uploads/` 可写但勿执行脚本 |
| CORS | 生产改为具体站点 Origin，支持逗号分隔多源；勿长期 `*`。非白名单请求回落到第一个允许源（浏览器会拒绝跨域读取） |
| 备份 | 后台写入前每 15 分钟自动备份；也可跑 `backup-data`。备份含 SQLite、静态数据和上传图片，`_backups` 勿暴露 Web |
| 操作日志 | 写操作与登录写入 `admin_audit_log`；默认保留 90 天（`AUDIT_RETENTION_DAYS`）；不含密码与上传二进制 |

**并发访问禁忌**：SQLite 服务运行期间，不要用其他进程直接写同一个 `txam.db`，尤其避免 WSL 与 Windows 两侧不同 SQLite 版本同时读写；备份恢复/替换数据库文件后**必须重启 Node 服务**，否则运行中的进程可能读到不一致视图（表现为 `database disk image is malformed`）。

---

## 7. 上线回归清单

自动化脚本：`ADMIN_PASSWORD=你的密码 npm run regression -- http://127.0.0.1:PORT`（需先 `npm run server:dev`）。未设 `ADMIN_PASSWORD` 时跳过后台写测，仍检查公网 API 与首页坑位。

最近一次后台/API 审计（2026-08-01，干净实例）：**33 PASS / 0 FAIL**（自定义审计脚本：公开 API 三语 + 后台只读端点 + 媒体上传/删除回环）。

> ⚠️ `regression-check.js` 里的「改产品摘要再恢复」写测会触发 `markStale('products')`，30 秒后调度器会对全部产品发起 AI 重译——跑写测前请确认翻译环境（无 key / 测试库），并先备份 DB。

- [x] `/` 首页区块正常（hero、标杆方案、三大核心类目、产品、服务、新闻）— 标杆/精选来自 `homeSlot` / `homeFeatured`，单元设备卡来自 `pages/home`
- [x] `/about.html` 轮播、统计、文化、时间轴、资质、客户 Logo — 容器 + API timeline 4 条；视觉再确认
- [x] `/contact.html` 渠道卡片 + 地图（无留言表单）
- [x] `/products.html` → 详情、`/news.html` → 详情 — 列表由 CMS `showInList` / `published` 过滤
- [x] `/solutions.html` 方案矩阵由目录数据渲染（仅已发布）
- [x] 方案落地页（如 `tv-display-solution.html`）
- [x] `/en/`、`/ru/` 对应页与语言切换 — 关键页 HTTP 200（8 URL）
- [x] 默认静态优先（读 `data/*.js` / JSON）；显式设置 `window.__TXAM_API_BASE` 后走 `/api/v1` — `ensureApiBase` 代码存在；浏览器 Network 需肉眼确认
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
| RBAC | 4 角色 / 11 权限；后台账号管理页 |
| 术语表 | 全局翻译记忆；术语管理页；翻译一致性 |
| 前台对接 | 静态优先（默认读 data/*.js / JSON）；产品列表由 `showInList` 控制 |

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
