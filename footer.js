document.addEventListener("DOMContentLoaded", function() {
    const footerHTML = `
    <footer class="bg-[#111111] text-[#86868B] h-[300px] px-6 md:px-24 relative overflow-hidden flex flex-col justify-center">
        <div class="absolute -top-12 -left-10 text-[15rem] font-black text-white opacity-5 tracking-tighter pointer-events-none select-none">TXAM</div>
        <div class="max-w-[1600px] mx-auto relative z-10 w-full">
            <div class="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 class="text-2xl md:text-[2.5rem] font-black text-white tracking-tighter leading-tight text-center md:text-left">以卓越品质，<br>不负每一份信任。</h2>
                <div>
                    <img src="wechat-service.png" alt="微信客服" class="max-h-[200px] w-auto rounded-lg object-cover">
                </div>
            </div>
        </div>
        <div class="absolute bottom-[25px] max-w-[1600px] mx-auto flex flex-row items-center text-sm font-light tracking-wide text-[#666] gap-4">
            <p>&copy; 2007-2026 广东同兴高科智能装备有限公司.</p>
            <span>|</span>
            <a href="https://beian.miit.gov.cn/" target="_blank" class="hover:text-white transition-colors">粤ICP备16101583号-1</a>
        </div>
    </footer>
    `;

    const placeholders = document.querySelectorAll('[data-footer-placeholder]');
    placeholders.forEach(el => {
        el.outerHTML = footerHTML;
    });

    // ====== 动态面包屑：基于 sessionStorage + referrer 跟踪多层访问路径 ======
    (function() {
        const KEY = 'txam-nav-history';
        const MAX_DEPTH = 6;

        const pathContainer = document.querySelector('[data-breadcrumb]');
        if (!pathContainer) return;  // 没有面包屑容器，跳过

        const pageNames = {
            'index.html': '首页',
            'about.html': '关于我们',
            'solutions.html': '解决方案',
            'solutions-detail.html': '方案详情',
            'products.html': '产品中心',
            'products-detail.html': '产品详情',
            'news.html': '新闻中心',
            'contact.html': '联系我们',
        };

        // 当前页信息
        const currentPage = location.pathname.split('/').pop();
        const h1 = document.querySelector('h1');
        const currentName = (h1 && h1.textContent.trim()) || (document.body.dataset.breadcrumbName) || pageNames[currentPage] || currentPage;

        // 读取历史
        let history = [];
        try {
            history = JSON.parse(sessionStorage.getItem(KEY) || '[]');
        } catch (e) {}

        // === 处理 referrer ===
        const referrer = document.referrer;
        if (referrer) {
            try {
                const url = new URL(referrer);
                if (url.origin === location.origin) {
                    const fromPage = url.pathname.split('/').pop();
                    const fromName = pageNames[fromPage];
                    // 只有当 referrer 是索引页（map 里有名字）时才主动 push
                    // 否则依赖 sessionStorage（详情页跳转时保留历史）
                    if (fromName && (history.length === 0 || history[history.length - 1].page !== fromPage)) {
                        history.push({ page: fromPage, name: fromName });
                    }
                }
            } catch (e) {}
        }

        // === 检测浏览器后退：如果当前页在历史中间，截断到当前页 ===
        const currentIdx = history.findIndex(p => p.page === currentPage);
        if (currentIdx >= 0 && currentIdx < history.length - 1) {
            // 用户从 history.back() 进来，截断历史到当前页
            history = history.slice(0, currentIdx + 1);
        }

        // 确保首页是第一层
        if (history.length === 0 || history[0].page !== 'index.html') {
            history.unshift({ page: 'index.html', name: '首页' });
        }

        // 添加当前页（去重）
        history = history.filter(p => p.page !== currentPage);
        history.push({ page: currentPage, name: currentName });

        // 限制深度
        if (history.length > MAX_DEPTH) {
            history = history.slice(-MAX_DEPTH);
        }

        sessionStorage.setItem(KEY, JSON.stringify(history));

        // 渲染面包屑
        let html = '';
        for (let i = 0; i < history.length; i++) {
            const p = history[i];
            const isLast = i === history.length - 1;
            if (isLast) {
                html += `<span class="text-[#1D1D1F] font-medium">${p.name}</span>`;
            } else {
                // data-truncate-to 让 click handler 截断历史
                html += `<a href="${p.page}" data-truncate-to="${p.page}" class="hover:text-[#FF6B00] transition-colors">${p.name}</a><span class="mx-2 text-[#C7C7CC]">›</span>`;
            }
        }
        pathContainer.innerHTML = html;

        // === 点击面包屑中间层时，截断 sessionStorage 到目标层 ===
        // 这样新页面加载时历史已经是截断后的
        pathContainer.querySelectorAll('a[data-truncate-to]').forEach(a => {
            a.addEventListener('click', () => {
                const targetPage = a.getAttribute('data-truncate-to');
                let h = [];
                try { h = JSON.parse(sessionStorage.getItem(KEY) || '[]'); } catch (e) {}
                const targetIdx = h.findIndex(p => p.page === targetPage);
                if (targetIdx >= 0) {
                    // 截断到 targetPage（包括 target），新页面加载时 filter(targetPage) 再去掉
                    const truncated = h.slice(0, targetIdx + 1);
                    sessionStorage.setItem(KEY, JSON.stringify(truncated));
                }
            });
        });
    })();
});
