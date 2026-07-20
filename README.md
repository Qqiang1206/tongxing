# 同兴高科 TXAM Website

## Structure

```
├── index.html, about.html, …     # Chinese pages (site root)
├── en/                           # English pages
├── ru/                           # Russian pages
├── assets/
│   ├── css/
│   ├── js/
│   └── images/{brand,hero,products,solutions,certifications,clients}
├── data/
│   ├── products/{zh,en,ru}.json
│   ├── solutions/{zh,en,ru}.json
│   ├── news/{zh,en,ru}.json
│   ├── i18n/
│   └── schema/
├── scripts/                      # Dev tooling (not required at runtime)
└── server/                       # Backend API plan + SQL draft
```

## Content edits

- Products / solutions / news: edit `data/**/*.json`
- Layout / copy in static shells: edit the corresponding HTML under `/`, `/en/`, `/ru/`
- Styles: `assets/css/styles.css`

## Deploy

Upload the whole repo **except** `.git/` and optionally `scripts/` + `server/` (or include `server/` docs only).

Ensure the server serves `data/*.json` as `application/json` (already configured in `web.config`).

## Backend path

See `server/README.md`. Front-end detail pages already `fetch` JSON — point them at `/api/v1` when ready.
