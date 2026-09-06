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

function money(v) {
  return new Decimal(v ?? 0).toFixed(2);
}

export async function getAllProducts(db) {
  return (await findAll(db)).map(productResponse);
}
export async function getProduct(db, id) {
  const row = await findById(db, id);
  if (!row) throw notFound(`Product not found with id: ${id}`);
  return productResponse(row);
}
function buildProduct(request, id, now) {
  const discountPercent = Number(request.discountPercent ?? 0);
  const price = new Decimal(request.price);
  const discountAmount = price
    .mul(discountPercent)
    .div(100)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return {
    id,
    sku: generateSku(request.name),
    category: request.category,
    name: request.name,
    contents: request.contents ?? "",
    price: money(price),
    discountPercent,
    discountAmount: money(discountAmount),
    amount: money(price.minus(discountAmount)),
    currency: "INR",
    taxRate: 0,
    image: request.image ?? "",
    tags: jsonText([], []),
    stockQuantity: 0,
    minOrderQty: 1,
    maxOrderQty: null,
    status: request.status,
    backorderAllowed: false,
    active: true,
    crmProductId: null,
    lastUpdated: now,
    source: "manual",
    descriptionVideo: "",
    updatedAt: now,
    uiFlags: jsonText({}, {}),
  };
}
export async function createProduct(db, request) {
  let id = request.rowid?.trim() || uuid();
  if (await exists(db, id)) id = uuid();
  const now = new Date();
  return productResponse(await insert(db, buildProduct(request, id, now)));
}
export async function updateProduct(db, id, request) {
  const existing = await findById(db, id);
  if (!existing) throw notFound(`Product not found with id: ${id}`);
  const discountPercent = Number(request.discountPercent ?? 0);
  const price = new Decimal(request.price);
  const discountAmount = price
    .mul(discountPercent)
    .div(100)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const now = new Date();
  return productResponse(
    await update(db, id, {
      name: request.name,
      category: request.category,
      price: money(price),
      contents: request.contents ?? "",
      image: request.image ?? "",
      status: request.status,
      discountPercent,
      discountAmount: money(discountAmount),
      amount: money(price.minus(discountAmount)),
      lastUpdated: now,
      updatedAt: now,
    }),
  );
}
export async function deleteProduct(db, id) {
  if (!(await exists(db, id)))
    throw notFound(`Product not found with id: ${id}`);
  await deleteById(db, id);
}
export async function updateProductStatus(db, id, status) {
  if (!["in_stock", "no_stock"].includes(status))
    throw new Error("Invalid status value");
  const existing = await findById(db, id);
  if (!existing) throw notFound(`Product not found with id: ${id}`);
  const now = new Date();
  const contents = status === "no_stock" ? "" : existing.contents;
  return productResponse(await repoUpdateStatus(db, id, status, contents, now));
}
