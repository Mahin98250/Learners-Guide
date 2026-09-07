ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS cls text,
  ADD COLUMN IF NOT EXISTS sec text;

UPDATE public.tests t
SET cls = b.cls,
    sec = b.sec
FROM public.batches b
WHERE b.id = t.batch_id
  AND (t.cls IS DISTINCT FROM b.cls OR t.sec IS DISTINCT FROM b.sec);

COMMENT ON COLUMN public.tests.cls IS 'Compatibility projection of the test batch class/standard.';
COMMENT ON COLUMN public.tests.sec IS 'Compatibility projection of the test batch section.';
