import Decimal from "decimal.js";
import { withTransaction, pool } from "../config/database.js";
import {
  findByRef,
  findById,
  findItems,
  insertOrder,
  insertItem,
  insertSnapshot,
  findAllWithItems,
} from "../repositories/enquiry.repository.js";
import { findById as findProduct } from "../repositories/product.repository.js";
import { generateOrderRef } from "../utils/reference.js";
import { badRequest, notFound } from "../utils/httpError.js";
import { parseUiFlags } from "../utils/json.js";

const VALID_STATUS = new Set([
  "order_received",
  "pending",
  "shipped",
  "delivered",
  "processing",
  "packaging",
  "cancelled",
]);

function amount(value) {
  return new Decimal(value ?? 0);
}

function formatOrder(order) {
  const items = (order.items || []).map((item) => ({
    id: item.id,
    productId: item.product_id || item.productId,
    name: item.name,
    category: item.category,
    contents: item.contents,
    originalPrice: item.original_price,
    price: item.price,
    quantity: item.quantity,
    total: item.total,
    discountType:
      item.discount_type === "value"
        ? "value"
        : "percent",
    discountValue:
      item.discount_value != null
        ? Number(item.discount_value)
        : Number(item.discount_percent ?? 0),
    discountPercent: Number(item.discount_percent ?? 0),
    discountAmount: Number(
      item.discount_amount ??
        Math.max(
          0,
          Number(item.original_price ?? 0) -
            Number(item.price ?? 0),
        ),
    ),
    stockQuantity:
      item.stock_quantity == null
        ? null
        : Number(item.stock_quantity),
    brands: Array.isArray(
      parseUiFlags(item.product_ui_flags).brands,
    )
      ? parseUiFlags(item.product_ui_flags).brands
      : [],
  }));

  return {
    id: order.id,
    ref: order.ref,
    customerName: order.customer_name,
    customerPhone: order.customer_phone,
    customerAddress: order.customer_address || null,
    partyName: order.customer_name,
    partyNumber: order.customer_phone,
    partyAddress: order.customer_address || null,
    partySector: order.party_sector || null,
    partyCountry: order.party_country || "India",
    partyState: order.party_state || null,
    partyDistrict: order.party_district || null,
    partyLocality: order.party_locality || null,
    partyPincode: order.party_pincode || null,
    brandMode: order.brand_mode || "multiBrand",
    channel: order.channel,
    status: order.status || "order_received",
    message: order.message,
    pdfLink: order.pdf_link,
    whatsappNumber: order.whatsapp_number,
    smsNumber: order.sms_number,
    totalAmount:
      order.total_amount ??
      items
        .reduce(
          (sum, item) => sum.plus(amount(item.total)),
          new Decimal(0),
        )
        .toFixed(2),
    totalItems: order.total_items ?? items.length,
    totalQuantity:
      order.total_quantity ??
      items.reduce(
        (sum, item) => sum + Number(item.quantity || 0),
        0,
      ),
    orderDate: order.order_date,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    items,
  };
}

export async function createOrder(request) {
  return withTransaction(async (client) => {
    const ref = request.ref?.trim() || generateOrderRef();
    const existing = await findByRef(ref, client);

    if (existing) {
      const items = await findItems(client, existing.id);
      return formatOrder({ ...existing, items });
    }

    const id = request.id?.trim() || ref;
    const now = new Date();
    const itemsInput = request.items || [];

    if (!itemsInput.length) {
      throw badRequest("At least one order item is required.");
    }

    let totalAmount = new Decimal(0);
    let totalQuantity = 0;
    const prepared = [];

    for (const item of itemsInput) {
      const product = await findProduct(
        client,
        item.productId,
        true,
      );

      if (!product) {
        throw notFound(
          `Product not found with id: ${item.productId}`,
        );
      }

      if (product.status !== "in_stock") {
        throw badRequest(
          `${product.name || item.productId} is out of stock`,
        );
      }

      const quantity = Number(item.quantity);

      if (!Number.isInteger(quantity) || quantity < 1) {
        throw badRequest(
          `Invalid quantity for ${product.name || item.productId}`,
        );
      }

      const min = product.min_order_qty ?? 1;
      const max = product.max_order_qty;

      if (quantity < min) {
        throw badRequest(
          `${product.name} minimum order quantity is ${min}`,
        );
      }

      if (max != null && quantity > max) {
        throw badRequest(
          `${product.name} maximum order quantity is ${max}`,
        );
      }

      if (
        product.stock_quantity != null &&
        quantity > product.stock_quantity &&
        !product.backorder_allowed
      ) {
        throw badRequest(
          `Insufficient stock for ${product.name}`,
        );
      }

      const stockBefore = product.stock_quantity;
      const stockAfter =
        stockBefore == null
          ? null
          : Number(stockBefore) - quantity;

      if (stockBefore != null) {
        await client.query(
          `
          UPDATE products
          SET stock_quantity = $1,
              updated_at = CURRENT_TIMESTAMP,
              last_updated = CURRENT_TIMESTAMP
          WHERE id = $2
          `,
          [stockAfter, product.id],
        );
      }

      const unitPrice = amount(product.amount);
      const lineTotal = unitPrice.mul(quantity);

      totalAmount = totalAmount.plus(lineTotal);
      totalQuantity += quantity;

      prepared.push({
        enquiryId: id,
        productId: product.id,
        name: product.name,
        category: product.category,
        contents: product.contents,
        originalPrice: product.price,
        price: product.amount,
        quantity,
        total: lineTotal.toFixed(2),
        discountType: "percent",
        discountValue: Number(product.discount_percent ?? 0),
        discountPercent: Number(product.discount_percent ?? 0),
        discountAmount: Math.max(
          0,
          Number(product.price ?? 0) - Number(product.amount ?? product.price ?? 0),
        ),
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
      customerAddress: request.customerAddress ?? null,
      partySector: request.partySector ?? null,
      partyCountry: request.partyCountry || "India",
      partyState: request.partyState ?? null,
      partyDistrict: request.partyDistrict ?? null,
      partyLocality: request.partyLocality ?? null,
      partyPincode: request.partyPincode ?? null,
      brandMode: request.brandMode || "multiBrand",
      channel: request.channel || "whatsapp",
      status: request.status || "order_received",
      message: request.message ?? null,
      pdfLink: request.pdfLink ?? null,
      whatsappNumber: request.whatsappNumber ?? null,
      smsNumber: request.smsNumber ?? null,
      totalAmount: totalAmount.toFixed(2),
      totalItems: prepared.length,
      totalQuantity,
      orderDate: request.orderDate || now,
      createdAt: now,
      updatedAt: now,
    });

    for (const item of prepared) {
      await insertItem(item, client);
      await insertSnapshot(
        {
          enquiryId: id,
          productId: item.productId,
          productName: item.name,
          quantityOrdered: item.quantity,
          stockBefore: item.stockBefore,
          stockAfter: item.stockAfter,
        },
        client,
      );
    }

    return formatOrder({
      ...order,
      items: prepared,
    });
  });
}

export async function getOrders() {
  return (await findAllWithItems(pool)).map(formatOrder);
}

export async function getOrderById(id) {
  const order = await findById(pool, id);

  if (!order) {
    throw notFound("Order not found");
  }

  const items = await findItems(pool, id);
  return formatOrder({ ...order, items });
}

export { formatOrder };

