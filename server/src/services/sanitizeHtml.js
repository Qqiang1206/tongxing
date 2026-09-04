/**
 * Conservative allowlist sanitizer for CMS rich-text (contentHtml).
 *
 * Public detail/landing pages render contentHtml via innerHTML, so scripts,
 * event handlers and dangerous URL schemes must be stripped at write time.
 * TinyMCE sanitizes interactive edits, but the API/import write path must not
 * trust the client.
 */

const ALLOWED_TAGS = new Set([
  'p', 'br', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'u',
  'a', 'img', 'span', 'blockquote', 'sub', 'sup', 'table', 'thead', 'tbody',
  'tr', 'th', 'td', 'hr', 'figure', 'figcaption', 'code', 'pre', 'div',
]);

const ALLOWED_ATTRS = new Set([
  'class', 'href', 'src', 'alt', 'title', 'target', 'rel', 'colspan', 'rowspan',
  'width', 'height',
]);

const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^<>]*?)?)(\/?)>/g;
const ATTR_RE = /([a-zA-Z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

/** Allow anything except executable URL schemes; relative paths are fine. */
function safeUrl(value) {
  const v = String(value || '').trim();
  if (!v) return v;
  if (/^(javascript|vbscript|data|file):/i.test(v)) return '';
  return v;
}

const TAG_ESC_RE = /&lt;(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+(?:[^&]|&(?!gt;))*?)?)(\/?)&gt;/g;

export function sanitizeContentHtml(input) {
  if (typeof input !== 'string' || !input) return input || '';
  let html = String(input)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<\?[\s\S]*?\?>/g, '');

  // 兜底：先转义全部 < 和 >，再只把「白名单的完整标签」还原为真实标签。
  // 未闭合的 <img ... onerror=... 之类片段会保持转义，浏览器无法拼出活动标签。
  html = html.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return html.replace(TAG_ESC_RE, (whole, close, tagName, attrs, selfClose) => {
    const tag = String(tagName).toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      // Drop disallowed tag markup; keep any text content.
      return '';
    }
    let out = '<' + (close || '') + tag;
    if (!close && attrs) {
      const attrRe = new RegExp(ATTR_RE.source, 'g');
      let m;
      while ((m = attrRe.exec(attrs))) {
        const name = String(m[1]).toLowerCase();
        if (!ALLOWED_ATTRS.has(name) || /^on/i.test(name)) continue;
        const raw = m[2] != null ? m[2] : m[3] != null ? m[3] : m[4] || '';
        const value = (name === 'href' || name === 'src') ? safeUrl(raw) : raw;
        if (!value && (name === 'href' || name === 'src')) continue;
        out +=
          ' ' + name + '="' +
          String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;') +
          '"';
      }
    }
    return out + (selfClose ? ' />' : '>');
  });
}
