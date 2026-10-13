/**
 * Teks pengajuan untuk layar Persetujuan — padanan resources/js/lib/requests.ts
 * (rentang tanggal, durasi, peringatan rekan) dalam zona kantor Asia/Jakarta.
 */
import type { DetailPengajuan, ItemPengajuan, JenisRingkas, RekanAbsen } from '@/api/persetujuan';
import type { Tone } from '@/ui';

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const HARI_PANJANG = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const isoKantor = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' });
const jamKantor = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false });
const angka = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });

interface Hari {
  y: number;
  m: number;
  d: number;
  wd: number;
  iso: string;
}

/** Bagian tanggal kantor dari ISO waktu atau `YYYY-MM-DD`. */
export function hariKantor(nilai: string | null | undefined): Hari | null {
  if (!nilai) {
    return null;
  }
  let iso = nilai;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nilai)) {
    const t = new Date(nilai);
    if (Number.isNaN(t.getTime())) {
      return null;
    }
    iso = isoKantor.format(t);
  }
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) {
    return null;
  }
  return { y, m, d, wd: new Date(Date.UTC(y, m - 1, d)).getUTCDay(), iso };
}

/** "07.35" (jam kantor) dari ISO, atau "17:10" → "17.10". */
export function jamTitik(nilai: string | null | undefined): string {
  if (!nilai) {
    return '';
  }
  if (/^\d{1,2}:\d{2}/.test(nilai)) {
    return nilai.slice(0, 5).replace(':', '.');
  }
  const t = new Date(nilai);
  return Number.isNaN(t.getTime()) ? '' : jamKantor.format(t).replace(':', '.');
}

/** "12 Okt 2026" */
export function tanggalSingkat(nilai: string | null | undefined): string {
  const h = hariKantor(nilai);
  return h ? `${h.d} ${BULAN[h.m - 1]} ${h.y}` : '—';
}

/** "12 Okt" */
export function tanggalTanpaTahun(nilai: string | null | undefined): string {
  const h = hariKantor(nilai);
  return h ? `${h.d} ${BULAN[h.m - 1]}` : '—';
}

/** "Sen, 5 Okt 2026" */
export function tanggalBerhari(nilai: string | null | undefined): string {
  const h = hariKantor(nilai);
  return h ? `${HARI[h.wd]}, ${h.d} ${BULAN[h.m - 1]} ${h.y}` : '—';
}

/** "Sab, 17/10/2026" untuk tanggal delegasi. */
export function tanggalNumerikBerhari(iso: string | null | undefined): string {
  const h = hariKantor(iso);
  if (!h) {
    return '—';
  }
  return `${HARI[h.wd]}, ${String(h.d).padStart(2, '0')}/${String(h.m).padStart(2, '0')}/${h.y}`;
}

/** "12–14 Okt 2026", "28 Sep – 2 Okt 2026", "3 Jul 2026". */
export function rentangTanggal(mulai: string, selesai: string): string {
  const a = hariKantor(mulai);
  const b = hariKantor(selesai);
  if (!a || !b) {
    return '—';
  }
  if (a.iso === b.iso) {
    return `${a.d} ${BULAN[a.m - 1]} ${a.y}`;
  }
  if (a.y === b.y && a.m === b.m) {
    return `${a.d}–${b.d} ${BULAN[b.m - 1]} ${b.y}`;
  }
  if (a.y === b.y) {
    return `${a.d} ${BULAN[a.m - 1]} – ${b.d} ${BULAN[b.m - 1]} ${b.y}`;
  }
  return `${tanggalSingkat(a.iso)} – ${tanggalSingkat(b.iso)}`;
}

/** "Senin–Rabu, 19–21 Okt 2026". */
export function rentangTanggalPanjang(mulai: string, selesai: string): string {
  const a = hariKantor(mulai);
  const b = hariKantor(selesai);
  if (!a || !b) {
    return '—';
  }
  const hari = a.iso === b.iso ? HARI_PANJANG[a.wd] : `${HARI_PANJANG[a.wd]}–${HARI_PANJANG[b.wd]}`;
  return `${hari}, ${rentangTanggal(mulai, selesai)}`;
}

export function angkaHari(n: number | null | undefined): string {
  return n === null || n === undefined ? '—' : angka.format(Math.round(n * 10) / 10);
}

export function satuanHari(type: Pick<JenisRingkas, 'category' | 'counts_calendar_days' | 'day_unit'>): string {
  if (type.day_unit) {
    return type.day_unit;
  }
  if (type.counts_calendar_days) {
    return 'hari kalender';
  }
  return type.category === 'leave' ? 'hari kerja' : 'hari';
}

export function rupiah(n: number | null | undefined): string {
  return n === null || n === undefined || !Number.isFinite(n) ? '—' : `Rp${new Intl.NumberFormat('id-ID').format(Math.round(n))}`;
}

function jamDariMenit(menit: number): string {
  return `${angka.format(Math.round((menit / 60) * 10) / 10)} jam`;
}

/** Durasi: "3 hari kerja", "2 jam", "2 unit" (barang), `null` (koreksi). */
export function durasi(item: Pick<ItemPengajuan, 'type' | 'days' | 'minutes' | 'payload'>): string | null {
  if (item.type.category === 'procurement') {
    return item.payload.quantity !== undefined ? `${angka.format(item.payload.quantity)} ${item.payload.unit ?? 'unit'}` : null;
  }
  if (item.minutes !== null && item.minutes !== undefined) {
    return jamDariMenit(item.minutes);
  }
  if (item.days !== null && item.days !== undefined) {
    return `${angkaHari(item.days)} ${satuanHari(item.type)}`;
  }
  return null;
}

