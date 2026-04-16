@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo === TXAM 网站批量优化 ===
echo.

powershell -ExecutionPolicy Bypass -Command "
$baseDir = '%CD%'
$cssFile = Join-Path $baseDir 'styles.css'
$headerFile = Join-Path $baseDir 'header.js'

if (-not (Test-Path $cssFile)) { Write-Host 'styles.css not found!'; exit 1 }
if (-not (Test-Path $headerFile)) { Write-Host 'header.js not found!'; exit 1 }

# 要处理的页面
$allPages = @(
    'index.html', 'index-en.html', 'index-ru.html',
    'about.html', 'about-en.html', 'about-ru.html',
    'products.html', 'products-en.html', 'products-ru.html',
    'news.html', 'news-en.html', 'news-ru.html',
    'news-detail.html', 'news-detail-en.html', 'news-detail-ru.html',
    'contact.html', 'contact-en.html', 'contact-ru.html',
    'solutions.html', 'solutions-en.html', 'solutions-ru.html',
    'solutions-detail.html', 'solutions-detail-en.html', 'solutions-detail-ru.html',
    'product-detail.html', 'product-detail-en.html', 'product-detail-ru.html'
)

# 添加解决方案页面
$solutions = Get-ChildItem -Path $baseDir -Filter '*solution*.html' -File -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name
$allPages = $allPages + $solutions | Select-Object -Unique

$processed = 0
$skipped = 0

foreach ($pageName in $allPages) {
    $filePath = Join-Path $baseDir $pageName
    if (-not (Test-Path $filePath)) { $skipped++; continue }
    
    $content = Get-Content $filePath -Raw -Encoding UTF8
    if ($content -match 'href=""styles\.css""') { Write-Host '[跳过] $pageName - 已优化' -ForegroundColor DarkGray; $skipped++; continue }
    if ($content -notmatch '<style>') { $skipped++; continue }
    
    # 移除内联样式
    $content = $content -replace '(?s)<style>.*?</style>', ''
    
    # 添加 styles.css 链接
    if ($content -match '<script src=""https://cdn\.tailwindcss\.com""></script>') {
        $content = $content -replace '<script src=""https://cdn\.tailwindcss\.com""></script>', '<script src=""https://cdn.tailwindcss.com""></script>' + \"`n\" + '    <link rel=""stylesheet"" href=""styles.css"">'
    }
    
    # 添加 header placeholder
    if ($content -notmatch '<div data-header-placeholder>') {
        $content = $content -replace '(<body[^>]*>)', \"`$1`n    <div data-header-placeholder></div>\"
    }
    
    # 添加 header.js
    if ($content -match '<script src=""footer.*?\.js"" defer></script>') {
        $content = $content -replace '<script src=""footer(.*?)\.js"" defer></script>', '<script src=""header.js"" defer></script>' + \"`n\" + '    <script src=""footer$1.js"" defer></script>'
    }
    
    Set-Content -Path $filePath -Value $content -Encoding UTF8 -NoNewline
    Write-Host '[处理] '$pageName -ForegroundColor Green
    $processed++
}

Write-Host ''
Write-Host '=== 完成 ===' -ForegroundColor Cyan
Write-Host '处理: '$processed' 个文件' -ForegroundColor Green
Write-Host '跳过: '$skipped' 个文件' -ForegroundColor Yellow
"

pause
