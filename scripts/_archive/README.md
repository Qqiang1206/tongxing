# scripts/\_archive — 历史一次性脚本

这里的脚本都是**已经执行完毕、使命完成**的一次性改写/迁移/修复脚本。

保留它们是为了留痕（可追溯"这行内容当年是怎么变成这样的"），
但它们**不是常驻工具**，不要再当成日常命令执行：

- 多数脚本里的选择器、文件路径、数据结构针对的是当时那一版页面/数据，
  现在再跑很可能**静默写坏内容**；
- 部分脚本缺少 published / 幂等保护；
- 命名相似（`patch-detail-pages.js` vs `fix-detail-pages.mjs`）容易误选。

需要新功能时，请在 `scripts/` 下新建脚本，而不是复用这里的文件。

常用常驻命令仍然在上一级 `scripts/` 目录：

| 命令 | 用途 |
| --- | --- |
| `node scripts/watchdog.mjs start` | 带守护地启动服务（崩溃自动重启 + 心跳探测） |
| `node scripts/watchdog.mjs stop` | 停止服务 |
| `node scripts/watchdog.mjs status` | 查看运行状态 |
| `node scripts/validate-data.js` | 校验数据完整性 |
| `node scripts/regression-check.js` | 回归检查 |
| `node scripts/backup-data.js` | 手动备份 |
| `node scripts/build.js` | 构建 |
| `node scripts/generate-sitemap.js` | 生成 sitemap |
