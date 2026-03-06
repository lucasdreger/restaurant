-- Normalize legacy voice provider values to Realtime.
--
-- Some rows still use historical values like 'openai' from older releases.

DO $$
BEGIN
  IF to_regclass('public.site_settings') IS NOT NULL THEN
    BEGIN
      UPDATE public.site_settings
      SET voice_provider = 'realtime'
      WHERE voice_provider IS NULL OR voice_provider IN ('openai', 'whisper');
    EXCEPTION
      WHEN others THEN
        RAISE NOTICE 'Skipping voice provider normalization: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'site_settings table not found; skipping normalize_realtime_voice_provider migration';
  END IF;
END $$;
