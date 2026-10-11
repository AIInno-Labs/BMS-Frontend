-- Quick fix: run this alone if schema.sql failed on resin_material index.
-- Safe to re-run.

ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS product_group TEXT;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS description_1 TEXT;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS description_2 TEXT;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS description_3 TEXT;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS description_4 TEXT;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS resin_material TEXT DEFAULT 'N/A';
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS primary_colour TEXT;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS stock_quantity NUMERIC(14, 3) DEFAULT 0;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS reorder_level NUMERIC(14, 3) DEFAULT 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory' AND column_name = 'quantity_on_hand'
  ) THEN
    UPDATE public.inventory SET stock_quantity = COALESCE(stock_quantity, quantity_on_hand, 0);
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory' AND column_name = 'description'
  ) THEN
    UPDATE public.inventory SET description_1 = COALESCE(description_1, description) WHERE description_1 IS NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory' AND column_name = 'reorder_alert'
  ) THEN
    ALTER TABLE public.inventory
      ADD COLUMN reorder_alert BOOLEAN GENERATED ALWAYS AS (stock_quantity <= reorder_level) STORED;
  END IF;
END $$;

UPDATE public.inventory SET resin_material = 'N/A' WHERE resin_material IS NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_resin_material ON public.inventory (resin_material);
