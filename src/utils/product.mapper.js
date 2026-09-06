import { parseTags, parseUiFlags } from "./json.js";

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
    amount: row.amount,
    currency: row.currency,
    taxRate: row.tax_rate,
    image: row.image,
    tags: parseTags(row.tags),
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
    uiFlags: parseUiFlags(row.ui_flags),
  };
}
