# 同兴高科 TXAM — 网站设计规范

> 源码依据：`assets/css/styles.css`（权威）+ 全站 HTML 约定  
> 气质：**浅底、深字、橙色点睛、大字重标题、轻阴影卡片**（偏 Apple 工业风，不是深色炫光风）

---

## 1. 品牌与气质

| 原则 | 说明 |
|------|------|
| 轻、净、稳 | 背景浅灰白，少用大块纯色 |
| 橙色只做强调 | CTA、导航高亮、eyebrow、hover，不铺满大面积背景 |
| 标题要重 | 栏目大标题字重 900，字距略收 |
| 正文要灰 | 内联惯例 `#86868B`（token `--text-muted`=`#6E6E73`），行高偏松（1.7–1.8） |
| 圆角克制 | 大面 12px、控件 8px；**不用胶囊 pill** |
| 动效克制 | 入场 fade-up、卡片上浮；曲线统一 `cubic-bezier(0.16, 1, 0.3, 1)` |

### 字体

- UI / 英文：`Geist`（400 / 700 / 900）
- 中文：`Noto Sans SC`（400 / 500 / 700）
- 回退：`-apple-system, BlinkMacSystemFont, sans-serif`
- 数字 / 型号：`.mono-num`（系统等宽 / SF Pro Rounded）

---

## 2. 色彩

| Token | 色值 | 用途 |
|-------|------|------|
| `--txam-orange` | `#FF6B00` | 品牌强调、链接 hover、筛选激活邻近、CTA hover |
| `--txam-dark` | `#1D1D1F` | 主文字、主按钮、标题 |
| `--bg-color` | `#FBFBFD` | 页面底色 |
| `--border-light` | `#E5E5EA` | 描边、分割线 |
| `--text-muted` | `#6E6E73` | 正文、导语、次要信息（页面内联多用 `text-[#86868B]`） |
| （辅助，`--color-surface-alt`） | `#F5F5F7` | 浅灰区块底、spec 标签底 |
| （辅助） | `#FFFFFF` | 卡片底 |
| （渐变字） | `#1D1D1F → #6E6E73` | `.text-gradient` 大标题 |

- **选中态**：`selection:bg-[#FF6B00] selection:text-white`
- **导航当前项**：深色字 + 橙色底边 `border-b-2 border-[#FF6B00]`

---

## 3. 字号层级（必守）

| 类名 | 字号 | 字重 | 只用在 |
|------|------|------|--------|
| `.text-display` | clamp(2.5rem → **5rem**) | 900 | **栏目首页 H1 唯一**（首页/关于/产品/方案/新闻/联系） |
| `.text-h1` | clamp(2rem → 3.5rem) | 900 | 详情页 H1、页内大章节 |
| `.text-h2` | clamp(1.5rem → 2.5rem) | 700 | 次级章节、方案列表矩阵标题 |
| `.text-h3` | clamp(1.25rem → 1.5rem) | 700 | 卡片标题、小标题 |
| `.text-body-lg` / `.detail-lead` | **1.125rem (18px)** | 500 | 页头导语、详情侧栏说明 |
| `.text-body` / `.detail-prose` | **1rem (16px)** | 400 | 正文段落 |
| `.text-sm` | 0.875rem | — | 卡片摘要、辅助说明 |
| `.text-caption` / eyebrow | 0.75rem | 700 | 橙色小标签、SOLUTION 01 等 |
| `.detail-section__title` | clamp(1.5rem → 2.25rem) | 900 | 详情页区块标题（详细说明、相关…） |

**禁止**：业务页用 `text-4xl`、`text-[3.5rem]` 等随意放大标题（统计数字装饰除外）。

### 详情正文内标题

走 `.detail-prose`，不要内联字号：

- `h2` ≈ 1.25–1.75rem
- `h3` = 1.125rem
- 段落行高 1.8，颜色 muted

新闻正文外加 `.detail-prose--article`（最大宽 760px 居中）。

