document.addEventListener("DOMContentLoaded", function() {
    const footerHTML = `
    <footer class="bg-[#111111] text-[#86868B] h-[300px] px-6 md:px-24 relative overflow-hidden flex flex-col justify-center">
        <div class="absolute -top-12 -left-10 text-[15rem] font-black text-white opacity-5 tracking-tighter pointer-events-none select-none">TXAM</div>
        <div class="max-w-[1600px] mx-auto relative z-10 w-full">
            <div class="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 class="text-2xl md:text-[2.5rem] font-black text-white tracking-tighter leading-tight text-center md:text-left">Excellence in Quality,<br>Trust in Every Delivery.</h2>
                <div>
                    <img src="wechat-service.png" alt="WeChat" class="max-h-[200px] w-auto rounded-lg object-cover">
                </div>
            </div>
        </div>
        <div class="absolute bottom-[25px] max-w-[1600px] mx-auto flex flex-row items-center text-sm font-light tracking-wide text-[#666] gap-4">
            <p>&copy; 2007-2026 Guangdong Tongxing High-Tech Intelligent Equipment Co., Ltd.</p>
            <span>|</span>
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
                'index-en.html': 'Home',
                'about-en.html': 'About Us',
                'solutions-en.html': 'Solutions',
                'products-en.html': 'Products',
                'news-en.html': 'News',
                'contact-en.html': 'Contact Us',
            },
            ru: {
                'index-ru.html': 'Главная',
                'about-ru.html': 'О нас',
                'solutions-ru.html': 'Решения',
                'products-ru.html': 'Продукция',
                'news-ru.html': 'Новости',
                'contact-ru.html': 'Контакты',
            },
        };

        // Index file per language
        const indexPageByLang = {
            zh: 'index.html',
            en: 'index-en.html',
            ru: 'index-ru.html',
        };

        // Detect current page language
        const currentPage = location.pathname.split('/').pop();
        let lang;
        if (currentPage.endsWith('-en.html')) lang = 'en';
        else if (currentPage.endsWith('-ru.html')) lang = 'ru';
        else lang = 'zh';

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

        // Detail page auto-injects list page middle layer (e.g. news-detail-en.html → news-en.html).
        // Generic rule: *detail*.html → strip -detail, find list page (only if in pageNames).
        const detailMatch = currentPage.match(/^(.+?)-detail(-[a-z]{2})?\.html$/);
        if (detailMatch) {
            const listPage = detailMatch[1] + (detailMatch[2] || '') + '.html';
            if (pageNames[listPage] && !history.find(h => h.page === listPage)) {
                history.push({ page: listPage, name: pageNames[listPage] });
            }
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
