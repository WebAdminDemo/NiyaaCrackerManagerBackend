import { z } from "zod";
import { PRODUCT_STATUS, BRAND } from "../config/common.properties.js";

export const productRequestSchema = z
  .object({
    rowid: z.string().optional().nullable(),
    name: z.string().trim().min(1, "Name is required"),
    category: z.string().trim().min(1, "Category is required"),
    price: z.coerce.number().min(0, "Price cannot be negative"),
    discount_percent: z.coerce
      .number()
      .min(0, "Discount cannot be negative")
      .optional()
      .nullable(),
    discountPercent: z.coerce
      .number()
      .min(0, "Discount cannot be negative")
      .optional()
      .nullable(),
    discountMode: z.enum(['percent', 'value']).optional().nullable(),
    discount_mode: z.enum(['percent', 'value']).optional().nullable(),
    discountValue: z.coerce.number().min(0).optional().nullable(),
    discount_value: z.coerce.number().min(0).optional().nullable(),
    contents: z
      .string()
      .regex(
        /^[a-zA-Z0-9 ]*$/,
        "Quantity can only contain letters, numbers, and spaces",
      )
      .optional()
      .nullable(),
    image: z.string().optional().nullable(),
    brand: z.enum(["", BRAND.STANDARD, BRAND.MULTIBRAND]).optional().nullable(),
    brandStatus: z.boolean().optional().nullable(),
    status: z.enum([PRODUCT_STATUS.IN_STOCK, PRODUCT_STATUS.NO_STOCK], {
      message: "Invalid product status",
    }),
  })
  .superRefine((v, ctx) => {
    const mode = v.discountMode ?? v.discount_mode ?? 'percent';
    if (mode !== 'percent') return;

    const percent = Number(
      v.discountPercent ??
        v.discount_percent ??
        0,
    );

    if (Number.isFinite(percent) && percent > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_big,
        maximum: 100,
        type: 'number',
        inclusive: true,
        path: ['discountPercent'],
        message: 'Discount percentage cannot exceed 100',
      });
    }
  })
  .transform((v) => ({
    rowid: v.rowid ?? null,
    name: v.name,
    category: v.category,
    price: v.price,
    discountMode: v.discountMode ?? v.discount_mode ?? 'percent',
    discountValue: v.discountValue ?? v.discount_value ?? (v.discountMode === 'value' || v.discount_mode === 'value' ? (v.discountAmount ?? 0) : (v.discount_percent ?? v.discountPercent ?? 0)),
    discountPercent: v.discount_percent ?? v.discountPercent ?? 0,
    contents: v.contents ?? "",
    image: v.image ?? "",
    brand: v.brand ?? "",
    brandStatus: v.brandStatus ?? null,
    status: v.status,
  }));

export const statusSchema = z.object({
  status: z.enum([PRODUCT_STATUS.IN_STOCK, PRODUCT_STATUS.NO_STOCK], {
    message: "Invalid product status",
  }),
});
