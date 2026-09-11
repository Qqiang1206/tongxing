document.addEventListener("DOMContentLoaded", function() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const V3 = document.documentElement.getAttribute('data-ui') === 'v3';

    /* 子目录感知：/en/ 或 /ru/ 下的页面需要 ../ 资源前缀与跨目录语言链接 */
    const inSub = /\/(en|ru)(\/|$)/i.test(window.location.pathname.replace(/\\/g, '/'));
    const subLang = /\/en(\/|$)/i.test(window.location.pathname) ? 'en'
        : /\/ru(\/|$)/i.test(window.location.pathname) ? 'ru' : 'zh';
    const P = inSub ? '../' : '';
    const LANG_HREFS = {
        zh: { zh: 'index.html', en: 'en/index.html', ru: 'ru/index.html' },
        en: { zh: '../index.html', en: 'index.html', ru: '../ru/index.html' },
        ru: { zh: '../index.html', en: '../en/index.html', ru: 'index.html' },
    }[subLang];

    /* 当前页导航高亮：按 href 与路径尾段匹配 */
    const ACTIVE_MAP = { 'index.html': 'home', 'about.html': 'about', 'solutions.html': 'solutions', 'products.html': 'products', 'news.html': 'news', 'contact.html': 'contact' };
    const activeKey = ACTIVE_MAP[currentPage] || 'home';
    const CTA_LABEL = { zh: '获取方案', en: 'Get a Quote', ru: 'Получить решение' }[subLang];

    /* Localized nav copy. Navigation is statically inlined on the real pages,
       so this generator is a fallback — but it must never emit Chinese on /en/ or /ru/. */
    const NAV_LABELS = {
        zh: ['首页', '关于我们', '解决方案', '产品中心', '新闻中心', '联系我们'],
        en: ['Home', 'About Us', 'Solutions', 'Products', 'News', 'Contact Us'],
        ru: ['Главная', 'О нас', 'Решения', 'Продукция', 'Новости', 'Контакты'],
    }[subLang];
    const NAV_TEXT = {
        zh: { brand: 'TXAM 同兴高科 首页', logo: 'TXAM 同兴高科 官网logo', menu: '打开菜单', site: '站内导航' },
        en: { brand: 'TXAM Home', logo: 'TXAM logo', menu: 'Open menu', site: 'Site navigation' },
        ru: { brand: 'TXAM Главная', logo: 'Логотип TXAM', menu: 'Открыть меню', site: 'Навигация по сайту' },
    }[subLang];

    let headerHTML;

    if (V3) {
        /* ── v3 「光感单色」导航：透明起步，滚动后玻璃化 ──
         * 复用 #navbar / #mobile-menu / #mobile-menu-btn 契约，
         * 由 site-chrome.js 统一处理滚动显影与移动端开合。 */
        headerHTML = `
        <!-- 🌐 顶部导航 v3 -->
        <nav id="navbar" class="txnav">
            <div class="v3-shell txnav__inner">
                <a href="${LANG_HREFS[subLang]}" class="txnav__brand" aria-label="${NAV_TEXT.brand}">
                    <picture><source srcset="${P}assets/images/brand/logo.webp" type="image/webp"><img src="${P}assets/images/brand/logo.png" alt="${NAV_TEXT.logo}" class="txnav__logo"></picture>
                </a>

                <div class="txnav__links">
                    <a href="index.html" class="txnav__link${activeKey === 'home' ? ' is-active' : ''}">${NAV_LABELS[0]}</a>
                    <a href="about.html" class="txnav__link${activeKey === 'about' ? ' is-active' : ''}">${NAV_LABELS[1]}</a>
                    <a href="solutions.html" class="txnav__link${activeKey === 'solutions' ? ' is-active' : ''}">${NAV_LABELS[2]}</a>
                    <a href="products.html" class="txnav__link${activeKey === 'products' ? ' is-active' : ''}">${NAV_LABELS[3]}</a>
                    <a href="news.html" class="txnav__link${activeKey === 'news' ? ' is-active' : ''}">${NAV_LABELS[4]}</a>
                    <a href="contact.html" class="txnav__link${activeKey === 'contact' ? ' is-active' : ''}">${NAV_LABELS[5]}</a>
                </div>

                <div class="txnav__cta">
                    <div class="hidden lg:flex items-center gap-1 text-xs font-bold tracking-wide">
                        <a href="${LANG_HREFS.zh}" class="px-2 py-1 ${subLang === 'zh' ? 'text-[#FF6B00]' : 'text-[#667084] hover:text-[#14161B] transition-colors'}">ZH</a>
                        <span class="text-[#E7EAF0]">|</span>
                        <a href="${LANG_HREFS.en}" class="px-2 py-1 ${subLang === 'en' ? 'text-[#FF6B00]' : 'text-[#667084] hover:text-[#14161B] transition-colors'}">EN</a>
                        <span class="text-[#E7EAF0]">|</span>
                        <a href="${LANG_HREFS.ru}" class="px-2 py-1 ${subLang === 'ru' ? 'text-[#FF6B00]' : 'text-[#667084] hover:text-[#14161B] transition-colors'}">RU</a>
                    </div>
                    <a href="contact.html" class="v3-btn v3-btn--primary txnav__cta-btn">
                        ${CTA_LABEL}
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 8h11M9 3.5 13.5 8 9 12.5"/></svg>
                    </a>
                    <button id="mobile-menu-btn" class="txnav__burger" type="button" aria-label="${NAV_TEXT.menu}">
                        <i></i><i></i><i></i>
                    </button>
                </div>
            </div>
        </nav>

        <!-- 📱 移动端全屏菜单（白色玻璃） -->
        <div id="mobile-menu" class="txnav-sheet menu-closed" role="dialog" aria-label="${NAV_TEXT.site}">
            <nav class="flex flex-col w-full max-w-md mx-auto">
                <a href="index.html" class="txnav-sheet__link${activeKey === 'home' ? '" style="color:#FF6B00' : ''}">${NAV_LABELS[0]}<span>01</span></a>
                <a href="about.html" class="txnav-sheet__link">${NAV_LABELS[1]}<span>02</span></a>
                <a href="solutions.html" class="txnav-sheet__link">${NAV_LABELS[2]}<span>03</span></a>
                <a href="products.html" class="txnav-sheet__link">${NAV_LABELS[3]}<span>04</span></a>
                <a href="news.html" class="txnav-sheet__link">${NAV_LABELS[4]}<span>05</span></a>
                <a href="contact.html" class="txnav-sheet__link">${NAV_LABELS[5]}<span>06</span></a>
            </nav>
            <div class="txnav-sheet__langs">
                <a href="${LANG_HREFS.zh}" class="${subLang === 'zh' ? 'is-active' : ''}">ZH</a>
                <a href="${LANG_HREFS.en}" class="${subLang === 'en' ? 'is-active' : ''}">EN</a>
                <a href="${LANG_HREFS.ru}" class="${subLang === 'ru' ? 'is-active' : ''}">RU</a>
            </div>
        </div>
        `;
    } else {
        headerHTML = `
        <!-- 🌐 顶部导航 -->
        <nav id="navbar" class="w-full flex justify-between items-center px-6 md:px-16 py-6 fixed top-0 z-50 transition-all duration-500 bg-[#FBFBFD]/80 backdrop-blur-xl border-b border-[#E5E5EA]">
            <a href="index.html" class="flex items-center cursor-pointer relative z-50">
                <picture><source srcset="assets/images/brand/logo.webp" type="image/webp"><img loading="lazy" decoding="async" src="assets/images/brand/logo.png" alt="${NAV_TEXT.logo}" class="h-8 md:h-10"></picture>
            </a>

            <div class="hidden md:flex items-center space-x-12 text-[15px] font-medium tracking-wide ml-0">
                <a href="index.html" class="text-[#1D1D1F] border-b-2 border-[#FF6B00] pb-1">${NAV_LABELS[0]}</a>
                <a href="about.html" class="text-[#86868B] hover:text-[#1D1D1F] transition duration-300">${NAV_LABELS[1]}</a>
                <a href="solutions.html" class="text-[#86868B] hover:text-[#1D1D1F] transition duration-300">${NAV_LABELS[2]}</a>
                <a href="products.html" class="text-[#86868B] hover:text-[#1D1D1F] transition duration-300">${NAV_LABELS[3]}</a>
                <a href="news.html" class="text-[#86868B] hover:text-[#1D1D1F] transition duration-300">${NAV_LABELS[4]}</a>
                <a href="contact.html" class="text-[#86868B] hover:text-[#1D1D1F] transition duration-300">${NAV_LABELS[5]}</a>
                <div class="ml-4 pl-4 border-l border-[#E5E5EA] flex items-center space-x-2">
                    <a href="index.html" class="px-2 py-1 text-[#FF6B00] font-bold text-xs">ZH</a>
                    <span class="text-[#E5E5EA]">|</span>
                    <a href="en/index.html" class="px-2 py-1 text-[#86868B] hover:text-[#1D1D1F] text-xs transition">EN</a>
                    <span class="text-[#E5E5EA]">|</span>
                    <a href="ru/index.html" class="px-2 py-1 text-[#86868B] hover:text-[#1D1D1F] text-xs transition">RU</a>
                </div>
            </div>

            <div class="md:hidden flex items-center relative z-50">
                <button id="mobile-menu-btn" class="focus:outline-none p-2 text-[#1D1D1F]" aria-label="${NAV_TEXT.menu}">
                    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path id="menu-icon" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
                    </svg>
                </button>
            </div>
        </nav>

        <!-- 📱 手机下拉菜单 -->
        <div id="mobile-menu" class="fixed top-[72px] left-0 right-0 bottom-0 bg-[#FBFBFD] z-50 menu-closed flex flex-col items-center border-b border-[#E5E5EA] overflow-y-auto">
            <div class="flex flex-col space-y-8 text-center text-3xl font-black tracking-widest text-[#1D1D1F] py-12">
                <a href="index.html" class="text-[#FF6B00]">${NAV_LABELS[0]}</a>
                <a href="about.html" class="text-[#86868B]">${NAV_LABELS[1]}</a>
                <a href="solutions.html" class="text-[#86868B]">${NAV_LABELS[2]}</a>
                <a href="products.html" class="text-[#86868B]">${NAV_LABELS[3]}</a>
                <a href="news.html" class="text-[#86868B]">${NAV_LABELS[4]}</a>
                <a href="contact.html" class="text-[#86868B]">${NAV_LABELS[5]}</a>
            </div>
            <div class="flex items-center space-x-4 text-lg pb-12">
                <a href="index.html" class="px-4 py-2 text-[#FF6B00] font-bold">ZH</a>
                <span class="text-[#E5E5EA]">|</span>
                <a href="en/index.html" class="px-4 py-2 text-[#86868B]">EN</a>
                <span class="text-[#E5E5EA]">|</span>
                <a href="ru/index.html" class="px-4 py-2 text-[#86868B]">RU</a>
            </div>
        </div>
        `;
    }

    // 注入到 placeholder
    const placeholders = document.querySelectorAll('[data-header-placeholder]');
    placeholders.forEach(el => {
        el.outerHTML = headerHTML;
    });

    // v3 导航滚动态：越过阈值后玻璃化
    if (V3) {
        const navbar = document.getElementById('navbar');
        let ticking = false;
        const update = () => {
            navbar.classList.toggle('is-scrolled', window.scrollY > 24);
            ticking = false;
        };
        window.addEventListener('scroll', () => {
            if (!ticking) {
                ticking = true;
                requestAnimationFrame(update);
            }
        }, { passive: true });
        update();
    }

    // 滚动动画
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1 });
    document.querySelectorAll('.fade-up').forEach((el) => observer.observe(el));
});
