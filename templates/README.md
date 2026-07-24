# Page templates (source of truth for future build)

This folder documents the page shells. Currently the live HTML under `/`, `/en/`, `/ru/` **is** the template set after restructure.

## Pages

| Template role | ZH | EN | RU |
|---------------|----|----|-----|
| Home | `/index.html` | `/en/index.html` | `/ru/index.html` |
| About | `/about.html` | `/en/about.html` | `/ru/about.html` |
| Products list | `/products.html` | `/en/products.html` | `/ru/products.html` |
| Product detail | `/product-detail.html` | `/en/product-detail.html` | `/ru/product-detail.html` |
| Solutions list | `/solutions.html` | … | … |
| Solution detail | `/solutions-detail.html` | … | … |
| News list/detail | `/news.html`, `/news-detail.html` | … | … |
| Contact | `/contact.html` | … | … |
| Solution landing | `/*-solution.html` | `/en/*-solution.html` | `/ru/*-solution.html` |

## Data binding

Detail pages load:

- `data/products/{lang}.json`
- `data/solutions/{lang}.json`
- `data/news/{lang}.json`

When backend is ready, change the `fetch(...)` URL in each detail page to `/api/v1/...`.

## Partials

Shared UI currently lives in:

- `assets/js/header.js` (ZH homepage)
- `assets/js/site-footer.js`

Next iteration can extract pure HTML partials and a `scripts/build.js` injector.
