document.addEventListener("DOMContentLoaded", function() {
    // 当前页面判断逻辑
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    const headerHTML = `
    <!-- 🌐 顶部导航 -->
    <nav id="navbar" class="w-full flex justify-between items-center px-6 md:px-16 py-6 fixed top-0 z-50 transition-all duration-500 bg-[#FBFBFD]/80 backdrop-blur-xl border-b border-[#E5E5EA]">
        <a href="index.html" class="flex items-center cursor-pointer relative z-50">
            <picture><source srcset="assets/images/brand/logo.webp" type="image/webp"><img loading="lazy" src="assets/images/brand/logo.png" alt="TXAM 同兴高科 官网logo" class="h-8 md:h-10"></picture>
        </a>
        
        <div class="hidden md:flex items-center space-x-12 text-[15px] font-medium tracking-wide ml-0">
            <a href="index.html" class="text-[#1D1D1F] border-b-2 border-[#FF6B00] pb-1">首页</a>
            <a href="about.html" class="text-[#86868B] hover:text-[#1D1D1F] transition duration-300">关于我们</a>
            <a href="solutions.html" class="text-[#86868B] hover:text-[#1D1D1F] transition duration-300">解决方案</a>
            <a href="products.html" class="text-[#86868B] hover:text-[#1D1D1F] transition duration-300">产品中心</a>
            <a href="news.html" class="text-[#86868B] hover:text-[#1D1D1F] transition duration-300">新闻中心</a>
            <a href="contact.html" class="text-[#86868B] hover:text-[#1D1D1F] transition duration-300">联系我们</a>
            <div class="ml-4 pl-4 border-l border-[#E5E5EA] flex items-center space-x-2">
                <a href="index.html" class="px-2 py-1 text-[#FF6B00] font-bold text-xs">ZH</a>
                <span class="text-[#E5E5EA]">|</span>
                <a href="en/index.html" class="px-2 py-1 text-[#86868B] hover:text-[#1D1D1F] text-xs transition">EN</a>
                <span class="text-[#E5E5EA]">|</span>
                <a href="ru/index.html" class="px-2 py-1 text-[#86868B] hover:text-[#1D1D1F] text-xs transition">RU</a>
            </div>
        </div>

        <div class="md:hidden flex items-center relative z-50">
            <button id="mobile-menu-btn" class="focus:outline-none p-2 text-[#1D1D1F]" aria-label="打开菜单">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path id="menu-icon" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
                </svg>
            </button>
        </div>
    </nav>

    <!-- 📱 手机下拉菜单 -->
    <div id="mobile-menu" class="fixed top-[72px] left-0 right-0 bottom-0 bg-[#FBFBFD] z-50 menu-closed flex flex-col items-center border-b border-[#E5E5EA] overflow-y-auto">
        <div class="flex flex-col space-y-8 text-center text-3xl font-black tracking-widest text-[#1D1D1F] py-12">
            <a href="index.html" class="text-[#FF6B00]">首页</a>
            <a href="about.html" class="text-[#86868B]">关于我们</a>
            <a href="solutions.html" class="text-[#86868B]">解决方案</a>
            <a href="products.html" class="text-[#86868B]">产品中心</a>
            <a href="news.html" class="text-[#86868B]">新闻中心</a>
            <a href="contact.html" class="text-[#86868B]">联系我们</a>
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

    // 注入到 placeholder
    const placeholders = document.querySelectorAll('[data-header-placeholder]');
    placeholders.forEach(el => {
        el.outerHTML = headerHTML;
    });

    // 导航栏滚动效果
    const navbar = document.getElementById('navbar');
    if (navbar) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 20) {
                navbar.classList.add('shadow-sm');
            } else {
                navbar.classList.remove('shadow-sm');
            }
        });
    }

    // 移动端菜单
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const menuIcon = document.getElementById('menu-icon');
    
    if (mobileBtn && mobileMenu && menuIcon) {
        let isMenuOpen = false;
        mobileBtn.addEventListener('click', () => {
            isMenuOpen = !isMenuOpen;
            if (isMenuOpen) {
                mobileMenu.classList.remove('menu-closed');
                mobileMenu.classList.add('menu-open');
                menuIcon.setAttribute('d', 'M6 18L18 6M6 6l12 12');
                document.body.style.overflow = 'hidden';
            } else {
                mobileMenu.classList.remove('menu-open');
                mobileMenu.classList.add('menu-closed');
                menuIcon.setAttribute('d', 'M4 6h16M4 12h16M4 18h16');
                document.body.style.overflow = 'auto';
            }
        });

        // 点击菜单链接后关闭
        mobileMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                isMenuOpen = false;
                mobileMenu.classList.remove('menu-open');
                mobileMenu.classList.add('menu-closed');
                menuIcon.setAttribute('d', 'M4 6h16M4 12h16M4 18h16');
                document.body.style.overflow = 'auto';
            });
        });
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
