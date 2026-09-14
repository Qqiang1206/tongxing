/**
 * 首屏 hero 视频：双路交叉溶解。
 *
 * 为什么需要：
 *   hero-loop.mp4 用原生 loop 时接缝是看得见的 —— 逐帧实测末帧与首帧的画面差 4.07，
 *   而正常帧间差的中位数只有 1.17（3.5 倍），到尾跳回首那一下就是用户说的
 *   「倒回去一点，然后再继续往前走」。逐帧比对过全片 251 帧，**不存在任何一对
 *   画面重复的帧**（跨度 ≥100 帧的最相似对就是首帧↔末帧），所以「换个循环点绕开
 *   接缝」走不通 —— 只能靠过渡把这一下抹平。
 *
 * 做法：
 *   两路同源 <video> 叠放。第一路播到 duration - XFADE 时，第二路从 0 起播并在
 *   上层做透明度 0→1 的线性溶解；底层保持完全不透明，这样 alpha 合成的结果就是
 *   纯粹的两帧线性混合（若两层同时半透明，中间态会发暗）。溶完交换角色，如此往复。
 *
 * 兜底：
 *   JS 没跑到时，第一路还带着 HTML 里的 loop 属性，退化成原来的原生循环，
 *   视频照常可见（不会白屏）。「减少动效」偏好下也回退成原生单路循环。
 */
(function () {
  'use strict';

  var XFADE = 0.8; /* 溶解时长（秒） */

  function init() {
    var vids = document.querySelectorAll('[data-hero-video]');
    if (vids.length < 2) return;

    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var live = vids[0];
    var idle = vids[1];
    var switching = false;
    var fadeStart = 0;
    var outEl = null;
    var inEl = null;

    function play(el) {
      /* 首屏视频始终静音自动播放（站点所有者的明确选择，「减少动效」不停它，
         该偏好仍作用于 fade-up 等入场动画） */
      el.muted = true;
      var p = el.play();
      if (p && p.catch) p.catch(function () { /* autoplay 被拦：poster 留着 */ });
    }

    live.style.opacity = '1';
    play(live);

    /* 「减少动效」→ 不做溶解，回退原生单路循环 */
    if (reduce) { live.loop = true; return; }

    live.loop = false;

    function beginCrossfade() {
      switching = true;
      outEl = live;
      inEl = idle;
      outEl.loop = false;
      inEl.loop = false;
      try { inEl.currentTime = 0; } catch (e) {}
      /* 上层放正在淡入的那路，底层放正在淡出的那路 —— 顺序反了混合会发暗 */
      inEl.style.zIndex = '2';
      outEl.style.zIndex = '1';
      inEl.style.opacity = '0';
      outEl.style.opacity = '1';
      play(inEl);
      fadeStart = (window.performance && performance.now) ? performance.now() : Date.now();
    }

    function endCrossfade() {
      inEl.style.opacity = '1';
      /* 这一下必须是瞬时的（CSS 里没给 transition），否则底层会在过渡中露出背景 */
      outEl.style.opacity = '0';
      try { outEl.pause(); outEl.currentTime = 0; } catch (e) {}
      live = inEl;
      idle = outEl;
      outEl = null;
      inEl = null;
      switching = false;
    }

    function tick(now) {
      if (switching) {
        var k = (now - fadeStart) / (XFADE * 1000);
        if (k >= 1) endCrossfade();
        else inEl.style.opacity = k.toFixed(3);
      } else if (live.duration && live.currentTime >= live.duration - XFADE) {
        beginCrossfade();
      }
      window.requestAnimationFrame(tick);
    }

    window.requestAnimationFrame(tick);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