---

## 4. 间距与版心

### 间距尺（8px 基准）

`--space-1` 8 → `--space-2` 16 → `--space-3` 24 → `--space-4` 32 → `--space-5` 40 → `--space-6` 48 → `--space-8` 64 → `--space-10` 80 → `--space-12` 96 → `--space-16` 128

### 常用页面节奏

| 场景 | 约定 |
|------|------|
| 顶栏占位后首屏 | `pt-40` |
| 大区块上下 | `py-32` |
| 左右边距 | `px-6` / `md:px-24` |
| 列表/首页版心 | `max-w-[1400px]` |
| 详情版心 | `max-w-[1200px]`（`.detail-page__inner`） |
| 详情区块间距 | `.detail-section` → `mb-16` / 4rem |

---

## 5. 圆角与阴影

| Token / 类 | 值 | 用途 |
|------------|-----|------|
| `--radius-sm` / `.radius-sm` | **8px** | 按钮、筛选、标签、小图 |
| `--radius-lg` / `.radius-lg` | **12px** | 卡片、大图、轮播、地图浮层 |

| 阴影 | 用法 |
|------|------|
| `0 4px 20px rgba(0,0,0,0.02)` | 卡片默认 |
| `0 20px 40px rgba(0,0,0,0.08)` | 卡片 hover |
| `0 20px 60px rgba(0,0,0,0.06)` | 大图 / hero 媒体 |
| `0 10px 30px rgba(255,107,0,0.2)` | 主按钮 hover |

Hover 卡片：上移 `translateY(-6px)`，边框偏橙 `rgba(255,107,0,0.3)`。

---

## 6. 组件规范

### 导航

- 桌面：字号约 15px、`font-medium`，间距宽松
- 当前页：深色 + 橙色下划线
- 语言：`ZH | EN | RU`，当前语言橙色加粗
- 固定顶栏：半透明底 + `backdrop-blur` + 底边

### 按钮

| 类 | 样式 |
|----|------|
| `.btn-primary` | 深底白字 → hover 橙底、上移 |
| `.btn-secondary` | 白底浅边 → hover `#F5F5F7` |
| 筛选 `.filter-btn` | 默认白底灰字；`.active` 深底白字 |

圆角一律 `radius-sm`，**不要** `rounded-full` 做主按钮。

### 卡片

| 类 | 场景 |
|----|------|
| `.apple-card` | 通用白卡片 |
| `.product-card` / `.news-card` | 列表卡片（纵向 flex，产品图高 220px） |
| `.detail-related-card` | 详情页「相关」三列 |

图上加 `.img-zoom`：hover 轻微放大 1.05。

### 标签

- `.spec-tag`：灰底 `#F5F5F7`、13px、8px 圆角
- `.detail-eyebrow`：橙色、12px、字距加宽、大写

### 媒体高度

| 类 | 移动 | ≥768px |
|----|------|--------|
| `.media-h-index` | 300 | 600 |
| `.media-h-detail` | 400 | 500 |
| `.media-h-solution` | 400 | 600 |
| `.media-h-factory` / 轮播 | 320 | 560 |
| `.media-h-map` | 600 | 700 |

外壳常用 `.media-hero`（大圆角 + 边框 + 轻阴影）。

### 动效

- 入场：`.fade-up` → IntersectionObserver / 详情页 `.detail-ready` 加 `.visible`
- 时长：卡片约 0.5s，入场约 1s，图缩放约 0.8s
- 缓动：`cubic-bezier(0.16, 1, 0.3, 1)`

### 地图浮层

- `.map-overlay`：近白半透明 + blur 16px + `radius-lg`

### 资质横向滚动（关于我们）

- `.patent-marquee`：质量资质 / 专利资质 **自动从右往左**无缝滚动（无滚动条）
- 时长 `--marquee-duration`（质量约 40s，专利约 60s）；悬停暂停
- 脚本：`assets/js/patent-marquee.js`（复制一轨内容实现无缝循环）

