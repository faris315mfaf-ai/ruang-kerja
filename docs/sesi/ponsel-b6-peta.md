# Peta riil di Absen — proxy ubin OSM + `PetaRiil` (B6)

> 14 Okt 2026 · Claude Code (agen M2) · branch `claude/android-bagian-5`. Permintaan pemilik: "maps di absen adalah maps riil" (kartu lokasi di layar Absen sebelumnya hanya sketsa SVG).

## Endpoint

`GET /api/v1/peta/{z}/{x}/{y}` — `routes/api/auth/b6-peta.php` (nama `api.v1.map.tile`), `App\Http\Controllers\Api\Map\TileController`.

| Hal | Nilai |
|---|---|
| Auth | `Authorization: Bearer <token Sanctum>` (401 tanpa token) |
| Limiter | `throttle:600,1,peta` per pengguna. Limiter grup `api-v1` (60/menit) **dilepas** untuk rute ini lewat `withoutMiddleware('throttle:api-v1')`: satu kartu memuat belasan ubin sekaligus dan tidak boleh menghabiskan jatah endpoint lain |
| Parameter | `z` 14–18; `x`,`y` 0…2^z−1. Di luar jangkauan → **422** `{message, code: "invalid_tile"}`; segmen bukan angka / terlalu panjang → 404 |
| Sukses | **200** `image/png`, `Cache-Control: private, max-age=604800` (7 hari), `X-Content-Type-Options: nosniff` |
| Upstream gagal / bukan PNG / timeout 5 dtk | **204** tanpa isi, `Cache-Control: no-store`; ubin yang sama tidak diminta ke OSM lagi selama 60 detik (cache `osm-tile-fail:*`). Aplikasi membaca ini sebagai ubin kosong dan memakai sketsa |
| Cache server | Disk privat (`Storage::disk('local')`, `osm-tiles/{z}/{x}/{y}.png`), TTL 7 hari berdasarkan `lastModified`; ubin yang masih segar tidak pernah diambil dua kali. Sumber: `config('services.osm.tile_url')`, `User-Agent` deskriptif `config('services.osm.user_agent')` (env `OSM_USER_AGENT`) |

Tes: `tests/Feature/Api/MapTileApiTest.php` (11 tes: miss/hit + UA, TTL kedaluwarsa, 204 + jeda saat upstream 503, tolak body bukan PNG, zoom/koordinat di luar jangkauan, 404 segmen aneh, 401, bebas limiter 60/menit).

## Kebijakan OpenStreetMap

- Ubin diambil **server** (bukan ponsel): satu permintaan ke OSM per ubin per 7 hari untuk seluruh perusahaan, User-Agent mengidentifikasi aplikasi (`RuangKerja/1.0 (+https://spkd.store)`), sesuai Tile Usage Policy (https://operations.osmfoundation.org/policies/tiles/). Ponsel tidak membuka `tile.openstreetmap.org`, jadi IP/koordinat karyawan tidak sampai ke pihak ketiga.
- Pemakaian ringan (puluhan karyawan, zoom 15–18 sekitar kantor) wajar untuk server ubin komunitas. Bila nanti ramai/ratusan pengguna: ganti `OSM_TILE_URL` ke penyedia ubin sendiri (mis. MapTiler/Stadia berkunci API) tanpa mengubah aplikasi — proxy sudah menjadi titik tunggal.
- **Atribusi wajib** "© OpenStreetMap contributors" tampil di pojok kanan bawah peta (`PetaRiil`) begitu minimal satu ubin termuat. Data OSM berlisensi ODbL.
- `StampedSelfie.php` (stempel selfie WhatsApp) memakai cache dan konfigurasi `services.osm` yang sama tetapi kunci cache sendiri (`osm-tile:*`, 24 jam, Redis); tidak diubah.

## Aplikasi

- `apps/mobile/src/features/absensi/PetaRiil.tsx` (dipakai `KartuLokasi.tsx`, menggantikan `Sketsa`), perhitungan murni di `petaMath.ts` (uji: `npm run test:peta`).
- Kartu 168 dp. Zoom efektif dipilih otomatis 15–17 supaya lingkaran geofence kantor **dan** titik pengguna sama-sama terlihat (radius 100 m → zoom 16; radius kecil → 17; pengguna sangat jauh → zoom 15 dan titik dijepit di tepi). Ubin diambil satu zoom lebih rapat (retina) dan digambar 128 dp; sekitar 12 ubin.
- Lingkaran geofence skala sebenarnya (meter per piksel menurut lintang), penanda kantor, titik pengguna + cincin akurasi, nama kantor, atribusi. Statis (tidak bisa digeser/diketuk).
- Lapisan bawah = sketsa lama (latar + grid): ubin yang belum termuat/gagal/offline tidak merusak layar. Tombol "Perbarui lokasi" mencoba ulang ubin yang gagal.
- Titik GPS ditahan: peta hanya digambar ulang bila posisi bergeser > 15 m atau akurasi berubah > 25 m. Ubin di-memo per ubin; `Image` RN memakai cache Fresco dan header cache server 7 hari.
- Mode malam: ubin tetap terang, diredupkan dengan lapisan token `scrim` (opasitas 0,5). TalkBack: "Peta: Anda 120 m dari Kantor Pusat".
- `src/api/client.ts` mendapat `tokenSaatIni()` agar `Image` bisa mengirim header Bearer.

## Verifikasi

- Pest: 11 tes hijau; Pint + PHPStan bersih. `tsc --noEmit` dan `eslint .` bersih; `npm run test:peta` OK.
- Proxy diuji langsung ke OSM lewat server lokal (`php -S` :8001): 200 `image/png` 256×256, tanpa token 401, zoom 12 → 422.
- **Belum diuji di emulator**: tidak ada APK debug (dev client) untuk bagian 5 di mesin ini — hanya APK release (tanpa Metro) — dan membangun native di luar lingkup tugas. Pratinjau komposisi dibuat dengan skrip yang memakai rencana asli `petaMath` + ubin asli dari proxy.
