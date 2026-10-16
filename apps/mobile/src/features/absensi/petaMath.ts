/**
 * Matematika peta slippy (Web Mercator, ubin OSM 256 px) untuk kartu peta di
 * layar Absen. Murni (tanpa React Native) supaya bisa diuji dengan
 * `npm run test:peta`. Satuan layar = dp; "zoom" = zoom efektif peta,
 * ubin diambil satu tingkat lebih rapat (retina) lalu digambar 128 dp.
 */

export const UBIN_PX = 256;
/** Zoom efektif yang dicoba (besar → kecil). Ubin yang diminta = zoom + 1 (maks 18 sesuai proxy). */
export const ZOOM_MAKS = 17;
export const ZOOM_MIN = 15;
/** Proxy server hanya melayani zoom 14–18. */
export const ZOOM_UBIN_MAKS = 18;
/** Ruang kosong di tepi kartu agar lingkaran/titik tidak menempel. */
export const BANTALAN_DP = 22;
/** Titik GPS baru memicu gambar ulang hanya bila bergeser lebih dari ini. */
export const GESER_MIN_M = 15;

export interface LatLon {
  latitude: number;
  longitude: number;
}

export interface TitikPeta extends LatLon {
  accuracy: number | null;
}

export interface KantorPeta extends LatLon {
  radiusM: number;
}

/** Piksel dunia pada zoom z (ubin 256). */
export function keDunia(lat: number, lon: number, z: number): { x: number; y: number } {
  const n = UBIN_PX * 2 ** z;
  const sin = Math.sin((Math.max(-85.05112878, Math.min(85.05112878, lat)) * Math.PI) / 180);
  return {
    x: ((lon + 180) / 360) * n,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * n,
  };
}

