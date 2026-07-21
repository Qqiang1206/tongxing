export function parseJsonField(value, fallback = null) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function mapProduct(row, i18n) {
  if (!row || !i18n) return null;
  return {
    id: row.id,
    category: row.category_key || '',
    model: row.model || '',
    name: i18n.name,
    image: row.image || '',
    specs: parseJsonField(i18n.specs_json, []),
    summary: i18n.summary || '',
    contentHtml: i18n.content_html || '',
    published: !!row.published,
    showInList: row.show_in_list == null ? true : !!Number(row.show_in_list),
    sortOrder: Number(row.sort_order) || 0,
    filterKey: row.filter_key || '',
    filterKeyEn: row.filter_key_en || '',
  };
}

export function mapSolution(row, i18n) {
  if (!row || !i18n) return null;
  const out = {
    id: row.id,
    slug: row.slug || '',
    category: row.category_key || '',
    name: i18n.name,
    image: row.image || '',
    specs: parseJsonField(i18n.specs_json, []),
    summary: i18n.summary || '',
    contentHtml: i18n.content_html || '',
    published: !!row.published,
    sortOrder: Number(row.sort_order) || 0,
    homeSlot: row.home_slot === 'hero' || row.home_slot === 'category' ? row.home_slot : '',
  };
  const painPoints = parseJsonField(i18n.pain_points_json, null);
  const process = parseJsonField(i18n.process_json, null);
  if (painPoints) out.painPoints = painPoints;
  if (process) out.process = process;
  return out;
}

export function mapNews(row, i18n) {
  if (!row || !i18n) return null;
  return {
    id: row.id,
    category: i18n.category || '',
    title: i18n.title,
    date: i18n.date_display || row.published_at || '',
    cover: row.cover || '',
    contentHtml: i18n.content_html || '',
    published: !!row.published,
    sortOrder: Number(row.sort_order) || 0,
    homeFeatured: !!Number(row.home_featured),
  };
}

export function toCatalogMap(items) {
  const map = {};
  for (const item of items) {
    if (item && item.id != null) map[String(item.id)] = item;
  }
  return map;
}
