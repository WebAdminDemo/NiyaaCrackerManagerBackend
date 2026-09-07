const cleanString = (value, fallback = null) => {
  if (value === undefined || value === null) return fallback;
  const text = String(value).trim();
  return text === "" ? fallback : text;
};

const nullableNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;

  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`Invalid numeric value: ${value}`);
  }

  return number;
};

const numberOrDefault = (value, fallback = 0) => {
  const number = nullableNumber(value);
  return number === null ? fallback : number;
};

const toBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "boolean") return value;

  const text = String(value).trim().toLowerCase();

  if (["true", "1", "yes", "y"].includes(text)) return true;
  if (["false", "0", "no", "n"].includes(text)) return false;

  return fallback;
};

const parseJson = (value, fallback) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    throw new Error("Invalid JSON value in Excel data.");
  }
};

function mapProduct(product, index) {
  const excelRow = index + 2;

  const id = cleanString(product.rowid ?? product.id);
  const name = cleanString(product.name);
  const category = cleanString(product.category);

  if (!id) {
    throw new Error(`Excel row ${excelRow}: rowid is required.`);
  }

  if (!name) {
    throw new Error(`Excel row ${excelRow}: name is required.`);
  }

  if (!category) {
    throw new Error(`Excel row ${excelRow}: category is required.`);
  }

  const discountPercent = numberOrDefault(
    product.discountPercent ?? product.discount_percent,
    0
  );

  if (discountPercent < 0 || discountPercent > 100) {
    throw new Error(
      `Excel row ${excelRow}: discountPercent must be between 0 and 100.`
    );
  }

  const status = cleanString(product.status, "in_stock").toLowerCase();

  if (!["in_stock", "no_stock"].includes(status)) {
    throw new Error(
      `Excel row ${excelRow}: status must be in_stock or no_stock.`
    );
  }

  return {
    id,
    sku: cleanString(product.sku),
    category,
    name,
    contents: cleanString(product.contents),
    price: numberOrDefault(product.price, 0),
    discount_percent: discountPercent,
    discount_amount: numberOrDefault(
      product.discountAmount ?? product.discount_amount,
      0
    ),
    amount: numberOrDefault(product.amount, 0),
    currency: cleanString(product.currency, "INR"),
    tax_rate: numberOrDefault(
      product.taxRate ?? product.tax_rate,
      0
    ),
    image: cleanString(product.image),
    tags: parseJson(product.tags, []),
    stock_quantity: nullableNumber(
      product.stockQuantity ?? product.stock_quantity
    ),
    min_order_qty: numberOrDefault(
      product.minOrderQty ?? product.min_order_qty,
      1
    ),
    max_order_qty: nullableNumber(
      product.maxOrderQty ?? product.max_order_qty
    ),
    status,
    backorder_allowed: toBoolean(
      product.backorderAllowed ?? product.backorder_allowed,
      false
    ),
    active: toBoolean(product.active, true),
    crm_product_id: cleanString(
      product.crmProductId ?? product.crm_product_id
    ),
    last_updated: cleanString(
      product.lastUpdated ?? product.last_updated
    ),
    source: cleanString(product.source, "manual"),
    description_video: cleanString(
      product.descriptionVideo ?? product.description_video
    ),
    updated_at: cleanString(
      product.updatedAt ?? product.updated_at
    ),
    ui_flags: parseJson(
      product.uiFlags,
      {
        featured: toBoolean(product.uiFlags_featured, false),
        hidden: toBoolean(product.uiFlags_hidden, false),
      }
    ),

    // Keep this if the Excel contains masterId/master_id.
    master_id: cleanString(product.masterId ?? product.master_id),
  };
}

function jsonForColumn(value, udtName) {
  if (udtName === "json" || udtName === "jsonb") {
    return JSON.stringify(value ?? {});
  }

  // PostgreSQL text[] / varchar[] columns.
  if (udtName === "_text" || udtName === "_varchar") {
    return Array.isArray(value) ? value : [];
  }

  return value;
}

function valueForColumn(row, column) {
  const name = column.column_name;
  const type = column.udt_name;

  switch (name) {
    case "id":
      return row.id;

    case "master_id":
      return row.master_id;

    case "sku":
      return row.sku;

    case "category":
      return row.category;

    case "name":
      return row.name;

    case "contents":
      return row.contents;

    case "price":
      return row.price;

    case "discount_percent":
      return row.discount_percent;

    case "discount_amount":
      return row.discount_amount;

    case "amount":
      return row.amount;

    case "currency":
      return row.currency;

    case "tax_rate":
      return row.tax_rate;

    case "image":
      return row.image;

    case "tags":
      return jsonForColumn(row.tags, type);

    case "stock_quantity":
      return row.stock_quantity;

    case "min_order_qty":
      return row.min_order_qty;

    case "max_order_qty":
      return row.max_order_qty;

    case "status":
      return row.status;

    case "backorder_allowed":
      return row.backorder_allowed;

    case "active":
      return row.active;

    case "crm_product_id":
      return row.crm_product_id;

    case "last_updated":
      return row.last_updated;

    case "source":
      return row.source;

    case "description_video":
      return row.description_video;

    case "updated_at":
      return row.updated_at;

    case "ui_flags":
      return jsonForColumn(row.ui_flags, type);

    default:
      return undefined;
  }
}

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