---

## 7. 页面模板约定

| 页面类型 | 标题 | 导语 | 备注 |
|----------|------|------|------|
| 栏目首页 | `hero-title text-display text-gradient` | `text-body-lg` | 可居中 |
| 产品/新闻列表 | 同上 | 同上 | 筛选器用 `.filter-btn` |
| 方案列表 | 同上 | 同上 | 矩阵标题用 `text-h2`，正文 `text-body-lg` |
| 产品/新闻/方案详情 | `detail-title text-h1 text-gradient` | `detail-lead` | 结构见下方 |
| 静态 `*-solution.html` | 同详情 | `detail-lead` | 正文 `detail-prose` |

### 详情页结构（推荐顺序）

1. 面包屑  
2. eyebrow + H1  
3. 双栏 hero（图 + 参数/导语）  
4. `detail-section` 正文  
5. `detail-related` 相关推荐  

### 多语言

- `/` 中文、`/en/`、`/ru/` 结构对称  
- 样式同一份 `assets/css/styles.css`

页面角色对照见 `templates/README.md`。

---

## 8. 资源与内容路径

```
assets/css/styles.css          # 设计系统唯一入口
assets/css/tailwind.min.css
assets/js/                     # header / footer / data-loader …
assets/images/
  brand|hero|products|solutions|certifications|clients
data/
  products|solutions|news/{zh,en,ru}.{json,js}
  pages/{home,about,contact,products,news,solutions}/{zh,en,ru}.{json,js}
  i18n/{zh,en,ru}.{json,js}
```

图片路径相对站点：`assets/images/...`（不要写死域名；语言子目录页由 `TXAM.assetUrl` 处理）。

---

## 9. 做新页 / 改页检查清单

1. 栏目大标题是否只用 `text-display`？详情是否用 `text-h1`？
2. 导语是否 `text-body-lg` / `detail-lead`（约 18px）？
3. 正文是否进 `detail-prose`，文内 h2/h3 是否裸标签、不内联字号？
4. 卡片是否 `apple-card` / `product-card`，圆角是否 8/12？
5. 橙色是否只作强调，没有大面积橙底？
6. 是否避免新的 `text-[…rem]` / `text-4xl` 标题？
7. 中英俄三份 HTML 是否同一套类名？

---

## 10. 相关文件

| 文件 | 说明 |
|------|------|
| `assets/css/styles.css` | 设计 token 与组件实现 |
| `templates/README.md` | 页面角色与数据绑定 |
| `scripts/unify-typography.js` | 字号统一工具（历史/维护用） |
| `README.md` | 站点结构与部署说明 |

---

## 11. Design System v3 「光感单色」（2026-08，首页样板阶段）

**定位**：明亮基调下的近单色高级灰白 + 光感科技白。墨黑标题、多层冷灰正文、发丝边框、
玻璃拟态卡片、中性光晕氛围。品牌橙 `#FF6B00` 降为微交互点缀（导航激活下划线、hover、
focus 光圈、选中文字色），不再出现在大面积色块。

### 11.1 门控机制（改动红线）

所有 v3 样式只在 `<html data-ui="v3">` 存在时生效：

- 共享 CSS 新层全部以 `html[data-ui="v3"]` / `[data-ui="v3"]` 或 v3 专属类（`.v3-*`、
  `.txnav-*`、`.txf-*`）实现；未打标记的页面零影响。
- `assets/js/home-page.js` 双模式：`data-ui="v3"` 输出新组件标记，否则按 git 历史里的
  旧模板原样输出（en/ru 首页共用该渲染器，必须保持旧观感）。
- `header.js` / `site-footer.js` 内部按 `data-ui` 分支：v3 用 `.txnav*` 导航与 `.txf*`
  浅色页脚；其余页面沿用旧导航/深色页脚。
