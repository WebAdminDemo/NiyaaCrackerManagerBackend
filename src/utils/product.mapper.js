import { parseTags, parseUiFlags } from './json.js';

export function productResponse(row) {
  if (!row) return null;

  return {
    rowid: row.id,
    sku: row.sku,
    category: row.category,
    name: row.name,
    contents: row.contents,
    price: row.price,
    discountPercent: row.discount_percent,
    discountAmount: row.discount_amount,
    discountMode: Number(row.discount_percent ?? 0) > 0 ? 'percent' : (Number(row.discount_amount ?? 0) > 0 ? 'value' : 'percent'),
    discountValue: Number(row.discount_percent ?? 0) > 0 ? row.discount_percent : (row.discount_amount ?? 0),
    amount: row.amount,
    currency: row.currency,
    taxRate: row.tax_rate,
    image: row.image,
    tags: row.tags === null ? null : parseTags(row.tags),
    stockQuantity: row.stock_quantity,
    minOrderQty: row.min_order_qty,
    maxOrderQty: row.max_order_qty,
    status: row.status,
    backorderAllowed: row.backorder_allowed,
    active: row.active,
    crmProductId: row.crm_product_id,
    lastUpdated: row.last_updated,
    source: row.source,
    descriptionVideo: row.description_video,
    updatedAt: row.updated_at,
    brand: row.brand || "",
    brandStatus:
      row.brand_status === null || row.brand_status === undefined
        ? null
        : row.brand_status === true || row.brand_status === 1 || String(row.brand_status).trim() === "1",
    uiFlags: row.ui_flags === null ? null : parseUiFlags(row.ui_flags),
  };
}
