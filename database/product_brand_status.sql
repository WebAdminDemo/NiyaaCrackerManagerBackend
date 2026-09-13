/* Product brand migration
 * Brand is optional.
 * Standard   -> brandStatus = TRUE
 * Multibrand -> brandStatus = FALSE
 * No brand   -> brandStatus = NULL
 *
 * This project uses PostgreSQL, so brandStatus is BOOLEAN.
 */

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS brand VARCHAR(50) NULL;

ALTER TABLE public.products
  ALTER COLUMN brand DROP NOT NULL;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS "brandStatus" BOOLEAN NULL;

UPDATE public.products
SET
  brand = CASE
    WHEN LOWER(TRIM(COALESCE(brand, ''))) IN ('standard', 'standard fireworks')
      THEN 'Standard'
    WHEN LOWER(TRIM(COALESCE(brand, ''))) IN ('multibrand', 'multi-brand', 'multi brand')
      THEN 'Multibrand'
    ELSE NULL
  END,
  "brandStatus" = CASE
    WHEN LOWER(TRIM(COALESCE(brand, ''))) IN ('standard', 'standard fireworks')
      THEN TRUE
    WHEN LOWER(TRIM(COALESCE(brand, ''))) IN ('multibrand', 'multi-brand', 'multi brand')
      THEN FALSE
    ELSE NULL
  END;