- v3 导航复用 `#navbar` / `#mobile-menu` / `#mobile-menu-btn` 契约与 `menu-open` /
  `menu-closed` 类，滚动显影、移动端开合、三语标签水合全部由 site-chrome / site-nav
  现有逻辑接管，不新增 JS 依赖。

### 11.2 令牌（styles.css `[data-ui="v3"]` 块）

| 令牌 | 值 | 用途 |
|---|---|---|
| `--tx-ink` | #14161B | 标题/主按钮墨黑 |
| `--tx-ink-mid / --tx-ink-mute / --tx-ink-faint` | #39404C / #667084 / #9AA1AE | 正文/辅助/弱化 |
| `--tx-bg` / `--tx-mist-50 / --tx-mist-100` | #FFFFFF / #F7F8FA / #F1F3F7 | 页面/交替区块 |
| `--tx-hairline` | rgba(20,22,27,.08) | 发丝边框 |
| `--tx-glow-a / --tx-glow-b` | 中性冷灰/暖灰 | 光晕（纯 CSS 径向渐变） |
| `--tx-radius-card / --tx-radius-shell` | 20px / 24px | 卡片/媒体壳（门控页同时把 --radius-lg 升到 16px） |

玻璃卡规范：半透明白底 + `backdrop-blur` + 1px 光边 + 三层阴影 + 顶部内高光
（`.v3-panel` / `.v3-stat` / `.v3-feature__caption` 同族）。

### 11.3 首屏 Hero（满屏视频 · 白雾压字）

- 底层 `<video autoplay muted loop playsinline>`：`assets/videos/hero-loop.mp4`
  （1080p/30fps、8.4s 交叉淡化无缝循环、2.1MB、H.264 faststart）；
  海报回退 `assets/videos/hero-poster.webp`（同时是 LCP 预加载）。
- 素材来源与授权：Pexels 视频 id **32386532**（"Industrial Robot Arm in High-Tech
  Factory"），Pexels License 免费商用、无需署名；已在本地转码（交叉淡化循环），
  自托管于 `assets/videos/`，不外链 CDN。
- 白雾层 `.v3-hero__veil` 顶部 0.90 → 中部 0.26 → 底部归入 `--tx-bg`，保证明亮基调
  与墨黑大字对比度；站点所有者明确选择：该装饰性氛围视频不受系统「减少动效」偏好影响，始终静音自动播放；该偏好仍作用于 fade-up 等入场动画（styles.css 已处理）。
- 客户 logo 墙 `.v3-logos`（灰度 50% → hover 显色）。

### 11.4 构建链（Tailwind 恢复为真实管线）

```
npm run build:css
# tailwindcss -c tailwind.config.js -i assets/css/tailwind.src.css -o assets/css/tailwind.min.css --minify
```

- `tailwind.config.js` content 扫描 `*.html`、`en/ ru/`、`assets/js/**`、`data/**`
  （数据 JSON 里存在动态携带的工具类）。
- 产物覆盖 `assets/css/tailwind.min.css`，全站 `<head>` 引用无需改动；
  改版前原文件在 git 历史中可随时比对回滚。
- `node scripts/check-css-coverage.mjs`：抽取全站候选工具类，逐一核对产物中存在，
  防止新增类静默失效（误报清单：styles.css 自定义类与 `group-hover:` 变体）。
- 主题扩展只 add 不改默认：`ink/mist/accent` 色板、`rounded-card/shell/ctl`、
  `shadow-glass-*`、`max-w-shell`、`ease-out-expo`、`animate-drift-a/b`。

### 11.5 第二阶段全站铺开清单（待批准后执行）

1. `en/index.html`、`ru/index.html` 加 `data-ui="v3"`，补译 header/footer/CTA 文案
   （i18n JSON 增字段）。
2. 其余页面逐组迁移：列表页（products/solutions/news）→ 详情模板 → 11 个方案落地页
   → about/contact/404；每页打 `data-ui="v3"` 后把硬编码导航替换为 header.js 注入。
