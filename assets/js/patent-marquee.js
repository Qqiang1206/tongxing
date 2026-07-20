/**
 * Quality / patent marquee: duplicate track once for seamless RTL loop.
 * Runs immediately (no defer dependency on DOMContentLoaded alone).
 */
(function () {
  function initTrack(track) {
    if (!track || track.getAttribute('data-marquee-ready') === '1') return;
    var kids = Array.prototype.slice.call(track.children);
    if (!kids.length) return;
    for (var i = 0; i < kids.length; i++) {
      var clone = kids[i].cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      track.appendChild(clone);
    }
    track.setAttribute('data-marquee-ready', '1');
  }

  function run() {
    var tracks = document.querySelectorAll('[data-patent-marquee]');
    for (var i = 0; i < tracks.length; i++) initTrack(tracks[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
