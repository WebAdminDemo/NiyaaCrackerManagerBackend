import { pool } from "../config/database.js";

export async function getAll(req, res, next) {
  try {
    const { rows } = await pool.query(`
      SELECT id, enquiry_id, product_id, name, category, contents,
             original_price, price, quantity, total, discount_percent,
             created_at, updated_at
      FROM enquiry_items ORDER BY id
    `);
    res.json(
      rows.map((x) => ({
        id: x.id,
        enquiryId: x.enquiry_id,
        productId: x.product_id,
        name: x.name,
        category: x.category,
        contents: x.contents,
        originalPrice: x.original_price,
        price: x.price,
        quantity: x.quantity,
        total: x.total,
        discountPercent: x.discount_percent,
        createdAt: x.created_at,
        updatedAt: x.updated_at,
      })),
    );
  } catch (e) {
    next(e);
  }
}