3. 已知待清理素材：`assets/images/hero/automation-line.webp`（马自达停车场，与命名
   不符）、`assets/images/hero/robot-arm.webp`（暗色旧机床，弃用）；产品卡中后段包装
   线图片出现疑似第三方纸箱印花，铺开前建议替换素材。
4. 每步跑 `npm run build:css` + `check-css-coverage`，浏览器三档宽度抽查。

### 11.6 全站铺开记录（第二阶段完成）

- 63 页（zh 21 / en 21 / ru 21）全部完成 v3 铺开：`node scripts/rollout-v3.mjs --verify` 全绿
  （data-ui 存在、静态 v3 导航唯一、无旧导航/旧移动菜单残留、渲染器同步化、跨页过渡已链接）。
- 导航为**静态内联**（首帧直出，无 JS 弹入），标签按语言烘焙自 data/i18n/{lang}.json，
  水合前后零位移；滚动玻璃态由 site-chrome.js 接管；fade-up 观察器也已迁至 site-chrome.js。
- 首页三语结构 1:1（满屏视频 hero · 白雾压字 · 数据胶囊 · logo 墙 · 各区块），文案取自
  data/pages/home/{lang}.json，en/ru 资源路径带 ../ 前缀。
- 体验保障：scroll-smooth 已移除、首屏无入场动画、列表卡片 250ms 柔和淡入（过渡层）、
  页面级 0.35s 载入动画 + 跨文档 View Transitions（Chromium 126+）。
- 维护注意：
  1) 列表页筛选按钮文案是 HTML 静态兜底，CMS 改名筛选分类后需重跑 rollout 或手改对齐；
  2) 落地页 H1/lead 静态兜底已与 data/solutions/{lang}.json 对齐，CMS 改名后需再同步；
  3) robot-arm.webp 已无引用可删；automation-line.webp 无引用可删；
  4) CMS 数据待清理：zh 解决方案筛选含测试条目「爱你」(solution-s9nqazv)；
     ru 解决方案 id=36-40 filterKey 与 slug 不一致（validate-data.js WARN）。

### 11.7 五页专属 hero 视频资产（第二阶段追加）

| 页面 | 文件 | 来源（Mixkit，免费下载） | 时长/体积 |
|---|---|---|---|
| 首页 | hero-loop.mp4 | Pexels 32386532 | 8.4s / 2.1MB |
| 解决方案 | solutions-loop.mp4 | Mixkit "Automated machine places parts on circuit boards" (47266) | 7.8s / 2.2MB |
| 产品中心 | products-loop.mp4 | Mixkit "Parcels on a conveyor belt" (20770) | 7.0s / 1.0MB |
| 新闻中心 | news-loop.mp4 | 首页 hero-loop 的正向段（2026-09-11 与联系页对调） | 8.4s / 1.2MB |
| 关于我们 | about-loop.mp4 | Mixkit "Electrical workers walking on the hallway" (23696) | 7.8s / 2.5MB |
| 联系我们 | contact-loop.mp4 | Mixkit "Open office space" (914)（2026-09-11 与新闻页对调） | 7.8s / 1.9MB |

> 2026-09-11 换素材：原 47257/17675/14631/22033 与页面主题不符（航拍化工厂用于新闻、
> 手部特写用于产品等），经用户从候选预览页选定上述素材；同日新闻中心 ↔ 联系我们 对调
> （新闻用产线机械臂、联系用办公场景）。旧文件备份于 `_backups/videos-20260911/`
> （同时 git 可回滚）。
> 同日内页白雾层 `.v3-hero--band-media .v3-hero__veil` 中部浓度 0.58 → 0.32（顶部
> 0.92 → 0.88、其余同比下调），改善"太白发灰"、提升视频可见度，文字对比度保持。
> 同日循环方式变更：全部 6 条循环视频由**正放+倒放乒乓**改为**交叉淡化循环**
> （crossfade：结尾 1.0–1.2s 与开头柔和混合，xfade transition=fade），消除用户反馈的
> "倒退再前进"观感；内页视频 `preload` 同步由 metadata 改 auto，减少载入停顿。

