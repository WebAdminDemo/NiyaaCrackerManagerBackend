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
import { generateSku, uuid } from "../utils/reference.js";
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
  if (value === null || String(value ?? "").trim().toLowerCase() === "null") {
    return null;
  }

  return isBlank(value) ? "" : String(value).trim();
}

function jsonValue(value, fallback) {
  if (value === null) return null;

  if (value === undefined || isBlank(value)) {
    return jsonText(fallback, fallback);
  }

  return typeof value === "string"
    ? value
    : jsonText(value, fallback);
}

function calculateAmounts(priceValue, discountValue) {
  const price = nullableNumber(priceValue);

  // IMPORTANT:
  // Accept both discountPercent (new API) and discount_percent (old API).
  const discountPercent = isBlank(discountValue)
    ? 0
    : Number(discountValue);

  const safeDiscountPercent =
    Number.isFinite(discountPercent)
      ? Math.max(0, Math.min(100, discountPercent))
      : 0;

  if (price === null) {
    return {
      price: null,
      discountPercent: safeDiscountPercent,
      discountAmount: null,
      amount: null,
    };
  }

  const discountAmount = new Decimal(price)
    .mul(safeDiscountPercent)
    .div(100)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const amount = new Decimal(price)
    .minus(discountAmount)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return {
    price: money(price),
    discountPercent: safeDiscountPercent,
    discountAmount: money(discountAmount),
    amount: money(amount),
  };
}

function buildProduct(request, id, now) {
  const discountValue =
    request.discountPercent ??
    request.discount_percent ??
    0;

  const amounts = calculateAmounts(
    request.price,
    discountValue
  );

  return {
    id,

    sku:
      nullableText(request.sku) ||
      generateSku(request.name),

    category: nullableText(request.category),
    name: nullableText(request.name),
    contents: nullableText(request.contents),

    price: amounts.price,
    discountPercent: amounts.discountPercent,
    discountAmount: amounts.discountAmount,
    amount: amounts.amount,

    currency: nullableText(request.currency) || "INR",
    taxRate: nullableNumber(request.taxRate) ?? 0,

    image: nullableText(request.image),

    tags:
      request.tags === null
        ? null
        : jsonValue(request.tags, []),

    stockQuantity: nullableNumber(request.stockQuantity),
    minOrderQty: nullableNumber(request.minOrderQty) ?? 1,
    maxOrderQty: nullableNumber(request.maxOrderQty),

    status:
      nullableText(request.status) ||
      "in_stock",

    backorderAllowed:
      request.backorderAllowed ?? false,

    active:
      request.active ?? true,

    crmProductId:
      nullableText(request.crmProductId),

    lastUpdated:
      request.lastUpdated ?? now,

    source:
      nullableText(request.source) || "manual",

    descriptionVideo:
      nullableText(request.descriptionVideo),

    updatedAt:
      request.updatedAt ?? now,

    uiFlags:
      request.uiFlags === null
        ? null
        : jsonValue(request.uiFlags, {}),
  };
}

export async function getAllProducts(db) {
  return (await findAll(db)).map(productResponse);
}

export async function getProductById(db, id) {
  const row = await findById(db, id);

  if (!row) {
    throw notFound(
      `Product not found with id: ${id}`
    );
  }

  return productResponse(row);
}

export async function createProduct(db, request) {
  let id =
    String(request.rowid ?? "").trim() ||
    uuid();

  if (await exists(db, id)) {
    id = uuid();
  }

  const now = new Date();

  return productResponse(
    await insert(
      db,
      buildProduct(request, id, now)
    )
  );
}

export async function updateProduct(db, id, request) {
  const existing = await findById(db, id, true);

  if (!existing) {
    throw notFound(
      `Product not found with id: ${id}`
    );
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

  const priceInput =
    Object.prototype.hasOwnProperty.call(
      request,
      "price"
    )
      ? request.price
      : existing.price;

  const discountInput =
    Object.prototype.hasOwnProperty.call(
      request,
      "discountPercent"
    )
      ? request.discountPercent
      : Object.prototype.hasOwnProperty.call(
          request,
          "discount_percent"
        )
        ? request.discount_percent
        : existing.discount_percent;

  const amounts = calculateAmounts(
    priceInput,
    discountInput
  );

  const now = new Date();

  const updated = await update(db, id, {
    name:
      Object.prototype.hasOwnProperty.call(
        request,
        "name"
      )
        ? nullableText(request.name)
        : existing.name,

    category:
      Object.prototype.hasOwnProperty.call(
        request,
        "category"
      )
        ? nullableText(request.category)
        : existing.category,

    price: amounts.price,

    contents:
      Object.prototype.hasOwnProperty.call(
        request,
        "contents"
      )
        ? nullableText(request.contents)
        : existing.contents,

    image:
      Object.prototype.hasOwnProperty.call(
        request,
        "image"
      )
        ? nullableText(request.image)
        : existing.image,

    status:
      Object.prototype.hasOwnProperty.call(
        request,
        "status"
      )
        ? nullableText(request.status)
        : existing.status,

    discountPercent:
      amounts.discountPercent,

    discountAmount:
      amounts.discountAmount,

    amount:
      amounts.amount,

    lastUpdated: now,
    updatedAt: now,
  });

  return productResponse(updated);
}

export async function deleteProduct(db, id) {
  if (!(await exists(db, id))) {
    throw notFound(
      `Product not found with id: ${id}`
    );
  }

  await deleteById(db, id);
}

export async function updateProductStatus(
  db,
  id,
  status
) {
  if (
    !["in_stock", "no_stock"].includes(status)
  ) {
    throw new Error("Invalid status value");
  }

  const existing = await findById(db, id, true);

  if (!existing) {
    throw notFound(
      `Product not found with id: ${id}`
    );
  }

  return productResponse(
    await repoUpdateStatus(
      db,
      id,
      status,
      new Date()
    )
  );
}
