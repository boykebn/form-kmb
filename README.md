# Form KMB

Form sederhana ala Google Forms dengan React untuk frontend dan Express untuk backend.

## Route

- `/` menampilkan company profile PT. Kreasi Mitra Berdikari.
- `/program-bss` menampilkan informasi program dan alur kemitraan BSS.
- `/form-bss` menampilkan form pendaftaran lokasi BSS.

## Jalankan lokal

```bash
npm install
npm --prefix client install
npm run dev
```

Frontend: http://localhost:5173  
Backend: http://localhost:4100

## Penyimpanan

Secara default, submission disimpan dengan format kolom internal ke:

- `data/submissions.json`
- `data/submissions.csv`

Kolom spreadsheet internal:

`No`, `Site Name`, `Address`, `Google Map URL`, `City`, `Province`, `Rental Price`, `Slot`, `Venue PIC`, `Account Number`, `Rent Period`, `Key Account`, `No. Telp Lokasi`, `Foto Lokasi`, `Approval`, `Awal Kontrak`, `Akhir Kontrak`, `Masa Kontrak`, `Termin Pembayaran`.

## Sambungkan ke Google Sheets

1. Buat service account di Google Cloud.
2. Aktifkan Google Sheets API.
3. Share spreadsheet ke email service account sebagai Editor.
4. Copy `.env.example` menjadi `.env`.
5. Isi `GOOGLE_SHEETS_ID`, `GOOGLE_SHEETS_TAB`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, dan `GOOGLE_PRIVATE_KEY`.

Saat env Google Sheets lengkap, backend akan tetap menyimpan lokal dan juga append ke spreadsheet.

## Simpan Foto ke Google Drive

1. Aktifkan Google Drive API di project Google Cloud yang sama.
2. Buat folder Google Drive untuk foto lokasi.
3. Share folder itu ke email service account sebagai Editor.
4. Ambil folder ID dari URL folder. Contoh URL:
   `https://drive.google.com/drive/folders/ABC123...`
   maka folder ID-nya adalah `ABC123...`.
5. Isi `GOOGLE_DRIVE_FOLDER_ID` di `.env`.

Kalau `GOOGLE_DRIVE_FOLDER_ID` terisi, foto akan diupload ke Google Drive dan link Drive-nya masuk ke spreadsheet. Kalau kosong, foto tetap disimpan lokal di folder `uploads`.

Set `GOOGLE_DRIVE_PUBLIC_LINKS=true` hanya kalau link foto di spreadsheet boleh dibuka siapa pun yang punya link.

## Simpan Foto ke Cloudinary

Isi env berikut jika foto ingin disimpan ke Cloudinary:

```env
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_FOLDER=form-kmb/foto-site
```

Jika konfigurasi Cloudinary lengkap, backend akan memprioritaskan Cloudinary untuk upload foto. Jika kosong, backend akan fallback ke Google Drive atau folder lokal `uploads`.

## Sambungkan ke Google Maps

1. Aktifkan Google Maps JavaScript API di Google Cloud.
2. Buat API key dan batasi HTTP referrer untuk domain aplikasi.
3. Isi `VITE_GOOGLE_MAPS_API_KEY` di `.env`.

Vite sudah dikonfigurasi membaca `.env` dari root project, jadi satu file `.env` dipakai oleh frontend dan backend.
