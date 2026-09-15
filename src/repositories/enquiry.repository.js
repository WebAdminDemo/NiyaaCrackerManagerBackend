import { pool } from "../config/database.js";

const ORDER_COLUMNS = `
  id,
  ref,
  customer_name,
  customer_phone,
  customer_address,
  party_sector,
  party_country,
  party_state,
  party_district,
  party_locality,
  party_pincode,
  brand_mode,
  channel,
  status,
  message,
  pdf_link,
  whatsapp_number,
  sms_number,
  total_amount,
  discount_percent,
  discount_amount,
  final_amount,
  discount_mode,
  discount_value,
  total_items,
  total_quantity,
  order_date,
  created_at,
  updated_at
`;

const ITEM_COLUMNS = `
  ei.id,
  ei.enquiry_id,
  ei.product_id,
  ei.name,
  ei.category,
  ei.contents,
  ei.original_price,
  ei.price,
  ei.quantity,
  ei.total,
  ei.discount_percent,
  ei.discount_type,
  ei.discount_value,
  ei.discount_amount,
  ei.brand,
  ei.created_at,
  ei.updated_at,
  p.stock_quantity,
  p.ui_flags AS product_ui_flags,
  p.brand AS product_brand
`;

export async function exists(id, client = pool) {
  const result = await client.query(
    "SELECT 1 FROM enquiries WHERE id = $1 LIMIT 1",
    [id],
  );

  return Boolean(result.rows[0]);
}

export async function insertEnquiry(enquiry, client = pool) {
  const { rows } = await client.query(
    `
    INSERT INTO enquiries (
      id,
      ref,
      customer_name,
      customer_phone,
      customer_address,
      party_sector,
      party_country,
      party_state,
      party_district,
      party_locality,
      party_pincode,
      brand_mode,
      channel,
      status,
      message,
      pdf_link,
      whatsapp_number,
      sms_number,
      total_amount,
      total_items,
      total_quantity,
      order_date,
      created_at,
      updated_at
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
      $13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24
    )
    RETURNING *
    `,
    [
      enquiry.id,
      enquiry.ref,
      enquiry.customerName,
      enquiry.customerPhone,
      enquiry.customerAddress ?? null,
      enquiry.partySector ?? null,
      enquiry.partyCountry || "India",
      enquiry.partyState ?? null,
      enquiry.partyDistrict ?? null,
      enquiry.partyLocality ?? null,
      enquiry.partyPincode ?? null,
      enquiry.brandMode || "multiBrand",
      enquiry.channel || "whatsapp",
      enquiry.status || "order_received",
      enquiry.message ?? null,
      enquiry.pdfLink ?? null,
      enquiry.whatsappNumber ?? null,
      enquiry.smsNumber ?? null,
      enquiry.totalAmount ?? 0,
      enquiry.totalItems ?? 0,
      enquiry.totalQuantity ?? 0,
      enquiry.orderDate ?? new Date(),
      enquiry.createdAt ?? new Date(),
      enquiry.updatedAt ?? new Date(),
    ],
  );

  return rows[0];
}

