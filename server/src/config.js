import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.join(__dirname, '..');
export const REPO_ROOT = path.join(ROOT, '..');
export const DATA_DIR = path.join(REPO_ROOT, 'data');

/**
 * CORS 允许源。CORS_ORIGIN 支持逗号分隔的多个源，例如：
 *   CORS_ORIGIN=https://www.txam.com,https://txam.com
 * 留空或 "*" 表示放行全部（开发环境默认）。生产环境务必显式列出域名。
 */
function parseAllowedOrigins(raw) {
  const list = String(raw == null ? '*' : raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : ['*'];
}

export const config = {
  port: Number(process.env.PORT || 8204),
  host: process.env.HOST || '0.0.0.0',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  allowedOrigins: parseAllowedOrigins(process.env.CORS_ORIGIN),
};

/**
 * 按请求解析实际下发的 Access-Control-Allow-Origin。
 * 配置为 "*" 时原样放行；否则仅回显白名单内的 Origin，
 * 不在白名单的请求回落到第一个允许源（浏览器会因此拒绝跨域读取）。
 */
export function resolveCorsOrigin(req) {
  const allowed = config.allowedOrigins;
  if (allowed.includes('*')) return '*';
  const incoming = req && req.headers ? req.headers.origin : '';
  if (incoming && allowed.includes(incoming)) return incoming;
  return allowed[0];
}

export const LANGS = ['zh', 'en', 'ru'];

export function parseLang(raw) {
  const lang = String(raw || 'zh').toLowerCase();
  return LANGS.includes(lang) ? lang : 'zh';
}

/**
 * 全站安全响应头。
 *
 * - X-Frame-Options / frame-ancestors：只允许同源嵌套，防点击劫持
 * - Referrer-Policy：跨站只带来源，不带完整路径
 * - Permissions-Policy：关闭摄像头/麦克风/定位（本站不需要）
 * - HSTS：仅在确认 HTTPS（x-forwarded-proto 或直连 TLS）时下发，避免 HTTP 环境下把站点锁死
 * - CSP：默认启用宽松策略（页面仍有大量内联脚本，必须 'unsafe-inline'）；
 *   需要加载额外外部资源时用 CSP_EXTRA 追加，出问题可 CSP_ENABLED=0 一键关闭。
 */
// CSP_ENABLED=0 关闭；CSP_MODE=report 只上报不阻断（上线前先观察一轮用）；
// CSP_MODE=enforce（默认）正式拦截；CSP_EXTRA 用于追加额外的外部源。
const CSP_MODE = String(process.env.CSP_ENABLED || '') === '0'
  ? 'off'
  : String(process.env.CSP_MODE || 'enforce').toLowerCase();
const CSP_EXTRA = String(process.env.CSP_EXTRA || '').trim();

// 高德地图（contact.html 三语页面均加载 webapi.amap.com，并会拉瓦片/接口/字体）
const AMAP_SOURCES = 'https://webapi.amap.com https://*.amap.com https://*.autonavi.com';

function buildCsp() {
  const parts = [
    "default-src 'self'",
    `img-src 'self' data: blob: ${AMAP_SOURCES}`,
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${AMAP_SOURCES}`,
    `style-src 'self' 'unsafe-inline' ${AMAP_SOURCES}`,
    `font-src 'self' data: ${AMAP_SOURCES}`,
    `connect-src 'self' ${AMAP_SOURCES}`,
    "worker-src 'self' blob:",
    "frame-src 'self'",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ];
  if (CSP_EXTRA) parts.push(CSP_EXTRA);
  return parts.join('; ');
}

const CSP_VALUE = CSP_MODE === 'off' ? '' : buildCsp();
const CSP_HEADER = CSP_MODE === 'report'
  ? 'Content-Security-Policy-Report-Only'
  : 'Content-Security-Policy';

export function securityHeaders(req) {
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': process.env.FRAME_OPTIONS || 'SAMEORIGIN',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
  };
  if (CSP_VALUE) headers[CSP_HEADER] = CSP_VALUE;

  const forwardedProto = req && req.headers ? req.headers['x-forwarded-proto'] : '';
  const isHttps = String(forwardedProto).split(',')[0].trim() === 'https'
    || (req && req.socket && req.socket.encrypted === true);
  if (isHttps && String(process.env.HSTS || '1') !== '0') {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  }
  return headers;
}

