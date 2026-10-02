-- Adds idempotency protection and Cloudinary photo metadata.

ALTER TABLE bss_registrations
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

ALTER TABLE bss_registrations
  ADD COLUMN IF NOT EXISTS foto_lokasi_meta JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_bss_registrations_idempotency_key
  ON bss_registrations (idempotency_key);