export async function replaceAllProducts(pool, products) {
  if (!Array.isArray(products)) {
    const error = new Error("Request body must be an array of products.");
    error.status = 400;
    throw error;
  }

  if (products.length === 0) {
    const error = new Error("Excel file contains no products.");
    error.status = 400;
    throw error;
  }

  const rows = products.map(mapProduct);

  // Validate duplicate rowid before opening the transaction.
  const rowids = new Set();

  for (const row of rows) {
    if (rowids.has(row.id)) {
      const error = new Error(
        `Duplicate rowid "${row.id}" found in Excel.`
      );
      error.status = 400;
      throw error;
    }

    rowids.add(row.id);
  }

  const client = await pool.connect();

  try {
    /*
     * Read the ACTUAL database schema instead of assuming that
     * tags/ui_flags are JSONB or that master_id has a particular type.
     */
    const schemaResult = await client.query(`
      SELECT
        column_name,
        data_type,
        udt_name,
        is_nullable,
        column_default,
        ordinal_position
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'products'
      ORDER BY ordinal_position
    `);

    if (!schemaResult.rows.length) {
      const error = new Error(
        'Database table "products" was not found.'
      );
      error.status = 500;
      throw error;
    }

    const columns = schemaResult.rows;

    const supportedColumns = columns.filter((column) =>
      [
        "id",
        "master_id",
        "sku",
        "category",
        "name",
        "contents",
        "price",
        "discount_percent",
        "discount_amount",
        "amount",
        "currency",
        "tax_rate",
        "image",
        "tags",
        "stock_quantity",
        "min_order_qty",
        "max_order_qty",
        "status",
        "backorder_allowed",
        "active",
        "crm_product_id",
        "last_updated",
        "source",
        "description_video",
        "updated_at",
        "ui_flags",
      ].includes(column.column_name)
    );

    /*
     * Any NOT NULL column without a default must be supplied.
     * master_id is accepted when it exists in the Excel file.
     */
    const missingRequiredColumns = columns
      .filter(
        (column) =>
          column.is_nullable === "NO" &&
          !column.column_default &&
          ![
            "id",
            "sku",
            "category",
            "name",
            "contents",
            "price",
            "discount_percent",
            "discount_amount",
            "amount",
            "currency",
            "tax_rate",
            "image",
            "tags",
            "stock_quantity",
            "min_order_qty",
            "max_order_qty",
            "status",
            "backorder_allowed",
            "active",
            "crm_product_id",
            "last_updated",
            "source",
            "description_video",
            "updated_at",
            "ui_flags",
            "master_id",
          ].includes(column.column_name)
      );

    if (missingRequiredColumns.length) {
      const error = new Error(
        `Import cannot continue. Required database column(s) without a default: ${missingRequiredColumns
          .map((c) => c.column_name)
          .join(", ")}`
      );
      error.status = 400;
      throw error;
    }

    const requiredMasterId = columns.find(
      (column) =>
        column.column_name === "master_id" &&
        column.is_nullable === "NO" &&
        !column.column_default
    );

    if (requiredMasterId && rows.some((row) => !row.master_id)) {
      const error = new Error(
        'Database requires "master_id", but the Excel file does not contain masterId/master_id.'
      );
      error.status = 400;
      throw error;
    }

    /*
     * Insert only columns that actually exist in the user's database.
     * This prevents failures when the schema has optional columns or
     * different versions of the products table.
     */
    const insertColumns = supportedColumns.filter((column) => {
      if (column.column_name === "master_id") {
        return Boolean(column.column_default) || rows.some((r) => r.master_id);
      }

      return true;
    });

    const columnNames = insertColumns.map((c) =>
      quoteIdentifier(c.column_name)
    );

    await client.query("BEGIN");

    // Excel is the complete catalog.
    await client.query("DELETE FROM products");

    const placeholders = insertColumns.map(
      (_, index) => `$${index + 1}`
    );

    const insertSql = `
      INSERT INTO products (${columnNames.join(", ")})
      VALUES (${placeholders.join(", ")})
    `;

    for (const row of rows) {
      const values = insertColumns.map((column) =>
        valueForColumn(row, column)
      );

      await client.query(insertSql, values);
    }

    /*
     * Return the same camelCase shape expected by the React product manager.
     */
    const result = await client.query(`
      SELECT
        id AS rowid,
        sku,
        category,
        name,
        contents,
        price,
        discount_percent AS "discountPercent",
        discount_amount AS "discountAmount",
        amount,
        currency,
        tax_rate AS "taxRate",
        image,
        tags,
        stock_quantity AS "stockQuantity",
        min_order_qty AS "minOrderQty",
        max_order_qty AS "maxOrderQty",
        status,
        backorder_allowed AS "backorderAllowed",
        active,
        crm_product_id AS "crmProductId",
        last_updated AS "lastUpdated",
        source,
        description_video AS "descriptionVideo",
        updated_at AS "updatedAt",
        ui_flags AS "uiFlags"
      FROM products
      ORDER BY name ASC
    `);

    await client.query("COMMIT");

    return result.rows;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Ignore rollback errors; preserve the original database error.
    }

    console.error("replaceAllProducts database error:", error);
    throw error;
  } finally {
    client.release();
  }
}
