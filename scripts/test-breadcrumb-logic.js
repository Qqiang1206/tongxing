// scripts/test-breadcrumb-logic.js
// 测试面包屑逻辑（模拟各种访问场景）
// 注意：这只是逻辑模拟，不是真实运行环境

function simulate(history, currentPage, referrer, clickTarget = null) {
    // 复制初始状态
    let h = JSON.parse(JSON.stringify(history));
    const pageNames = {
        'index.html': '首页', 'about.html': '关于我们',
        'solutions.html': '解决方案', 'products.html': '产品中心',
        'news.html': '新闻中心', 'contact.html': '联系我们',
    };
    const MAX_DEPTH = 6;

    // 1. 处理 referrer
    if (referrer) {
        const fromPage = referrer.split('/').pop();
        const fromName = pageNames[fromPage];
        if (fromName && (h.length === 0 || h[h.length - 1].page !== fromPage)) {
            h.push({ page: fromPage, name: fromName });
        }
    }

    // 2. 检测后退
    const currentIdx = h.findIndex(p => p.page === currentPage);
    if (currentIdx >= 0 && currentIdx < h.length - 1) {
        h = h.slice(0, currentIdx + 1);
    }

    // 3. 确保首页
    if (h.length === 0 || h[0].page !== 'index.html') {
        h.unshift({ page: 'index.html', name: '首页' });
    }

    // 4. 加当前页（去重）
    h = h.filter(p => p.page !== currentPage);
    h.push({ page: currentPage, name: currentPage });

    // 5. 限制深度
    if (h.length > MAX_DEPTH) h = h.slice(-MAX_DEPTH);

    return h.map(p => p.name).join(' › ');
}

function truncate(history, targetPage) {
    // 模拟 click handler
    const idx = history.findIndex(p => p.page === targetPage);
    if (idx >= 0) {
        return history.slice(0, idx + 1);
    }
    return history;
}

console.log('===== 场景测试 =====\n');

// 场景 1: 初始进入 index
console.log('1. 直接打开 index.html:');
console.log('   ' + simulate([], 'index.html', ''));

// 场景 2: 从 index 进入 solutions
console.log('\n2. 从 index 进入 solutions:');
console.log('   ' + simulate([{page:'index.html', name:'首页'}], 'solutions.html', 'index.html'));

// 场景 3: 从 solutions 进入 tv-display
console.log('\n3. 从 solutions 进入 tv-display-solution:');
console.log('   ' + simulate([{page:'index.html', name:'首页'},{page:'solutions.html', name:'解决方案'}], 'tv-display-solution.html', 'solutions.html'));

// 场景 4: 在 tv-display 点 breadcrumb "解决方案" 返回 (关键测试!)
console.log('\n4. ★ 在 tv-display 点 breadcrumb "解决方案" 返回:');
let h4 = [{page:'index.html', name:'首页'},{page:'solutions.html', name:'解决方案'},{page:'tv-display-solution.html', name:'TV/商业显示器柔性生产线'}];
let h4AfterClick = truncate(h4, 'solutions.html');
console.log('   截断后 history: ' + h4AfterClick.map(p => p.name).join(' › '));
console.log('   跳转到 solutions.html 后: ' + simulate(h4AfterClick, 'solutions.html', 'tv-display-solution.html'));

// 场景 5: 在 tv-display 浏览器后退到 solutions
console.log('\n5. 在 tv-display 浏览器后退到 solutions:');
let h5 = [{page:'index.html', name:'首页'},{page:'solutions.html', name:'解决方案'},{page:'tv-display-solution.html', name:'TV/商业显示器柔性生产线'}];
console.log('   ' + simulate(h5, 'solutions.html', 'tv-display-solution.html'));

// 场景 6: 在 tv-display 点击相关推荐到 refrigerator (跨方案页)
console.log('\n6. 在 tv-display 点击相关推荐到 refrigerator:');
let h6 = [{page:'index.html', name:'首页'},{page:'solutions.html', name:'解决方案'},{page:'tv-display-solution.html', name:'TV/商业显示器柔性生产线'}];
console.log('   ' + simulate(h6, 'refrigerator-solution.html', 'tv-display-solution.html'));

// 场景 7: 在 refrigerator 点 breadcrumb "解决方案"
console.log('\n7. ★ 在 refrigerator 点 breadcrumb "解决方案" 返回 (4 层→ 2 层):');
let h7 = [{page:'index.html', name:'首页'},{page:'solutions.html', name:'解决方案'},{page:'tv-display-solution.html', name:'TV/商业显示器柔性生产线'},{page:'refrigerator-solution.html', name:'冰箱生产线'}];
let h7AfterClick = truncate(h7, 'solutions.html');
console.log('   截断后: ' + h7AfterClick.map(p => p.name).join(' › '));
console.log('   跳转后: ' + simulate(h7AfterClick, 'solutions.html', 'refrigerator-solution.html'));

// 场景 8: 直接刷新当前页
console.log('\n8. 在 tv-display 刷新页面 (无 referrer):');
let h8 = [{page:'index.html', name:'首页'},{page:'solutions.html', name:'解决方案'},{page:'tv-display-solution.html', name:'TV/商业显示器柔性生产线'}];
console.log('   ' + simulate(h8, 'tv-display-solution.html', ''));

// 场景 9: 从产品中心到解决方案到包装
console.log('\n9. 从 products → solutions → packaging (3层):');
let h9 = simulate([{page:'index.html', name:'首页'},{page:'products.html', name:'产品中心'}], 'solutions.html', 'products.html');
console.log('   solutions 渲染: ' + h9);
console.log('   packaging 渲染: ' + simulate([{page:'index.html', name:'首页'},{page:'products.html', name:'产品中心'},{page:'solutions.html', name:'解决方案'}], 'packaging-solution.html', 'solutions.html'));