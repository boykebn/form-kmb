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

## Deploy ke VPS

Rekomendasi production:

- Node.js 20 atau lebih baru
- PM2 untuk menjalankan aplikasi
- Nginx sebagai reverse proxy
- Certbot untuk SSL domain

Di VPS:

```bash
sudo apt update
sudo apt install -y git nginx certbot python3-certbot-nginx

curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

Clone project:

```bash
cd /var/www
sudo git clone https://github.com/boykebn/form-kmb.git
sudo chown -R $USER:$USER /var/www/form-kmb
cd /var/www/form-kmb

npm install
npm --prefix client install
npm run build
```

Buat file `.env` di VPS dan isi dengan env production. Untuk domain:

```env
PORT=4444
CLIENT_ORIGIN=https://kmbgroup.id
```

Jalankan aplikasi:

```bash
pm2 start npm --name form-kmb -- start
pm2 save
pm2 startup
```

Konfigurasi Nginx:

```nginx
server {
  server_name kmbgroup.id www.kmbgroup.id;

  location / {
    proxy_pass http://127.0.0.1:4444;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Simpan ke `/etc/nginx/sites-available/kmbgroup.id`, lalu aktifkan:

```bash
sudo ln -s /etc/nginx/sites-available/kmbgroup.id /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d kmbgroup.id -d www.kmbgroup.id
```

## Auto Deploy dari GitHub

Tambahkan GitHub Actions secret di repo:

- `VPS_HOST`
- `VPS_USER`
- `VPS_SSH_KEY`
- `VPS_PORT` opsional, default `22`

Contoh workflow `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Deploy to VPS
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          port: ${{ secrets.VPS_PORT || '22' }}
          script: |
            cd /var/www/form-kmb
            git pull origin main
            npm install
            npm --prefix client install
            npm run build
            pm2 restart form-kmb || pm2 start npm --name form-kmb -- start
            pm2 save
```
