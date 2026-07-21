/**
 * Seed product list/order/filter metadata after JSON import (zh is source of truth).
 * Mirrors former hardcode in assets/js/products-list.js.
 */
export const PRODUCT_LIST_SEED = {
  /** IDs hidden from product center (solution-like / whole-line rows). */
  hiddenIds: new Set(['3', '16', '17', '25', '26']),
  orderZh: [
    '1', '2', '4', '11', '9', '8', '12', '18', '19', '20', '21', '22', '23', '24',
    '5', '6', '7', '10', '15', '13', '14', '27', '28', '29', '30',
  ],
  filterZh: {
    '1': 'optical', '2': 'optical', '3': 'optical', '4': 'dispensing', '5': 'dispensing',
    '6': 'optical', '7': 'optical', '8': 'screw', '9': 'flip', '10': 'optical',
    '11': 'robot', '12': 'robot', '13': 'robot', '14': 'packaging', '15': 'flip',
    '16': 'packaging', '17': 'transfer', '18': 'transfer', '19': 'transfer', '20': 'transfer',
    '21': 'screw', '22': 'packaging', '23': 'packaging', '24': 'robot', '25': 'robot',
    '26': 'transfer', '27': 'packaging', '28': 'packaging', '29': 'packaging', '30': 'robot',
  },
  filterEn: {
    '1': 'single', '2': 'single', '3': 'single', '4': 'single', '5': 'dispensing',
    '6': 'optical', '7': 'optical', '8': 'single', '9': 'single', '10': 'optical',
    '11': 'logistics', '12': 'logistics', '13': 'robot', '14': 'packaging', '15': 'flip',
    '16': 'packaging', '17': 'single', '18': 'single', '19': 'single', '20': 'single',
    '21': 'single', '22': 'single', '23': 'single', '24': 'single', '25': 'robot',
    '26': 'single', '27': 'packaging', '28': 'packaging', '29': 'packaging', '30': 'robot',
  },
};

export function applyProductListSeed(db) {
  const rows = db.prepare('SELECT id FROM products').all();
  const upd = db.prepare(
    `UPDATE products SET show_in_list = ?, sort_order = ?, filter_key = ?, filter_key_en = ? WHERE id = ?`
  );
  for (const { id } of rows) {
    const sid = String(id);
    const show = PRODUCT_LIST_SEED.hiddenIds.has(sid) ? 0 : 1;
    const orderIdx = PRODUCT_LIST_SEED.orderZh.indexOf(sid);
    const sortOrder = orderIdx >= 0 ? orderIdx + 1 : Number(sid) || 999;
    upd.run(
      show,
      sortOrder,
      PRODUCT_LIST_SEED.filterZh[sid] || '',
      PRODUCT_LIST_SEED.filterEn[sid] || '',
      sid
    );
  }
}
