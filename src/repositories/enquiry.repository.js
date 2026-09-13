import { pool } from "../config/database.js";
import { BRAND, BRAND_STATUS } from "../config/common.properties.js";

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
  ei.brand,
  ei.created_at,
  ei.updated_at,
  p.stock_quantity,
  p.ui_flags AS product_ui_flags,
  p.brand AS product_brand,
  p.brand_status AS product_brand_status
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
      brand
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
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
      item.brand || null,
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
              'originalPrice', i.original_price,
              'price', i.price,
              'quantity', i.quantity,
              'total', i.total,
              'brand', i.brand
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

function normalizeProductBrand(value) {
  const text = String(value ?? "")
    .trim()
    .toLowerCase();
  if ([BRAND.STANDARD.toLowerCase(), "standard fireworks"].includes(text))
    return BRAND.STANDARD;
  if (
    [BRAND.MULTIBRAND.toLowerCase(), "multi-brand", "multi brand"].includes(
      text,
    )
  )
    return BRAND.MULTIBRAND;
  return null;
}

function brandStatus(value) {
  const brand = normalizeProductBrand(value);
  if (brand === BRAND.STANDARD) return BRAND_STATUS.STANDARD;
  if (brand === BRAND.MULTIBRAND) return BRAND_STATUS.MULTIBRAND;
  return BRAND_STATUS.EMPTY;
}

