/**
 * Format & metadata tampilan Pengajuan (status, kategori, periode, durasi,
 * rupiah, jam "14.00"). Tanggal pengajuan memakai zona kantor Asia/Jakarta.
 */
import type { IconTileTone, Tone } from '@/ui';
import type { AnyIconName } from '@/ui/Icon';

import type { ItemPengajuan, KategoriPengajuan, StatusPengajuan } from '@/api/pengajuan';

const JAKARTA = 'Asia/Jakarta';

export const META_STATUS: Record<StatusPengajuan, { label: string; tone: Tone }> = {
  draft: { label: 'Draf', tone: 'neutral' },
  pending: { label: 'Menunggu', tone: 'warning' },
  revision_requested: { label: 'Perlu revisi', tone: 'info' },
  approved: { label: 'Disetujui', tone: 'success' },
  rejected: { label: 'Ditolak', tone: 'danger' },
  canceled: { label: 'Dibatalkan', tone: 'neutral' },
};

export interface MetaKategori {
  label: string;
  icon: AnyIconName;
  tile: IconTileTone;
  tag: Tone;
  /** Penjelasan ubin "Apa yang ingin Anda ajukan?". */
  ubin: string;
}

export const META_KATEGORI: Record<KategoriPengajuan, MetaKategori> = {
  permit: { label: 'Izin', icon: 'door-open', tile: 'warn', tag: 'warning', ubin: 'Per jam atau per hari, tidak memotong cuti' },
  sick: { label: 'Sakit', icon: 'stethoscope', tile: 'bad', tag: 'danger', ubin: 'Surat dokter wajib bila lebih dari 1 hari' },
  correction: { label: 'Koreksi absensi', icon: 'file-pen', tile: 'blue', tag: 'info', ubin: 'Lupa check-in atau check-out, maks. 7 hari lalu' },
  business_trip: { label: 'Dinas luar', icon: 'briefcase-business', tile: 'ok', tag: 'success', ubin: 'Tugas di luar kantor, cantumkan tujuan' },
  procurement: { label: 'Pengajuan barang', icon: 'package', tile: 'warn', tag: 'warning', ubin: 'Barang kantor dengan perkiraan harga' },
  leave: { label: 'Cuti', icon: 'calendar', tile: 'teal', tag: 'primary', ubin: 'Cuti tahunan dan cuti lainnya' },
  overtime: { label: 'Lembur', icon: 'clock', tile: 'neutral', tag: 'neutral', ubin: 'Kerja di luar jam shift' },
};

/** Urutan ubin terbuka (D1); cuti & lembur di blok Dikunci bila terkunci. */
export const URUTAN_KATEGORI: KategoriPengajuan[] = ['permit', 'sick', 'correction', 'business_trip', 'procurement', 'leave', 'overtime'];

/** Slug/alias parameter `?jenis=` → kategori. */
export function kategoriDariSlug(slug: string | null | undefined): KategoriPengajuan | null {
  switch ((slug ?? '').toLowerCase()) {
    case 'izin':
    case 'permit':
      return 'permit';
    case 'sakit':
    case 'sick':
      return 'sick';
    case 'koreksi':
    case 'correction':
      return 'correction';
    case 'dinas':
    case 'business_trip':
      return 'business_trip';
    case 'barang':
    case 'procurement':
      return 'procurement';
    case 'cuti':
    case 'leave':
      return 'leave';
    case 'lembur':
    case 'overtime':
      return 'overtime';
    default:
      return null;
  }
}

