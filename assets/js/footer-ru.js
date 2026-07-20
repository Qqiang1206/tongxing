document.addEventListener("DOMContentLoaded", function() {
    const footerHTML = `
    <footer class="bg-[#111111] text-[#86868B] min-h-[300px] md:h-[300px] px-6 md:px-24 py-10 md:py-0 relative overflow-hidden flex flex-col justify-center">
        <div class="absolute -top-12 -left-10 text-[15rem] font-black text-white opacity-5 tracking-tighter pointer-events-none select-none">TXAM</div>
        <div class="max-w-[1600px] mx-auto relative z-10 w-full">
            <div class="flex flex-col md:flex-row justify-between items-center gap-6 md:gap-4">
                <h2 class="text-2xl md:text-[2.5rem] font-black text-white tracking-tighter leading-tight text-center md:text-left">Превосходное качество,<br>доверие в каждой поставке.</h2>
                <div>
                    <img src="../assets/images/brand/wechat-service.png" alt="WeChat" class="max-h-[140px] md:max-h-[200px] w-auto rounded-lg object-cover">
                </div>
            </div>
        </div>
        <div class="relative z-10 mt-8 md:mt-0 md:absolute md:bottom-[25px] md:left-6 md:right-6 lg:left-24 lg:right-24 max-w-[1600px] md:mx-auto flex flex-col sm:flex-row flex-wrap items-center justify-center md:justify-start text-center md:text-left text-sm font-light tracking-wide text-[#666] gap-2 md:gap-4">
            <p>&copy; 2007-2026 Guangdong Tongxing High-Tech Intelligent Equipment Co., Ltd.</p>
            <span class="hidden sm:inline">|</span>
            <a href="https://beian.miit.gov.cn/" target="_blank" class="hover:text-white transition-colors">粤ICP备16101583号-1</a>
        </div>
    </footer>
    `;
    
    const placeholders = document.querySelectorAll('[data-footer-placeholder]');
    placeholders.forEach(el => {
        el.outerHTML = footerHTML;
    });

    // ====== Dynamic breadcrumb: sessionStorage + referrer to track multi-level visit path ======
    (function() {
        const MAX_DEPTH = 6;

        // Page name map per language (selected by current page language)
        const pageNamesByLang = {
            zh: {
                'index.html': '首页',
                'about.html': '关于我们',
                'solutions.html': '解决方案',
                'products.html': '产品中心',
                'news.html': '新闻中心',
                'contact.html': '联系我们',
            },
            en: {
                'index.html': 'Home',
                'about.html': 'About Us',
                'solutions.html': 'Solutions',
                'products.html': 'Products',
                'news.html': 'News',
                'contact.html': 'Contact Us',
            },
            ru: {
                'index.html': 'Главная',
                'about.html': 'О нас',
                'solutions.html': 'Решения',
                'products.html': 'Продукция',
                'news.html': 'Новости',
                'contact.html': 'Контакты',
            },
        };

        // Index file per language
        const indexPageByLang = {
            zh: 'index.html',
            en: 'index.html',
            ru: 'index.html',
        };

        // Detect current page language (/en/ /ru/ dirs; legacy *-en.html / *-ru.html still work)
        const pathNorm = (location.pathname || '').replace(/\\/g, '/');
        const currentPage = pathNorm.split('/').pop() || 'index.html';
        let lang = 'zh';
        if (/\/en(\/|$)/i.test(pathNorm) || currentPage.endsWith('-en.html')) lang = 'en';
        else if (/\/ru(\/|$)/i.test(pathNorm) || currentPage.endsWith('-ru.html')) lang = 'ru';

        const pageNames = pageNamesByLang[lang];
        const indexPage = indexPageByLang[lang];
        const KEY = 'txam-nav-history-' + lang;  // sessionStorage bucket per language

        const pathContainer = document.querySelector('[data-breadcrumb]');
        if (!pathContainer) return;  // No breadcrumb container, skip

        // Current page name: prefer body data-breadcrumb-name (overrides hero h1), then <h1>, then pageNames map
        const h1 = document.querySelector('h1');
        const currentName = (document.body.dataset.breadcrumbName) || (h1 && h1.textContent.trim()) || pageNames[currentPage] || currentPage;

        // Read history
        let history = [];
        try {
            history = JSON.parse(sessionStorage.getItem(KEY) || '[]');
        } catch (e) {}

        // === Handle referrer ===
        const referrer = document.referrer;
        if (referrer) {
            try {
                const url = new URL(referrer);
                if (url.origin === location.origin) {
                    const fromPage = url.pathname.split('/').pop();
                    const fromName = pageNames[fromPage];
                    // Only auto-push when referrer is a known index page in the same language
                    // Otherwise rely on sessionStorage (preserves history across detail page jumps)
                    if (fromName && (history.length === 0 || history[history.length - 1].page !== fromPage)) {
                        history.push({ page: fromPage, name: fromName });
                    }
                }
            } catch (e) {}
        } else {
            // External direct visit (no referrer): reset history to avoid cross-section pollution
            // Prevents "browsed news section → direct-visit solution detail" showing wrong middle layer
            history = [];
        }

        // === Detect browser back: if current page is in middle of history, truncate ===
        const currentIdx = history.findIndex(p => p.page === currentPage);
        if (currentIdx >= 0 && currentIdx < history.length - 1) {
            // User came in via history.back(); truncate to current page
            history = history.slice(0, currentIdx + 1);
        }

        // Ensure index page is the first layer (same-language version)
        if (history.length === 0 || history[0].page !== indexPage) {
            history.unshift({ page: indexPage, name: pageNames[indexPage] });
        }

        // Detail page auto-injects list page middle layer (rule-based parent lookup)
        // Priority: data-breadcrumb-parent > product-detail special > *-detail.html strip -detail > *-solution.html → solutions.html
        function findParentPage() {
            const declared = document.body.dataset.breadcrumbParent;
            if (declared && pageNames[declared]) return declared;

            // product-detail.html → products.html (plural special-case, before generic -detail rule)
            let m = currentPage.match(/^product-detail(-[a-z]{2})?\.html$/);
            if (m) {
                const listPage = 'products' + (m[1] || '') + '.html';
                if (pageNames[listPage]) return listPage;
            }

            // *-detail.html → strip -detail (e.g. news-detail.html → news-ru.html)
            m = currentPage.match(/^(.+?)-detail(-[a-z]{2})?\.html$/);
            if (m) {
                const listPage = m[1] + (m[2] || '') + '.html';
                if (pageNames[listPage]) return listPage;
            }

            // *-solution.html → solutions.html (same language)
            m = currentPage.match(/^.+?-solution(-[a-z]{2})?\.html$/);
            if (m) {
                const listPage = 'solutions' + (m[1] || '') + '.html';
                if (pageNames[listPage]) return listPage;
            }

            return null;
        }
        const parentPage = findParentPage();
        if (parentPage && !history.find(h => h.page === parentPage)) {
            history.push({ page: parentPage, name: pageNames[parentPage] });
        }

        // Append current page (dedupe)
        history = history.filter(p => p.page !== currentPage);
        history.push({ page: currentPage, name: currentName });

        // Limit depth
        if (history.length > MAX_DEPTH) {
            history = history.slice(-MAX_DEPTH);
        }

        sessionStorage.setItem(KEY, JSON.stringify(history));

        // Render breadcrumb
        let html = '';
        for (let i = 0; i < history.length; i++) {
            const p = history[i];
            const isLast = i === history.length - 1;
            if (isLast) {
                html += `<span class="text-[#1D1D1F] font-medium">${p.name}</span>`;
            } else {
                // data-truncate-to lets click handler truncate history
                html += `<a href="${p.page}" data-truncate-to="${p.page}" class="hover:text-[#FF6B00] transition-colors">${p.name}</a><span class="mx-2 text-[#C7C7CC]">›</span>`;
            }
        }
        pathContainer.innerHTML = html;

        // === Click middle breadcrumb layer: truncate sessionStorage to that layer ===
        // So when new page loads, history is already truncated
        pathContainer.querySelectorAll('a[data-truncate-to]').forEach(a => {
            a.addEventListener('click', () => {
                const targetPage = a.getAttribute('data-truncate-to');
                let h = [];
                try { h = JSON.parse(sessionStorage.getItem(KEY) || '[]'); } catch (e) {}
                const targetIdx = h.findIndex(p => p.page === targetPage);
                if (targetIdx >= 0) {
                    // Truncate to targetPage (inclusive); new page filter(targetPage) will re-dedupe
                    const truncated = h.slice(0, targetIdx + 1);
                    sessionStorage.setItem(KEY, JSON.stringify(truncated));
                }
            });
        });
    })();
});
