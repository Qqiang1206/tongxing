const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const baseDir = __dirname;

// 需要压缩的图片列表
const imagesToCompress = [
    { path: 'solutions/pkg-logistics-line.png', quality: 80 },
    { path: 'solutions/refrigerator-production-line.png', quality: 80 },
    { path: 'solutions/washer-production-line.png', quality: 80 },
    { path: 'solutions/capacitor-production-line.png', quality: 80 },
    { path: 'solutions/headlight-production-line.png', quality: 80 },
    { path: 'solutions/ac-production-line.png', quality: 80 },
    { path: 'solutions/microwave-production-line.png', quality: 80 },
    { path: 'solutions/coffee-production-line.png', quality: 80 },
];

async function compressImage(inputPath, quality) {
    const fullPath = path.join(baseDir, inputPath);
    const ext = path.extname(inputPath);
    
    if (!fs.existsSync(fullPath)) {
        console.log(`[跳过] ${inputPath} - 文件不存在`);
        return { original: 0, new: 0 };
    }
    
    const stats = fs.statSync(fullPath);
    const originalSize = stats.size / 1024;
    
    try {
        let outputPath = fullPath + '.tmp';
        
        if (ext === '.png') {
            await sharp(fullPath)
                .png({ quality: quality, compressionLevel: 9 })
                .toFile(outputPath);
        } else if (ext === '.jpg' || ext === '.jpeg') {
            await sharp(fullPath)
                .jpeg({ quality: quality, mozjpeg: true })
                .toFile(outputPath);
        }
        
        // 替换原文件
        fs.unlinkSync(fullPath);
        fs.renameSync(outputPath, fullPath);
        
        const newStats = fs.statSync(fullPath);
        const newSize = newStats.size / 1024;
        const saved = ((originalSize - newSize) / originalSize * 100).toFixed(1);
        
        console.log(`[压缩] ${inputPath}`);
        console.log(`  ${originalSize.toFixed(0)} KB → ${newSize.toFixed(0)} KB (节省 ${saved}%)`);
        
        return { original: originalSize, new: newSize };
        
    } catch (err) {
        console.error(`[错误] ${inputPath}: ${err.message}`);
        return { original: originalSize, new: originalSize };
    }
}

async function main() {
    console.log('=== 图片压缩优化 ===\n');
    console.log('--- 压缩中 ---\n');
    
    let totalOriginal = 0;
    let totalNew = 0;
    
    for (const img of imagesToCompress) {
        const result = await compressImage(img.path, img.quality);
        totalOriginal += result.original;
        totalNew += result.new;
    }
    
    console.log('\n=== 压缩结果 ===');
    console.log(`原始大小: ${totalOriginal.toFixed(0)} KB`);
    console.log(`压缩后: ${totalNew.toFixed(0)} KB`);
    console.log(`总共节省: ${((totalOriginal - totalNew) / totalOriginal * 100).toFixed(1)}%`);
}

main().catch(console.error);
