# B-LOG — Sistem Optimasi Rute Pengiriman

Vite + vanilla JS + Leaflet project untuk optimasi rute pengiriman (VRP) menggunakan OpenRouteService.

## Setup

```bash
npm install
cp .env.example .env
# lalu edit .env dan isi VITE_ORS_KEY dengan API key OpenRouteService Anda
npm run dev
```

## Build produksi

```bash
npm run build
npm run preview
```

## Deploy ke Vercel

Project ini bisa dijalankan di Vercel sebagai aplikasi statis. File konfigurasi `vercel.json` sudah disiapkan untuk membangun output ke folder `dist`.

1. Push repository ini ke GitHub.
2. Sambungkan repository GitHub Anda ke Vercel melalui dashboard Vercel.
3. Atur environment variable `VITE_ORS_KEY` di dashboard Vercel.
4. Deploy langsung dari dashboard Vercel, atau gunakan GitHub Actions untuk deployment otomatis.

### Deploy otomatis via GitHub Actions

Terdapat workflow GitHub Actions di `.github/workflows/vercel-deploy.yml`.

- Buat secret `VERCEL_TOKEN` di repository GitHub Anda.
- Buat secret `VITE_ORS_KEY` di repository GitHub Anda.

Workflow akan berjalan setiap push ke `main` dan:

1. Checkout kode
2. Install dependency
3. Build `dist`
4. Deploy ke Vercel menggunakan `npx vercel --prod --prebuilt --confirm --token "$VERCEL_TOKEN"`

Jika menggunakan Vercel CLI secara manual:

```bash
vercel --prod
```

## Struktur

- `index.html` — markup halaman
- `src/main.js` — logic aplikasi (peta, optimasi rute, panel driver, WhatsApp, import CSV)
- `src/stores.js` — data toko default & palet warna
- `src/style.css` — semua styling

## Import Titik Pengiriman via CSV

Di tab **Input**, gunakan tombol **Pilih File CSV** untuk mengganti data toko/titik
pengiriman dengan data Anda sendiri. Klik **Template** untuk mengunduh contoh format CSV.

Kolom CSV:
| Kolom | Wajib | Keterangan |
|---|---|---|
| `name` | ✅ | Nama toko/tujuan |
| `addr` | ✅ | Alamat |
| `lat` | ✅ | Latitude (desimal) |
| `lon` | ✅ | Longitude (desimal) |
| `area` | ❌ | Nama wilayah/kategori (opsional) |

Data hasil import akan menggantikan seluruh data toko default dan langsung tampil
di daftar toko + peta. Baris yang datanya tidak lengkap/valid akan dilewati dan
dilaporkan di layar.

## Catatan keamanan

API key OpenRouteService sebelumnya ter-hardcode di file HTML asli. Pada project ini
key dipindahkan ke environment variable (`VITE_ORS_KEY`) via `.env` — jangan commit
file `.env` ke git (sudah masuk `.gitignore`). Untuk produksi, sebaiknya panggilan
ke OpenRouteService dilakukan lewat backend proxy agar key tidak terekspos ke browser.