/** Meter per piksel pada garis lintang & zoom tertentu. */
export function meterPerPiksel(lat: number, z: number): number {
  return (156_543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** z;
}

export function jarakM(a: LatLon, b: LatLon): number {
  const rad = (d: number): number => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Apakah titik GPS baru layak menggantikan yang tampil (bergeser > 15 m, akurasi berubah banyak, atau muncul/hilang). */
export function perluPerbarui(lama: TitikPeta | null, baru: TitikPeta | null): boolean {
  if (lama === null || baru === null) {
    return lama !== baru;
  }
  if (jarakM(lama, baru) > GESER_MIN_M) {
    return true;
  }
  return Math.abs((lama.accuracy ?? 0) - (baru.accuracy ?? 0)) > 25;
}

export interface UbinRencana {
  key: string;
  z: number;
  x: number;
  y: number;
  left: number;
  top: number;
  size: number;
}

export interface RencanaPeta {
  zoom: number;
  mPerDp: number;
  /** Posisi pusat kantor di kartu (dp), radius geofence (dp). */
  kantor: { x: number; y: number; r: number } | null;
  /** Posisi titik pengguna di kartu (dp), sudah dijepit ke dalam kartu; `halo` = cincin akurasi (dp). */
  pengguna: { x: number; y: number; halo: number; terpotong: boolean } | null;
  ubin: UbinRencana[];
}

export function susunPeta(input: { kantor: KantorPeta | null; titik: TitikPeta | null; lebar: number; tinggi: number }): RencanaPeta | null {
  const { kantor, titik, lebar, tinggi } = input;
  const jangkar: LatLon | null = kantor ?? titik;
  if (jangkar === null || lebar <= 0 || tinggi <= 0) {
    return null;
  }

  const ukur = (z: number): { minX: number; maxX: number; minY: number; maxY: number; ux: number; uy: number } => {
    const a = keDunia(jangkar.latitude, jangkar.longitude, z);
    const r = kantor ? kantor.radiusM / meterPerPiksel(kantor.latitude, z) : 0;
    let minX = -r;
    let maxX = r;
    let minY = -r;
    let maxY = r;
    let ux = 0;
    let uy = 0;
    if (titik && kantor) {
      const u = keDunia(titik.latitude, titik.longitude, z);
      ux = u.x - a.x;
      uy = u.y - a.y;
      minX = Math.min(minX, ux);
      maxX = Math.max(maxX, ux);
      minY = Math.min(minY, uy);
      maxY = Math.max(maxY, uy);
    }
    return { minX, maxX, minY, maxY, ux, uy };
  };

  let zoom = ZOOM_MIN;
  let muat = false;
  for (let z = ZOOM_MAKS; z >= ZOOM_MIN; z--) {
    const b = ukur(z);
    if (b.maxX - b.minX + 2 * BANTALAN_DP <= lebar && b.maxY - b.minY + 2 * BANTALAN_DP <= tinggi) {
      zoom = z;
      muat = true;
      break;
    }
  }

  // Pengguna terlalu jauh untuk muat bersama kantor di zoom terkecil: pusatkan di kantor
  // (peta tetap menampilkan jalan di sekitar kantor; titik pengguna dijepit di tepi kartu).
  // Memusatkan di titik tengah keduanya menghasilkan ubin laut/kosong.
  const rLingkaran = kantor ? kantor.radiusM / meterPerPiksel(kantor.latitude, zoom) : 0;
  const b = muat || !kantor ? ukur(zoom) : { minX: -rLingkaran, maxX: rLingkaran, minY: -rLingkaran, maxY: rLingkaran, ux: 0, uy: 0 };
  const a = keDunia(jangkar.latitude, jangkar.longitude, zoom);
  // Pusat kartu = tengah kotak yang membungkus lingkaran kantor dan titik pengguna.
  const offX = (b.minX + b.maxX) / 2;
  const offY = (b.minY + b.maxY) / 2;
  const pusat = { x: a.x + offX, y: a.y + offY };
  const tengahX = lebar / 2;
  const tengahY = tinggi / 2;

  const mPerDp = meterPerPiksel(jangkar.latitude, zoom);
  const kantorPos = kantor ? { x: tengahX - offX, y: tengahY - offY, r: kantor.radiusM / mPerDp } : null;

  let penggunaPos: RencanaPeta['pengguna'] = null;
  if (titik) {
    const u = keDunia(titik.latitude, titik.longitude, zoom);
    const rawX = tengahX + (u.x - pusat.x);
    const rawY = tengahY + (u.y - pusat.y);
    const x = Math.min(lebar - 14, Math.max(14, rawX));
    const y = Math.min(tinggi - 14, Math.max(14, rawY));
    const halo = Math.min(48, Math.max(10, (titik.accuracy ?? 20) / mPerDp));
    penggunaPos = { x, y, halo, terpotong: x !== rawX || y !== rawY };
  }

  // Ubin: satu zoom lebih rapat (retina), digambar setengah ukuran.
  const zf = Math.min(zoom + 1, ZOOM_UBIN_MAKS);
  const ukuran = UBIN_PX * 2 ** (zoom - zf);
  const k = 2 ** (zf - zoom);
  const tcx = (pusat.x * k) / UBIN_PX;
  const tcy = (pusat.y * k) / UBIN_PX;
  const n = 2 ** zf;
  const i0 = Math.floor(tcx - tengahX / ukuran);
  const i1 = Math.floor(tcx + tengahX / ukuran);
  const j0 = Math.floor(tcy - tengahY / ukuran);
  const j1 = Math.floor(tcy + tengahY / ukuran);

  const ubin: UbinRencana[] = [];
  for (let j = j0; j <= j1; j++) {
    if (j < 0 || j >= n) {
      continue;
    }
    for (let i = i0; i <= i1; i++) {
      const x = ((i % n) + n) % n;
      const kiri = tengahX + (i - tcx) * ukuran;
      const atas = tengahY + (j - tcy) * ukuran;
      const l = Math.round(kiri);
      const t = Math.round(atas);
      ubin.push({ key: `${zf}/${x}/${j}`, z: zf, x, y: j, left: l, top: t, size: Math.round(kiri + ukuran) - l });
    }
  }

  return { zoom, mPerDp, kantor: kantorPos, pengguna: penggunaPos, ubin };
}