- 全部 1280×720/30fps（首页 1080p）、交叉淡化无缝循环、≤2.5MB、无音频。
- ⚠️ 授权状态：Mixkit 免费下载的 720p 产物标注 **Restricted License（仅限个人使用）**，
  商用需向 Envato/Mixkit 购买授权或后续替换为可商用素材。站点所有者已知悉并决定先行使用。
- 偏暗素材已在转码时做 gamma 亮度适配（solutions 2.07 / products 1.29 / news 1.31 / about 1.24），
  成片亮度 131–150，与首页（158）同属明亮基调。
- 关于页：CMS 轮播首图作为视频海报（后台换图即换加载画面）。

## 12. 安全加固批次记录（2026-09-04 开始，按批次推进）

### 批次 1（已完成，commit 5f3b07c）：静态暴露面收窄
nginx `/data/` 白名单化；双端黑名单补齐 output/docs/templates/nginx/.zcode/.playwright-cli/data/_tmp_curl；
清理 5 组旧实验库。实测：泄漏路径 403，公开内容 200。
更正：初判「txam.db 可公网下载」不成立（/server/ 双侧已屏蔽）。

### 批次 2（已完成，commit 待查）：ADMIN_PASSWORD 登录后门移除 + 会话吊销
- admin.js 删除「ADMIN_PASSWORD 等值即登录为 super_admin」的回退分支与 passwordMatches。
- ADMIN_PASSWORD 保留**唯一职责**：全新数据库首次引导创建 super_admin（adminUsers.js:231）。
- 新增 revokeUserSessions(userId)：账号改密/停用/角色变更时立即吊销其全部会话。
- ⚠️ 所有者待办：当前真实 admin 密码与旧 ADMIN_PASSWORD 相同（引导种子未轮换），
  请在 后台 → 账号管理 修改密码，并同步更换 .env 的 ADMIN_PASSWORD 为强随机值。

### 批次 5（已完成）：测试回绿 + 原子导出 + CI + 部署脚本
- page-title 测试改为校验真正的不变量（HTML 静态兜底标题 = 导出的 CMS 数据），
  3 个陈旧断言回绿（34/34）
- catalog 导出（json/js/items）全部原子写入（.tmp + rename），杜绝发布瞬间截断
- 导出时清理已下架条目的幽灵 item 快照
- .github/workflows/ci.yml：validate + 三套测试 + build:css + 覆盖率校验
- scripts/deploy-init.sh：全新机器一键初始化（依赖/导入/同步/构建/校验）

### 批次 6（已完成）：统一入场节奏（用户选定 B 方案）
全站只保留一种入场语言，规则固化：
- 首屏（导航 + 标题带 / 首页视频区）零动画，第一帧即完整；
- 首屏以下所有区块：0.45s / 上浮 12px / 同组 +60ms 交错，滚动进入视口触发，仅一次；
- 整页透明淡入已删除（闪屏元凶）；跨页 0.25s 交叉淡化保留；
- prefers-reduced-motion：全部即时呈现。
参数如需调整：styles.css 的 .fade-up 基类与 --stagger 变量。

### 11.8 全站视觉统一（2026-09-12）

用户定位"高档、大气、有格调"，审计后发现根因是**两套设计系统并存**：首页用 v3 令牌，
内页/详情页把 Apple 灰阶（`#1D1D1F/#86868B/#F5F5F7/#E5E5EA/#6E6E73/#FBFBFD`）硬编码
在 class 里绕过令牌，容器用 `px-6 md:px-24` 而非 `v3-shell`。本批次统一到 v3。

**表现层（前端）**
- 全站硬编码 Apple 色值 → v3 令牌值（68 文件 / 1561 处），含 solution 落地页生成器
  `scripts/generate-solution-landings.js`，避免重新生成时回退。
