const ORDER_COLUMNS = `
e.id, e.ref, e.customer_name, e.customer_phone, e.channel, e.status, e.message,
e.pdf_link, e.whatsapp_number, e.sms_number, e.total_amount, e.total_items,
e.total_quantity, e.order_date, e.created_at, e.updated_at
`;

export async function findAllOrders(db) {
  const { rows } = await db.query(`
    SELECT ${ORDER_COLUMNS}
    FROM enquiries e
    ORDER BY e.created_at DESC
  `);
  return rows;
}

export async function findById(db, id, client = db) {
  const { rows } = await client.query(
    `SELECT ${ORDER_COLUMNS} FROM enquiries e WHERE e.id=$1`,
    [id],
  );
  return rows[0] || null;
}

export async function findByRef(db, ref) {
  const { rows } = await db.query(
    `SELECT ${ORDER_COLUMNS} FROM enquiries e WHERE e.ref=$1`,
    [ref],
  );
  return rows[0] || null;
}

export async function findItems(db, enquiryId) {
  const { rows } = await db.query(
    `
    SELECT id, enquiry_id, product_id, name, category, contents,
           original_price, price, quantity, total, discount_percent,
           created_at, updated_at
    FROM enquiry_items
    WHERE enquiry_id=$1
    ORDER BY id
  `,
    [enquiryId],
  );
  return rows;
}

export async function findAllWithItems(db) {
  const orders = await findAllOrders(db);
  if (!orders.length) return [];
  const ids = orders.map((x) => x.id);
  const { rows: items } = await db.query(
    `
    SELECT id, enquiry_id, product_id, name, category, contents,
           original_price, price, quantity, total, discount_percent,
           created_at, updated_at
    FROM enquiry_items
    WHERE enquiry_id = ANY($1::text[])
    ORDER BY id
  `,
    [ids],
  );
  const byOrder = new Map();
  for (const item of items) {
    if (!byOrder.has(item.enquiry_id)) byOrder.set(item.enquiry_id, []);
    byOrder.get(item.enquiry_id).push(item);
  }
  return orders.map((o) => ({ ...o, items: byOrder.get(o.id) || [] }));
}

export async function insertOrder(client, o) {
  const { rows } = await client.query(
    `
    INSERT INTO enquiries (
      id, ref, customer_name, customer_phone, channel, status, message,
      pdf_link, whatsapp_number, sms_number, total_amount, total_items,
      total_quantity, order_date, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15)
    RETURNING *
  `,
    [
      o.id,
      o.ref,
      o.customerName,
      o.customerPhone,
      o.channel,
      o.status,
      o.message,
      o.pdfLink,
      o.whatsappNumber,
      o.smsNumber,
      o.totalAmount,
      o.totalItems,
      o.totalQuantity,
      o.orderDate,
      o.createdAt,
    ],
  );
  return rows[0];
}

export async function insertItem(client, item) {
  const { rows } = await client.query(
    `
    INSERT INTO enquiry_items (
      enquiry_id, product_id, name, category, contents, original_price,
      price, quantity, total, discount_percent, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)
    RETURNING *
  `,
    [
      item.enquiryId,
      item.productId,
      item.name,
      item.category,
      item.contents,
      item.originalPrice,
      item.price,
      item.quantity,
      item.total,
      item.discountPercent,
      item.createdAt,
    ],
  );
  return rows[0];
}

export async function insertSnapshot(client, s) {
  const { rows } = await client.query(
    `
    INSERT INTO stock_snapshots (
      enquiry_id, product_id, product_name, quantity_ordered, stock_before, stock_after
    ) VALUES ($1,$2,$3,$4,$5,$6)
    RETURNING *
  `,
    [
      s.enquiryId,
      s.productId,
      s.productName,
      s.quantityOrdered,
      s.stockBefore,
      s.stockAfter,
    ],
  );
  return rows[0];
}

export async function updateStatus(db, id, status) {
  const { rows } = await db.query(
    `
    UPDATE enquiries SET status=$1, updated_at=CURRENT_TIMESTAMP
    WHERE id=$2 RETURNING *
  `,
    [status, id],
  );
  return rows[0] || null;
}

export async function topCustomers(db) {
  const { rows } = await db.query(`
    SELECT customer_name, customer_phone, COUNT(*) AS order_count,
           COALESCE(SUM(total_amount),0) AS total_amount, MAX(order_date) AS last_order
    FROM enquiries
    WHERE status NOT IN ('cancelled')
    GROUP BY customer_name, customer_phone
    ORDER BY COALESCE(SUM(total_amount),0) DESC
  `);
  return rows;
}
