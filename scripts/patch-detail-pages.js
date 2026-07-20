/**
 * Patch all *-detail.html pages to load data via data/*.js + data-loader.js
 * and always reveal .fade-up content.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function patchFile(rel, opts) {
  const file = path.join(ROOT, rel);
  let html = fs.readFileSync(file, 'utf8');
  const { kind, lang, footerSrc, dataSrc, loaderSrc, titleSuffix, relatedPrefix } = opts;

  // Ensure data-loader + data js before inline script (replace old inline data loader block)
  const scriptStart = html.indexOf('<div data-footer-placeholder></div>');
  if (scriptStart < 0) throw new Error('no footer placeholder: ' + rel);

  const afterFooter = html.indexOf('</div>', scriptStart) + 6;
  const bodyEnd = html.lastIndexOf('</body>');
  if (bodyEnd < 0) throw new Error('no body end: ' + rel);

  let newTail;
  if (kind === 'products') {
    newTail = productTail(opts);
  } else if (kind === 'news') {
    newTail = newsTail(opts);
  } else {
    newTail = solutionTail(opts);
  }

  html = html.slice(0, afterFooter) + '\n\n' + newTail + '\n</body>\n</html>\n';
  // If file had content after </body>, we already truncated — fine for these pages
  // But we may have duplicated if html already ended — strip anything after first rebuild
  // Actually we replaced from afterFooter to end including old </body></html> — good if we include them in newTail
  fs.writeFileSync(file, html);
  console.log('patched', rel);
}

function productTail({ lang, footerSrc, dataSrc, loaderSrc, titleSuffix }) {
  const solCat = lang === 'zh' ? '解决方案' : lang === 'en' ? 'Solutions' : 'Решения';
  return `    <script src="${loaderSrc}"></script>
    <script src="${dataSrc}"></script>
    <script>
        document.addEventListener("DOMContentLoaded", async function () {
            var productData = {};
            try {
                productData = await TXAM.loadData('products', '${lang}');
            } catch (err) {
                console.error(err);
                TXAM.revealFadeUps();
                TXAM.bindMobileMenu();
                return;
            }

            var params = new URLSearchParams(window.location.search);
            var id = params.get('id') || '1';
            var product = productData[id] || productData['1'];
            if (!product) {
                console.error('Product not found', id);
                TXAM.revealFadeUps();
                TXAM.bindMobileMenu();
                return;
            }

            if (product.category === '${solCat}') {
                document.body.dataset.breadcrumbParent = 'solutions.html';
                var ns = document.getElementById('nav-solutions');
                var np = document.getElementById('nav-products');
                if (ns && np) {
                    ns.classList.remove('text-[#86868B]');
                    ns.classList.add('text-[#1D1D1F]', 'border-b-2', 'border-[#FF6B00]', 'pb-1');
                    np.classList.remove('text-[#1D1D1F]', 'border-b-2', 'border-[#FF6B00]', 'pb-1');
                    np.classList.add('text-[#86868B]');
                }
                var mns = document.getElementById('mobile-nav-solutions');
                var mnp = document.getElementById('mobile-nav-products');
                if (mns && mnp) {
                    mns.classList.remove('text-[#86868B]');
                    mns.classList.add('text-[#FF6B00]');
                    mnp.classList.remove('text-[#FF6B00]');
                    mnp.classList.add('text-[#86868B]');
                }
            }

            document.getElementById('product-category').textContent = product.category;
            document.getElementById('product-model').textContent = product.model;
            document.getElementById('product-name').textContent = product.name;
            TXAM.setMedia('product-image', product.image, product.name);
            document.getElementById('product-desc').textContent = product.summary || product.desc || '';
            document.getElementById('product-detail').innerHTML = product.contentHtml || product.detail || '';
            document.title = product.name + ' | ${titleSuffix}';

            var specs = product.specs || [];
            document.getElementById('product-specs').innerHTML = specs.map(function (spec) {
                return '<span class="spec-tag">' + spec + '</span>';
            }).join('');

            var relatedHtml = Object.keys(productData)
                .filter(function (pid) { return pid !== id; })
                .filter(function (pid) { return productData[pid].category === product.category; })
                .slice(0, 3)
                .map(function (pid) {
                    var p = productData[pid];
                    return (
                        '<a href="product-detail.html?id=' + pid + '" class="detail-related-card apple-card block p-6 group">' +
                        '<div class="detail-related-card__img w-full h-40 radius-sm overflow-hidden bg-gray-100 mb-4">' +
                        '<img loading="lazy" src="' + TXAM.assetUrl(p.image) + '" alt="' + p.name + '" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">' +
                        '</div>' +
                        '<span class="detail-related-card__eyebrow">' + p.model + '</span>' +
                        '<h4 class="detail-related-card__title mt-1">' + p.name + '</h4>' +
                        '</a>'
                    );
                }).join('');
            document.getElementById('related-products').innerHTML = relatedHtml;

            TXAM.revealFadeUps();
            TXAM.bindMobileMenu();
        });
    </script>
    <script src="${footerSrc}" defer></script>`;
}

function newsTail({ lang, footerSrc, dataSrc, loaderSrc, titleSuffix }) {
  return `    <script src="${loaderSrc}"></script>
    <script src="${dataSrc}"></script>
    <script>
        document.addEventListener("DOMContentLoaded", async function () {
            var newsData = {};
            try {
                newsData = await TXAM.loadData('news', '${lang}');
            } catch (err) {
                console.error(err);
                TXAM.revealFadeUps();
                TXAM.bindMobileMenu();
                return;
            }

            var params = new URLSearchParams(window.location.search);
            var id = params.get('id') || '1';
            var news = newsData[id] || newsData['1'];
            if (!news) {
                console.error('News not found', id);
                TXAM.revealFadeUps();
                TXAM.bindMobileMenu();
                return;
            }

            document.getElementById('news-category').textContent = news.category;
            document.getElementById('news-title').textContent = news.title;
            document.getElementById('news-date').textContent = news.date;
            TXAM.setMedia('news-cover', news.cover, news.title);
            document.getElementById('news-content').innerHTML = news.contentHtml || news.content || '';
            document.title = news.title + ' | ${titleSuffix}';

            var relatedContainer = document.getElementById('related-news');
            if (relatedContainer) {
                relatedContainer.innerHTML = Object.keys(newsData)
                    .filter(function (nid) { return nid !== id; })
                    .slice(0, 3)
                    .map(function (nid) {
                        var item = newsData[nid];
                        return (
                            '<a href="news-detail.html?id=' + nid + '" class="detail-related-card apple-card block p-6 group">' +
                            '<div class="detail-related-card__img w-full h-40 radius-sm overflow-hidden bg-gray-100 mb-4">' +
                            '<img loading="lazy" src="' + TXAM.assetUrl(item.cover) + '" alt="' + item.title + '" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">' +
                            '</div>' +
                            '<span class="detail-related-card__eyebrow">' + item.category + '</span>' +
                            '<h4 class="detail-related-card__title mt-1 mb-2">' + item.title + '</h4>' +
                            '<span class="detail-meta-mono text-xs">' + item.date + '</span>' +
                            '</a>'
                        );
                    }).join('');
            }

            TXAM.revealFadeUps();
            TXAM.bindMobileMenu();
        });
    </script>
    <script src="${footerSrc}" defer></script>`;
}

function solutionTail({ lang, footerSrc, dataSrc, loaderSrc, titleSuffix }) {
  // Keep zh/ru rich layout; en uses simpler product-like IDs
  if (lang === 'en') {
    return `    <script src="${loaderSrc}"></script>
    <script src="${dataSrc}"></script>
    <script>
        document.addEventListener("DOMContentLoaded", async function () {
            var solutionData = {};
            try {
                solutionData = await TXAM.loadData('solutions', 'en');
            } catch (err) {
                console.error(err);
                TXAM.revealFadeUps();
                TXAM.bindMobileMenu();
                return;
            }

            var params = new URLSearchParams(window.location.search);
            var id = params.get('id') || '31';
            var solution = solutionData[id] || solutionData['31'];
            if (!solution) {
                console.error('Solution not found', id);
                TXAM.revealFadeUps();
                TXAM.bindMobileMenu();
                return;
            }

            document.getElementById('product-category').textContent = solution.category;
            document.getElementById('product-model').textContent = solution.model;
            document.getElementById('product-name').textContent = solution.name;
            TXAM.setMedia('product-image', solution.image, solution.name);
            document.getElementById('product-desc').textContent = solution.summary || solution.desc || '';
            document.getElementById('product-detail').innerHTML = solution.contentHtml || solution.detail || '';
            document.title = solution.name + ' | ${titleSuffix}';

            var specs = solution.specs || [];
            document.getElementById('product-specs').innerHTML = specs.map(function (spec) {
                return '<span class="spec-tag">' + spec + '</span>';
            }).join('');

            document.getElementById('related-products').innerHTML = Object.keys(solutionData)
                .filter(function (sid) { return sid !== id; })
                .slice(0, 3)
                .map(function (sid) {
                    var s = solutionData[sid];
                    return (
                        '<a href="solutions-detail.html?id=' + sid + '" class="detail-related-card apple-card block p-6 group">' +
                        '<div class="detail-related-card__img w-full h-40 radius-sm overflow-hidden bg-gray-100 mb-4">' +
                        '<img loading="lazy" src="' + TXAM.assetUrl(s.image) + '" alt="' + s.name + '" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">' +
                        '</div>' +
                        '<span class="detail-related-card__eyebrow">' + (s.model || '') + '</span>' +
                        '<h4 class="detail-related-card__title mt-1">' + s.name + '</h4>' +
                        '</a>'
                    );
                }).join('');

            TXAM.revealFadeUps();
            TXAM.bindMobileMenu();
        });
    </script>
    <script src="${footerSrc}" defer></script>`;
  }

  return `    <script src="${loaderSrc}"></script>
    <script src="${dataSrc}"></script>
    <script>
        function getUrlParameter(name) {
            return new URLSearchParams(window.location.search).get(name);
        }

        function loadSolution(solutionData) {
            var solutionId = getUrlParameter('id') || '31';
            var data = solutionData[solutionId];
            if (!data) {
                console.error('Solution not found:', solutionId);
                return;
            }

            var nameEl = document.getElementById('solution-name');
            if (nameEl) nameEl.textContent = data.name;
            var descEl = document.getElementById('solution-desc');
            if (descEl) descEl.textContent = data.summary || data.desc || '';
            var featEl = document.getElementById('solution-features');
            if (featEl) featEl.textContent = data.summary || data.desc || '';
            TXAM.setMedia('solution-image', data.image, data.name);

            var specsContainer = document.getElementById('solution-specs');
            if (specsContainer) {
                specsContainer.innerHTML = '';
                (data.specs || []).forEach(function (spec) {
                    var span = document.createElement('span');
                    span.className = 'spec-tag';
                    span.textContent = spec;
                    specsContainer.appendChild(span);
                });
            }

            var painPointsContainer = document.getElementById('solution-pain-points-grid') || document.getElementById('pain-points');
            if (painPointsContainer && data.painPoints) {
                painPointsContainer.innerHTML = data.painPoints.map(function (p) {
                    return '<div class="apple-card p-8">' +
                        '<div class="w-12 h-12 bg-[#FF6B00]/10 radius-sm flex items-center justify-center mb-4">' +
                        '<svg class="w-6 h-6 text-[#FF6B00]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>' +
                        '</div>' +
                        '<h4 class="font-bold text-[#1D1D1F] mb-2">' + p.title + '</h4>' +
                        '<p class="text-sm text-[#86868B]">' + p.desc + '</p></div>';
                }).join('');
            }

            var processContainer = document.getElementById('solution-process-grid') || document.getElementById('process-steps');
            if (processContainer && data.process) {
                processContainer.innerHTML = data.process.map(function (p) {
                    return '<div class="apple-card p-6 text-center">' +
                        '<div class="w-16 h-16 bg-[#FF6B00] rounded-full flex items-center justify-center mx-auto mb-4">' +
                        '<span class="text-white font-black text-xl mono-num">' + p.step + '</span></div>' +
                        '<h4 class="font-bold text-[#1D1D1F] mb-2">' + p.title + '</h4>' +
                        '<p class="text-sm text-[#86868B]">' + p.desc + '</p></div>';
                }).join('');
            }

            var detailEl = document.getElementById('solution-detail');
            if (detailEl) detailEl.innerHTML = data.contentHtml || data.detail || '';

            var relatedContainer = document.getElementById('related-solutions');
            if (relatedContainer) {
                relatedContainer.innerHTML = '';
                Object.keys(solutionData).filter(function (id) { return id !== solutionId; })
                    .sort(function () { return Math.random() - 0.5; })
                    .slice(0, 3)
                    .forEach(function (id) {
                        var item = solutionData[id];
                        var card = document.createElement('a');
                        card.href = 'solutions-detail.html?id=' + id;
                        card.className = 'detail-related-card apple-card block p-6 group';
                        card.innerHTML =
                            '<div class="detail-related-card__img w-full h-40 radius-sm overflow-hidden bg-gray-100 mb-4">' +
                            '<img loading="lazy" src="' + TXAM.assetUrl(item.image) + '" alt="' + item.name + '" class="img-zoom w-full h-full object-cover"></div>' +
                            '<h4 class="detail-related-card__title mb-2">' + item.name + '</h4>' +
                            '<p class="detail-related-card__desc">' + (item.summary || item.desc || '') + '</p>';
                        relatedContainer.appendChild(card);
                    });
            }

            document.title = data.name + ' | ${titleSuffix}';
        }

        document.addEventListener('DOMContentLoaded', async function () {
            var solutionData = {};
            try {
                solutionData = await TXAM.loadData('solutions', '${lang}');
            } catch (err) {
                console.error(err);
                TXAM.revealFadeUps();
                TXAM.bindMobileMenu();
                return;
            }
            loadSolution(solutionData);
            TXAM.revealFadeUps();
            TXAM.bindMobileMenu();
        });
    </script>
    <script src="${footerSrc}" defer></script>`;
}

const pages = [
  { rel: 'product-detail.html', kind: 'products', lang: 'zh', titleSuffix: '同兴高科',
    loaderSrc: 'assets/js/data-loader.js', dataSrc: 'data/products/zh.js', footerSrc: 'assets/js/footer.js' },
  { rel: 'en/product-detail.html', kind: 'products', lang: 'en', titleSuffix: 'TXAM',
    loaderSrc: '../assets/js/data-loader.js', dataSrc: '../data/products/en.js', footerSrc: '../assets/js/footer-en.js' },
  { rel: 'ru/product-detail.html', kind: 'products', lang: 'ru', titleSuffix: 'Тунсин Гаотек',
    loaderSrc: '../assets/js/data-loader.js', dataSrc: '../data/products/ru.js', footerSrc: '../assets/js/footer-ru.js' },
  { rel: 'news-detail.html', kind: 'news', lang: 'zh', titleSuffix: '同兴高科',
    loaderSrc: 'assets/js/data-loader.js', dataSrc: 'data/news/zh.js', footerSrc: 'assets/js/footer.js' },
  { rel: 'en/news-detail.html', kind: 'news', lang: 'en', titleSuffix: 'TXAM',
    loaderSrc: '../assets/js/data-loader.js', dataSrc: '../data/news/en.js', footerSrc: '../assets/js/footer-en.js' },
  { rel: 'ru/news-detail.html', kind: 'news', lang: 'ru', titleSuffix: 'Тунсин Гаотек',
    loaderSrc: '../assets/js/data-loader.js', dataSrc: '../data/news/ru.js', footerSrc: '../assets/js/footer-ru.js' },
  { rel: 'solutions-detail.html', kind: 'solutions', lang: 'zh', titleSuffix: '同兴高科',
    loaderSrc: 'assets/js/data-loader.js', dataSrc: 'data/solutions/zh.js', footerSrc: 'assets/js/footer.js' },
  { rel: 'en/solutions-detail.html', kind: 'solutions', lang: 'en', titleSuffix: 'TXAM',
    loaderSrc: '../assets/js/data-loader.js', dataSrc: '../data/solutions/en.js', footerSrc: '../assets/js/footer-en.js' },
  { rel: 'ru/solutions-detail.html', kind: 'solutions', lang: 'ru', titleSuffix: 'Тунсин Гаотек',
    loaderSrc: '../assets/js/data-loader.js', dataSrc: '../data/solutions/ru.js', footerSrc: '../assets/js/footer-ru.js' },
];

for (const p of pages) patchFile(p.rel, p);
console.log('done');
