# Database Lokal Form KMB

Database dibuat mengikuti kolom spreadsheet internal. Nama kolom di PostgreSQL memakai `snake_case`, tapi urutan dan maknanya 1:1 dengan spreadsheet.

## Kolom

| Spreadsheet | PostgreSQL |
| --- | --- |
| No | `no` |
| Site Name | `site_name` |
| Address | `address` |
| Google Map URL | `google_map_url` |
| City | `city` |
| Province | `province` |
| Rental Price | `rental_price` |
| Jenis | `jenis` |
| Slot / Jumlah EVCS | `slot` |
| Venue PIC | `venue_pic` |
| Account Number | `account_number` |
| Rent Period | `rent_period` |
| Key Account | `key_account` |
| No. Telp Lokasi | `no_telp_lokasi` |
| Foto Lokasi | `foto_lokasi` |
| Approval | `approval` |
| Awal Kontrak | `awal_kontrak` |
| Akhir Kontrak | `akhir_kontrak` |
| Masa Kontrak | `masa_kontrak` |
| Termin Pembayaran | `termin_pembayaran` |

Foto tetap disimpan di Cloudinary. Database hanya menyimpan link Cloudinary di kolom `foto_lokasi`. Jika ada lebih dari 1 foto, link disimpan dalam 1 text dipisahkan baris baru.

## Buat Database Lokal

```powershell
psql -U postgres
```

```sql
CREATE DATABASE form_kmb;
CREATE USER form_kmb_user WITH ENCRYPTED PASSWORD 'GANTI_PASSWORD_KUAT';
GRANT ALL PRIVILEGES ON DATABASE form_kmb TO form_kmb_user;
\c form_kmb
GRANT ALL ON SCHEMA public TO form_kmb_user;
\q
```

Jalankan schema:

```powershell
psql -U form_kmb_user -d form_kmb -f database/schema.sql
```

Kalau database sudah ada dari versi sebelum kolom `Jenis`, jalankan migration:

```powershell
psql -U form_kmb_user -d form_kmb -f database/migrations/002_add_jenis.sql
```

Kalau database lokal sudah pernah dibuat dengan struktur lama dan ingin reset bersih:

```powershell
psql -U form_kmb_user -d form_kmb -f database/reset-local.sql
```

## Cek Data

```powershell
psql -U form_kmb_user -d form_kmb
```

```sql
\dt public.*
\dv public.*
SELECT * FROM bss_registrations_export;
```
