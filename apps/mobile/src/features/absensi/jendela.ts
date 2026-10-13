/**
 * Jam absen perusahaan (docs/sesi/ponsel-b5-absensi-laporan-jendela.md §B–C):
 * kalimat ringkas untuk kartu, dan fase jam pulang (sebelum dibuka / sudah ditutup)
 * dari `state.windows.checkOut` + jam kantor sekarang. Server tetap memutuskan
 * (`canCheckOut`, `checkOutBlockedReason`); fungsi di sini hanya untuk teks.
 */
import type { JendelaAbsen, KeadaanAbsen, RentangJam } from '@/api/absensi';
import { jam } from '@/lib/format';

/** "06:00" → "06.00". */
export function jamTeks(hhmm: string): string {
  return hhmm.replace(':', '.');
}

function rentang(nama: string, r: RentangJam | null | undefined): string | null {
  if (!r || (!r.from && !r.until)) {
    return null;
  }
  if (r.from && r.until) {
    return `${nama} ${jamTeks(r.from)}–${jamTeks(r.until)}`;
  }
  return r.from ? `${nama} mulai ${jamTeks(r.from)}` : `${nama} sampai ${jamTeks(r.until as string)}`;
}

/** "Masuk 06.00–12.00 · Pulang mulai 15.00", atau null bila tidak ada jam absen. */
export function ringkasJendela(w: JendelaAbsen | undefined | null): string | null {
  if (!w) {
    return null;
  }
  const bagian = [rentang('Masuk', w.checkIn), rentang('Pulang', w.checkOut)].filter((x): x is string => x !== null);
  return bagian.length > 0 ? bagian.join(' · ') : null;
}

/** Menit sejak 00.00 (jam kantor) dari Date. */
function menitKantor(d: Date): number {
  const [h, m] = jam(d).split('.');
  return Number(h) * 60 + Number(m);
}

function menitDari(hhmm: string): number {
  const [h, m] = hhmm.split(':');
  return Number(h) * 60 + Number(m);
}

/**
 * Fase absen pulang bila server menutupnya: `sebelum` (belum dibuka, mis. 15.00)
 * atau `sesudah` (sudah ditutup). Null bila pulang terbuka / tanpa jam pulang.
 */
export function fasePulang(state: KeadaanAbsen, sekarang: Date): 'sebelum' | 'sesudah' | null {
  if (state.code !== 'checked_in' || state.canCheckOut || !state.checkOutBlockedReason) {
    return null;
  }
  const r = state.windows?.checkOut;
  if (r?.from && menitKantor(sekarang) < menitDari(r.from)) {
    return 'sebelum';
  }
  return 'sesudah';
}

/** Teks pendek untuk geser terkunci / tombol nonaktif saat pulang tertutup. */
export function labelPulangTertutup(state: KeadaanAbsen, fase: 'sebelum' | 'sesudah'): string {
  const from = state.windows?.checkOut?.from;
  return fase === 'sebelum' && from ? `Pulang dibuka pukul ${jamTeks(from)}` : 'Absen pulang sudah ditutup';
}
