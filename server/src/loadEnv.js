import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * 服务端代码实际会读取的环境变量（含 scripts 用到的）。
 * .env 里出现但不在此集合的键，会被判定为"死配置"并在启动时告警，
 * 避免历史上遗留的开关（如 SOLUTION_ROUTE_ENABLED）长期无人察觉。
 */
const KNOWN_ENV_KEYS = new Set([
  // 服务基础
  'PORT', 'HOST', 'NODE_ENV',
  // 安全 / 后台
  'ADMIN_PASSWORD', 'ADMIN_USERNAME', 'ADMIN_DISPLAY_NAME', 'ADMIN_SESSION_HOURS',
  'ADMIN_LOGIN_MAX_ATTEMPTS', 'ADMIN_ACTOR', 'ALLOW_WEAK_CREDENTIALS',
  'MAX_BODY_BYTES', 'CORS_ORIGIN',
  // 存储 / 缓存
  'SQLITE_PATH', 'DB_PATH', 'SYNC_JSON_ON_WRITE', 'PUBLIC_CACHE_TTL_MS',
  // 审计 / 备份
  'AUDIT_RETENTION_DAYS', 'AUTO_BACKUP_INTERVAL_MINUTES', 'AUTO_BACKUP_LIMIT',
  // 统计
  'ANALYTICS_ENABLED', 'ANALYTICS_IGNORE_HOSTS', 'ANALYTICS_TZ', 'ANALYTICS_MAX_HITS_PER_MIN',
  // 翻译
  'TRANSLATION_PROVIDER', 'TRANSLATION_API_KEY', 'TRANSLATION_BASE_URL',
  'TRANSLATION_MODEL', 'TRANSLATION_ALLOW_ECHO_WRITE', 'DEEPSEEK_API_KEY',
  // 站点地图 / 脚本
  'SITEMAP_BASE', 'REGRESSION_BASE',
]);

/** Load server/.env into process.env (does not override existing vars). */
const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');
if (fs.existsSync(envPath)) {
  const fileKeys = [];
  const text = fs.readFileSync(envPath, 'utf8').replace(/^\uFEFF/, '');
  text.split(/\r?\n/).forEach(function (line) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) return;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
    fileKeys.push(key);
  });

  const unknown = fileKeys.filter((k) => !KNOWN_ENV_KEYS.has(k));
  if (unknown.length) {
    console.warn(
      '[config] server/.env 中以下变量没有被代码读取，可能是历史遗留的死配置：%s\n' +
      '         如确认无用请从 .env 删除，或在 loadEnv.js 的 KNOWN_ENV_KEYS 中登记。',
      unknown.join(', ')
    );
  }
}
