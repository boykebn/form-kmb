ALTER TABLE bss_registrations
  ADD COLUMN IF NOT EXISTS jenis TEXT NOT NULL DEFAULT 'BSS';

ALTER TABLE bss_registrations
  DROP CONSTRAINT IF EXISTS bss_registrations_slot_check;

ALTER TABLE bss_registrations
  DROP CONSTRAINT IF EXISTS bss_registrations_jenis_check;

ALTER TABLE bss_registrations
  ADD CONSTRAINT bss_registrations_jenis_check
  CHECK (jenis IN ('BSS', 'EVCS'));

DROP VIEW IF EXISTS bss_registrations_export;

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
