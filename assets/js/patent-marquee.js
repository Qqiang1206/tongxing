/**
 * Patent / quality marquee: duplicate track for seamless loop.
 */
(function (global) {
  function initPatentMarquee(root) {
    var scope = root || document;
    var tracks = scope.querySelectorAll
      ? scope.querySelectorAll('[data-patent-marquee]')
      : [];
    for (var i = 0; i < tracks.length; i++) {
      var track = tracks[i];
      if (!track || track.getAttribute('data-marquee-ready') === '1') continue;
      var kids = Array.prototype.slice.call(track.children);
      if (!kids.length) continue;
      for (var j = 0; j < kids.length; j++) {
        var clone = kids[j].cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        track.appendChild(clone);
      }
      track.setAttribute('data-marquee-ready', '1');
    }
  }

  function run() {
    initPatentMarquee(document);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

  global.TXAM = global.TXAM || {};
  global.TXAM.initPatentMarquee = initPatentMarquee;
})(typeof window !== 'undefined' ? window : globalThis);
