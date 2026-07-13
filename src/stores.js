export const STORES = [
  // JAKARTA PUSAT
  { id:1,  name:'Toko Maju Jaya',       addr:'Jl. Kramat Raya No.45, Senen',               lat:-6.1832, lon:106.8481, area:'Jakarta Pusat' },
  { id:2,  name:'UD Sumber Rezeki',     addr:'Jl. Cempaka Putih Timur No.22',               lat:-6.1712, lon:106.8712, area:'Jakarta Pusat' },
  { id:3,  name:'Toko Sentosa Abadi',   addr:'Jl. Gunung Sahari Raya No.8',                 lat:-6.1592, lon:106.8401, area:'Jakarta Pusat' },
  // JAKARTA UTARA
  { id:4,  name:'CV Nusantara Jaya',    addr:'Jl. Pluit Raya No.12, Penjaringan',           lat:-6.1175, lon:106.7926, area:'Jakarta Utara' },
  { id:5,  name:'Toko Harapan Baru',    addr:'Jl. Yos Sudarso No.55, Tanjung Priok',        lat:-6.1283, lon:106.8672, area:'Jakarta Utara' },
  // JAKARTA BARAT
  { id:6,  name:'UD Makmur Sentosa',    addr:'Jl. Daan Mogot KM 12, Cengkareng',            lat:-6.1563, lon:106.7411, area:'Jakarta Barat' },
  { id:7,  name:'Toko Berkah Jaya',     addr:'Jl. Panjang No.33, Kebon Jeruk',              lat:-6.1912, lon:106.7764, area:'Jakarta Barat' },
  { id:8,  name:'CV Indah Permai',      addr:'Jl. Raya Kembangan No.17',                    lat:-6.1823, lon:106.7513, area:'Jakarta Barat' },
  // JAKARTA SELATAN
  { id:9,  name:'Toko Mulia Raya',      addr:'Jl. Raya Pasar Minggu No.28',                 lat:-6.2895, lon:106.8451, area:'Jakarta Selatan' },
  { id:10, name:'UD Cahaya Terang',     addr:'Jl. TB Simatupang No.41, Lebak Bulus',        lat:-6.3126, lon:106.7814, area:'Jakarta Selatan' },
  { id:11, name:'Toko Sari Rejeki',     addr:'Jl. Fatmawati Raya No.9, Cilandak',           lat:-6.2914, lon:106.7936, area:'Jakarta Selatan' },
  // JAKARTA TIMUR
  { id:12, name:'CV Putra Mandiri',     addr:'Jl. Raya Bogor KM 22, Kramat Jati',           lat:-6.2812, lon:106.8853, area:'Jakarta Timur' },
  { id:13, name:'Toko Bintang Timur',   addr:'Jl. Condet Raya No.67, Kramat Jati',          lat:-6.2735, lon:106.8764, area:'Jakarta Timur' },
  { id:14, name:'UD Mitra Usaha',       addr:'Jl. Pondok Kelapa Raya No.15, Duren Sawit',   lat:-6.2456, lon:106.9245, area:'Jakarta Timur' },
  // BEKASI
  { id:15, name:'Toko Jaya Abadi',      addr:'Jl. Ahmad Yani No.33, Bekasi Barat',          lat:-6.2423, lon:106.9937, area:'Bekasi' },
  { id:16, name:'CV Maju Bersama',      addr:'Jl. Ir H Juanda No.52, Bekasi Timur',         lat:-6.2356, lon:107.0198, area:'Bekasi' },
  { id:17, name:'UD Sinar Harapan',     addr:'Jl. Raya Pekayon No.8, Bekasi Selatan',       lat:-6.2712, lon:107.0034, area:'Bekasi' },
  { id:18, name:'Toko Barokah',         addr:'Jl. Raya Cikunir No.5, Jatiasih',             lat:-6.3012, lon:107.0156, area:'Bekasi' },
  // DEPOK
  { id:19, name:'Toko Subur Makmur',    addr:'Jl. Margonda Raya No.78, Depok',              lat:-6.3945, lon:106.8237, area:'Depok' },
  { id:20, name:'CV Anugrah Jaya',      addr:'Jl. Raya Sawangan No.45, Pancoran Mas',       lat:-6.4123, lon:106.8012, area:'Depok' },
  // TANGERANG
  { id:21, name:'UD Prima Jaya',        addr:'Jl. Imam Bonjol No.22, Tangerang Kota',       lat:-6.1784, lon:106.6329, area:'Tangerang' },
  { id:22, name:'Toko Lestari',         addr:'Jl. Raya Serpong No.18, Serpong',             lat:-6.3123, lon:106.6645, area:'Tangerang' },
  { id:23, name:'CV Mitra Sejati',      addr:'Jl. Raya Legok No.11, Tangerang',             lat:-6.2456, lon:106.6234, area:'Tangerang' },
  // BOGOR
  { id:24, name:'Toko Gemilang',        addr:'Jl. Pajajaran No.55, Bogor Tengah',           lat:-6.5921, lon:106.7979, area:'Bogor' },
  { id:25, name:'UD Berkah Abadi',      addr:'Jl. Raya Cibinong No.33, Cibinong',           lat:-6.4756, lon:106.8512, area:'Bogor' },
];

export const COLORS = ['#CC1F1F','#1565C0','#1A8754','#B45309','#6A1B9A','#00838F','#E91E63','#37474F','#FF6F00','#2E7D32'];
export const COLOR_NAMES = ['Merah','Biru','Hijau','Kuning','Ungu','Teal','Pink','Abu-abu','Orange','Hijau Tua'];

// ── FUEL CONSUMPTION ─────────────────────────────────────────────────────────
// Rasio konsumsi bahan bakar per tipe kendaraan (km per liter)
export const FUEL_RATIO = {
  CDE: 10, // 1 : 10 km/liter
  CDD: 7,  // 1 : 7 km/liter
};

// Harga BBM per liter (Rupiah)
export const FUEL_PRICE_PER_LITER = 6800;