- ⚠️ **Tailwind 必须重编译**：`assets/css/tailwind.min.css` 是预编译产物，任意值类
  （`bg-[#E7EAF0]`、`border-[#14161B]` 等）只有在构建时被扫描到才会生成。色值替换引入了
  新类名但未重编译，导致时间轴竖线（`bg-[#E7EAF0]`）等元素丢失样式。
  **规则：凡改动 Tailwind 任意值类，必须执行 `npm run build:css`**（配置 `tailwind.config.js`
  的 content 已覆盖 `*.html` / `en|ru/**` / `assets/js/**` / `data/**` / `server/admin/**`）。
  本次已重编译（28,992 → 26,408 字节；新增 11 类、移除 57 个确认未被引用的旧类）。
- `[data-ui="v3"]` 补齐 `--text-muted` 重定向（此前 `.service-flow__detail` 等仍用旧灰）。
- 容器统一：`px-6 md:px-24` + `max-w-[1400px] mx-auto` → `v3-shell`；详情页窄栏用新增
  `.v3-shell--narrow`（1200px）。51 个文件脚本化，`solutions.html` 手工处理。
- 关于页深色带（`bg-[#1D1D1F] py-32`）→ `v3-section v3-section--mist` 浅色；文化柱卡片
  由 `bg-white/5` 改 `apple-card`，正文 `text-gray-300` → `--tx-ink-mute`。
- 列表卡片徽标统一为白玻璃（新闻的行业深色徽标、方案的深色 KPI 徽标 → 白玻璃）；
  产品卡片标签 chip 对齐方案的 token 化 chip。
- 客户 Logo 墙重做（用户反馈"很丑"）：根因是素材本身——14 个 logo 全部**无透明通道**
  （白底或彩色底），长宽比 0.9–8.2 悬殊，康佳/联想还是**红色实心方块**（灰度化后变灰块），
  美的内边距极大。处理：
  1) **素材归一化**（sharp 原地处理，原图备份 `_backups/clients-original/`）：flatten 白底 →
     `trim(threshold:12)` 去白边 → 高度统一到 96px（只缩不放，避免 GIF 放大失真）；
  2) 首页改为**等大磁贴网格**（68px 高、mist 底 + 发丝描边、`object-fit:contain`、
     灰度 + 0.74 透明，hover 恢复彩色），3/4/6 列响应式——形状差异被网格节奏吸收；
  3) 关于页客户墙 14 个 logo 原为 6 列网格（末行只剩 2 个左对齐），改 flex 居中，
     移动 2 列 / 平板 3 列 / 桌面 5 列，末行自动居中。
  ⚠️ 素材写入注意：本机 Node `fs.writeFileSync/copyFileSync` 覆盖 `clients/*.webp` 会报
  `UNKNOWN errno -4094`（PowerShell 正常），归一化脚本改为"输出到暂存目录 + PowerShell 覆盖"。
- **Logo 素材整体换源**（用户反馈"素材确实不太行"）：原素材全部无透明通道、比例 0.9–8.2、
  康佳/联想是红底实心方块。重新找源并统一处理：
  - 来源：Wikimedia Commons 矢量/透明图 10 个（TCL / Skyworth / Midea / Changhong / Lenovo /
    Foxconn / CATL / BOE / Unilumin / Innolux）；希沃取官网 `seewo.com/images/logo.svg`（原为纯白，
    改色 `#fff→#14161B`）；康佳取中文维基 `康佳商标.jpg`；HKC / HUAKETEK 暂无更好源，沿用归一化旧图。
  - 处理管线：栅格化（SVG density 400）→ 白底 → **alpha = 255 − min(R,G,B)**（离白距离去底，
    保留彩色与抗锯齿）→ trim → 统一高 96px（只缩不放）→ webp（alphaQuality 100）。
  - 长虹由 `changhong.gif` 改为 `changhong.webp`：更新首页三语引用 + 运行
    `server/scripts/patch-client-logos.mjs` 改 about 页数据（DB 为准）。
  - 获取要点：`upload.wikimedia.org` 直链易触发 429，用
    `https://commons.wikimedia.org/wiki/Special:FilePath/<文件名>` 更稳；
    Commons 偶有 UTF-16 编码 SVG，sharp 不识别，需先转 UTF-8。
