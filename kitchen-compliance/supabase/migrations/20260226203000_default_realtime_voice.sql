-- Default Realtime voice provider across all restaurants.
--
-- Moves prior Whisper default to Realtime while keeping Whisper available in settings.

DO $$
BEGIN
  IF to_regclass('public.site_settings') IS NOT NULL THEN
    BEGIN
      ALTER TABLE public.site_settings
        ADD COLUMN IF NOT EXISTS voice_provider TEXT;
    EXCEPTION
      WHEN others THEN
        RAISE NOTICE 'Skipping add column site_settings.voice_provider: %', SQLERRM;
    END;

    BEGIN
      UPDATE public.site_settings
      SET voice_provider = 'realtime'
      WHERE voice_provider IS NULL OR voice_provider IN ('whisper', 'openai');
    EXCEPTION
      WHEN others THEN
        RAISE NOTICE 'Skipping update site_settings.voice_provider to realtime: %', SQLERRM;
    END;

    BEGIN
      ALTER TABLE public.site_settings
        ALTER COLUMN voice_provider SET DEFAULT 'realtime';
    EXCEPTION
      WHEN others THEN
        RAISE NOTICE 'Skipping default for site_settings.voice_provider: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'site_settings table not found; skipping default_realtime_voice migration';
  END IF;
END $$;
