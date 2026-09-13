-- Optional order-address support used by the Sales Order editor and invoice PDF.
-- Safe to run more than once.
ALTER TABLE enquiries
ADD COLUMN IF NOT EXISTS customer_address TEXT;

CREATE INDEX IF NOT EXISTS idx_enquiries_customer_phone
ON enquiries(customer_phone);

ALTER TABLE enquiry_items
ADD COLUMN IF NOT EXISTS brand VARCHAR(150);
