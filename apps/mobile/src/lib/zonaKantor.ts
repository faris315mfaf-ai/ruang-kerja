/**
 * Zona waktu kantor perusahaan pengguna (`companies.timezone`, Fase 1
 * multi-perusahaan): dikirim server di `GET /auth/saya` (`office_timezone`)
 * dan dipasang SessionProvider setiap profil berganti. Semua tanggal & jam
 * kantor di aplikasi memakai zona ini; Asia/Jakarta sampai server memberi tahu
 * zona lain (dan setelah keluar).
 */

export const ZONA_KANTOR_BAWAAN = 'Asia/Jakarta';

let zona = ZONA_KANTOR_BAWAAN;

const cache = new Map<string, Intl.DateTimeFormat>();

/** Zona kantor saat ini. */
export function zonaKantor(): string {
  return zona;
}

/** Pasang zona dari server; kosong = bawaan, zona yang tidak dikenal mesin JS diabaikan. */
export function aturZonaKantor(baru: unknown): void {
  if (baru === null || baru === undefined || baru === '') {
    zona = ZONA_KANTOR_BAWAAN;
    return;
  }
  if (typeof baru !== 'string' || baru === zona) {
    return;
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: baru });
  } catch {
    return;
  }
  zona = baru;
}

/**
 * `Intl.DateTimeFormat` dalam zona kantor, dibuat sekali per zona + opsi.
 * Panggil saat dipakai (bukan saat modul dimuat) agar zona yang dipasang
 * belakangan ikut berlaku.
 */
export function formatKantor(locale: string, opsi: Omit<Intl.DateTimeFormatOptions, 'timeZone'>): Intl.DateTimeFormat {
  const kunci = `${zona}|${locale}|${JSON.stringify(opsi)}`;
  let format = cache.get(kunci);
  if (format === undefined) {
    format = new Intl.DateTimeFormat(locale, { ...opsi, timeZone: zona });
    cache.set(kunci, format);
  }
  return format;
}
