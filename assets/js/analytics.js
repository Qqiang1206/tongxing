/**
 * Lightweight page-view beacon for TXAM site analytics (admin dashboard).
 * Sends one hit per full page load to the Node API on the same origin.
 */
(function () {
  var path = location.pathname || '/';
  if (!path || path.indexOf('/admin') === 0 || path.indexOf('/api/') === 0) return;
  // Only skip paths that carry a non-html extension (.js/.css/.png/...).
  // Directory / clean URLs without an extension (/, /en/, /ru/, /products)
  // are tracked, matching the server-side shouldTrackPageView() policy.
  var dotIdx = path.lastIndexOf('.');
  if (dotIdx >= 0) {
    var ext = path.slice(dotIdx).toLowerCase();
    if (ext !== '.html' && ext !== '.htm') return;
  }

  var url = '/api/v1/analytics/hit?path=' + encodeURIComponent(path);
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url);
      return;
    }
  } catch (e) { /* sendBeacon unavailable, fall through to fetch */ }

  fetch(url, { method: 'GET', keepalive: true, credentials: 'same-origin' }).catch(function () {});
})();
