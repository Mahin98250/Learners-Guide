ALTER TABLE public.batches
ADD COLUMN IF NOT EXISTS active boolean
GENERATED ALWAYS AS (COALESCE(status = 'active', true)) STORED;

COMMENT ON COLUMN public.batches.active IS 'Compatibility projection derived from status. TRUE when status is active or NULL; do not write directly.';
