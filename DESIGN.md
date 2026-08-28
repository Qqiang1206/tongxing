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
  （1080p/30fps、19.2s 正放+倒放乒乓无缝循环、3.5MB、H.264 faststart）；
  海报回退 `assets/videos/hero-poster.webp`（同时是 LCP 预加载）。
- 素材来源与授权：Pexels 视频 id **32386532**（"Industrial Robot Arm in High-Tech
  Factory"），Pexels License 免费商用、无需署名；已在本地转码（正放+倒放拼循环），
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
