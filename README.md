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
