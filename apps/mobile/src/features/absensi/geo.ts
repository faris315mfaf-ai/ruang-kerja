import type { OfficeLocation } from '@/api/types';

const R_BUMI = 6_371_000;

/** Jarak haversine dalam meter. */
export function jarakHaversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = (d: number): number => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_BUMI * Math.asin(Math.min(1, Math.sqrt(a)));
}

export interface LokasiTerdekat {
  lokasi: OfficeLocation;
  jarakM: number;
  /** Di dalam radius (akurasi tidak memperlebar radius; server yang memutuskan). */
  dalam: boolean;
}

/** Lokasi kantor aktif terdekat dari titik; null bila daftar kosong. */
export function lokasiTerdekat(latitude: number, longitude: number, daftar: OfficeLocation[]): LokasiTerdekat | null {
  let terbaik: LokasiTerdekat | null = null;
  for (const lokasi of daftar) {
    const jarakM = jarakHaversine(latitude, longitude, lokasi.latitude, lokasi.longitude);
    if (terbaik === null || jarakM < terbaik.jarakM) {
      terbaik = { lokasi, jarakM, dalam: jarakM <= lokasi.radiusM };
    }
  }
  return terbaik;
}
