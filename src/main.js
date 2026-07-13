import "./style.css";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Papa from "papaparse";
import {
  STORES as DEFAULT_STORES,
  COLORS,
  FUEL_RATIO,
  FUEL_PRICE_PER_LITER,
} from "./stores.js";

// API key is read from .env (VITE_ORS_KEY=...). Copy .env.example to .env and fill in your key.
const ORS_KEY = import.meta.env.VITE_ORS_KEY || "";

// Data toko bisa diganti lewat import CSV, jadi disimpan sebagai variabel yang bisa diubah (bukan const import langsung)
let STORES = [...DEFAULT_STORES];

// ── STATE ───────────────────────────────────────────────────────────────────
let vehicleCount = 2;
let drivers = Array.from({ length: 2 }, () => ({ phone: "", name: "", plate: "" }));
let vehicleType = "CDE";
let selectedStores = new Set();
let lastResult = null;
let depotCoords = { lat: -6.2731161664465285, lon: 107.14379115302602 };
let depotName = "PT ICI Paints Indonesia (Dulux)";
let mapLayers = [];
let depotMarker = null;
let storeMarkers = [];

// ── MAP INIT ─────────────────────────────────────────────────────────────────
const map = L.map("map", { zoomControl: true }).setView([-6.25, 106.85], 11);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors",
  maxZoom: 19,
}).addTo(map);

// ── ICONS ────────────────────────────────────────────────────────────────────
function createDepotIcon() {
  return L.divIcon({
    html: `<div style="background:#CC1F1F;color:#fff;border:3px solid #fff;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,0.35);font-weight:800;">🏭</div>`,
    className: "",
    iconAnchor: [18, 18],
  });
}
function createStoreIcon(color, num) {
  return L.divIcon({
    html: `<div style="background:${color};color:#fff;border:2px solid #fff;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;box-shadow:0 2px 5px rgba(0,0,0,0.3);">${num}</div>`,
    className: "",
    iconAnchor: [13, 13],
  });
}
function createDefaultStoreIcon() {
  return L.divIcon({
    html: `<div style="background:#666;color:#fff;border:2px solid #fff;border-radius:4px;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:10px;box-shadow:0 1px 4px rgba(0,0,0,0.25);">📦</div>`,
    className: "",
    iconAnchor: [11, 11],
  });
}

function placeDepotMarker() {
  if (depotMarker) map.removeLayer(depotMarker);
  depotMarker = L.marker([depotCoords.lat, depotCoords.lon], {
    icon: createDepotIcon(),
    zIndexOffset: 1000,
  })
    .addTo(map)
    .bindPopup(`<b>🏭 ${depotName}</b><br>Titik awal & akhir rute`);
}

// ── BUILD STORE LIST ─────────────────────────────────────────────────────────
function buildStoreList(filter = "") {
  const list = document.getElementById("store-list");
  list.innerHTML = "";
  const lf = filter.toLowerCase();
  const areas = [...new Set(STORES.map((s) => s.area))];
  areas.forEach((area) => {
    const stores = STORES.filter(
      (s) =>
        s.area === area &&
        (!lf ||
          s.name.toLowerCase().includes(lf) ||
          s.addr.toLowerCase().includes(lf) ||
          s.area.toLowerCase().includes(lf)),
    );
    if (!stores.length) return;
    const hdr = document.createElement("div");
    hdr.className = "store-area-header";
    hdr.textContent = `${area} (${stores.length})`;
    list.appendChild(hdr);
    stores.forEach((s) => {
      const item = document.createElement("div");
      item.className = "store-item";
      item.innerHTML = `
        <input type="checkbox" id="store-${s.id}" ${selectedStores.has(s.id) ? "checked" : ""} />
        <div class="store-item-info">
          <div class="store-item-name">${s.name}</div>
          <div class="store-item-addr">${s.addr}</div>
        </div>`;
      item
        .querySelector("input")
        .addEventListener("change", () => toggleStore(s.id));
      item.addEventListener("click", (e) => {
        if (e.target.tagName !== "INPUT") toggleStore(s.id);
      });
      list.appendChild(item);
    });
  });
}

function filterStores() {
  buildStoreList(document.getElementById("store-search").value);
}

function toggleStore(id) {
  if (selectedStores.has(id)) selectedStores.delete(id);
  else selectedStores.add(id);
  const cb = document.getElementById(`store-${id}`);
  if (cb) cb.checked = selectedStores.has(id);
  updateSelectedCount();
  updateDefaultMarkers();
}