- **Logo 尺寸统一（二次修正）**：用户反馈"大大小小不一致"。根因是 `object-fit: contain`
  下宽 logo 被容器宽度限制而变矮（Skyworth 比例 7.2 → 字高只有窄 logo 的 60%）。
  解法：把所有 logo 预渲染到**统一画布 720×100**（宽高比 = 最宽 logo 比例），每个 logo
  占满画布高度、水平居中。画布尺寸一致 ⇒ `contain` 在任何容器里都等比渲染 ⇒ 字高全站一致。
  配套：首页磁贴 `height:46px` + `padding:.7rem .9rem`（内容区比例 ≈7.08，接近画布 7.2）；
  移动端改 2 列（3 列时字高只剩 ~11px）。
  注意：堆叠式方形 logo（如 HUAKETEK）字高与其他一致，但视觉面积天然偏小，属正常。
- **缓存穿透**：素材沿用同名文件时浏览器会继续用旧图（用户反馈"还是旧方块"）。
  首页 12 个 `<img>` 与 about 页数据均加 `?v=20260912`（`patch-client-logos.mjs` 负责后者）。
- band hero 正文：`#55555b` → `--tx-ink-mid` + 白色柔光 text-shadow（视频底更亮）；
  内容区补 `text-align:center`，与首页 hero 对齐。移动端 hero 双 CTA 等宽。
- 修 bug：6 个根页 `../assets/css/tx-view-transitions.css` 越出根目录 404 → `assets/css/...`。

**内容层（DB 为准，后台可管）**
- 新增一次性补丁 `server/scripts/patch-v3-unify.mjs`：用与后台同源的
  `writePageJsonAny/writeSiteSettingsAny` 写库并导出静态文件（三语言一次完成）。
- 首页服务流程 `badgeStyle`：`start/mid/accent` → 统一 `neutral`（四步同款深色）；
  **后台同步改**：`server/admin/admin.js` 的 `collectHomeServiceSteps()` 现固定生成
  `neutral`（原先按位置自动生成 start/accent，保存会覆盖前端改动）；
  CSS 新增 `.service-flow__badge--neutral`。
- 首页类目眉标本地化：zh「单机单元」/ ru「Отдельные машины」（原三语都是 "Single Machines"）。
- 页脚新增 `phone/email/addressShenzhen/addressHuizhou`（取值沿用联系页），
  `site-footer.js` 渲染联系方式列 + 双基地地址行；**后台同步改**：
  `SITE_FOOTER_LABELS` 增 4 字段（全站设置→网站底部可直接编辑）。
- 页脚水印由 `clamp(7rem,18vw,15rem)` 越界裁切改为 `clamp(4.5rem,11vw,9rem)` 完整可见。
- 首页"企业动态"由 2 条改 3 条：精选不足时用最新发布补齐（`home-page.js`）。

**素材**
- 首页"关于同兴"主图原为 CGI 效果图 `hzgc2-960.webp`，与真实企业形象冲突；
  与真实厂房照 `szgc1.webp`（含"同兴高科"门头）**对调主次**——真实照作主图，
  效果图缩小作"惠州基地（效果图）"配图（三语言 alt 同步）。
- 联系页高德地图加 `mapStyle:'amap://styles/whitesmoke'` + `features:['bg','road','building']`，
  去除酒店/钓鱼场等 POI 噪声。

> 维护红线：内容改动必须走 DB（`writePageJsonAny/writeSiteSettingsAny` 或后台），
> 直接改 `data/**` 会被 `sync:static` 或后台保存覆盖；若改动涉及后台自动生成的字段
> （如 badgeStyle），必须同步修改 `server/admin/admin.js` 的生成/收集逻辑。
