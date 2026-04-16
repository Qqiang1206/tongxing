# TXAM 网站批量优化脚本
# 将 styles.css 和 header.js 集成到所有 HTML 文件

$ErrorActionPreference = "Stop"

# 设置工作目录
$baseDir = $PSScriptRoot

# 读取公共文件
$cssFile = Join-Path $baseDir "styles.css"
$headerFile = Join-Path $baseDir "header.js"

if (-not (Test-Path $cssFile)) {
    Write-Error "styles.css not found!"
    exit 1
}
if (-not (Test-Path $headerFile)) {
    Write-Error "header.js not found!"
    exit 1
}

$cssContent = Get-Content $cssFile -Raw
$headerContent = Get-Content $headerFile -Raw

Write-Host "=== TXAM 网站批量优化脚本 ===" -ForegroundColor Cyan
Write-Host "工作目录: $baseDir" -ForegroundColor Gray
Write-Host ""

# 获取所有 HTML 文件
$htmlFiles = Get-ChildItem -Path $baseDir -Filter "*.html" -File | Where-Object { 
    $_.Name -ne "index.html" -and  # 跳过已处理的文件
    $_.Name -notmatch "product-\d+-en\.html$" -and  # 暂时只处理主文件
    $_.Name -notmatch "product-\d+-ru\.html$"
}

Write-Host "找到 $(@($htmlFiles).Count) 个待处理文件" -ForegroundColor Yellow
Write-Host ""

$processed = 0
$skipped = 0

foreach ($file in $htmlFiles) {
    try {
        $content = Get-Content $file.FullName -Raw -Encoding UTF8
        
        # 检查是否已经被优化过
        if ($content -match 'href="styles\.css"') {
            Write-Host "[跳过] $($file.Name) - 已优化" -ForegroundColor DarkGray
            $skipped++
            continue
        }
        
        # 检查是否是产品详情页（需要特殊处理）
        if ($file.Name -match "^product-detail") {
            Write-Host "[跳过] $($file.Name) - 产品详情页" -ForegroundColor DarkGray
            $skipped++
            continue
        }
        
        # 提取原有内联 CSS (从 <style> 到 </style>)
        $originalCSS = ""
        if ($content -match '(?s)<style>.*?</style>') {
            $originalCSS = $Matches[0]
        }
        
        # 构建新的 head 部分
        # 1. 添加 styles.css 链接（在 </head> 前）
        # 2. 移除原有的内联 CSS
        # 3. 添加 header.js (在 footer.js 前)
        # 4. 添加 header placeholder
        
        # 移除原有的 <style>...</style>
        $newContent = $content -replace '(?s)<style>.*?</style>', ''
        
        # 在 </head> 前插入 styles.css 链接（如果有 tailwind 的话）
        if ($newContent -match '<script src="https://cdn\.tailwindcss\.com"></script>') {
            $newContent = $newContent -replace (
                '<script src="https://cdn\.tailwindcss\.com"></script>',
                '<script src="https://cdn.tailwindcss.com"></script>`n    <link rel="stylesheet" href="styles.css">'
            )
        }
        
        # 在 body 开始后添加 header placeholder（如果没有的话）
        if ($newContent -notmatch '<div data-header-placeholder>' -and $newContent -notmatch '<nav id="navbar"') {
            # 在 </body> 前的最后一个 </footer> 或类似位置添加
            $newContent = $newContent -replace '(</body>)', "`n    <div data-header-placeholder></div>`n$1"
        }
        
        # 添加 header.js 引用（在 footer.js 前）
        if ($newContent -match '<script src="footer(?:-en|-ru)?\.js" defer></script>') {
            $newContent = $newContent -replace (
                '<script src="footer(?:-en|-ru)?\.js" defer></script>',
                '<script src="header.js" defer></script>`n    <script src="footer$1.js" defer></script>'
            )
        }
        
        # 保存文件
        Set-Content -Path $file.FullName -Value $newContent -Encoding UTF8 -NoNewline
        
        Write-Host "[处理] $($file.Name)" -ForegroundColor Green
        $processed++
        
    } catch {
        Write-Warning "[错误] $($file.Name): $_"
    }
}

Write-Host ""
Write-Host "=== 完成 ===" -ForegroundColor Cyan
Write-Host "处理: $processed 个文件" -ForegroundColor Green
Write-Host "跳过: $skipped 个文件" -ForegroundColor Yellow
Write-Host ""
Write-Host "建议: 运行前先备份或提交 git" -ForegroundColor Red
