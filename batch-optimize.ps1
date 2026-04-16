# TXAM 网站批量优化脚本 v2
# 将 styles.css 和 header.js 集成到所有 HTML 文件
# 使用前请先备份！

$ErrorActionPreference = "Continue"

# 设置工作目录
$baseDir = $PSScriptRoot

# 读取公共文件
$cssFile = Join-Path $baseDir "styles.css"
$headerFile = Join-Path $baseDir "header.js"

if (-not (Test-Path $cssFile)) {
    Write-Error "styles.css not found! Please run from website root."
    exit 1
}
if (-not (Test-Path $headerFile)) {
    Write-Error "header.js not found! Please run from website root."
    exit 1
}

Write-Host "=== TXAM 网站批量优化脚本 v2 ===" -ForegroundColor Cyan
Write-Host "工作目录: $baseDir" -ForegroundColor Gray
Write-Host ""
Write-Host "即将处理的文件:" -ForegroundColor Yellow
Write-Host "  - 主页: index-en.html, index-ru.html, index.html" -ForegroundColor Gray
Write-Host "  - 关于页: about-en.html, about-ru.html, about.html" -ForegroundColor Gray
Write-Host "  - 解决方案页 (7个): *_solution*.html (3种语言)" -ForegroundColor Gray
Write-Host "  - 产品列表页: products-en.html, products-ru.html, products.html" -ForegroundColor Gray
Write-Host "  - 新闻页: news-en.html, news-ru.html, news.html" -ForegroundColor Gray
Write-Host "  - 联系页: contact-en.html, contact-ru.html, contact.html" -ForegroundColor Gray
Write-Host "  - 产品详情页: product-detail*.html" -ForegroundColor Gray
Write-Host ""
Write-Host "跳过: product-*.html (90个产品页面)" -ForegroundColor DarkGray
Write-Host ""

# 检查是否强制运行（跳过确认）
if (-not $Force) {
    $confirm = Read-Host "是否继续? (y/n)"
    if ($confirm -ne "y" -and $confirm -ne "Y") {
        Write-Host "已取消" -ForegroundColor Red
        exit 0
    }
}

# 要处理的文件模式
$mainPages = @(
    "index.html", "index-en.html", "index-ru.html",
    "about.html", "about-en.html", "about-ru.html",
    "products.html", "products-en.html", "products-ru.html",
    "news.html", "news-en.html", "news-ru.html",
    "news-detail.html", "news-detail-en.html", "news-detail-ru.html",
    "contact.html", "contact-en.html", "contact-ru.html",
    "solutions.html", "solutions-en.html", "solutions-ru.html",
    "solutions-detail.html", "solutions-detail-en.html", "solutions-detail-ru.html",
    "product-detail.html", "product-detail-en.html", "product-detail-ru.html"
)

# 解决方案页面
$solutionPages = Get-ChildItem -Path $baseDir -Filter "*solution*.html" -File | Select-Object -ExpandProperty Name

# 合并所有要处理的页面
$allPages = $mainPages + $solutionPages | Select-Object -Unique

$processed = 0
$skipped = 0
$errors = 0

foreach ($pageName in $allPages) {
    $filePath = Join-Path $baseDir $pageName
    
    if (-not (Test-Path $filePath)) {
        Write-Host "[跳过] $pageName - 文件不存在" -ForegroundColor DarkGray
        $skipped++
        continue
    }
    
    try {
        $content = Get-Content $filePath -Raw -Encoding UTF8
        
        # 检查是否已经被优化过
        if ($content -match 'href="styles\.css"') {
            Write-Host "[跳过] $pageName - 已优化" -ForegroundColor DarkGray
            $skipped++
            continue
        }
        
        # 检查是否有内联 style 标签
        if ($content -notmatch '<style>') {
            Write-Host "[跳过] $pageName - 无内联样式" -ForegroundColor DarkGray
            $skipped++
            continue
        }
        
        $originalContent = $content
        
        # 1. 移除内联 <style>...</style>
        $content = $content -replace '(?s)<style>.*?</style>', ''
        
        # 2. 在 tailwind script 后添加 styles.css 链接
        if ($content -match '<script src="https://cdn\.tailwindcss\.com"></script>') {
            $content = $content -replace (
                '<script src="https://cdn\.tailwindcss\.com"></script>',
                '<script src="https://cdn.tailwindcss.com"></script>`n    <link rel="stylesheet" href="styles.css">'
            )
        }
        
        # 3. 添加 header placeholder (在 body 开始后，nav 前面)
        if ($content -notmatch '<div data-header-placeholder>' -and $content -notmatch '<nav id="navbar"') {
            $content = $content -replace '(<body[^>]*>)', "`$1`n    <div data-header-placeholder></div>"
        }
        
        # 4. 添加 header.js 引用（在 footer.js 前）
        if ($content -match '<script src="footer(?:-en|-ru)?\.js" defer></script>') {
            $content = $content -replace (
                '<script src="footer(?:-en|-ru)?\.js" defer></script>',
                '<script src="header.js" defer></script>`n    <script src="footer$1.js" defer></script>'
            )
        }
        
        # 检查是否有变化
        if ($content -eq $originalContent) {
            Write-Host "[跳过] $pageName - 无需修改" -ForegroundColor DarkGray
            $skipped++
            continue
        }
        
        # 保存文件
        Set-Content -Path $filePath -Value $content -Encoding UTF8 -NoNewline
        
        Write-Host "[处理] $pageName" -ForegroundColor Green
        $processed++
        
    } catch {
        Write-Warning "[错误] $pageName : $_"
        $errors++
    }
}

Write-Host ""
Write-Host "=== 完成 ===" -ForegroundColor Cyan
Write-Host "处理: $processed 个文件" -ForegroundColor Green
Write-Host "跳过: $skipped 个文件" -ForegroundColor Yellow
Write-Host "错误: $errors 个文件" -ForegroundColor Red
Write-Host ""
if ($processed -gt 0) {
    Write-Host "建议: 刷新浏览器测试效果，然后提交 git" -ForegroundColor Cyan
}
