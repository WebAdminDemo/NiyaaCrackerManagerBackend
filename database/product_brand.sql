-- Product catalogue brand mode.
-- Canonical values: multiBrand, standard.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS brand VARCHAR(50) NULL;

UPDATE public.products
SET brand = CASE
  WHEN LOWER(TRIM(COALESCE(brand, ''))) IN ('multibrand', 'multi-brand') THEN 'multiBrand'
  WHEN LOWER(TRIM(COALESCE(brand, ''))) IN ('standard', 'standard fireworks') THEN 'standard'
  WHEN LOWER(COALESCE(ui_flags, '')) LIKE '%"catalogmode":"multibrand"%' THEN 'multiBrand'
  WHEN LOWER(COALESCE(ui_flags, '')) LIKE '%"catalogmode" : "multibrand"%' THEN 'multiBrand'
  ELSE COALESCE(brand, '')
END;
