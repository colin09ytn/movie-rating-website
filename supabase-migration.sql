-- Run this in Supabase Dashboard > SQL Editor before publishing the updated app.
-- The existing titles table already has the core movie fields. These columns
-- preserve the extra metadata used by the current website.
ALTER TABLE public.titles
  ADD COLUMN IF NOT EXISTS year text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS genres jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

-- Keep the app's realtime change feed available, if it has not already been enabled.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.titles;
  EXCEPTION WHEN duplicate_object THEN NULL;
            WHEN undefined_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ratings;
  EXCEPTION WHEN duplicate_object THEN NULL;
            WHEN undefined_object THEN NULL;
  END;
END $$;
