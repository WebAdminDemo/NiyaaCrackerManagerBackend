import * as service from "../services/sales.service.js";
import { salesStatusSchema } from "../validators/enquiry.validator.js";

function filters(req) {
  return {
    from: req.query.from || null,
    to: req.query.to || null,
    status: req.query.status || null,
    category: req.query.category || null,
    channel: req.query.channel || null,
    search: req.query.search || null,
  };
}
export async function orders(req, res, next) {
  try {
    res.json(await service.findOrders(filters(req)));
  } catch (e) {
    next(e);
  }
}
export async function analytics(req, res, next) {
  try {
    res.json(await service.getAnalytics(filters(req)));
  } catch (e) {
    next(e);
  }
}
export async function updateStatus(req, res, next) {
  try {
    const b = salesStatusSchema.parse(req.body);
    res.json(await service.updateStatus(req.params.id, b.status));
  } catch (e) {
    next(e);
  }
}
export async function topCustomers(req, res, next) {
  try {
    res.json(await service.getTopCustomers());
  } catch (e) {
    next(e);
  }
}
