-- Niyaa order-level discount migration.
-- Safe to run more than once.
ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS discount_percent numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_amount numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_mode varchar(10) NOT NULL DEFAULT 'percent',
  ADD COLUMN IF NOT EXISTS discount_value numeric(14,2) NOT NULL DEFAULT 0;

-- For old orders, preserve the existing total as the gross/final amount.
UPDATE public.enquiries
SET final_amount = COALESCE(total_amount, 0)
WHERE COALESCE(discount_amount, 0) = 0
  AND COALESCE(final_amount, 0) = 0;

CREATE INDEX IF NOT EXISTS idx_enquiries_discount
  ON public.enquiries (discount_percent);
