# TXAM Backend (planned)

Static site currently serves JSON from `/data/*.json`.
Backend should expose the same shapes via REST so front-end only changes the fetch base URL.

## Planned API

```
GET  /api/v1/products?lang=zh
GET  /api/v1/products/:id?lang=zh
GET  /api/v1/solutions?lang=zh
GET  /api/v1/solutions/:id?lang=zh
GET  /api/v1/news?lang=zh&page=1
GET  /api/v1/news/:id?lang=zh
POST /api/v1/contact
```

## Data contract

See `../data/schema/product.schema.json` and mirror for solutions/news.
Translation pattern:

| Table | Purpose |
|-------|---------|
| products | id, slug, category_key, model, image, published, updated_at |
| product_translations | product_id, lang, name, summary, content_html, specs_json |
| solutions / solution_translations | same pattern |
| news / news_translations | same pattern |
| contact_messages | name, email, phone, company, message, created_at |

## Migration path

1. Import `data/**/*.json` into DB
2. Point `assets/js/pages/*.js` (or inline loaders) to `/api/v1`
3. Keep static HTML shells until SSR/CMS is ready
