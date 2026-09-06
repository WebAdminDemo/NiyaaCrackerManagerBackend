import { z } from "zod";

export const productRequestSchema = z
  .object({
    rowid: z.string().optional().nullable(),
    name: z.string().trim().min(1, "Name is required"),
    category: z.string().trim().min(1, "Category is required"),
    price: z.coerce.number().positive("Price must be positive"),
    discount_percent: z.coerce
      .number()
      .min(0, "Discount cannot be negative")
      .max(100, "Discount cannot exceed 100")
      .optional()
      .nullable(),
    discountPercent: z.coerce.number().min(0).max(100).optional().nullable(),
    contents: z
      .string()
      .regex(
        /^[a-zA-Z0-9 ]*$/,
        "Quantity can only contain letters, numbers, and spaces",
      )
      .optional()
      .nullable(),
    image: z.string().optional().nullable(),
    status: z.enum(["in_stock", "no_stock"], {
      message: "Status must be 'in_stock' or 'no_stock'",
    }),
  })
  .transform((v) => ({
    rowid: v.rowid ?? null,
    name: v.name,
    category: v.category,
    price: v.price,
    discountPercent: v.discount_percent ?? v.discountPercent ?? 0,
    contents: v.contents ?? "",
    image: v.image ?? "",
    status: v.status,
  }));

export const statusSchema = z.object({
  status: z.enum(["in_stock", "no_stock"], {
    message: "Status must be 'in_stock' or 'no_stock'",
  }),
});
