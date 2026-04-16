document.addEventListener("DOMContentLoaded", function() {
    const footerHTML = `
    <footer class="bg-[#111111] text-[#86868B] h-[300px] px-6 md:px-24 relative overflow-hidden flex flex-col justify-center">
        <div class="absolute -top-12 -left-10 text-[15rem] font-black text-white opacity-5 tracking-tighter pointer-events-none select-none">TXAM</div>
        <div class="max-w-[1600px] mx-auto relative z-10 w-full">
            <div class="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 class="text-2xl md:text-[2.5rem] font-black text-white tracking-tighter leading-tight text-center md:text-left">Превосходное качество,<br>доверие в каждой поставке.</h2>
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
});
