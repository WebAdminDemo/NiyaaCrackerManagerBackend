/* Keep the selected product brand on each order line for order-history accuracy. */
ALTER TABLE public.enquiry_items
  ADD COLUMN IF NOT EXISTS brand VARCHAR(50) NULL;
