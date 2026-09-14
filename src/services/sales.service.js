import Decimal from "decimal.js";

import { pool } from "../config/database.js";

import {
  findAllWithItems,
  findItems,
  topCustomers,
  updateStatus as updateOrderStatus,
  updateOrderItems,
  updateOrderDetails,
} from "../repositories/enquiry.repository.js";

import { notFound } from "../utils/httpError.js";

const VALID_STATUSES = [
  "order_received",
  "pending",
  "shipped",
  "delivered",
  "processing",
  "packaging",
  "cancelled",
];

function hasText(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function normalize(value, fallback = "") {
  return hasText(value)
    ? String(value).trim().toLowerCase()
    : fallback;
}

function money(value) {
  return new Decimal(value ?? 0);
}

function toDateOnly(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }

    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  const text = String(value).trim();

  if (!text) {
    return null;
  }

  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  const parsed = new Date(text);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function orderDate(order) {
  return order.order_date || order.created_at;
}

function matchesMonth(order, month) {
  if (!hasText(month)) {
    return true;
  }

  const normalizedMonth = String(month).trim();

  if (!/^\d{4}-\d{2}$/.test(normalizedMonth)) {
    return false;
  }

  const date = toDateOnly(orderDate(order));

  if (!date) {
    return false;
  }

  return date.startsWith(`${normalizedMonth}-`);
}

function matchesDate(order, from, to) {
  if (!from && !to) {
    return true;
  }

  const date = toDateOnly(orderDate(order));

  if (!date) {
    return false;
  }

  const fromDate = hasText(from)
    ? String(from).trim()
    : null;

  const toDate = hasText(to)
    ? String(to).trim()
    : null;

  if (fromDate && date < fromDate) {
    return false;
  }

  if (toDate && date > toDate) {
    return false;
  }

  return true;
}

function matches(order, status, category, channel, brand, search) {
  if (
    status &&
    normalize(order.status) !== normalize(status)
  ) {
    return false;
  }

  if (
    channel &&
    normalize(order.channel) !== normalize(channel)
  ) {
    return false;
  }

  if (
    category &&
    !(order.items || []).some(
      (item) =>
        normalize(item.category) === normalize(category),
    )
  ) {
    return false;
  }

  if (
    brand &&
    !(order.items || []).some(
      (item) =>
        normalize(item.brand || item.product_brand) ===
        normalize(brand),
    )
  ) {
    return false;
  }

  if (hasText(search)) {
    const needle = String(search).trim().toLowerCase();

    const found = [
      order.ref,
      order.id,
      order.customer_name,
      order.customer_phone,
      order.party_sector,
      order.party_state,
      order.party_district,
      order.party_locality,
      ...(order.items || []).flatMap((item) => [
        item.name,
        item.category,
        item.brand,
        item.product_brand,
      ]),
    ].some(
      (value) =>
        value !== null &&
        value !== undefined &&
        String(value).toLowerCase().includes(needle),
    );

    if (!found) {
      return false;
    }
  }

  return true;
}

async function filtered({
  from,
  to,
  month,
  status,
  category,
  channel,
  brand,
  search,
} = {}) {
  const orders = await findAllWithItems(pool);

  return orders.filter((order) => {
    const dateMatches = hasText(month)
      ? matchesMonth(order, month)
      : matchesDate(order, from, to);

    return (
      dateMatches &&
      matches(
        order,
        status,
        category,
        channel,
        brand,
        search,
      )
    );
  });
}

function mapOrder(order) {
  const items = (order.items || []).map((item) => {
    return {
      id: item.id,

      productId: item.product_id,

      name: item.name,

      category: item.category,

      contents: item.contents,

      originalPrice: item.original_price,

      price: item.price,

      quantity: item.quantity,

      total:
        item.total ??
        money(item.price)
          .mul(item.quantity || 0)
          .toFixed(2),

      discountType:
        item.discount_type === "value"
          ? "value"
          : "percent",

      discountValue:
        item.discount_value !== null &&
        item.discount_value !== undefined
          ? Number(item.discount_value)
          : item.discount_type === "value"
            ? Number(item.discount_amount ?? 0)
            : Number(item.discount_percent ?? 0),

      discountPercent:
        item.discount_percent !== null &&
        item.discount_percent !== undefined
          ? Number(item.discount_percent)
          : 0,

      discountAmount:
        item.discount_amount !== null &&
        item.discount_amount !== undefined
          ? Number(item.discount_amount)
          : Math.max(
              0,
              Number(item.original_price ?? 0) -
                Number(item.price ?? 0),
            ),

      brand: item.brand || item.product_brand || null,

      brandStatus:
        item.product_brand_status === null ||
        item.product_brand_status === undefined
          ? null
          : item.product_brand_status === true ||
            item.product_brand_status === 1 ||
            String(item.product_brand_status).trim() === "1",

      stockQuantity:
        item.stock_quantity == null
          ? null
          : Number(item.stock_quantity),
    };
  });

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

    partyCountry: order.party_country || null,

    partyState: order.party_state || null,

    partyDistrict: order.party_district || null,

    partyLocality: order.party_locality || null,

    partyPincode: order.party_pincode || null,

    brandMode: order.brand_mode || "multiBrand",

    channel: order.channel,

    status: normalize(order.status, "order_received"),

    message: order.message,

    pdfLink: order.pdf_link,

    whatsappNumber: order.whatsapp_number,

    smsNumber: order.sms_number,

    totalAmount:
      order.total_amount ??
      items
        .reduce(
          (sum, item) => sum.plus(money(item.total)),
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

export async function findOrders(filters = {}) {
  return (await filtered(filters)).map(mapOrder);
}

export async function getAnalytics(filters = {}) {
  const orders = await filtered(filters);

  const totalRevenue = orders.reduce(
    (sum, order) =>
      sum.plus(order.total_amount || 0),
    new Decimal(0),
  );

  const totalItems = orders.reduce(
    (sum, order) =>
      sum + (order.items || []).length,
    0,
  );

  const totalQuantity = orders.reduce(
    (sum, order) =>
      sum +
      (order.items || []).reduce(
        (quantity, item) =>
          quantity + Number(item.quantity || 0),
        0,
      ),
    0,
  );

  const totalCustomers = new Set(
    orders
      .map((order) => order.customer_phone)
      .filter(hasText),
  ).size;

  const statusCounts = Object.fromEntries(
    VALID_STATUSES.map((status) => [status, 0]),
  );

  const categoryRevenue = {};
  const daily = {};
  const channelDistribution = {};
  const productRevenue = {};
  const productQuantity = {};

  for (const order of orders) {
    const status = normalize(
      order.status,
      "order_received",
    );

    statusCounts[status] =
      (statusCounts[status] || 0) + 1;

    if (hasText(order.channel)) {
      channelDistribution[order.channel] =
        (channelDistribution[order.channel] || 0) + 1;
    }

    const day = toDateOnly(orderDate(order));

    if (day) {
      if (!daily[day]) {
        daily[day] = {
          revenue: new Decimal(0),
          orders: 0,
        };
      }

      daily[day].revenue = daily[day].revenue.plus(
        order.total_amount || 0,
      );

      daily[day].orders += 1;
    }

    for (const item of order.items || []) {
      const category = hasText(item.category)
        ? item.category
        : "Uncategorised";

      const lineTotal =
        item.total ??
        money(item.price).mul(item.quantity || 0);

      categoryRevenue[category] = money(
        categoryRevenue[category],
      )
        .plus(lineTotal)
        .toFixed(2);

      const productName =
        item.name || "Unknown Product";

      productRevenue[productName] = money(
        productRevenue[productName],
      )
        .plus(lineTotal)
        .toFixed(2);

      productQuantity[productName] =
        (productQuantity[productName] || 0) +
        Number(item.quantity || 0);
    }
  }

  const sortedCategoryRevenue =
    Object.fromEntries(
      Object.entries(categoryRevenue).sort(
        (a, b) =>
          money(b[1]).cmp(money(a[1])),
      ),
    );

  const dailyRevenue = Object.entries(daily)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({
      date,
      revenue: value.revenue.toFixed(2),
      orders: value.orders,
    }));

  const topProducts = Object.entries(productRevenue)
    .map(([name, revenue]) => ({
      name,
      revenue,
      quantity: productQuantity[name],
    }))
    .sort(
      (a, b) =>
        money(b.revenue).cmp(money(a.revenue)),
    )
    .slice(0, 6);

  const top = await topCustomers(pool);

  const topCustomersDto = top
    .slice(0, 5)
    .map((row) => ({
      name: row.customer_name,
      phone: row.customer_phone,
      orders: Number(row.order_count),
      revenue: String(row.total_amount),
      lastOrder: row.last_order,
    }));

  return {
    totalRevenue: totalRevenue.toFixed(2),

    totalOrders: orders.length,

    totalItems,

    totalQuantity,

    totalCustomers,

    statusCounts,

    categoryRevenue: sortedCategoryRevenue,

    dailyRevenue,

    channelDistribution,

    topProducts,

    topCustomers: topCustomersDto,
  };
}

export async function updateStatus(id, status) {
  const normalized = normalize(status, "");

  if (!VALID_STATUSES.includes(normalized)) {
    const error = new Error(
      "Unsupported order status",
    );

    error.status = 400;

    throw error;
  }

  const row = await updateOrderStatus(
    pool,
    id,
    normalized,
  );

  if (!row) {
    throw notFound("Order not found");
  }

  const items = await findItems(pool, id);

  return mapOrder({
    ...row,
    items,
  });
}

export async function updateItems(id, items) {
  const updated = await updateOrderItems(id, items);

  return mapOrder(updated);
}

export async function updateOrder(id, details, items) {
  const updated = await updateOrderDetails(
    id,
    details || {},
    Array.isArray(items) ? items : [],
  );

  return mapOrder(updated);
}

export async function getTopCustomers() {
  return (await topCustomers(pool)).map((row) => ({
    name: row.customer_name,
    phone: row.customer_phone,
    orders: Number(row.order_count),
    revenue: String(row.total_amount),
    lastOrder: row.last_order,
  }));
}