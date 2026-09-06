const PRODUCT_COLUMNS = `
id, sku, category, name, contents, price, discount_percent, discount_amount,
amount, currency, tax_rate, image, tags, stock_quantity, min_order_qty,
max_order_qty, status, backorder_allowed, active, crm_product_id,
last_updated, source, description_video, updated_at, ui_flags
`;

export async function findAll(db) {
  const { rows } = await db.query(
    `SELECT ${PRODUCT_COLUMNS} FROM products ORDER BY id`,
  );
  return rows;
}
export async function findById(db, id, forUpdate = false) {
  const { rows } = await db.query(
    `SELECT ${PRODUCT_COLUMNS} FROM products WHERE id = $1 ${forUpdate ? "FOR UPDATE" : ""}`,
    [id],
  );
  return rows[0] || null;
}
export async function exists(db, id) {
  const { rowCount } = await db.query("SELECT 1 FROM products WHERE id = $1", [
    id,
  ]);
  return rowCount > 0;
}
export async function insert(db, p) {
  const { rows } = await db.query(
    `
    INSERT INTO products (
      id, sku, category, name, contents, price, discount_percent, discount_amount,
      amount, currency, tax_rate, image, tags, stock_quantity, min_order_qty,
      max_order_qty, status, backorder_allowed, active, crm_product_id,
      last_updated, source, description_video, updated_at, ui_flags
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25
    ) RETURNING ${PRODUCT_COLUMNS}
  `,
    [
      p.id,
      p.sku,
      p.category,
      p.name,
      p.contents,
      p.price,
      p.discountPercent,
      p.discountAmount,
      p.amount,
      p.currency,
      p.taxRate,
      p.image,
      p.tags,
      p.stockQuantity,
      p.minOrderQty,
      p.maxOrderQty,
      p.status,
      p.backorderAllowed,
      p.active,
      p.crmProductId,
      p.lastUpdated,
      p.source,
      p.descriptionVideo,
      p.updatedAt,
      p.uiFlags,
    ],
  );
  return rows[0];
}
export async function update(db, id, p) {
  const { rows } = await db.query(
    `
    UPDATE products SET
      name=$1, category=$2, price=$3, contents=$4, image=$5, status=$6,
      discount_percent=$7, discount_amount=$8, amount=$9,
      last_updated=$10, updated_at=$11
    WHERE id=$12
    RETURNING ${PRODUCT_COLUMNS}
  `,
    [
      p.name,
      p.category,
      p.price,
      p.contents,
      p.image,
      p.status,
      p.discountPercent,
      p.discountAmount,
      p.amount,
      p.lastUpdated,
      p.updatedAt,
      id,
    ],
  );
  return rows[0] || null;
}
export async function updateStatus(db, id, status, contents, now) {
  const { rows } = await db.query(
    `
    UPDATE products SET status=$1, contents=$2, last_updated=$3, updated_at=$3
    WHERE id=$4 RETURNING ${PRODUCT_COLUMNS}
  `,
    [status, contents, now, id],
  );
  return rows[0] || null;
}
export async function deleteById(db, id) {
  const { rowCount } = await db.query("DELETE FROM products WHERE id=$1", [id]);
  return rowCount > 0;
}
