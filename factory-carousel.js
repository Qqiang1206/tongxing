(function () {
    var root = document.getElementById('factory-carousel');
    if (!root) return;

    var slides = root.querySelectorAll('.factory-carousel__slide');
    var dots = document.querySelectorAll('[data-factory-dot]');
    var prevBtn = document.querySelector('[data-factory-prev]');
    var nextBtn = document.querySelector('[data-factory-next]');
    var current = 0;
    var timer = null;
    var interval = 7000;
    var touchStartX = 0;

    function goTo(index) {
        if (!slides.length) return;
        current = (index + slides.length) % slides.length;
        slides.forEach(function (slide, i) {
            slide.classList.toggle('is-active', i === current);
            slide.setAttribute('aria-hidden', i === current ? 'false' : 'true');
        });
        dots.forEach(function (dot, i) {
            var active = i === current;
            dot.classList.toggle('is-active', active);
            dot.setAttribute('aria-selected', active ? 'true' : 'false');
        });
    }

    function next() { goTo(current + 1); }
    function prev() { goTo(current - 1); }

    function startAutoplay() {
        stopAutoplay();
        timer = window.setInterval(next, interval);
    }

    function stopAutoplay() {
        if (timer) {
            window.clearInterval(timer);
            timer = null;
        }
    }

    dots.forEach(function (dot, i) {
        dot.addEventListener('click', function () {
            goTo(i);
            startAutoplay();
        });
    });

    if (prevBtn) prevBtn.addEventListener('click', function () { prev(); startAutoplay(); });
    if (nextBtn) nextBtn.addEventListener('click', function () { next(); startAutoplay(); });

    root.addEventListener('mouseenter', stopAutoplay);
    root.addEventListener('mouseleave', startAutoplay);
    root.addEventListener('focusin', stopAutoplay);
    root.addEventListener('focusout', startAutoplay);

    root.addEventListener('touchstart', function (e) {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    root.addEventListener('touchend', function (e) {
        var delta = e.changedTouches[0].screenX - touchStartX;
        if (Math.abs(delta) < 50) return;
        if (delta < 0) next();
        else prev();
        startAutoplay();
    }, { passive: true });

    document.addEventListener('visibilitychange', function () {
        if (document.hidden) stopAutoplay();
        else startAutoplay();
    });

    goTo(0);
    startAutoplay();
})();
