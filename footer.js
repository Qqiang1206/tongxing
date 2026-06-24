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

    // ====== 动态面包屑：基于 referrer 在 [data-breadcrumb-insert] 处插入中间项 ======
    (function() {
        const insertEl = document.querySelector('[data-breadcrumb-insert]');
        if (!insertEl) return;  // 没有面包屑，跳过

        const breadcrumbMap = {
            'about.html': { name: '关于我们', url: 'about.html' },
            'solutions.html': { name: '解决方案', url: 'solutions.html' },
            'products.html': { name: '产品中心', url: 'products.html' },
            'news.html': { name: '新闻中心', url: 'news.html' },
            'contact.html': { name: '联系我们', url: 'contact.html' },
        };

        const referrer = document.referrer;
        if (!referrer) return;  // 没有 referrer，保持静态 (首页 › 当前页)

        try {
            const url = new URL(referrer);
            // 只处理同源 referrer
            if (url.origin !== location.origin) return;

            const fromPage = url.pathname.split('/').pop();
            if (!fromPage || fromPage === 'index.html' || fromPage === '') return;

            // 避免循环：当前页 == 来源页
            const currentPage = location.pathname.split('/').pop();
            if (fromPage === currentPage) return;

            const crumb = breadcrumbMap[fromPage];
            if (crumb) {
                insertEl.innerHTML = `<a href="${crumb.url}" class="hover:text-[#FF6B00] transition-colors">${crumb.name}</a><span class="mx-2 text-[#C7C7CC]">›</span>`;
            }
        } catch (e) {
            // referrer 解析失败，保持静态
        }
    })();
});
