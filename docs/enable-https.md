# HTTPS 启用指引（上线必须）

当前状态：nginx.conf 的 443 server 块已写好但被注释（证书路径为占位符），全站走 80 明文。
按以下步骤启用：

1. **准备证书**（三选一）：
   - 有公网 80 端口：`certbot certonly --webroot -w <站点根目录> -d sztxgk.com -d www.sztxgk.com`
   - 云厂商（阿里云/腾讯云）免费证书：控制台申请后下载 nginx 格式（.pem + .key）
2. **填入 nginx.conf**：取消 443 server 块注释，把 `ssl_certificate` / `ssl_certificate_key` 的占位路径
   改为真实证书路径；确认 80 块保留（用于跳转）。
3. **80 → 443 跳转**：在 80 server 块加 `return 301 https://$host$request_uri;`
4. **CMS 后端收紧**（server/.env）：
   ```
   HOST=127.0.0.1
   NODE_ENV=production
   CORS_ORIGIN=https://www.sztxgk.com
   ```
   然后重启 CMS 服务（npm run server:dev / pm2 restart txam）。
5. **验证**：
   - `curl -I https://www.sztxgk.com` → 200 且带 HSTS
   - `curl -I http://www.sztxgk.com` → 301 跳 https
   - 后台登录、图片、视频、语言切换全流程过一遍
6. **上线检查清单**（评审报告 H2/H4 相关）：
   - server/.env 已无弱口令，ADMIN_PASSWORD 为强随机值（仅用于全新数据库引导）
   - NODE_ENV=production（错误信息脱敏生效）
   - nginx reload 后 `/output/`、`/nginx/`、`/docs/`、`/server/` 均为 403
