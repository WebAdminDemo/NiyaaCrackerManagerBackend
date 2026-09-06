import Decimal from "decimal.js";
import { pool } from "../config/database.js";
import {
  findAllWithItems,
  topCustomers,
  updateStatus as updateOrderStatus,
} from "../repositories/enquiry.repository.js";
import { notFound } from "../utils/httpError.js";

const VALID_STATUSES = [
  "pending",
  "processing",
  "packaging",
  "shipped",
  "delivered",
  "cancelled",
];

function hasText(v) {
  return v != null && String(v).trim() !== "";
}
function normalize(v, fallback = "") {
  return hasText(v) ? String(v).trim().toLowerCase() : fallback;
}
function money(v) {
  return new Decimal(v ?? 0);
}

function mapOrder(o) {
  const items = (o.items || []).map((i) => ({
    id: i.id,
    productId: i.product_id,
    name: i.name,
    category: i.category,
    price: i.price,
    quantity: i.quantity,
    total:
      i.total ??
      money(i.price)
        .mul(i.quantity || 0)
        .toFixed(2),
    discountPercent: i.discount_percent,
  }));
  return {
    id: o.id,
    ref: o.ref,
    customerName: o.customer_name,
    customerPhone: o.customer_phone,
    channel: o.channel,
    status: normalize(o.status, "pending"),
    totalAmount:
      o.total_amount ??
      items.reduce((s, i) => s.plus(money(i.total)), new Decimal(0)).toFixed(2),
    totalItems: o.total_items ?? items.length,
    totalQuantity: o.total_quantity,
    orderDate: o.order_date,
    createdAt: o.created_at,
    items,
  };
}
function orderDate(o) {
  return o.order_date || o.created_at;
}
function matchesDate(o, from, to) {
  if (!from && !to) return true;
  const d = orderDate(o);
  if (!d) return false;
  const day = new Date(d).toISOString().slice(0, 10);
  return (!from || day >= from) && (!to || day <= to);
}
function matches(o, status, category, channel, search) {
  if (status && normalize(o.status) !== normalize(status)) return false;
  if (channel && normalize(o.channel) !== normalize(channel)) return false;
  if (
    category &&
    !(o.items || []).some((i) => normalize(i.category) === normalize(category))
  )
    return false;
  if (search) {
    const n = String(search).trim().toLowerCase();
    const found = [
      o.ref,
      o.id,
      o.customer_name,
      o.customer_phone,
      ...(o.items || []).map((i) => i.name),
    ].some((v) => v != null && String(v).toLowerCase().includes(n));
    if (!found) return false;
  }
  return true;
}
async function filtered({ from, to, status, category, channel, search }) {
  const orders = await findAllWithItems(pool);
  return orders.filter(
    (o) =>
      matchesDate(o, from, to) && matches(o, status, category, channel, search),
  );
}
export async function findOrders(filters) {
  return (await filtered(filters)).map(mapOrder);
}

export async function getAnalytics(filters) {
  const orders = await filtered(filters);
  const totalRevenue = orders.reduce(
    (s, o) => s.plus(o.total_amount || 0),
    new Decimal(0),
  );
  const totalItems = orders.reduce((s, o) => s + (o.items || []).length, 0);
  const totalQuantity = orders.reduce(
    (s, o) => s + (o.items || []).reduce((q, i) => q + (i.quantity || 0), 0),
    0,
  );
  const totalCustomers = new Set(
    orders.map((o) => o.customer_phone).filter(hasText),
  ).size;
  const statusCounts = Object.fromEntries(
    [...VALID_STATUSES].sort().map((s) => [s, 0]),
  );
  const categoryRevenue = {};
  const daily = {};
  const channelDistribution = {};
  const productRevenue = {};
  const productQuantity = {};
  for (const o of orders) {
    const st = normalize(o.status, "pending");
    statusCounts[st] = (statusCounts[st] || 0) + 1;
    if (hasText(o.channel))
      channelDistribution[o.channel] =
        (channelDistribution[o.channel] || 0) + 1;
    const day =
      orderDate(o)?.toISOString?.().slice(0, 10) ||
      (orderDate(o) ? String(orderDate(o)).slice(0, 10) : null);
    if (day) {
      if (!daily[day]) daily[day] = { revenue: new Decimal(0), orders: 0 };
      daily[day].revenue = daily[day].revenue.plus(o.total_amount || 0);
      daily[day].orders++;
    }
    for (const i of o.items || []) {
      const cat = hasText(i.category) ? i.category : "Uncategorised";
      categoryRevenue[cat] = money(categoryRevenue[cat])
        .plus(i.total || money(i.price).mul(i.quantity || 0))
        .toFixed(2);
      productRevenue[i.name] = money(productRevenue[i.name])
        .plus(i.total || money(i.price).mul(i.quantity || 0))
        .toFixed(2);
      productQuantity[i.name] =
        (productQuantity[i.name] || 0) + (i.quantity || 0);
    }
  }
  const sortedCategoryRevenue = Object.fromEntries(
    Object.entries(categoryRevenue).sort((a, b) => money(b[1]).cmp(a[1])),
  );
  const dailyRevenue = Object.entries(daily)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, x]) => ({
      date,
      revenue: x.revenue.toFixed(2),
      orders: x.orders,
    }));
  const topProducts = Object.entries(productRevenue)
    .map(([name, revenue]) => ({
      name,
      revenue,
      quantity: productQuantity[name],
    }))
    .sort((a, b) => money(b.revenue).cmp(a.revenue))
    .slice(0, 6);
  const top = await topCustomers(pool);
  const topCustomersDto = top.slice(0, 5).map((r) => ({
    name: r.customer_name,
    phone: r.customer_phone,
    orders: Number(r.order_count),
    revenue: String(r.total_amount),
    lastOrder: r.last_order,
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
    const e = new Error("Unsupported order status");
    e.status = 400;
    throw e;
  }
  const row = await updateOrderStatus(pool, id, normalized);
  if (!row) throw notFound("Order not found");
  const items = await (
    await import("../repositories/enquiry.repository.js")
  ).findItems(pool, id);
  return mapOrder({ ...row, items });
}
export async function getTopCustomers() {
  return (await topCustomers(pool)).map((r) => ({
    name: r.customer_name,
    phone: r.customer_phone,
    orders: Number(r.order_count),
    revenue: String(r.total_amount),
    lastOrder: r.last_order,
  }));
}