function selectAll() {
  STORES.forEach((s) => selectedStores.add(s.id));
  buildStoreList(document.getElementById("store-search").value);
  updateSelectedCount();
  updateDefaultMarkers();
}

function clearAllStores() {
  selectedStores.clear();
  buildStoreList(document.getElementById("store-search").value);
  updateSelectedCount();
  updateDefaultMarkers();
}

function updateSelectedCount() {
  document.getElementById("selected-count").textContent = selectedStores.size;
  document.getElementById("btn-optimize").disabled = selectedStores.size < 1;
}

function updateDefaultMarkers() {
  storeMarkers.forEach((m) => map.removeLayer(m));
  storeMarkers = [];
  if (lastResult) return; // Don't show default markers when result is active
  STORES.filter((s) => selectedStores.has(s.id)).forEach((s) => {
    const m = L.marker([s.lat, s.lon], { icon: createDefaultStoreIcon() })
      .addTo(map)
      .bindPopup(`<b>📦 ${s.name}</b><br>${s.addr}`);
    storeMarkers.push(m);
  });
}

// ── CSV IMPORT ───────────────────────────────────────────────────────────────
// Mendukung 2 format kolom CSV:
// 1) Format standar aplikasi: name, addr, lat, lon, area
// 2) Format "Detail Lokasi Pengiriman": NO, TOKO, PROVINSI, KOTA/KABUPATEN,
//    KETERANGAN, ALAMAT SP (LATLONG), JARAK FR WAREHOUSE (KM)
//    -> kolom LATLONG berisi "lat, lon" dalam satu sel.
function getField(row, ...keys) {
  for (const k of keys) {
    for (const rk of Object.keys(row)) {
      if (rk.trim().toLowerCase() === k.toLowerCase()) {
        const v = row[rk];
        if (v !== undefined && v !== null && String(v).trim() !== "")
          return String(v).trim();
      }
    }
  }
  return "";
}

function parseLatLon(value) {
  if (!value) return { lat: NaN, lon: NaN };
  const parts = value.split(",").map((p) => parseFloat(p.trim()));
  if (
    parts.length >= 2 &&
    Number.isFinite(parts[0]) &&
    Number.isFinite(parts[1])
  ) {
    return { lat: parts[0], lon: parts[1] };
  }
  return { lat: NaN, lon: NaN };
}

function normalizeCsvRow(row) {
  // Coba format "Detail Lokasi Pengiriman" dulu (kolom TOKO / ALAMAT SP (LATLONG) khas)
  const toko = getField(row, "TOKO");
  const latlongRaw = getField(
    row,
    "ALAMAT SP (LATLONG)",
    "LATLONG",
    "LAT LONG",
  );

  if (toko && latlongRaw) {
    const { lat, lon } = parseLatLon(latlongRaw);
    const kota = getField(row, "KOTA/KABUPATEN", "KOTA", "KABUPATEN");
    const provinsi = getField(row, "PROVINSI");
    const keterangan = getField(row, "KETERANGAN");
    const addrParts = [kota, provinsi].filter(Boolean);
    return {
      name: toko,
      addr: addrParts.join(", ") || keterangan || provinsi || kota,
      lat,
      lon,
      area: provinsi || kota || keterangan || "Import CSV",
    };
  }

  // Fallback: format standar name/addr/lat/lon/area
  const name = getField(row, "name", "nama");
  const addr = getField(row, "addr", "address", "alamat");
  const latStr = getField(row, "lat", "latitude");
  const lonStr = getField(row, "lon", "lng", "longitude");
  const lat = latStr ? parseFloat(latStr) : NaN;
  const lon = lonStr ? parseFloat(lonStr) : NaN;
  const area = getField(row, "area", "wilayah") || "Import CSV";

  return { name, addr, lat, lon, area };
}

function handleCsvFile(file) {
  const alertBox = document.getElementById("csv-alert");
  alertBox.innerHTML = "";

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      const rows = results.data;
      const errors = [];
      const parsed = [];

      rows.forEach((row, i) => {
        const { name, addr, lat, lon, area } = normalizeCsvRow(row);

        if (!name || !addr || !Number.isFinite(lat) || !Number.isFinite(lon)) {
          errors.push(
            `Baris ${i + 2}: data tidak lengkap/valid (nama, alamat, dan koordinat wajib diisi)`,
          );
          return;
        }
        parsed.push({ id: i + 1, name, addr, lat, lon, area });
      });

      if (parsed.length === 0) {
        alertBox.innerHTML = `<div class="alert alert-error">❌ Tidak ada data valid ditemukan di file CSV. Format yang didukung: (name, addr, lat, lon, area) atau (TOKO, PROVINSI, KOTA/KABUPATEN, ALAMAT SP (LATLONG)).</div>`;
        return;
      }

      STORES = parsed;
      selectedStores.clear();
      buildStoreList();
      updateSelectedCount();
      updateDefaultMarkers();
      clearResult();

      let msg = `✅ Berhasil import <b>${parsed.length}</b> titik pengiriman dari CSV.`;
      if (errors.length)
        msg += `<br><small>⚠️ ${errors.length} baris dilewati karena tidak valid.</small>`;
      alertBox.innerHTML = `<div class="alert alert-success">${msg}</div>`;
    },
    error: (err) => {
      alertBox.innerHTML = `<div class="alert alert-error">❌ Gagal membaca CSV: ${err.message}</div>`;
    },
  });
}