/** Baris periode utama (kartu & daftar). Mono = bagian jam (dipisah supaya bisa diberi font mono). */
export interface Periode {
  utama: string;
  jam: string | null;
  keterangan: string | null;
}

export function periode(item: Pick<ItemPengajuan, 'type' | 'start_at' | 'end_at' | 'days' | 'minutes' | 'payload' | 'submitted_at'>): Periode {
  const kat = item.type.category;
  if (kat === 'correction') {
    const masuk = jamTitik(item.payload.check_in);
    const pulang = jamTitik(item.payload.check_out);
    const jamTeks = [masuk, pulang].filter(Boolean).join(' · ');
    const ket = masuk && pulang ? 'jam masuk · jam pulang' : pulang ? 'jam pulang' : masuk ? 'jam masuk' : null;
    return { utama: tanggalSingkat(item.payload.date ?? item.start_at), jam: jamTeks || null, keterangan: ket };
  }
  if (kat === 'procurement') {
    return { utama: item.payload.item_name ?? 'Pengajuan barang', jam: null, keterangan: [durasi(item), item.payload.total !== undefined ? rupiah(item.payload.total) : null].filter(Boolean).join(' · ') || null };
  }
  if (item.minutes !== null && item.minutes !== undefined) {
    return { utama: tanggalTanpaTahun(item.start_at), jam: `${jamTitik(item.start_at)}–${jamTitik(item.end_at)}`, keterangan: durasi(item) };
  }
  return { utama: rentangTanggal(item.start_at, item.end_at), jam: null, keterangan: durasi(item) };
}

/** Nada tag per kategori (status tetap ikon/titik + teks di tempat lain). */
export function nadaKategori(kategori: string): Tone {
  switch (kategori) {
    case 'leave':
      return 'info';
    case 'permit':
      return 'warning';
    case 'sick':
      return 'danger';
    case 'business_trip':
      return 'success';
    case 'correction':
      return 'primary';
    case 'procurement':
      return 'neutral';
    default:
      return 'neutral';
  }
}

/** "Nadia Putri juga cuti 20 Okt" — ringkasan rekan yang juga tidak masuk. */
export function ringkasRekan(rekan: RekanAbsen | null | undefined): string | null {
  const pertama = rekan?.people[0];
  if (!rekan || !pertama) {
    return null;
  }
  const tgl = pertama.dates.slice(0, 3).map((d) => tanggalTanpaTahun(d));
  const lebih = pertama.dates.length > 3 ? ` (+${pertama.dates.length - 3})` : '';
  const lain = rekan.people.length > 1 ? ` dan ${rekan.people.length - 1} lainnya` : '';
  return `${pertama.name}${lain} juga tidak masuk pada ${tgl.join(', ')}${lebih}`;
}

/** Kalimat lanjutan peringatan rekan ("Tim Gudang kurang 2 dari 6 orang hari itu."). */
export function dampakRekan(rekan: RekanAbsen | null | undefined): string | null {
  if (!rekan || rekan.people.length === 0 || !rekan.group || rekan.size <= 0) {
    return null;
  }
  return `${rekan.group} kurang ${rekan.people.length + 1} dari ${rekan.size} orang hari itu.`;
}

/** "langkah 1 dari 2" */
export function langkahTeks(item: Pick<ItemPengajuan, 'step_position' | 'step_count'>): string | null {
  return item.step_position === null ? null : `langkah ${item.step_position} dari ${item.step_count}`;
}

/** "8 hari", "6 jam", "12 menit" sejak waktu tertentu (tanpa "lalu"). */
export function lamaSejak(nilai: string | null | undefined, sekarang = Date.now()): string | null {
  if (!nilai) {
    return null;
  }
  const t = new Date(nilai).getTime();
  if (Number.isNaN(t)) {
    return null;
  }
  const menit = Math.max(0, Math.round((sekarang - t) / 60000));
  if (menit < 60) {
    return `${Math.max(1, menit)} menit`;
  }
  const jam = Math.round(menit / 60);
  if (jam < 24) {
    return `${jam} jam`;
  }
  return `${Math.round(jam / 24)} hari`;
}

export function diajukan(item: Pick<ItemPengajuan, 'submitted_at' | 'created_at'>): string {
  const lama = lamaSejak(item.submitted_at ?? item.created_at);
  return lama ? `Diajukan ${lama} lalu` : 'Diajukan';
}

/** Nama depan untuk teks ringkas ("Terlihat oleh Maya dan HR."). */
export function namaDepan(nama: string): string {
  return nama.trim().split(/\s+/)[0] ?? nama;
}

/** Judul ringkas keputusan ("Cuti Maya Lestari"). */
export function judulKeputusan(item: Pick<ItemPengajuan, 'type' | 'user'>): string {
  return `${item.type.category_label || item.type.name} ${item.user.name}`;
}

/** Saldo cuti (hanya bila server mengirim; staf tidak pernah menerima kunci `balance`). */
export function saldoTeks(detail: Pick<DetailPengajuan, 'balance'> | null | undefined): { sebelum: string; sesudah: string } | null {
  const b = detail?.balance;
  if (!b) {
    return null;
  }
  return { sebelum: angkaHari(b.before), sesudah: angkaHari(b.after) };
}