function fmt(opsi: Intl.DateTimeFormatOptions, iso: string | null | undefined): string {
  if (!iso) {
    return '';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat('id-ID', { ...opsi, timeZone: JAKARTA }).format(d).replace(/\./g, '').trim();
}

function bagian(iso: string): { y: string; m: string; d: string; wd: string; hh: string; mm: string } {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: JAKARTA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(d);
  const ambil = (t: string): string => parts.find((p) => p.type === t)?.value ?? '';
  return { y: ambil('year'), m: ambil('month'), d: ambil('day'), wd: ambil('weekday'), hh: ambil('hour'), mm: ambil('minute') };
}

/** YYYY-MM-DD menurut zona kantor. */
export function ymdKantor(iso: string | null | undefined): string {
  if (!iso) {
    return '';
  }
  const b = bagian(iso);
  return `${b.y}-${b.m}-${b.d}`;
}

/** "14.00" menurut zona kantor. */
export function jamKantor(iso: string | null | undefined): string {
  if (!iso) {
    return '';
  }
  const b = bagian(iso);
  return `${b.hh}.${b.mm}`;
}

/** "HH:MM" (server) → "HH.MM" (tampil). */
export function jamTampil(hhmm: string | null | undefined): string {
  return (hhmm ?? '').replace(':', '.');
}

/** "Sel, 13 Okt" */
export function hariTanggalSingkat(iso: string | null | undefined): string {
  return fmt({ weekday: 'short', day: 'numeric', month: 'short' }, iso);
}

/** "13 Okt 2026" */
export function tanggalPendek(iso: string | null | undefined): string {
  return fmt({ day: 'numeric', month: 'short', year: 'numeric' }, iso);
}

/** "13 Okt" */
export function tanggalTanpaTahun(iso: string | null | undefined): string {
  return fmt({ day: 'numeric', month: 'short' }, iso);
}

/** "Sel, 13 Okt 2026" */
export function hariTanggalPendek(iso: string | null | undefined): string {
  return fmt({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }, iso);
}

/** "Selasa, 13 Okt 2026" */
export function hariTanggalPanjang(iso: string | null | undefined): string {
  return fmt({ weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }, iso);
}

/** YYYY-MM-DD → ISO tengah hari WIB (aman dari geser zona). */
export function isoDariYmd(ymd: string): string {
  return `${ymd}T05:00:00Z`;
}

export function jamSaja(item: Pick<ItemPengajuan, 'type' | 'payload'>): boolean {
  const k = item.type.category;
  return k === 'overtime' || (k === 'permit' && item.payload.mode === 'hours');
}

/** Judul periode kartu: "Sel, 13 Okt · 14.00–16.00", "22–23 Sep 2026", "Kam, 8 Okt 2026", "Sen, 12 Okt · 17.10". */
export function judulPeriode(item: ItemPengajuan): string {
  const k = item.type.category;
  const p = item.payload;
  if (k === 'procurement') {
    return p.item_name ?? item.type.name;
  }
  if (jamSaja(item)) {
    return `${hariTanggalSingkat(item.start_at)} · ${jamTampil(p.start_time) || jamKantor(item.start_at)}–${jamTampil(p.end_time) || jamKantor(item.end_at)}`;
  }
  if (k === 'correction') {
    const jamKoreksi = [p.check_in, p.check_out].filter(Boolean).map(jamTampil).join('–');
    return jamKoreksi ? `${hariTanggalSingkat(item.start_at)} · ${jamKoreksi}` : hariTanggalPendek(item.start_at);
  }
  return rentangTanggal(item.start_at, item.end_at);
}

/** "Kam, 8 Okt 2026" untuk satu hari; "22–23 Sep 2026"; "30 Sep–2 Okt 2026"; lintas tahun lengkap. */
export function rentangTanggal(mulai: string, selesai: string): string {
  const a = ymdKantor(mulai);
  const b = ymdKantor(selesai);
  if (a === b || !b) {
    return hariTanggalPendek(mulai);
  }
  const ba = bagian(mulai);
  const bb = bagian(selesai);
  if (ba.y !== bb.y) {
    return `${tanggalPendek(mulai)}–${tanggalPendek(selesai)}`;
  }
  if (ba.m === bb.m) {
    return `${Number(ba.d)}–${tanggalPendek(selesai)}`;
  }
  return `${tanggalTanpaTahun(mulai)}–${tanggalPendek(selesai)}`;
}

/** "2 jam", "1,5 jam", "45 menit". */
export function durasiMenit(menit: number | null | undefined): string {
  if (!menit) {
    return '';
  }
  if (menit < 60) {
    return `${menit} menit`;
  }
  const jam = menit / 60;
  return `${Number.isInteger(jam) ? jam : jam.toLocaleString('id-ID', { maximumFractionDigits: 1 })} jam`;
}

export function angkaHari(hari: number): string {
  return hari.toLocaleString('id-ID', { maximumFractionDigits: 1 });
}

/** Durasi singkat kartu: "2 jam", "3 hari", "2 unit · Rp 700.000". */
export function durasiItem(item: ItemPengajuan): string {
  const k = item.type.category;
  if (k === 'procurement') {
    const p = item.payload;
    const jumlah = p.quantity ? `${p.quantity} ${p.unit || 'unit'}` : '';
    const total = p.total ? rupiah(p.total) : '';
    return [jumlah, total].filter(Boolean).join(' · ');
  }
  if (item.minutes) {
    return durasiMenit(item.minutes);
  }
  if (item.days !== null && item.days !== undefined && k !== 'correction') {
    return `${angkaHari(item.days)} hari`;
  }
  if (k === 'correction') {
    const p = item.payload;
    if (p.check_in && p.check_out) {
      return 'jam masuk & pulang';
    }
    return p.check_in ? 'jam masuk' : 'jam pulang';
  }
  return '';
}

/** Judul detail: "Izin · 2 jam", "Cuti tahunan · 2 hari kerja". */
export function judulDetail(item: ItemPengajuan): string {
  const k = item.type.category;
  if (k === 'procurement' || k === 'correction' || k === 'business_trip') {
    return item.type.name;
  }
  if (item.minutes) {
    return `${item.type.name} · ${durasiMenit(item.minutes)}`;
  }
  if (item.days) {
    return `${item.type.name} · ${angkaHari(item.days)} ${item.type.counts_calendar_days ? 'hari' : 'hari kerja'}`;
  }
  return item.type.name;
}

/** Rp 700.000 */
export function rupiah(n: number | null | undefined): string {
  if (n === null || n === undefined) {
    return '';
  }
  return `Rp ${Math.round(n).toLocaleString('id-ID')}`;
}

/** "350000" → "350.000" (isian harga). */
export function ribuan(digit: string): string {
  const bersih = digit.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  return bersih === '' ? '' : Number(bersih).toLocaleString('id-ID');
}

/** Lama sejak `iso`: "2 jam", "8 hari", "5 menit". */
export function sejak(iso: string | null | undefined): string {
  if (!iso) {
    return '';
  }
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) {
    return '';
  }
  const menit = Math.max(1, Math.round(ms / 60_000));
  if (menit < 60) {
    return `${menit} menit`;
  }
  const jam = Math.round(menit / 60);
  if (jam < 24) {
    return `${jam} jam`;
  }
  return `${Math.round(jam / 24)} hari`;
}

export function namaDepan(nama: string | null | undefined): string {
  return (nama ?? '').split(' ')[0] ?? '';
}

export function ukuranBerkas(byte: number | null | undefined): string {
  if (!byte) {
    return '';
  }
  if (byte < 1024 * 1024) {
    return `${Math.max(1, Math.round(byte / 1024))} KB`;
  }
  return `${(byte / (1024 * 1024)).toLocaleString('id-ID', { maximumFractionDigits: 1 })} MB`;
}

/** Daftar tanggal YYYY-MM-DD → "5, 6 Okt". */
export function daftarTanggal(tanggal: string[]): string {
  if (tanggal.length === 0) {
    return '';
  }
  const iso = tanggal.map(isoDariYmd);
  const akhir = iso[iso.length - 1] ?? '';
  const sebelum = iso.slice(0, -1).map((t) => String(Number(ymdKantor(t).slice(8, 10))));
  return [...sebelum, tanggalTanpaTahun(akhir)].join(', ');
}
