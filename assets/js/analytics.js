/**
 * Lightweight page-view beacon for TXAM site analytics (admin dashboard).
 * Sends one hit per full page load to the Node API on the same origin.
 */
(function () {
  var path = location.pathname || '/';
  if (!path || path.indexOf('/admin') === 0 || path.indexOf('/api/') === 0) return;
  var ext = path.slice(path.lastIndexOf('.'));
  if (ext && ext !== '.html' && ext !== '.htm') return;

  var url = '/api/v1/analytics/hit?path=' + encodeURIComponent(path);
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url);
      return;
    }
  } catch (e) { /* fall through */ }

  fetch(url, { method: 'GET', keepalive: true, credentials: 'same-origin' }).catch(function () {});
})();
