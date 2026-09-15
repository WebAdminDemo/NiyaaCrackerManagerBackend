import Decimal from "decimal.js";

import {
  findAll,
  findById,
  exists,
  insert,
  update,
  updateStatus as repoUpdateStatus,
  deleteById,
} from "../repositories/product.repository.js";

import { productResponse } from "../utils/product.mapper.js";
import { generateSku } from "../utils/reference.js";
import { notFound } from "../utils/httpError.js";
import { jsonText } from "../utils/json.js";

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

function money(value) {
  if (isBlank(value)) return null;

  const number = Number(value);
  if (!Number.isFinite(number)) return null;

  return new Decimal(number).toFixed(2);
}

function nullableNumber(value) {
  if (isBlank(value)) return null;

  const number = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
}

function nullableText(value) {
  if (
    value === null ||
    String(value ?? "")
      .trim()
      .toLowerCase() === "null"
  ) {
    return null;
  }

  return isBlank(value) ? "" : String(value).trim();
}

function jsonValue(value, fallback) {
  if (value === null) return null;

  if (value === undefined || isBlank(value)) {
    return jsonText(fallback, fallback);
  }

  return typeof value === "string" ? value : jsonText(value, fallback);
}

function calculateAmounts(priceValue, discountValue, discountMode = "percent") {
  const price = nullableNumber(priceValue);
  const mode =
    String(discountMode ?? "percent")
      .trim()
      .toLowerCase() === "value"
      ? "value"
      : "percent";

  let value = isBlank(discountValue) ? 0 : Number(discountValue);
  if (!Number.isFinite(value) || value < 0) value = 0;

  // 100 is a limit ONLY for percentage discounts.
  // Fixed-value discounts can be greater than 100.
  if (mode === "percent") {
    value = Math.min(100, value);
  }

  if (price === null) {
    return {
      price: null,
      discountMode: mode,
      discountValue: value,
      discountPercent: mode === "percent" ? value : 0,
      discountAmount: null,
      amount: null,
    };
  }

  const original = new Decimal(price);
  let discountAmount;

  if (mode === "value") {
    // Do not use Decimal.min(); this also fixes the reported
    // "(intermediate value).min is not a function" error.
    const fixedDiscount = new Decimal(value);
    discountAmount = fixedDiscount.gt(original) ? original : fixedDiscount;
  } else {
    discountAmount = original.mul(value).div(100);
  }

  discountAmount = discountAmount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const amount = original
    .minus(discountAmount)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return {
    price: money(price),
    discountMode: mode,
    discountValue: value,
    discountPercent: mode === "percent" ? value : 0,
    discountAmount: money(discountAmount),
    amount: money(amount),
  };
}

function buildProduct(request, id, now) {
  const discountMode =
    String(request.discountMode ?? request.discount_mode ?? "percent")
      .trim()
      .toLowerCase() === "value"
      ? "value"
      : "percent";

  const discountValue =
    request.discountValue ??
    request.discount_value ??
    (discountMode === "value"
      ? (request.discountAmount ?? request.discount_amount ?? 0)
      : (request.discountPercent ?? request.discount_percent ?? 0));

  const amounts = calculateAmounts(request.price, discountValue, discountMode);

  return {
    id,

    sku: nullableText(request.sku) || generateSku(request.name),

    category: nullableText(request.category),
    name: nullableText(request.name),
    contents: nullableText(request.contents),

    price: amounts.price,
    discountMode: amounts.discountMode,
    discountValue: amounts.discountValue,
    discountPercent: amounts.discountPercent,
    discountAmount: amounts.discountAmount,
    amount: amounts.amount,

    currency: nullableText(request.currency) || "INR",
    taxRate: nullableNumber(request.taxRate) ?? 0,

    image: nullableText(request.image),

    tags: request.tags === null ? null : jsonValue(request.tags, []),

    stockQuantity: nullableNumber(request.stockQuantity),
    minOrderQty: nullableNumber(request.minOrderQty) ?? 1,
    maxOrderQty: nullableNumber(request.maxOrderQty),

    status: nullableText(request.status) || "in_stock",

    backorderAllowed: request.backorderAllowed ?? false,

    active: request.active ?? true,

    crmProductId: nullableText(request.crmProductId),

    lastUpdated: request.lastUpdated ?? now,

    source: nullableText(request.source) || "manual",

    descriptionVideo: nullableText(request.descriptionVideo),

    updatedAt: request.updatedAt ?? now,

    uiFlags: request.uiFlags === null ? null : jsonValue(request.uiFlags, {}),
  };
}

