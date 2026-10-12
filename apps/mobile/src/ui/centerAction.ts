/**
 * Mesin keadaan tombol tengah tab bar (keputusan pemilik 9 Okt 2026;
 * padanan web resources/js/components/mobile/tab-bar-center.ts):
 *
 *   belum check-in / status tidak diketahui / tak bisa absen → Absen
 *   sudah check-in dan sekarang < jam pulang − 60 menit      → Workspace
 *   sudah check-in dan sekarang ≥ jam pulang − 60 menit      → Absen (check-out)
 *   sudah check-out hari ini                                 → Workspace
 *
 * Fungsi murni: tanpa jaringan, tanpa timer — pemanggil yang menjadwalkan
 * ulang pada `nextCenterBoundary`.
 */

export type CenterAction = 'absen' | 'workspace';

/** `action` dari GET absensi/hari-ini (`today.action`); null = belum diketahui. */
export type AttendanceActionState = 'check_in' | 'check_out' | 'done' | 'unavailable' | null;

/** Absen kembali muncul sejak X menit sebelum jam pulang. */
export const CHECKOUT_LEAD_MINUTES = 60;

function parseEnd(endIso: string | null | undefined): number | null {
  if (!endIso) {
    return null;
  }
  const waktu = Date.parse(endIso);
  return Number.isNaN(waktu) ? null : waktu;
}

export function centerAction(action: AttendanceActionState, endIso: string | null | undefined, now: Date): CenterAction {
  if (action === 'done') {
    return 'workspace';
  }
  if (action !== 'check_out') {
    return 'absen';
  }
  const akhir = parseEnd(endIso);
  if (akhir === null) {
    return 'workspace';
  }
  return now.getTime() >= akhir - CHECKOUT_LEAD_MINUTES * 60_000 ? 'absen' : 'workspace';
}

/**
 * Kapan tombol tengah akan berganti tanpa data baru (untuk `setTimeout`);
 * null bila tidak ada pergantian terjadwal.
 */
export function nextCenterBoundary(action: AttendanceActionState, endIso: string | null | undefined, now: Date): Date | null {
  if (action !== 'check_out') {
    return null;
  }
  const akhir = parseEnd(endIso);
  if (akhir === null) {
    return null;
  }
  const batas = akhir - CHECKOUT_LEAD_MINUTES * 60_000;
  return batas > now.getTime() ? new Date(batas) : null;
}
