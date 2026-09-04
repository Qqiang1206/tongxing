# 生产就绪度评审报告（2026-09-04）

> 评审基准：以代码为准，标准为“域名解析到本机后是否敢直接上线”。
> 结论：**按当前默认配置直接暴露公网 = 不批准**；完成 Top 5 后可达批准线。
> 总体评分：**6.5 / 10**（完成 Top 5 后预计 8.5）。

## 一、高危（上线前必须修复）

| # | 问题 | 位置 | 说明/改法 |
|---|---|---|---|
| H1 | HTTPS 未启用，全站明文 | nginx.conf（443 块被注释，证书占位） | 签发证书后启用已写好的 443 块（含 HSTS）；Node 生产绑定 127.0.0.1 |
| H2 | `ADMIN_PASSWORD` 构成绕过密码哈希的后门 | server/src/admin.js:607-619 | 该共享口令可直接以 super_admin 登录，改密/轮换无法吊销。删除回退分支 |
| H3 | SIGTERM 后进程无法优雅停机 | server/src/services/analytics.js:203-204 | 信号监听器只 flush 不 exit，systemd/Ctrl+C 失效。flush 后 `process.exit(0)` 或统一优雅关闭 |
| H4 | 登录限速基于可伪造的 X-Forwarded-For 第一段 | server/src/services/audit.js:39-44 | 轮换伪 XFF 可绕过 8 次/分钟爆破保护；审计 IP 可伪造。nginx 改覆盖式 XFF 或 Node 端仅信任 socket 地址 |
| H5 | 静态黑名单遗漏：`/output/`（内部日志）、`/nginx/`（路由配置）可公网下载（实测 200）；`docs/`、`templates/`、`.zcode/`、`.playwright-cli/` 同理未覆盖 | server/src/index.js BLOCKED_SITE_PREFIXES；nginx/txam-locations.conf 黑名单 | 改白名单制或补齐黑名单；日志移出 web root |

> 评审更正：初审计曾认为 `/server/data/txam.db` 可被公网下载，实测 **不成立**（`/server/` 在 nginx 与 Node 两侧均已屏蔽，返回 403）。真实暴露面以 H5 为准。

## 二、中危（上线前强烈建议）

| # | 问题 | 位置 | 改法 |
|---|---|---|---|
| M1 | 存储型 XSS：sanitizeHtml 正则可被“未闭合标签”绕过 | server/src/services/sanitizeHtml.js:21；渲染点 solution-landing.js:96 | 换 sanitize-html/DOMPurify 类库；或对净化后仍含未配对 `<` 的输入整体转义 |
| M2 | 停用账号/重置密码不吊销已发会话（最长 8h） | server/src/admin.js:252-264 | 改密/停用时按用户清会话，或 guard 每请求回查状态 |
| M3 | 数据快照导出非原子（就地 writeFileSync，截断=整页内容空白） | server/src/services/catalog.js:1097+ | 写 .tmp + renameSync 原子替换 |
| M4 | data/*.js 内嵌 `<script>` 未转义 `<`（受信编辑可注入） | catalog.js:1110 等 | `JSON.stringify(x).replace(/</g,'\u003c')` |
| M5 | 缓存策略三方矛盾（Node no-cache 无 ETag/304/Range；nginx css/js 7 天；IIS 365 天）且 JS/CSS/数据 JS 无版本参数 | server/src/index.js:137-141；nginx:100-111；web.config | 统一“版本参数 + 长缓存 + HTML no-cache”；源站补 ETag/304 |
| M6 | 5 条 hero 视频 `preload="auto"` 合计约 14MB | 各页面 video 标签 | 改 `preload="metadata"` + 降码率 |
| M7 | 测试 3 个红（contact 标题陈旧断言）+ 无 CI + auth/upload/backup/sync 零覆盖 | server/tests/page-title-data-binding.test.js | 更新断言至 CMS 值；加最小 CI |
| M8 | en/ru 漂移残留：42 页移动菜单 `aria-label="打开菜单"`；ru/index hreflang en-US 错指；详情页语言切换落到目标语言首页；en/ru solutions 空 eyebrow；en/ru news/products 容器多 mt-6 | en/ ru/ 各页 | 批次清理 |
| M9 | 备份同机无异地副本；自动备份同步阻塞事件循环（141MB copyTree） | server/src/services/backup.js | 异步队列 + 异地同步脚本 |
| M10 | 详情页 SEO 依赖客户端水合；sitemap lastmod 陈旧 | 详情模板；sitemap.xml | 构建期预渲染热门详情；发布流水线重算 sitemap |

## 三、低危（常规迭代）
健康端点泄露绝对路径；非生产 500 返回 err.message（NODE_ENV 未设）；用户名枚举时序差 + 同步 scrypt 阻塞事件循环；媒体删除 execSync 拼接；上传不验魔数；CORS_ORIGIN=*；纯静态部署 analytics 打 404；AMap key 需域名白名单确认；mass-assignment 无 key 白名单；审计 actor 可被 X-Admin-Actor 头伪造；磁盘残留（server/data 旧实验库、output/ 62MB）。

## 四、修复批次计划

| 批次 | 内容 | 状态 |
|---|---|---|
| 1 | 静态暴露面收窄（H5 + nginx /data/ 白名单化 + 残留清理） | 本批 |
| 2 | H2 ADMIN_PASSWORD 后门移除 + M2 会话吊销 | 待开始 |
| 3 | H3 SIGTERM 停机 + H4 XFF 信任边界 + 服务器超时 | 待开始 |
| 4 | H1 HTTPS 启用（需证书）+ M1 sanitize 库化 + M4 `<` 转义 | 待开始 |
| 5 | M7 测试回绿 + 最小 CI + M3 原子导出 | 待开始 |
| 6 | M5/M6 缓存与视频策略定稿 + M8 en/ru 漂移清理 + 其余低危 | 待开始 |

## 五、做得对的地方
scrypt+盐+恒时比较密码哈希；Bearer 会话（无 Cookie，CSRF 不成立）；全 prepared statements；路径遍历双重防护；上传 SVG 禁止+白名单+sharp 重编码；contentHtml 写入时清洗；RBAC 落实到路由；静态优先架构（Node 宕机不影响公开页）；WAL+VACUUM INTO 备份；分析无 PII；admin SPA 转义纪律（87/88 处）。

## 六、评分
安全设计 7.5 / 并发与完整性 7.5 / 性能 7.0 / 错误处理 6.0 / 结构 8.0 / API 8.0 / 配置与运维 4.5 → **总体 6.5**（Top 5 完成后 8.5）。
