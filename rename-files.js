const fs = require('fs');
const path = require('path');

const baseDir = __dirname;

// 产品图片重命名映射
const productRenameMap = {
    'fuzhufengdaiji': 'retainer-sealer',
    'fuzhuhuajiandanyuan': 'auxiliary-clamp-unit',
    'fuzhushangxianfanzhuandanyuan': 'upper-flip-unit',
    'fuzhuxiaxianfanzhuandanyuan': 'lower-flip-unit',
    'jiqirenjichengmaduo': 'robot-palletizing-integrated',
    'jiqirenlijidanyuan': 'robot-clamp-unit',
    'jiqirenxiaxiantaodai': 'robot-box-bagging',
    'jiqirenzidongshangxuangualian': 'robot-auto-hanging',
    'jiqirenzidongtoubeiban': 'robot-auto-backplane',
    'mozuyizaiji': 'module-assembler',
    'OCkahejizu': 'oc-lamination-unit',
    'rengongfuzhutaodai': 'manual-bagging',
    'shangyongxianshirouxingzhuangpeichanxian': 'commercial-display-assembly',
    'shengjiangjizu': 'lift-unit',
    'xuanzhuantai': 'turntable',
    'zidongbaoyadanyuan': 'auto-press-unit',
    'zidongdabeibanluosi': 'auto-screw-unit',
    'zidongfangdengtiao': 'auto-light-strip',
    'zidongfangdengzhicheng': 'auto-light-bracket',
    'zidongkabanji': 'auto-palletizer',
    'zidongkaganghuabolijia': 'auto-glass-holder',
    'zidongpenjiaoji': 'auto-dispenser'
};

// 解决方案图片重命名映射
const solutionRenameMap = {
    'acshengchanxian': 'ac-production-line',
    'capacitorshengchanxian': 'capacitor-production-line',
    'coffeejishengchanxian': 'coffee-production-line',
    'headlightshengchanxian': 'headlight-production-line',
    'microwaveshengchanxian': 'microwave-production-line',
    'refrigeratorshengchanxian': 'refrigerator-production-line',
    'tabletdiannaoshengchanxian': 'tablet-production-line',
    'washershengchanxian': 'washer-production-line'
};

// 合并映射
const renameMap = { ...productRenameMap, ...solutionRenameMap };

console.log('=== 文件重命名脚本 ===\n');

let renamed = 0;
let skipped = 0;
const renameLog = []; // 记录重命名以便更新HTML

// 处理 products 目录
const productsDir = path.join(baseDir, 'products');
if (fs.existsSync(productsDir)) {
    const files = fs.readdirSync(productsDir);
    files.forEach(file => {
        const filePath = path.join(productsDir, file);
        if (!fs.statSync(filePath).isFile()) return;
        
        const ext = path.extname(file);
        const nameWithoutExt = path.basename(file, ext);
        
        // 检查是否需要重命名
        if (renameMap[nameWithoutExt]) {
            const newName = renameMap[nameWithoutExt] + ext;
            const newPath = path.join(productsDir, newName);
            
            if (!fs.existsSync(newPath)) {
                fs.renameSync(filePath, newPath);
                console.log(`[重命名] products/${file} -> products/${newName}`);
                renameLog.push({ old: file, new: newName, folder: 'products/' });
                renamed++;
            } else {
                console.log(`[跳过] products/${file} (目标已存在)`);
                skipped++;
            }
        }
    });
}

// 处理 solutions 目录
const solutionsDir = path.join(baseDir, 'solutions');
if (fs.existsSync(solutionsDir)) {
    const files = fs.readdirSync(solutionsDir);
    files.forEach(file => {
        const filePath = path.join(solutionsDir, file);
        if (!fs.statSync(filePath).isFile()) return;
        
        const ext = path.extname(file);
        const nameWithoutExt = path.basename(file, ext);
        
        if (renameMap[nameWithoutExt]) {
            const newName = renameMap[nameWithoutExt] + ext;
            const newPath = path.join(solutionsDir, newName);
            
            if (!fs.existsSync(newPath)) {
                fs.renameSync(filePath, newPath);
                console.log(`[重命名] solutions/${file} -> solutions/${newName}`);
                renameLog.push({ old: file, new: newName, folder: 'solutions/' });
                renamed++;
            } else {
                console.log(`[跳过] solutions/${file} (目标已存在)`);
                skipped++;
            }
        }
    });
}

console.log(`\n=== 文件重命名完成 ===`);
console.log(`重命名: ${renamed} 个文件`);
console.log(`跳过: ${skipped} 个文件`);

// 保存重命名日志供HTML更新使用
fs.writeFileSync(
    path.join(baseDir, 'rename-log.json'),
    JSON.stringify(renameLog, null, 2)
);
console.log('\n已保存 rename-log.json 用于HTML更新');