export async function getAllProducts(db) {
  return (await findAll(db)).map(productResponse);
}

export async function getProductById(db, id) {
  const row = await findById(db, id);

  if (!row) {
    throw notFound(`Product not found with id: ${id}`);
  }

  return productResponse(row);
}

async function getNextProductId(db) {
  // MAX(CAST(...)) supports existing numeric IDs stored as text/varchar.
  // The returned value is converted back to the existing DB column type
  // by PostgreSQL when it is inserted into products.id.
  const { rows } = await db.query(`
    SELECT COALESCE(
      MAX(
        CASE
          WHEN TRIM(id::text) ~ '^[0-9]+$'
          THEN TRIM(id::text)::numeric
          ELSE 0
        END
      ),
      0
    ) + 1 AS next_id
    FROM products
  `);

  return String(rows[0]?.next_id ?? 1);
}

export async function createProduct(db, request) {
  // NEW products always receive the next sequential numeric ID.
  // EDIT requests do not come through this method; updateProduct()
  // continues to use the existing product ID unchanged.
  const id = await getNextProductId(db);

  const now = new Date();

  return productResponse(await insert(db, buildProduct(request, id, now)));
}

export async function updateProduct(db, id, request) {
  const existing = await findById(db, id, true);

  if (!existing) {
    throw notFound(`Product not found with id: ${id}`);
  }

  /*
   * Missing field:
   *   keep the existing database value.
   *
   * Explicit null:
   *   store NULL where the database column allows it.
   *
   * Empty string:
   *   store an empty string for text fields.
   *
   * Discount:
   *   accept BOTH discountPercent and discount_percent.
   *   Recalculate discountAmount and amount from the ORIGINAL price.
   */

  const priceInput = Object.prototype.hasOwnProperty.call(request, "price")
    ? request.price
    : existing.price;

  const discountMode =
    String(
      request.discountMode ??
        request.discount_mode ??
        existing.discount_mode ??
        "percent",
    )
      .trim()
      .toLowerCase() === "value"
      ? "value"
      : "percent";

  const hasDiscountValue =
    Object.prototype.hasOwnProperty.call(request, "discountValue") ||
    Object.prototype.hasOwnProperty.call(request, "discount_value");

  const hasDiscountPercent =
    Object.prototype.hasOwnProperty.call(request, "discountPercent") ||
    Object.prototype.hasOwnProperty.call(request, "discount_percent");

  const discountInput = hasDiscountValue
    ? (request.discountValue ?? request.discount_value)
    : hasDiscountPercent
      ? (request.discountPercent ?? request.discount_percent)
      : discountMode === "value"
        ? existing.discount_amount
        : existing.discount_percent;

  const amounts = calculateAmounts(priceInput, discountInput, discountMode);

  const now = new Date();

  const updated = await update(db, id, {
    name: Object.prototype.hasOwnProperty.call(request, "name")
      ? nullableText(request.name)
      : existing.name,

    category: Object.prototype.hasOwnProperty.call(request, "category")
      ? nullableText(request.category)
      : existing.category,

    price: amounts.price,

    contents: Object.prototype.hasOwnProperty.call(request, "contents")
      ? nullableText(request.contents)
      : existing.contents,

    image: Object.prototype.hasOwnProperty.call(request, "image")
      ? nullableText(request.image)
      : existing.image,

    status: Object.prototype.hasOwnProperty.call(request, "status")
      ? nullableText(request.status)
      : existing.status,

    discountPercent: amounts.discountPercent,

    discountAmount: amounts.discountAmount,

    amount: amounts.amount,

    lastUpdated: now,
    updatedAt: now,
  });

  return productResponse(updated);
}

export async function deleteProduct(db, id) {
  if (!(await exists(db, id))) {
    throw notFound(`Product not found with id: ${id}`);
  }

  await deleteById(db, id);
}

export async function updateProductStatus(db, id, status) {
  if (!["in_stock", "no_stock"].includes(status)) {
    throw new Error("Invalid status value");
  }

  const existing = await findById(db, id, true);

  if (!existing) {
    throw notFound(`Product not found with id: ${id}`);
  }

  return productResponse(await repoUpdateStatus(db, id, status, new Date()));
}