function downloadCsvTemplate() {
  const header = "NO,TOKO,PROVINSI,KOTA/KABUPATEN,KETERANGAN,ALAMAT SP (LATLONG)\n";
  const example =
    "1,CV ANDELA JAYA,JAWA BARAT,Kota Cirebon,ICI PAINT,-6.751383369072352, 108.53986894747766\n";
  const blob = new Blob([header + example], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "template-titik-pengiriman.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── VEHICLE COUNTER ──────────────────────────────────────────────────────────
function changeVehicle(delta) {
  vehicleCount = Math.max(1, Math.min(10, vehicleCount + delta));
  document.getElementById("vehicle-count").textContent = vehicleCount;
  while (drivers.length < vehicleCount) drivers.push({ phone: "", name: "", plate: "" });
  drivers.length = vehicleCount;
  buildDriverInputs();
  clearResult();
}

function buildDriverInputs() {
  const wrap = document.getElementById("driver-phone-inputs");
  wrap.innerHTML = "";
  for (let i = 0; i < vehicleCount; i++) {
    const driver = drivers[i] || { phone: "", name: "", plate: "" };
    const row = document.createElement("div");
    row.style.cssText =
      "display:flex;flex-wrap:wrap;align-items:flex-start;gap:6px;margin-bottom:8px;";
    row.innerHTML = `
      <span style="font-size:11px;color:var(--gray-600);white-space:nowrap;min-width:78px;">Kendaraan ${i + 1}</span>
      <input type="text" class="form-select" style="flex:1;min-width:120px;padding:6px 8px;font-size:12px;" placeholder="Nama Driver" data-driver-field="name" data-driver-index="${i}" value="${driver.name || ""}" />
      <input type="text" class="form-select" style="flex:1;min-width:120px;padding:6px 8px;font-size:12px;" placeholder="Nomor Polisi" data-driver-field="plate" data-driver-index="${i}" value="${driver.plate || ""}" />
      <input type="tel" class="form-select" style="flex:1;min-width:120px;padding:6px 8px;font-size:12px;" placeholder="6281234567890" data-driver-field="phone" data-driver-index="${i}" value="${driver.phone || ""}" />
    `;
    row.querySelectorAll("input").forEach((input) => {
      input.addEventListener("input", (e) => {
        const field = e.target.dataset.driverField;
        const idx = Number(e.target.dataset.driverIndex);
        if (!drivers[idx]) drivers[idx] = { phone: "", name: "", plate: "" };
        drivers[idx][field] = e.target.value.trim();
      });
    });
    wrap.appendChild(row);
  }
}

function onVehicleTypeChange() {
  vehicleType = document.getElementById("vehicle-type-select").value;
  clearResult();
}

// ── FUEL CALCULATION ─────────────────────────────────────────────────────────
// Menghitung konsumsi & biaya BBM berdasarkan jarak (km) dan tipe kendaraan
function calcFuel(distanceKm) {
  const ratio = FUEL_RATIO[vehicleType] || FUEL_RATIO.CDE;
  const liters = distanceKm / ratio;
  const cost = liters * FUEL_PRICE_PER_LITER;
  return { liters, cost, ratio };
}

function formatRupiah(num) {
  return "Rp" + Math.round(num).toLocaleString("id-ID");
}

// Selalu kembalikan angka valid (tidak pernah NaN) untuk ditampilkan
function safeNum(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

// ── TAB SWITCH ───────────────────────────────────────────────────────────────
function switchTab(id) {
  document.querySelectorAll(".tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.tab === id);
  });
  document
    .querySelectorAll(".tab-content")
    .forEach((c) => c.classList.remove("active"));
  document.getElementById(`tab-${id}`).classList.add("active");
}

// ── CLEAR RESULT ─────────────────────────────────────────────────────────────
function clearResult() {
  lastResult = null;
  mapLayers.forEach((l) => map.removeLayer(l));
  mapLayers = [];
  document.getElementById("map-legend").style.display = "none";
  document.getElementById("result-summary").innerHTML = "";
  document.getElementById("result-cards").innerHTML = "";
  document.getElementById("driver-panel").innerHTML =
    `<div class="alert alert-info">ℹ️ Jalankan optimasi terlebih dahulu untuk melihat panel pengiriman driver.</div>`;
  updateDefaultMarkers();
}

// ── OPTIMIZATION ─────────────────────────────────────────────────────────────
async function runOptimization() {
  if (selectedStores.size < 1) return;

  if (!ORS_KEY) {
    document.getElementById("input-alert").innerHTML =
      `<div class="alert alert-error">❌ VITE_ORS_KEY belum diatur. Salin .env.example ke .env dan isi API key OpenRouteService Anda.</div>`;
    return;
  }

  showLoading("Mengirim permintaan ke OpenRouteService API...");
  document.getElementById("input-alert").innerHTML = "";

  const selectedList = STORES.filter((s) => selectedStores.has(s.id));

  const vehicles = Array.from({ length: vehicleCount }, (_, i) => ({
    id: i + 1,
    // NOTE: 'driving-hgv' butuh izin khusus di API key ORS.
    // Kalau key Anda punya akses HGV, ganti profile ini kembali ke 'driving-hgv'.
    profile: "driving-car",
    start: [depotCoords.lon, depotCoords.lat],
    end: [depotCoords.lon, depotCoords.lat],
    description: `Kendaraan ${i + 1} (${vehicleType})`,
  }));

  const jobs = selectedList.map((s) => ({
    id: s.id,
    description: s.name,
    location: [s.lon, s.lat],
    service: 600,
  }));

  const payload = { vehicles, jobs };

  try {
    updateLoadingText("Solver VRP sedang memproses...");
    const optRes = await fetch(
      "https://api.openrouteservice.org/optimization",
      {
        method: "POST",
        headers: { Authorization: ORS_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    if (!optRes.ok) {
      const err = await optRes.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(err.error?.message || `API Error ${optRes.status}`);
    }

    const optData = await optRes.json();
    updateLoadingText("Mengambil geometri rute dari peta...");

    const routeGeometries = await Promise.all(
      optData.routes.map(async (route) => {
        const stops = route.steps.filter(
          (s) => s.type === "job" || s.type === "start" || s.type === "end",
        );
        if (stops.length < 2) return null;
        const coords = stops.map((s) => s.location);
        try {
          // NOTE: 'driving-hgv' butuh izin khusus di API key ORS.
          // Kalau key Anda punya akses HGV, ganti kembali ke 'driving-hgv'.
          const dirRes = await fetch(
            "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
            {
              method: "POST",
              headers: {
                Authorization: ORS_KEY,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ coordinates: coords }),
            },
          );
          if (!dirRes.ok) {
            const errBody = await dirRes.json().catch(() => null);
            console.warn("Directions API gagal:", dirRes.status, errBody);
            return null;
          }
          const dirData = await dirRes.json();
          const feature = dirData.features?.[0];
          const summary = feature?.properties?.summary; // { distance (m), duration (s) }
          return {
            coordinates: feature?.geometry?.coordinates || null,
            distance: summary?.distance ?? null,
            duration: summary?.duration ?? null,
          };
        } catch (e) {
          console.warn("Directions API error:", e);
          return null;
        }
      }),
    );

    // Gunakan jarak/waktu dari Directions API (lebih dapat diandalkan) sebagai sumber utama;
    // fallback ke data dari Optimization API, lalu fallback terakhir ke 0 (tidak pernah NaN).
    optData.routes.forEach((route, ri) => {
      const g = routeGeometries[ri];
      if (g && typeof g.distance === "number") route.distance = g.distance;
      if (g && typeof g.duration === "number") route.duration = g.duration;
      route.distance = safeNum(route.distance, 0);
      route.duration = safeNum(route.duration, 0);
      if (route.distance === 0) {
        console.warn(
          `Kendaraan ${ri + 1}: jarak tidak terdeteksi dari ORS. Cek console untuk error Directions API di atas (kemungkinan API key tidak punya akses profil routing, atau kuota habis).`,
        );
      }
    });

    lastResult = { optData, routeGeometries, selectedList };
    hideLoading();
    renderResult(optData, routeGeometries, selectedList);
  } catch (err) {
    hideLoading();
    document.getElementById("input-alert").innerHTML =
      `<div class="alert alert-error">❌ ${err.message}</div>`;
  }
}

// ── RENDER RESULT ─────────────────────────────────────────────────────────────
function renderResult(optData, routeGeometries, selectedList) {
  mapLayers.forEach((l) => map.removeLayer(l));
  mapLayers = [];
  storeMarkers.forEach((m) => map.removeLayer(m));
  storeMarkers = [];

  const routes = optData.routes;
  const unassigned = optData.unassigned || [];
  const bounds = [];

  bounds.push([depotCoords.lat, depotCoords.lon]);

  routes.forEach((route, ri) => {
    const color = COLORS[ri % COLORS.length];
    const geom = routeGeometries[ri];
    const coords = geom?.coordinates;

    if (coords && coords.length > 1) {
      const latlngs = coords.map((c) => [c[1], c[0]]);
      const poly = L.polyline(latlngs, {
        color,
        weight: 5,
        opacity: 0.85,
      }).addTo(map);
      mapLayers.push(poly);
      latlngs.forEach((ll) => bounds.push(ll));
    }

    let stopNum = 1;
    route.steps
      .filter((s) => s.type === "job")
      .forEach((step) => {
        const store = selectedList.find((s) => s.id === step.job);
        if (!store) return;
        const m = L.marker([store.lat, store.lon], {
          icon: createStoreIcon(color, stopNum),
        })
          .addTo(map)
          .bindPopup(
            `<b style="color:${color}">🚛 Kendaraan ${ri + 1} — Stop ${stopNum}</b><br><b>${store.name}</b><br>${store.addr}`,
          );
        mapLayers.push(m);
        bounds.push([store.lat, store.lon]);
        stopNum++;
      });
  });

  unassigned.forEach((u) => {
    const store = selectedList.find((s) => s.id === u.id);
    if (!store) return;
    const m = L.marker([store.lat, store.lon], {
      icon: createDefaultStoreIcon(),
    })
      .addTo(map)
      .bindPopup(
        `<b>⚠️ Tidak Teralokasi</b><br>${store.name}<br><small>Tambah kendaraan atau kurangi titik pengiriman</small>`,
      );
    mapLayers.push(m);
    bounds.push([store.lat, store.lon]);
  });

  if (bounds.length > 1) map.fitBounds(bounds, { padding: [40, 40] });

  const legendDiv = document.getElementById("map-legend");
  const legendItems = document.getElementById("legend-items");
  legendItems.innerHTML = "";
  routes.forEach((r, i) => {
    const el = document.createElement("div");
    el.className = "legend-item";
    const jobs = r.steps.filter((s) => s.type === "job").length;
    el.innerHTML = `<div class="legend-color" style="background:${COLORS[i]};height:5px;"></div><span>Kendaraan ${i + 1} (${jobs} titik)</span>`;
    legendItems.appendChild(el);
  });
  if (unassigned.length) {
    const el = document.createElement("div");
    el.className = "legend-item";
    el.innerHTML = `<div class="legend-color" style="background:#999;"></div><span>⚠️ ${unassigned.length} tidak teralokasi</span>`;
    legendItems.appendChild(el);
  }
  legendDiv.style.display = "block";

  buildResultPanel(optData, selectedList);
  buildDriverPanel(optData, selectedList);
  switchTab("result");
}

// ── RESULT PANEL ─────────────────────────────────────────────────────────────
function buildResultPanel(optData, selectedList) {
  const routes = optData.routes;
  const unassigned = optData.unassigned || [];

  let totalDist = 0,
    totalDur = 0;
  routes.forEach((r) => {
    totalDist += r.distance;
    totalDur += r.duration;
  });
  const totalDistKm = totalDist / 1000;
  const totalFuel = calcFuel(totalDistKm);

  const summary = document.getElementById("result-summary");
  summary.innerHTML = `
    <div class="alert alert-success">
      ✅ Optimasi berhasil! <b>${routes.length}</b> kendaraan (${vehicleType}) dialokasikan untuk <b>${selectedList.length - unassigned.length}</b> titik pengiriman.
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:2px;">
      <div style="background:var(--red-light);border-radius:8px;padding:10px;text-align:center;">
        <div style="font-size:18px;font-weight:800;color:var(--red);">${routes.length}</div>
        <div style="font-size:11px;color:var(--gray-600);">Kendaraan</div>
      </div>
      <div style="background:#E3F2FD;border-radius:8px;padding:10px;text-align:center;">
        <div style="font-size:18px;font-weight:800;color:var(--blue);">${totalDistKm.toFixed(1)} km</div>
        <div style="font-size:11px;color:var(--gray-600);">Total Jarak</div>
      </div>
      <div style="background:#E8F5E9;border-radius:8px;padding:10px;text-align:center;">
        <div style="font-size:18px;font-weight:800;color:var(--green);">${Math.round(totalDur / 60)} mnt</div>
        <div style="font-size:11px;color:var(--gray-600);">Est. Waktu</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
      <div style="background:#FFF3E0;border-radius:8px;padding:10px;text-align:center;">
        <div style="font-size:18px;font-weight:800;color:var(--amber);">${totalFuel.liters.toFixed(1)} L</div>
        <div style="font-size:11px;color:var(--gray-600);">Est. BBM (1:${totalFuel.ratio} km/L)</div>
      </div>
      <div style="background:#FFEBEE;border-radius:8px;padding:10px;text-align:center;">
        <div style="font-size:18px;font-weight:800;color:var(--red);">${formatRupiah(totalFuel.cost)}</div>
        <div style="font-size:11px;color:var(--gray-600);">Est. Biaya BBM</div>
      </div>
    </div>`;
  if (unassigned.length) {
    summary.innerHTML += `<div class="alert alert-warn">⚠️ ${unassigned.length} titik tidak teralokasi. Tambah jumlah kendaraan.</div>`;
  }
  if (routes.some((r) => r.distance === 0)) {
    summary.innerHTML += `<div class="alert alert-error">❌ Jarak beberapa kendaraan tidak terdeteksi (0 km). Cek Console browser (F12) untuk detail error dari OpenRouteService — kemungkinan API key tidak punya akses/kuota habis.</div>`;
  }

  const cards = document.getElementById("result-cards");
  cards.innerHTML = '<hr class="divider" style="margin:4px 0 8px;">';

  routes.forEach((route, ri) => {
    const color = COLORS[ri % COLORS.length];
    const jobs = route.steps.filter((s) => s.type === "job");
    const distKm = route.distance / 1000;
    const durMin = Math.round(route.duration / 60);
    const fuel = calcFuel(distKm);

    let stopsHtml = `<div class="route-stops">`;
    stopsHtml += `<div class="route-stop"><div class="stop-num" style="background:${color};border-radius:4px;width:20px;height:20px;">🏭</div><span class="stop-home">${depotName} (Start)</span></div>`;
    jobs.forEach((step, si) => {
      const store = selectedList.find((s) => s.id === step.job);
      const nm = store ? store.name : `Job ${step.job}`;
      stopsHtml += `<div class="route-stop"><div class="stop-num" style="background:${color};">${si + 1}</div><span class="stop-name">${nm}</span></div>`;
    });
    stopsHtml += `<div class="route-stop"><div class="stop-num" style="background:${color};border-radius:4px;width:20px;height:20px;">🏭</div><span class="stop-home">${depotName} (End)</span></div>`;
    stopsHtml += "</div>";

    cards.innerHTML += `
      <div class="result-card">
        <div class="result-card-header" style="background:${color}15;border-bottom:2px solid ${color}30;">
          <span style="color:${color}">🚛 Kendaraan ${ri + 1}</span>
          <span style="font-size:11px;color:var(--gray-600);font-weight:400;">${jobs.length} titik pengiriman</span>
        </div>
        <div class="result-card-body">
          <div class="result-stat"><span class="result-stat-label">📏 Total Jarak</span><span class="result-stat-value">${distKm.toFixed(1)} km</span></div>
          <div class="result-stat"><span class="result-stat-label">⏱️ Est. Waktu</span><span class="result-stat-value">${durMin} menit</span></div>
          <div class="result-stat"><span class="result-stat-label">⛽ Est. BBM (${vehicleType})</span><span class="result-stat-value">${fuel.liters.toFixed(1)} L</span></div>
          <div class="result-stat"><span class="result-stat-label">💰 Est. Biaya BBM</span><span class="result-stat-value">${formatRupiah(fuel.cost)}</span></div>
          ${stopsHtml}
          <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn btn-outline btn-sm" data-focus="${ri}">🗺️ Fokus Peta</button>
            <button class="btn btn-green btn-sm" data-gmaps="${ri}">📍 Google Maps</button>
          </div>
        </div>
      </div>`;
  });

  cards
    .querySelectorAll("[data-focus]")
    .forEach((btn) =>
      btn.addEventListener("click", () =>
        focusRoute(Number(btn.dataset.focus)),
      ),
    );
  cards
    .querySelectorAll("[data-gmaps]")
    .forEach((btn) =>
      btn.addEventListener("click", () =>
        openGoogleMaps(Number(btn.dataset.gmaps)),
      ),
    );
}

// ── DRIVER PANEL ─────────────────────────────────────────────────────────────
function buildDriverPanel(optData, selectedList) {
  const routes = optData.routes;
  const panel = document.getElementById("driver-panel");

  let html = `<div class="form-group"><div class="form-label">👨‍✈️ Pengiriman Per Kendaraan</div></div>`;
  html += `<div class="alert alert-info" style="margin-bottom:10px;">📱 Salin pesan untuk dikirim ke driver via WhatsApp</div>`;

  routes.forEach((route, ri) => {
    const color = COLORS[ri % COLORS.length];
    const jobs = route.steps.filter((s) => s.type === "job");
    const distKm = (route.distance / 1000).toFixed(1);
    const durMin = Math.round(route.duration / 60);

    const driver = drivers[ri] || { name: "", plate: "", phone: "" };
    html += `
      <div class="result-card" style="margin-bottom:10px;">
        <div class="result-card-header" style="background:${color}15;border-bottom:2px solid ${color}30;">
          <span style="color:${color}">🚛 Kendaraan ${ri + 1}</span>
          <span style="font-size:11px;">${distKm} km · ${durMin} mnt</span>
        </div>
        <div class="result-card-body">
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">
            <div style="flex:1;min-width:140px;font-size:12px;color:var(--gray-600);">
              <strong>${driver.name || "Driver belum diisi"}</strong><br />
              ${driver.plate ? `Polisi: ${driver.plate}` : "Nomor polisi belum diisi"}
            </div>
            <div style="flex:1;min-width:140px;font-size:12px;color:var(--gray-600);">
              ${driver.phone ? `WA: ${driver.phone}` : "Nomor WA belum diisi"}
            </div>
          </div>
          <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;">
            <button class="btn btn-green btn-sm" data-wa="${ri}">💬 Pesan WA Driver</button>
            <button class="btn btn-outline btn-sm" data-gmaps2="${ri}">📍 Google Maps</button>
          </div>
          <div style="font-size:12px;font-weight:700;color:var(--gray-600);margin-bottom:4px;">URUTAN PENGIRIMAN:</div>`;
    jobs.forEach((step, si) => {
      const store = selectedList.find((s) => s.id === step.job);
      if (!store) return;
      const mapsUrl = `https://maps.google.com/?q=${store.lat},${store.lon}`;
      html += `
        <div style="display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px solid var(--gray-200);">
          <div class="stop-num" style="background:${color};flex-shrink:0;">${si + 1}</div>
          <div style="flex:1;">
            <div style="font-weight:600;font-size:12px;">${store.name}</div>
            <div style="font-size:11px;color:var(--gray-600);">${store.addr}</div>
          </div>
          <a href="${mapsUrl}" target="_blank" style="font-size:10px;color:var(--blue);text-decoration:none;white-space:nowrap;padding-top:2px;">📍 Maps</a>
        </div>`;
    });
    html += `</div></div>`;
  });

  panel.innerHTML = html;
  panel
    .querySelectorAll("[data-wa]")
    .forEach((btn) =>
      btn.addEventListener("click", () => showWaModal(Number(btn.dataset.wa))),
    );
  panel
    .querySelectorAll("[data-gmaps2]")
    .forEach((btn) =>
      btn.addEventListener("click", () =>
        openGoogleMaps(Number(btn.dataset.gmaps2)),
      ),
    );
}

// ── WHATSAPP ──────────────────────────────────────────────────────────────────
function showWaModal(routeIdx) {
  if (!lastResult) return;
  const { optData, selectedList } = lastResult;
  const route = optData.routes[routeIdx];
  const jobs = route.steps.filter((s) => s.type === "job");
  const distKmNum = route.distance / 1000;
  const distKm = distKmNum.toFixed(1);
  const durMin = Math.round(route.duration / 60);
  const fuel = calcFuel(distKmNum);
  const today = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  let msg = `🚛 *PENUGASAN PENGIRIMAN B-LOG*\n`;
  msg += `📅 ${today}\n`;
  const driver = drivers[routeIdx] || { name: "", plate: "", phone: "" };
  msg += `🔑 Kendaraan ${routeIdx + 1} (${vehicleType})\n`;
  msg += `👤 Driver: ${driver.name || "-"}\n`;
  msg += `🚘 Nomor Polisi: ${driver.plate || "-"}\n`;
  msg += `📱 WA: ${driver.phone || "-"}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;
  msg += `📍 *START:* ${depotName}\n\n`;
  msg += `📦 *TITIK PENGIRIMAN (${jobs.length} titik):*\n`;
  jobs.forEach((step, si) => {
    const store = selectedList.find((s) => s.id === step.job);
    if (!store) return;
    msg += `\n${si + 1}. *${store.name}*\n   📌 ${store.addr}\n   🗺️ https://maps.google.com/?q=${store.lat},${store.lon}\n`;
  });
  msg += `\n📍 *END:* ${depotName}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `📏 Total jarak: *${distKm} km*\n`;
  msg += `⏱️ Est. waktu: *${durMin} menit*\n`;
  msg += `⛽ Est. BBM: *${fuel.liters.toFixed(1)} L* (± ${formatRupiah(fuel.cost)})\n\n`;
  msg += `_Pesan ini dibuat otomatis oleh Sistem Optimasi Rute B-LOG_\n`;
  msg += `_Dispatcher: PT Trimitra Trans Persada_`;

  document.getElementById("wa-msg-text").textContent = msg;
  document.getElementById("wa-send-btn").onclick = () => {
    const phone = (drivers[routeIdx]?.phone || "").replace(/[^0-9]/g, "");
    const waUrl = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, "_blank");
  };
  document.getElementById("wa-modal").classList.add("show");
}

function closeWaModal() {
  document.getElementById("wa-modal").classList.remove("show");
}
function copyWaMsg() {
  navigator.clipboard
    .writeText(document.getElementById("wa-msg-text").textContent)
    .then(() => {
      const btn = document.querySelector("#wa-modal .btn-outline");
      btn.textContent = "✅ Tersalin!";
      setTimeout(() => (btn.textContent = "📋 Salin Pesan"), 2000);
    });
}

// ── GOOGLE MAPS ───────────────────────────────────────────────────────────────
function openGoogleMaps(routeIdx) {
  if (!lastResult) return;
  const { optData, selectedList } = lastResult;
  const route = optData.routes[routeIdx];
  const jobs = route.steps.filter((s) => s.type === "job");
  const origin = `${depotCoords.lat},${depotCoords.lon}`;
  const destination = origin;
  const waypoints = jobs
    .map((step) => {
      const store = selectedList.find((s) => s.id === step.job);
      return store ? `${store.lat},${store.lon}` : null;
    })
    .filter(Boolean)
    .join("|");
  const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}&travelmode=driving`;
  window.open(url, "_blank");
}

// ── FOCUS ROUTE ON MAP ───────────────────────────────────────────────────────
function focusRoute(routeIdx) {
  if (!lastResult) return;
  const { optData, selectedList } = lastResult;
  const route = optData.routes[routeIdx];
  const bounds = [[depotCoords.lat, depotCoords.lon]];
  route.steps
    .filter((s) => s.type === "job")
    .forEach((step) => {
      const store = selectedList.find((s) => s.id === step.job);
      if (store) bounds.push([store.lat, store.lon]);
    });
  if (bounds.length > 1) map.fitBounds(bounds, { padding: [60, 60] });
  switchTab("result");
}

// ── LOADING ───────────────────────────────────────────────────────────────────
function showLoading(msg) {
  document.getElementById("loading-text").innerHTML = msg;
  document.getElementById("loading").classList.add("show");
}
function updateLoadingText(msg) {
  document.getElementById("loading-text").innerHTML = msg;
}
function hideLoading() {
  document.getElementById("loading").classList.remove("show");
}

// ── EVENT BINDINGS ───────────────────────────────────────────────────────────
document
  .querySelectorAll(".tab")
  .forEach((t) => t.addEventListener("click", () => switchTab(t.dataset.tab)));
document
  .getElementById("vehicle-type-select")
  .addEventListener("change", onVehicleTypeChange);
document.getElementById("csv-file-input").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) handleCsvFile(file);
  e.target.value = ""; // reset agar bisa upload file yang sama lagi
});
document
  .getElementById("btn-download-template")
  .addEventListener("click", downloadCsvTemplate);
document
  .getElementById("btn-veh-dec")
  .addEventListener("click", () => changeVehicle(-1));
document
  .getElementById("btn-veh-inc")
  .addEventListener("click", () => changeVehicle(1));
document.getElementById("store-search").addEventListener("input", filterStores);
document.getElementById("btn-select-all").addEventListener("click", selectAll);
document
  .getElementById("btn-clear-all")
  .addEventListener("click", clearAllStores);
document
  .getElementById("btn-optimize")
  .addEventListener("click", runOptimization);
document.getElementById("btn-wa-close").addEventListener("click", closeWaModal);
document.getElementById("btn-wa-copy").addEventListener("click", copyWaMsg);

// ── INIT ──────────────────────────────────────────────────────────────────────
buildStoreList();
placeDepotMarker();
buildDriverInputs();
