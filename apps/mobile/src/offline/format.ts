/** Format waktu ringkas untuk UI offline (id-ID, zona kantor). */
import { formatKantor } from '@/lib/zonaKantor';

const jam = (): Intl.DateTimeFormat => formatKantor('id-ID', { hour: '2-digit', minute: '2-digit' });
const tanggalPendek = (): Intl.DateTimeFormat => formatKantor('id-ID', { day: 'numeric', month: 'short' });
const kunciHari = (): Intl.DateTimeFormat => formatKantor('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });

/** "09.12" */
export function jamMenit(ms: number | string | Date): string {
  return jam().format(new Date(ms)).replace(':', '.');
}

/** "09.12" bila hari ini, selain itu "12 Okt 09.12". */
export function waktuRingkas(ms: number | string | Date, sekarang: number = Date.now()): string {
  const d = new Date(ms);
  if (kunciHari().format(d) === kunciHari().format(new Date(sekarang))) {
    return jamMenit(d);
  }
  return `${tanggalPendek().format(d)} ${jamMenit(d)}`;
}

/** Ukuran berkas: "840 B", "12 KB", "3,4 MB". */
export function ukuranTeks(byte: number): string {
  if (byte < 1024) {
    return `${byte} B`;
  }
  if (byte < 1024 * 1024) {
    return `${Math.round(byte / 1024)} KB`;
  }
  return `${(byte / (1024 * 1024)).toLocaleString('id-ID', { maximumFractionDigits: 1 })} MB`;
}
