$ErrorActionPreference = "Continue"
$baseDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$processed = 0
$skipped = 0

Write-Host "=== TXAM 批量优化 ===" -ForegroundColor Cyan

# 要处理的文件
$files = @(
    "index.html", "index-en.html", "index-ru.html",
    "about.html", "about-en.html", "about-ru.html",
    "products.html", "products-en.html", "products-ru.html",
    "news.html", "news-en.html", "news-ru.html",
    "news-detail.html", "news-detail-en.html", "news-detail-ru.html",
    "contact.html", "contact-en.html", "contact-ru.html",
    "solutions.html", "solutions-en.html", "solutions-ru.html",
    "solutions-detail.html", "solutions-detail-en.html", "solutions-detail-ru.html",
    "product-detail.html", "product-detail-en.html", "product-detail-ru.html",
    "ac-solution.html", "ac-solution-en.html", "ac-solution-ru.html",
    "capacitor-solution.html", "capacitor-solution-en.html", "capacitor-solution-ru.html",
    "coffee-solution.html", "coffee-solution-en.html", "coffee-solution-ru.html",
    "headlight-solution.html", "headlight-solution-en.html", "headlight-solution-ru.html",
    "microwave-solution.html", "microwave-solution-en.html", "microwave-solution-ru.html",
    "refrigerator-solution.html", "refrigerator-solution-en.html", "refrigerator-solution-ru.html",
    "robot-solution.html", "robot-solution-en.html", "robot-solution-ru.html",
    "tablet-solution.html", "tablet-solution-en.html", "tablet-solution-ru.html",
    "tv-display-solution.html", "tv-display-solution-en.html", "tv-display-solution-ru.html",
    "washer-solution.html", "washer-solution-en.html", "washer-solution-ru.html",
    "packaging-solution.html", "packaging-solution-en.html", "packaging-solution-ru.html"
)

foreach ($f in $files) {
    $path = Join-Path $baseDir $f
    if (-not (Test-Path $path)) { continue }
    
    $content = Get-Content $path -Raw -Encoding UTF8
    
    # 跳过已优化的
    if ($content -match 'href="styles\.css"') {
        Write-Host "[跳过] $f" -ForegroundColor DarkGray
        $skipped++
        continue
    }
    
    # 移除内联 <style>
    $content = $content -replace '(?s)<style>.*?</style>', ''
    
    # 添加 styles.css
    if ($content -match 'src="https://cdn\.tailwindcss\.com"') {
        $content = $content -replace '(<script src="https://cdn\.tailwindcss\.com"></script>)', "`$1`n    <link rel=""stylesheet"" href=""styles.css"">"
    }
    
    # 添加 header placeholder
    if ($content -notmatch 'data-header-placeholder') {
        $content = $content -replace '(<body[^>]*>)', "`$1`n    <div data-header-placeholder></div>"
    }
    
    # 添加 header.js
    if ($content -match 'footer.*?\.js" defer></script>') {
        $content = $content -replace '(footer.*?\.js" defer></script>)', "header.js`" defer></script>`n    <script src=""`$1"
    }
    
    Set-Content -Path $path -Value $content -Encoding UTF8 -NoNewline
    Write-Host "[处理] $f" -ForegroundColor Green
    $processed++
}

Write-Host ""
Write-Host "完成! 处理: $processed, 跳过: $skipped" -ForegroundColor Cyan
