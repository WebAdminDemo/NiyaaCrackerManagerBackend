import * as service from "../services/enquiry.service.js";
import { enquirySchema } from "../validators/enquiry.validator.js";

export async function getOrders(req, res, next) {
  try {
    res.json(await service.getOrders());
  } catch (e) {
    next(e);
  }
}
export async function createOrder(req, res, next) {
  try {
    res
      .status(201)
      .json(await service.createOrder(enquirySchema.parse(req.body)));
  } catch (e) {
    next(e);
  }
}
export async function getOrder(req, res, next) {
  try {
    const { pool } = await import("../config/database.js");
    const { findById, findItems } =
      await import("../repositories/enquiry.repository.js");
    const row = await findById(pool, req.params.id);
    if (!row) {
      const e = new Error("Order not found");
      e.status = 404;
      throw e;
    }
    row.items = await findItems(pool, row.id);
    const { default: Decimal } = await import("decimal.js");
    res.json({
      id: row.id,
      ref: row.ref,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      channel: row.channel,
      status: row.status,
      message: row.message,
      pdfLink: row.pdf_link,
      whatsappNumber: row.whatsapp_number,
      smsNumber: row.sms_number,
      totalAmount: row.total_amount,
      totalItems: row.total_items,
      totalQuantity: row.total_quantity,
      orderDate: row.order_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      items: row.items.map((i) => ({
        ...i,
        productId: i.product_id,
        originalPrice: i.original_price,
        discountPercent: i.discount_percent,
      })),
    });
  } catch (e) {
    next(e);
  }
}
