-- Default OpenAI voice (Whisper via Edge Function) across all restaurants.
--
-- This sets the persisted per-restaurant setting (`site_settings.voice_provider`)
-- to 'whisper' for existing rows, and sets a DB default for future inserts.

DO $$
BEGIN
  IF to_regclass('public.site_settings') IS NOT NULL THEN
    -- Ensure the column exists (older DBs may have been created outside migrations).
    BEGIN
      ALTER TABLE public.site_settings
        ADD COLUMN IF NOT EXISTS voice_provider TEXT;
    EXCEPTION
      WHEN others THEN
        RAISE NOTICE 'Skipping add column site_settings.voice_provider: %', SQLERRM;
    END;

    -- Update all existing rows (one-time migration).
    BEGIN
      UPDATE public.site_settings
      SET voice_provider = 'whisper'
      WHERE voice_provider IS DISTINCT FROM 'whisper';
    EXCEPTION
      WHEN others THEN
        RAISE NOTICE 'Skipping update site_settings.voice_provider: %', SQLERRM;
    END;

    -- Best-effort: set default for new rows. (Don't block migration if column/type differs.)
    BEGIN
      ALTER TABLE public.site_settings
        ALTER COLUMN voice_provider SET DEFAULT 'whisper';
    EXCEPTION
      WHEN others THEN
        RAISE NOTICE 'Skipping default for site_settings.voice_provider: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'site_settings table not found; skipping default_whisper_voice migration';
  END IF;
END $$;
