import crypto from "node:crypto";

export function generateOrderRef() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `ORD-${yyyy}${mm}${dd}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}
export function uuid() {
  return crypto.randomUUID();
}
export function generateSku(name = "") {
  const base = String(name)
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 8);
  return `SKU-${base}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}
