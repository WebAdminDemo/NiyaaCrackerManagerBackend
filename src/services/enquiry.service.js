import Decimal from "decimal.js";
import { withTransaction } from "../config/database.js";
import {
  findByRef,
  findById,
  findItems,
  insertOrder,
  insertItem,
  insertSnapshot,
} from "../repositories/enquiry.repository.js";
import { findById as findProduct } from "../repositories/product.repository.js";
import { generateOrderRef, uuid } from "../utils/reference.js";
import { badRequest, notFound } from "../utils/httpError.js";

const VALID_STATUS = new Set([
  "pending",
  "processing",
  "packaging",
  "shipped",
  "delivered",
  "cancelled",
]);

function amount(v) {
  return new Decimal(v ?? 0);
}

export async function createOrder(request) {
  return withTransaction(async (client) => {
    const ref = request.ref?.trim() || generateOrderRef();
    const existing = await findByRef(client, ref);
    if (existing) {
      const items = await findItems(client, existing.id);
      return formatOrder({ ...existing, items });
    }

    const id = request.id?.trim() || ref;
    const now = new Date();
    const itemsInput = request.items || [];
    let totalAmount = new Decimal(0);
    let totalQuantity = 0;
    const prepared = [];

    for (const item of itemsInput) {
      const product = await findProduct(client, item.productId, true);
      if (!product)
        throw notFound(`Product not found with id: ${item.productId}`);
      if (product.status !== "in_stock")
        throw badRequest(`${product.name || item.productId} is out of stock`);

      const qty = Number(item.quantity);
      if (!Number.isInteger(qty) || qty <= 0)
        throw badRequest(
          `Invalid quantity for ${product.name || item.productId}`,
        );
      const min = product.min_order_qty ?? 1;
      const max = product.max_order_qty;
      if (qty < min)
        throw badRequest(`${product.name} minimum order quantity is ${min}`);
      if (max != null && qty > max)
        throw badRequest(`${product.name} maximum order quantity is ${max}`);

      if (
        product.stock_quantity != null &&
        qty > product.stock_quantity &&
        !product.backorder_allowed
      ) {
        throw badRequest(`Insufficient stock for ${product.name}`);
      }

      const stockBefore = product.stock_quantity;
      const stockAfter = stockBefore == null ? null : stockBefore - qty;
      if (stockBefore != null) {
        await client.query(
          `UPDATE products SET stock_quantity=$1, updated_at=CURRENT_TIMESTAMP, last_updated=CURRENT_TIMESTAMP WHERE id=$2`,
          [stockAfter, product.id],
        );
      }

      const unitPrice = amount(product.amount);
      const lineTotal = unitPrice.mul(qty);
      totalAmount = totalAmount.plus(lineTotal);
      totalQuantity += qty;

      prepared.push({
        enquiryId: id,
        productId: product.id,
        name: product.name,
        category: product.category,
        contents: product.contents,
        originalPrice: product.price,
        price: product.amount,
        quantity: qty,
        total: lineTotal.toFixed(2),
        discountPercent: product.discount_percent ?? 0,
        createdAt: now,
        stockBefore,
        stockAfter,
      });
    }

    const order = await insertOrder(client, {
      id,
      ref,
      customerName: request.customerName,
      customerPhone: request.customerPhone,
      channel: request.channel || "whatsapp",
      status: request.status || "pending",
      message: request.message ?? null,
      pdfLink: request.pdfLink ?? null,
      whatsappNumber: request.whatsappNumber ?? null,
      smsNumber: request.smsNumber ?? null,
      totalAmount: totalAmount.toFixed(2),
      totalItems: prepared.length,
      totalQuantity,
      orderDate: request.orderDate || now,
      createdAt: now,
    });

    for (const item of prepared) {
      await insertItem(client, item);
      await insertSnapshot(client, {
        enquiryId: id,
        productId: item.productId,
        productName: item.name,
        quantityOrdered: item.quantity,
        stockBefore: item.stockBefore,
        stockAfter: item.stockAfter,
      });
    }

    return formatOrder({ ...order, items: prepared });
  });
}

export async function getOrders() {
  const { findAllWithItems } =
    await import("../repositories/enquiry.repository.js");
  const { pool } = await import("../config/database.js");
  return (await findAllWithItems(pool)).map(formatOrder);
}
function formatOrder(o) {
  const items = (o.items || []).map((i) => ({
    id: i.id,
    productId: i.product_id,
    name: i.name,
    category: i.category,
    contents: i.contents,
    originalPrice: i.original_price,
    price: i.price,
    quantity: i.quantity,
    total: i.total,
    discountPercent: i.discount_percent,
  }));
  return {
    id: o.id,
    ref: o.ref,
    customerName: o.customer_name,
    customerPhone: o.customer_phone,
    channel: o.channel,
    status: o.status || "pending",
    message: o.message,
    pdfLink: o.pdf_link,
    whatsappNumber: o.whatsapp_number,
    smsNumber: o.sms_number,
    totalAmount:
      o.total_amount ??
      items
        .reduce((s, i) => s.plus(amount(i.total)), new Decimal(0))
        .toFixed(2),
    totalItems: o.total_items ?? items.length,
    totalQuantity: o.total_quantity,
    orderDate: o.order_date,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
    items,
  };
}
