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
        // 当前页名：优先从页面 <h1> 取，fallback 到 body data 属性，再 fallback 到 pageNames
        const h1 = document.querySelector('h1');
        const currentName = (h1 && h1.textContent.trim()) || (document.body.dataset.breadcrumbName) || pageNames[currentPage] || currentPage;

        // 读取历史
        let history = [];
        try {
            history = JSON.parse(sessionStorage.getItem(KEY) || '[]');
        } catch (e) {}

        // 处理 referrer：如果 referrer 是站内页，且不在 history 末尾，把它加入
        const referrer = document.referrer;
        if (referrer) {
            try {
                const url = new URL(referrer);
                if (url.origin === location.origin) {
                    const fromPage = url.pathname.split('/').pop();
                    const fromName = pageNames[fromPage];
                    if (fromName && fromPage !== currentPage) {
                        // 如果 referrer 不在 history 末尾（说明是新跳转），加入
                        if (history.length === 0 || history[history.length - 1].page !== fromPage) {
                            history.push({ page: fromPage, name: fromName });
                        }
                    }
                }
            } catch (e) {}
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
                html += `<a href="${p.page}" class="hover:text-[#FF6B00] transition-colors">${p.name}</a><span class="mx-2 text-[#C7C7CC]">›</span>`;
            }
        }
        pathContainer.innerHTML = html;
    })();
});