async function adjustStock(client, productId, delta) {
  const result = await client.query(
    `
    SELECT id, name, category, contents, price, amount,
           discount_percent, status, stock_quantity,
           ui_flags, brand, brand_status
    FROM products
    WHERE id = $1
    FOR UPDATE
    `,
    [productId],
  );

  const product = result.rows[0];

  if (!product) {
    const error = new Error(`Product not found: ${productId}`);
    error.status = 404;
    throw error;
  }

  if (product.stock_quantity !== null && delta) {
    await client.query(
      `
      UPDATE products
      SET stock_quantity = stock_quantity - $1,
          last_updated = NOW(),
          updated_at = NOW()
      WHERE id = $2
      `,
      [delta, productId],
    );
  }

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
      SELECT id, product_id, quantity, price, brand
      FROM enquiry_items
      WHERE enquiry_id = $1
      FOR UPDATE
      `,
      [id],
    );

    const existingItems = existingResult.rows;
    const requested = new Map();
    const requestedBrands = new Map();

    for (const item of requestedItems) {
      const productId = String(item?.productId ?? item?.id ?? "").trim();
      const quantity = Number(item?.quantity);

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
      requestedBrands.set(productId, normalizeProductBrand(item?.brand));
    }

    if (!requested.size) {
      const error = new Error("An order must contain at least one product.");
      error.status = 400;
      throw error;
    }

    const existingByProduct = new Map(
      existingItems.map((item) => [String(item.product_id), item]),
    );

    for (const item of existingItems) {
      const productId = String(item.product_id);
      if (requested.has(productId)) continue;

      await adjustStock(client, item.product_id, -Number(item.quantity || 0));

      await client.query(`DELETE FROM enquiry_items WHERE id = $1`, [item.id]);
    }

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
            brand = $2,
            total = ROUND(price * $4::numeric, 2),
            updated_at = NOW()
        WHERE id = $3
        `,
        [
          nextQuantity,
          requestedBrands.has(productId)
            ? requestedBrands.get(productId)
            : normalizeProductBrand(existing.brand),
          existing.id,
          nextQuantity,
        ],
      );

      const nextBrand = requestedBrands.has(productId)
        ? requestedBrands.get(productId)
        : normalizeProductBrand(existing.brand);
      await client.query(
        `
        UPDATE products
        SET brand = $1,
            brand_status = $2,
            updated_at = NOW(),
            last_updated = NOW()
        WHERE id = $3
        `,
        [nextBrand, brandStatus(nextBrand), existing.product_id],
      );
    }

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
          brand: requestedBrands.has(productId)
            ? requestedBrands.get(productId)
            : normalizeProductBrand(product.brand),
        },
        client,
      );

      const selectedBrand = requestedBrands.has(productId)
        ? requestedBrands.get(productId)
        : normalizeProductBrand(product.brand);
      await client.query(
        `
        UPDATE products
        SET brand = $1,
            brand_status = $2,
            updated_at = NOW(),
            last_updated = NOW()
        WHERE id = $3
        `,
        [selectedBrand, brandStatus(selectedBrand), product.id],
      );

      const stockAfter =
        product.stock_quantity == null
          ? null
          : Number(product.stock_quantity) - quantity;

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
             COALESCE(SUM(quantity), 0)::int AS total_quantity,
             COALESCE(SUM(total), 0)::numeric(12,2) AS total_amount
      FROM enquiry_items
      WHERE enquiry_id = $1
      `,
      [id],
    );

    const totals = totalsResult.rows[0];

    const updatedResult = await client.query(
      `
      UPDATE enquiries
      SET total_items = $1,
          total_quantity = $2,
          total_amount = $3,
          updated_at = NOW()
      WHERE id = $4
      RETURNING ${ORDER_COLUMNS}
      `,
      [totals.total_items, totals.total_quantity, totals.total_amount, id],
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
      SELECT id, product_id, quantity, price, brand
      FROM enquiry_items
      WHERE enquiry_id = $1
      FOR UPDATE
      `,
      [id],
    );

    const existingItems = existingResult.rows;
    const requested = new Map();
    const requestedBrands = new Map();

    for (const item of requestedItems) {
      const productId = String(item?.productId ?? item?.id ?? "").trim();
      const quantity = Number(item?.quantity);

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
      requestedBrands.set(productId, normalizeProductBrand(item?.brand));
    }

    if (!requested.size) {
      const error = new Error("An order must contain at least one product.");
      error.status = 400;
      throw error;
    }

    const existingByProduct = new Map(
      existingItems.map((item) => [String(item.product_id), item]),
    );

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
            brand = $2,
            total = ROUND(price * $4::numeric, 2),
            updated_at = NOW()
        WHERE id = $3
        `,
        [
          nextQuantity,
          requestedBrands.has(productId)
            ? requestedBrands.get(productId)
            : normalizeProductBrand(existing.brand),
          existing.id,
          nextQuantity,
        ],
      );

      const nextBrand = requestedBrands.has(productId)
        ? requestedBrands.get(productId)
        : normalizeProductBrand(existing.brand);
      await client.query(
        `
        UPDATE products
        SET brand = $1,
            brand_status = $2,
            updated_at = NOW(),
            last_updated = NOW()
        WHERE id = $3
        `,
        [nextBrand, brandStatus(nextBrand), existing.product_id],
      );
    }

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
          brand: requestedBrands.has(productId)
            ? requestedBrands.get(productId)
            : normalizeProductBrand(product.brand),
        },
        client,
      );

      const selectedBrand = requestedBrands.has(productId)
        ? requestedBrands.get(productId)
        : normalizeProductBrand(product.brand);
      await client.query(
        `
        UPDATE products
        SET brand = $1,
            brand_status = $2,
            updated_at = NOW(),
            last_updated = NOW()
        WHERE id = $3
        `,
        [selectedBrand, brandStatus(selectedBrand), product.id],
      );

      await insertSnapshot(
        {
          enquiryId: id,
          productId: product.id,
          productName: product.name,
          quantityOrdered: quantity,
          stockBefore: product.stock_quantity,
          stockAfter:
            product.stock_quantity == null
              ? null
              : Number(product.stock_quantity) - quantity,
        },
        client,
      );
    }

    const totalsResult = await client.query(
      `
      SELECT COUNT(*)::int AS total_items,
             COALESCE(SUM(quantity), 0)::int AS total_quantity,
             COALESCE(SUM(total), 0)::numeric(12,2) AS total_amount
      FROM enquiry_items
      WHERE enquiry_id = $1
      `,
      [id],
    );

    const totals = totalsResult.rows[0];

    const updatedResult = await client.query(
      `
      UPDATE enquiries
      SET customer_name = $1,
          customer_phone = $2,
          customer_address = $3,
          party_sector = $4,
          party_country = $5,
          party_state = $6,
          party_district = $7,
          party_locality = $8,
          party_pincode = $9,
          brand_mode = $10,
          status = $11,
          total_items = $12,
          total_quantity = $13,
          total_amount = $14,
          order_date = $15,
          updated_at = NOW()
      WHERE id = $16
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