export async function insertItem(item, client = pool) {
  const { rows } = await client.query(
    `
    INSERT INTO enquiry_items (
      enquiry_id,
      product_id,
      name,
      category,
      contents,
      original_price,
      price,
      quantity,
      total,
      discount_percent,
      discount_type,
      discount_value,
      discount_amount,
      brand
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
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
      item.discountPercent ?? 0,
      item.discountType || "percent",
      item.discountValue ?? item.discountPercent ?? 0,
      item.discountAmount ?? 0,
      item.brand ?? null,
    ],
  );

  return rows[0];
}

export async function insertSnapshot(snapshot, client = pool) {
  const { rows } = await client.query(
    `
    INSERT INTO stock_snapshots (
      enquiry_id,
      product_id,
      product_name,
      quantity_ordered,
      stock_before,
      stock_after
    )
    VALUES ($1,$2,$3,$4,$5,$6)
    RETURNING *
    `,
    [
      snapshot.enquiryId,
      snapshot.productId,
      snapshot.productName,
      snapshot.quantityOrdered,
      snapshot.stockBefore,
      snapshot.stockAfter,
    ],
  );

  return rows[0];
}

export async function findAll() {
  const { rows } = await pool.query(
    `
    SELECT e.*,
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'productId', i.product_id,
              'sku', i.product_id,
              'name', i.name,
              'category', i.category,
              'contents', i.contents,
              'discountPercent', i.discount_percent,
              'discountType', i.discount_type,
              'discountValue', i.discount_value,
              'discountAmount', i.discount_amount,
              'brand', i.brand,
              'originalPrice', i.original_price,
              'price', i.price,
              'quantity', i.quantity,
              'total', i.total
            ) ORDER BY i.id
          )
          FROM enquiry_items i
          WHERE i.enquiry_id = e.id
        ),
        '[]'::json
      ) AS items,
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'productId', s.product_id,
              'productName', s.product_name,
              'quantityOrdered', s.quantity_ordered,
              'stockBefore', s.stock_before,
              'stockAfter', s.stock_after
            ) ORDER BY s.id
          )
          FROM stock_snapshots s
          WHERE s.enquiry_id = e.id
        ),
        '[]'::json
      ) AS "stockSnapshots"
    FROM enquiries e
    ORDER BY e.created_at DESC
    `,
  );

  return rows;
}

export async function findByRef(ref, client = pool) {
  const { rows } = await client.query(
    `SELECT ${ORDER_COLUMNS} FROM enquiries WHERE ref = $1 LIMIT 1`,
    [ref],
  );

  return rows[0] || null;
}

export async function findById(id, client = pool) {
  const { rows } = await client.query(
    `SELECT ${ORDER_COLUMNS} FROM enquiries WHERE id = $1 LIMIT 1`,
    [id],
  );

  return rows[0] || null;
}

export async function insertOrder(client, enquiry) {
  return insertEnquiry(enquiry, client);
}

export async function findAllWithItems(db = pool) {
  const { rows: orders } = await db.query(`
    SELECT ${ORDER_COLUMNS}
    FROM enquiries
    ORDER BY created_at DESC
  `);

  if (!orders.length) return [];

  const ids = orders.map((order) => order.id);

  const { rows: items } = await db.query(
    `
    SELECT ${ITEM_COLUMNS}
    FROM enquiry_items ei
    LEFT JOIN products p ON p.id = ei.product_id
    WHERE ei.enquiry_id = ANY($1::text[])
    ORDER BY ei.id
    `,
    [ids],
  );

  const byOrder = new Map(orders.map((order) => [order.id, []]));

  items.forEach((item) => {
    byOrder.get(item.enquiry_id)?.push(item);
  });

  return orders.map((order) => ({
    ...order,
    items: byOrder.get(order.id) || [],
  }));
}

export async function findItems(db = pool, enquiryId) {
  const { rows } = await db.query(
    `
    SELECT ${ITEM_COLUMNS}
    FROM enquiry_items ei
    LEFT JOIN products p ON p.id = ei.product_id
    WHERE ei.enquiry_id = $1
    ORDER BY ei.id
    `,
    [enquiryId],
  );

  return rows;
}

export async function topCustomers(db = pool) {
  const { rows } = await db.query(`
    SELECT customer_name,
           customer_phone,
           COUNT(*)::int AS order_count,
           COALESCE(SUM(total_amount), 0) AS total_amount,
           MAX(order_date) AS last_order
    FROM enquiries
    WHERE COALESCE(status, 'pending') <> 'cancelled'
    GROUP BY customer_name, customer_phone
    ORDER BY SUM(total_amount) DESC NULLS LAST
  `);

  return rows;
}

export async function updateStatus(db = pool, id, status) {
  const { rows } = await db.query(
    `
    UPDATE enquiries
    SET status = $1,
        updated_at = NOW()
    WHERE id = $2
    RETURNING ${ORDER_COLUMNS}
    `,
    [status, id],
  );

  return rows[0] || null;
}

async function adjustStock(client, productId, delta) {
  const result = await client.query(
    `SELECT id, name, category, contents, price, amount, discount_percent, brand, status, stock_quantity, ui_flags
     FROM products WHERE id = $1 FOR UPDATE`,
    [productId],
  );
  const product = result.rows[0];
  if (!product) {
    const error = new Error(`Product not found: ${productId}`);
    error.status = 404;
    throw error;
  }
  // Order quantities are intentionally unlimited. Inventory is informational only
  // and is never used to reject an order or reduce the catalog stock.
  return product;
}

export async function updateOrderItems(id, requestedItems = []) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const orderResult = await client.query(
      `SELECT id FROM enquiries WHERE id = $1 FOR UPDATE`,
      [id],
    );

    if (!orderResult.rows[0]) {
      const error = new Error("Order not found");
      error.status = 404;
      throw error;
    }

    const existingResult = await client.query(
      `
      SELECT id, product_id, quantity, price
      FROM enquiry_items
      WHERE enquiry_id = $1
      FOR UPDATE
      `,
      [id],
    );

    const existingItems = existingResult.rows;
    const requested = new Map();

    for (const item of requestedItems) {
      const productId = String(item?.productId ?? item?.id ?? "").trim();
      const quantity = Number(item?.quantity);

      // Quantity is intentionally unlimited. We only require a positive integer;
      // there is no stock_quantity or max_order_qty restriction here.
      if (!productId || !Number.isInteger(quantity) || quantity < 1) {
        const error = new Error(
          "Every selected product must have a quantity greater than zero.",
        );
        error.status = 400;
        throw error;
      }

      if (requested.has(productId)) {
        const error = new Error(`Duplicate product in order: ${productId}`);
        error.status = 400;
        throw error;
      }

      requested.set(productId, quantity);
    }

    if (!requested.size) {
      const error = new Error("An order must contain at least one product.");
      error.status = 400;
      throw error;
    }

    const existingByProduct = new Map(
      existingItems.map((item) => [String(item.product_id), item]),
    );

    // Removed products: return their reserved quantity to stock and remove
    // the order line.
    for (const item of existingItems) {
      const productId = String(item.product_id);
      if (requested.has(productId)) continue;

      await adjustStock(client, item.product_id, -Number(item.quantity || 0));

      await client.query(`DELETE FROM enquiry_items WHERE id = $1`, [item.id]);
    }

    // Existing products: only the quantity delta changes stock.
    for (const [productId, nextQuantity] of requested.entries()) {
      const existing = existingByProduct.get(productId);

      if (!existing) continue;

      const oldQuantity = Number(existing.quantity || 0);
      const delta = nextQuantity - oldQuantity;

      if (delta) {
        await adjustStock(client, existing.product_id, delta);
      }

      await client.query(
        `
        UPDATE enquiry_items
        SET quantity = $1,
            total = ROUND(price * $1, 2),
            updated_at = NOW()
        WHERE id = $2
        `,
        [nextQuantity, existing.id],
      );
    }

    // New products: use the current product price/details and reserve stock.
    for (const [productId, quantity] of requested.entries()) {
      if (existingByProduct.has(productId)) continue;

      const product = await adjustStock(client, productId, quantity);
      const price = Number(product.amount ?? product.price ?? 0);
      const total = (price * quantity).toFixed(2);

      await insertItem(
        {
          enquiryId: id,
          productId: product.id,
          name: product.name,
          category: product.category,
          contents: product.contents,
          originalPrice: product.price,
          price,
          quantity,
          total,
          discountPercent: product.discount_percent ?? 0,
          brand: product.brand ?? null,
        },
        client,
      );

      const stockAfter =
        product.stock_quantity == null ? null : Number(product.stock_quantity);

      await insertSnapshot(
        {
          enquiryId: id,
          productId: product.id,
          productName: product.name,
          quantityOrdered: quantity,
          stockBefore: product.stock_quantity,
          stockAfter,
        },
        client,
      );
    }

    const totalsResult = await client.query(
      `
      SELECT COUNT(*)::int AS total_items,
             COALESCE(SUM(quantity), 0)::bigint AS total_quantity,
             COALESCE(SUM(total), 0)::numeric(30,2) AS total_amount
      FROM enquiry_items
      WHERE enquiry_id = $1
      `,
      [id],
    );

    const totals = totalsResult.rows[0];

    const currentOrderResult = await client.query(
      `SELECT discount_mode, discount_value FROM enquiries WHERE id = $1 FOR UPDATE`,
      [id],
    );
    const currentOrder = currentOrderResult.rows[0] || {};
    const gross = Number(totals.total_amount || 0);
    const discountMode =
      currentOrder.discount_mode === "value" ? "value" : "percent";
    const discountValue = Math.max(0, Number(currentOrder.discount_value || 0));
    const discountAmount =
      discountMode === "value"
        ? discountValue
        : (gross * Math.min(100, discountValue)) / 100;
    const finalAmount = gross - discountAmount;

    const updatedResult = await client.query(
      `
      UPDATE enquiries
      SET total_items = $1,
          total_quantity = $2,
          total_amount = $3,
          discount_percent = $4,
          discount_amount = $5,
          final_amount = $6,
          discount_mode = $7,
          discount_value = $8,
          updated_at = NOW()
      WHERE id = $9
      RETURNING ${ORDER_COLUMNS}
      `,
      [
        totals.total_items,
        totals.total_quantity,
        totals.total_amount,
        discountMode === "percent" ? Math.min(100, discountValue) : 0,
        discountAmount,
        finalAmount,
        discountMode,
        discountValue,
        id,
      ],
    );

    const updated = updatedResult.rows[0];

    await client.query("COMMIT");

    return {
      ...updated,
      items: await findItems(pool, id),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateOrderDetails(
  id,
  details = {},
  requestedItems = [],
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const orderResult = await client.query(
      `SELECT * FROM enquiries WHERE id = $1 FOR UPDATE`,
      [id],
    );

    const order = orderResult.rows[0];

    if (!order) {
      const error = new Error("Order not found");
      error.status = 404;
      throw error;
    }

    const customerName = String(
      details.partyName ?? details.customerName ?? order.customer_name ?? "",
    ).trim();

    const customerPhone = String(
      details.partyNumber ??
        details.customerPhone ??
        order.customer_phone ??
        "",
    ).trim();

    if (!customerName) {
      const error = new Error("Party Name is required.");
      error.status = 400;
      throw error;
    }

    if (!customerPhone) {
      const error = new Error("Party contact number is required.");
      error.status = 400;
      throw error;
    }

    const allowedStatuses = new Set([
      "order_received",
      "pending",
      "shipped",
      "delivered",
      "processing",
      "packaging",
      "cancelled",
    ]);

    const nextStatus = String(
      details.status ?? order.status ?? "order_received",
    )
      .trim()
      .toLowerCase();

    if (!allowedStatuses.has(nextStatus)) {
      const error = new Error("Unsupported order status.");
      error.status = 400;
      throw error;
    }

    const existingResult = await client.query(
      `
      SELECT id,
             product_id,
             quantity,
             original_price,
             price,
             discount_percent,
             discount_type,
             discount_value,
             discount_amount
      FROM enquiry_items
      WHERE enquiry_id = $1
      FOR UPDATE
      `,
      [id],
    );

    const existingItems = existingResult.rows;
    const requested = new Map();

    for (const item of requestedItems || []) {
      const productId = String(item?.productId ?? item?.id ?? "").trim();

      const quantity = Number(item?.quantity);

      // Quantity is intentionally unlimited. We only require a positive integer;
      // there is no stock_quantity or max_order_qty restriction here.
      if (!productId || !Number.isInteger(quantity) || quantity < 1) {
        const error = new Error(
          "Every selected product must have a quantity greater than zero.",
        );
        error.status = 400;
        throw error;
      }

      if (requested.has(productId)) {
        const error = new Error(`Duplicate product in order: ${productId}`);
        error.status = 400;
        throw error;
      }

      let originalPrice = Number(item?.originalPrice);
      if (!Number.isFinite(originalPrice) || originalPrice < 0) {
        originalPrice = 0;
      }

      let discountType = item?.discountType === "value" ? "value" : "percent";

      let discountValue = Number(item?.discountValue);
      if (!Number.isFinite(discountValue) || discountValue < 0) {
        discountValue = 0;
      }

      if (discountType === "percent") {
        discountValue = Math.min(100, discountValue);
      } else {
        discountValue = Math.min(originalPrice, discountValue);
      }

      const price =
        discountType === "value"
          ? Math.max(0, originalPrice - discountValue)
          : Math.max(
              0,
              originalPrice * (1 - Math.min(100, discountValue) / 100),
            );

      const discountAmount = Math.max(0, originalPrice - price);

      const discountPercent =
        originalPrice > 0 ? (discountAmount / originalPrice) * 100 : 0;

      requested.set(productId, {
        quantity,
        originalPrice,
        price,
        discountType,
        discountValue,
        discountAmount,
        discountPercent,
        brand:
          item?.brand !== undefined && item?.brand !== null
            ? String(item.brand).trim() || null
            : null,
      });
    }

    if (!requested.size) {
      const error = new Error("An order must contain at least one product.");
      error.status = 400;
      throw error;
    }

    const existingByProduct = new Map(
      existingItems.map((item) => [String(item.product_id), item]),
    );

    // Remove lines that were deselected.
    for (const existing of existingItems) {
      const productId = String(existing.product_id);

      if (requested.has(productId)) continue;

      await adjustStock(
        client,
        existing.product_id,
        -Number(existing.quantity || 0),
      );

      await client.query(`DELETE FROM enquiry_items WHERE id = $1`, [
        existing.id,
      ]);
    }

    // Update existing order lines, including the ORDER-SPECIFIC discount.
    // Never update the products table: catalog pricing/discount remains unchanged.
    for (const [productId, requestedItem] of requested.entries()) {
      const existing = existingByProduct.get(productId);

      if (!existing) continue;

      const oldQuantity = Number(existing.quantity || 0);
      const delta = requestedItem.quantity - oldQuantity;

      if (delta) {
        await adjustStock(client, existing.product_id, delta);
      }

      const lineTotal = (requestedItem.price * requestedItem.quantity).toFixed(
        2,
      );

      await client.query(
        `
        UPDATE enquiry_items
        SET original_price = $1,
            price = $2,
            quantity = $3,
            total = $4,
            discount_percent = $5,
            discount_type = $6,
            discount_value = $7,
            discount_amount = $8,
            brand = COALESCE($9, brand),
            updated_at = NOW()
        WHERE id = $10
        `,
        [
          requestedItem.originalPrice,
          requestedItem.price.toFixed(2),
          requestedItem.quantity,
          lineTotal,
          requestedItem.discountPercent.toFixed(2),
          requestedItem.discountType,
          requestedItem.discountValue.toFixed(2),
          requestedItem.discountAmount.toFixed(2),
          requestedItem.brand,
          existing.id,
        ],
      );
    }

    // Add newly selected products. New products start with their catalog
    // discount unless the frontend explicitly supplied an order discount.
    for (const [productId, requestedItem] of requested.entries()) {
      if (existingByProduct.has(productId)) continue;

      const product = await adjustStock(
        client,
        productId,
        requestedItem.quantity,
      );

      const catalogOriginalPrice = Number(product.price ?? 0);

      const hasExplicitDiscount =
        requestedItem.discountType || requestedItem.discountValue > 0;

      const originalPrice =
        Number.isFinite(catalogOriginalPrice) && catalogOriginalPrice >= 0
          ? catalogOriginalPrice
          : requestedItem.originalPrice;

      const discountType = hasExplicitDiscount
        ? requestedItem.discountType
        : "percent";

      const discountValue = hasExplicitDiscount
        ? requestedItem.discountValue
        : Math.max(0, Math.min(100, Number(product.discount_percent ?? 0)));

      const price =
        discountType === "value"
          ? Math.max(0, originalPrice - Math.min(originalPrice, discountValue))
          : Math.max(
              0,
              originalPrice * (1 - Math.min(100, discountValue) / 100),
            );

      const discountAmount = Math.max(0, originalPrice - price);

      const discountPercent =
        originalPrice > 0 ? (discountAmount / originalPrice) * 100 : 0;

      const total = (price * requestedItem.quantity).toFixed(2);

      await insertItem(
        {
          enquiryId: id,
          productId: product.id,
          name: product.name,
          category: product.category,
          contents: product.contents,
          originalPrice,
          price,
          quantity: requestedItem.quantity,
          total,
          discountPercent,
          discountType,
          discountValue,
          discountAmount,
          brand: requestedItem.brand ?? product.brand ?? null,
        },
        client,
      );

      await insertSnapshot(
        {
          enquiryId: id,
          productId: product.id,
          productName: product.name,
          quantityOrdered: requestedItem.quantity,
          stockBefore: product.stock_quantity,
          stockAfter:
            product.stock_quantity == null
              ? null
              : Number(product.stock_quantity),
        },
        client,
      );
    }

    const totalsResult = await client.query(
      `
      SELECT COUNT(*)::int AS total_items,
             COALESCE(SUM(quantity), 0)::bigint AS total_quantity,
             COALESCE(SUM(total), 0)::numeric(30,2) AS total_amount
      FROM enquiry_items
      WHERE enquiry_id = $1
      `,
      [id],
    );

    const totals = totalsResult.rows[0];

    const gross = Number(totals.total_amount || 0);
    const discountMode =
      details.discountMode === "value" || details.discount_mode === "value"
        ? "value"
        : (details.discountMode ||
              details.discount_mode ||
              order.discount_mode ||
              "percent") === "value"
          ? "value"
          : "percent";
    let discountValue = Number(
      details.discountValue ??
        details.discount_value ??
        (discountMode === "value"
          ? (order.discount_value ?? order.discount_amount)
          : order.discount_percent) ??
        0,
    );
    if (!Number.isFinite(discountValue) || discountValue < 0) discountValue = 0;
    if (discountMode === "percent")
      discountValue = Math.min(100, discountValue);
    const discountAmount =
      discountMode === "value" ? discountValue : (gross * discountValue) / 100;
    const finalAmount = gross - discountAmount;

    const updatedResult = await client.query(
      `
      UPDATE enquiries
      SET customer_name = $1, customer_phone = $2, customer_address = $3,
          party_sector = $4, party_country = $5, party_state = $6,
          party_district = $7, party_locality = $8, party_pincode = $9,
          brand_mode = $10, status = $11, total_items = $12, total_quantity = $13,
          total_amount = $14, discount_percent = $15, discount_amount = $16,
          final_amount = $17, discount_mode = $18, discount_value = $19,
          order_date = $20, updated_at = NOW()
      WHERE id = $21
      RETURNING ${ORDER_COLUMNS}
      `,
      [
        customerName,
        customerPhone,
        details.customerAddress ?? order.customer_address ?? null,
        details.partySector ?? order.party_sector ?? null,
        details.partyCountry || order.party_country || "India",
        details.partyState ?? order.party_state ?? null,
        details.partyDistrict ?? order.party_district ?? null,
        details.partyLocality ?? order.party_locality ?? null,
        details.partyPincode ?? order.party_pincode ?? null,
        details.brandMode || order.brand_mode || "multiBrand",
        nextStatus,
        totals.total_items,
        totals.total_quantity,
        totals.total_amount,
        discountMode === "percent" ? discountValue : 0,
        discountAmount,
        finalAmount,
        discountMode,
        discountValue,
        details.orderDate ?? order.order_date ?? null,
        id,
      ],
    );

    const updated = updatedResult.rows[0];

    await client.query("COMMIT");

    return {
      ...updated,
      items: await findItems(pool, id),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
