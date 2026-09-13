import * as service from "../services/sales.service.js";
import { salesStatusSchema } from "../validators/enquiry.validator.js";

function filters(req) {
  return {
    from: req.query.from || null,
    to: req.query.to || null,
    status: req.query.status || null,
    category: req.query.category || null,
    brand: req.query.brand || null,

    channel: req.query.channel || null,
    search: req.query.search || null,
  };
}

export async function orders(req, res, next) {
  try {
    res.json(await service.findOrders(filters(req)));
  } catch (error) {
    next(error);
  }
}

export async function analytics(req, res, next) {
  try {
    res.json(await service.getAnalytics(filters(req)));
  } catch (error) {
    next(error);
  }
}

export async function updateStatus(req, res, next) {
  try {
    const requestedStatus = String(req.body?.status || "")
      .trim()
      .toLowerCase();

    const parsed = salesStatusSchema.parse({
      status: requestedStatus,
    });

    res.json(await service.updateStatus(req.params.id, parsed.status));
  } catch (error) {
    next(error);
  }
}

export async function updateItems(req, res, next) {
  try {
    const items = req.body?.items;

    if (!Array.isArray(items)) {
      const error = new Error("items must be an array.");
      error.status = 400;
      throw error;
    }

    res.json(await service.updateItems(req.params.id, items));
  } catch (error) {
    next(error);
  }
}

export async function updateOrder(req, res, next) {
  try {
    const details = req.body?.details;
    const items = req.body?.items;

    if (!details || typeof details !== "object" || Array.isArray(details)) {
      const error = new Error("details must be an object.");
      error.status = 400;
      throw error;
    }

    if (!Array.isArray(items)) {
      const error = new Error("items must be an array.");
      error.status = 400;
      throw error;
    }

    res.json(await service.updateOrder(req.params.id, details, items));
  } catch (error) {
    next(error);
  }
}

export async function topCustomers(req, res, next) {
  try {
    res.json(await service.getTopCustomers());
  } catch (error) {
    next(error);
  }
}
