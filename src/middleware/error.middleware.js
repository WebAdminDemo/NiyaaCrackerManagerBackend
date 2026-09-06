import { ZodError } from "zod";
import { HttpError } from "../utils/httpError.js";

export function errorHandler(err, req, res, _next) {
  console.error(`[${req.method} ${req.originalUrl}]`, err);

  if (err instanceof ZodError) {
    const fields = {};
    for (const issue of err.issues) {
      const field = issue.path.join(".") || "request";
      fields[field] = issue.message;
    }
    return res.status(400).json(fields);
  }

  if (err instanceof HttpError) {
    return res.status(err.status).json({
      message: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
  }

  if (err?.code === "23505") {
    return res
      .status(409)
      .json({ message: "A record with the same unique value already exists" });
  }
  if (err?.code === "23503") {
    return res
      .status(409)
      .json({
        message:
          "The record cannot be changed because it is referenced by another record",
      });
  }
  if (err?.code === "23514") {
    return res
      .status(400)
      .json({ message: "Database constraint validation failed" });
  }

  return res.status(500).json({ message: "Internal server error" });
}
