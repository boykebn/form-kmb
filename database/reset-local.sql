DROP VIEW IF EXISTS bss_registrations_export;
DROP TABLE IF EXISTS bss_registration_photos;
DROP TABLE IF EXISTS bss_registrations;
DROP FUNCTION IF EXISTS set_updated_at;

\i database/schema.sql
