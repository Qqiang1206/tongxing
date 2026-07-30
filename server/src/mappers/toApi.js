/**
 * API response mappers: convert DB rows to frontend-consumed shapes.
 *
 * ── filterKey / filterKeyEn ──────────────────────────────────────────────
 * These are NOT per-item identity keys. They serve as **grouping keys** for
 * the frontend filter bar on list pages (solutions.html, products.html).
 *
 * Multiple items that should appear under the same filter button share one
 * filterKey value. The human-readable label for each filterKey is defined
 * in data/pages/{kind}/{lang}.json → filters map.
 *
 * Example (solutions):
 *   - "冰箱线"(id=32, slug=refrigerator)   → filterKey: "refrigerator"
 *   - "洗衣机线"(id=34, slug=washer)       → filterKey: "refrigerator"  ← grouped
 *   - "空调线"(id=36, slug=ac)             → filterKey: "refrigerator"  ← grouped
 *   All three appear under the "家电" (Home Appliances) filter button.
 *
 *   pages/solutions/zh.json → filters.refrigerator = "家电"
 *   pages/solutions/en.json → filters.refrigerator = "Home Appliances"
 *
 * To add a new filter group, pick an unused key, assign it as filterKey on
 * the items, and add a label in pages/{kind}/{lang}.json → filters.
 *
 * See also: assets/js/solutions-list.js → collectCategories()
 *           assets/js/product-list.js   → similar grouping
 * ──────────────────────────────────────────────────────────────────────────
 */

export function parseJsonField(value, fallback = null) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/**
 * Resolve a language-appropriate category display name.
 * categoryMap: { [filterKey]: { name, nameEn, nameRu } }
 */
function resolveCategoryName(categoryMap, filterKey, fallback, lang) {
  if (!categoryMap || !filterKey) return fallback || '';
  const cat = categoryMap[filterKey];
  if (!cat) return fallback || '';
  if (lang === 'en') return cat.nameEn || cat.name || fallback || '';
  if (lang === 'ru') return cat.nameRu || cat.name || fallback || '';
  return cat.name || fallback || '';
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function excerptFromHtml(html, maxLen = 160) {
  const text = stripHtml(html);
  if (text.length <= maxLen) return text;
  return text.slice(0, Math.max(0, maxLen - 1)).trimEnd() + '…';
}

export function mapProduct(row, i18n, opts = {}) {
  if (!row || !i18n) return null;
  const out = {
    id: row.id,
    category: resolveCategoryName(opts.categoryMap, row.filter_key, row.category_key, opts.lang),
    model: i18n.model || row.model || '',
    name: i18n.name,
    image: row.image || '',
    specs: parseJsonField(i18n.specs_json, []),
    summary: i18n.summary || '',
    published: !!row.published,
    showInList: row.show_in_list == null ? true : !!Number(row.show_in_list),
    sortOrder: Number(row.sort_order) || 0,
    // Grouping key for frontend filter bar — see file header comment
    filterKey: row.filter_key || '',
    filterKeyEn: row.filter_key_en || '',
  };
  if (!opts.slim) {
    out.contentHtml = i18n.content_html || '';
  }
  return out;
}

export function mapSolution(row, i18n, opts = {}) {
  if (!row || !i18n) return null;
  const out = {
    id: row.id,
    slug: row.slug || '',
    category: resolveCategoryName(opts.categoryMap, row.filter_key, row.category_key, opts.lang),
    name: i18n.name,
    image: row.image || '',
    specs: parseJsonField(i18n.specs_json, []),
    summary: i18n.summary || '',
    published: !!row.published,
    sortOrder: Number(row.sort_order) || 0,
    homeSlot: row.home_slot === 'hero' || row.home_slot === 'category' ? row.home_slot : '',
    // Grouping key for frontend filter bar — see file header comment
    filterKey: row.filter_key || '',
    filterKeyEn: row.filter_key_en || '',
  };
  if (!opts.slim) {
    out.contentHtml = i18n.content_html || '';
    const painPoints = parseJsonField(i18n.pain_points_json, null);
    const process = parseJsonField(i18n.process_json, null);
    if (painPoints) out.painPoints = painPoints;
    if (process) out.process = process;
  }
  return out;
}

export function mapNews(row, i18n, opts = {}) {
  if (!row || !i18n) return null;
  const out = {
    id: row.id,
    category: i18n.category || '',
    categoryKey: row.category_key || '',
    title: i18n.title,
    date: i18n.date_display || row.published_at || '',
    cover: row.cover || '',
    published: !!row.published,
    sortOrder: Number(row.sort_order) || 0,
    homeFeatured: !!Number(row.home_featured),
  };
  if (opts.slim) {
    out.excerpt = excerptFromHtml(i18n.content_html || '', 160);
  } else {
    out.contentHtml = i18n.content_html || '';
  }
  return out;
}

export function toCatalogMap(items) {
  const map = {};
  for (const item of items) {
    if (item && item.id != null) map[String(item.id)] = item;
  }
  return map;
}
