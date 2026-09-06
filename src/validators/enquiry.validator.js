import { z } from "zod";

const itemSchema = z.object({
  productId: z.string().min(1),
  name: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  contents: z.string().optional().nullable(),
  originalPrice: z.coerce.number().nonnegative().optional().nullable(),
  price: z.coerce.number().nonnegative().optional().nullable(),
  quantity: z.coerce.number().int().positive(),
  total: z.coerce.number().nonnegative().optional().nullable(),
  discountPercent: z.coerce.number().min(0).max(100).optional().nullable(),
});

export const enquirySchema = z.object({
  id: z.string().optional().nullable(),
  ref: z.string().optional().nullable(),
  customerName: z.string().trim().min(1, "Customer name is required"),
  customerPhone: z.string().trim().min(1, "Customer phone is required"),
  channel: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  message: z.string().optional().nullable(),
  pdfLink: z.string().optional().nullable(),
  whatsappNumber: z.string().optional().nullable(),
  smsNumber: z.string().optional().nullable(),
  totalAmount: z.coerce.number().nonnegative().optional().nullable(),
  totalItems: z.coerce.number().int().nonnegative().optional().nullable(),
  totalQuantity: z.coerce.number().int().nonnegative().optional().nullable(),
  orderDate: z.union([z.string(), z.date()]).optional().nullable(),
  items: z.array(itemSchema).min(1, "At least one order item is required"),
});

export const salesStatusSchema = z.object({
  status: z.enum(
    ["pending", "processing", "packaging", "shipped", "delivered", "cancelled"],
    {
      message: "Unsupported order status",
    },
  ),
});
