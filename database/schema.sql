-- Database schema for Form KMB / BSS registration.
-- Target database: PostgreSQL 15+
--
-- The columns intentionally follow the internal spreadsheet columns.

CREATE TABLE IF NOT EXISTS bss_registrations (
  no BIGSERIAL PRIMARY KEY,
  site_name TEXT NOT NULL,
  address TEXT NOT NULL,
  google_map_url TEXT NOT NULL,
  city TEXT NOT NULL,
  province TEXT NOT NULL,
  rental_price TEXT DEFAULT '',
  jenis TEXT NOT NULL DEFAULT 'BSS' CHECK (jenis IN ('BSS', 'EVCS')),
  slot TEXT NOT NULL,
  venue_pic TEXT NOT NULL,
  account_number TEXT DEFAULT '',
  rent_period TEXT DEFAULT '',
  key_account TEXT DEFAULT '',
  no_telp_lokasi TEXT NOT NULL,
  foto_lokasi TEXT NOT NULL DEFAULT '',
  approval TEXT DEFAULT '',
  awal_kontrak TEXT DEFAULT '',
  akhir_kontrak TEXT DEFAULT '',
  masa_kontrak TEXT DEFAULT '',
  termin_pembayaran TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bss_registrations_created_at
  ON bss_registrations (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bss_registrations_city
  ON bss_registrations (city);

CREATE INDEX IF NOT EXISTS idx_bss_registrations_approval
  ON bss_registrations (approval);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bss_registrations_updated_at ON bss_registrations;

CREATE TRIGGER trg_bss_registrations_updated_at
BEFORE UPDATE ON bss_registrations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE VIEW bss_registrations_export AS
SELECT
  no AS "No",
  site_name AS "Site Name",
  address AS "Address",
  google_map_url AS "Google Map URL",
  city AS "City",
  province AS "Province",
  rental_price AS "Rental Price",
  jenis AS "Jenis",
  slot AS "Slot / Jumlah EVCS",
  venue_pic AS "Venue PIC",
  account_number AS "Account Number",
  rent_period AS "Rent Period",
  key_account AS "Key Account",
  no_telp_lokasi AS "No. Telp Lokasi",
  foto_lokasi AS "Foto Lokasi",
  approval AS "Approval",
  awal_kontrak AS "Awal Kontrak",
  akhir_kontrak AS "Akhir Kontrak",
  masa_kontrak AS "Masa Kontrak",
  termin_pembayaran AS "Termin Pembayaran"
FROM bss_registrations;
