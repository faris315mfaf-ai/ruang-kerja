/**
 * Logika murni widget layar utama Android (docs/sesi/ponsel-b9-widget.md):
 * menentukan KEADAAN tiap widget (normal · semua selesai · terlambat · data lama ·
 * sesi berakhir · rapat berlangsung/belum mulai/tidak ada) dari data API, jam
 * perangkat, dan antrean offline — tanpa React, tanpa jaringan, tanpa paket native —
 * sehingga bisa diuji dengan `npm run test:widget` (Node ≥ 22.18, type-stripping).
 *
 * Aturan berkas ini: hanya `import type` dari modul lain (dihapus saat dijalankan di Node).
 * Waktu ditampilkan dalam WIB (UTC+7, tanpa DST) dihitung manual agar tidak bergantung pada Intl.
 */
import type { HariIni } from '@/api/absensi';
import type { MeetingItem, TodayTaskItem } from '@/api/types';

// ── Identitas widget & tautan ────────────────────────────────────────────────

export type NamaWidget = 'CheckIn' | 'TugasHariIni' | 'RapatBerikutnya';
export const SEMUA_WIDGET: readonly NamaWidget[] = ['CheckIn', 'TugasHariIni', 'RapatBerikutnya'];

export function adalahNamaWidget(nama: string): nama is NamaWidget {
  return (SEMUA_WIDGET as readonly string[]).includes(nama);
}

/** Skema `ruangkerja://` (app.json › scheme) → rute expo-router. */
export const TAUTAN = {
  absen: 'ruangkerja://absen',
  tabTugas: 'ruangkerja://tugas',
  daftarRapat: 'ruangkerja://rapat',
  detailTugas: (id: string): string => `ruangkerja://tugas/${encodeURIComponent(id)}`,
  detailRapat: (id: string, tanggal: string | null): string => `ruangkerja://rapat/${encodeURIComponent(id)}${tanggal ? `?tanggal=${encodeURIComponent(tanggal)}` : ''}`,
  praGabung: (id: string, tanggal: string | null): string => `ruangkerja://rapat/${encodeURIComponent(id)}/video/pra-gabung${tanggal ? `?tanggal=${encodeURIComponent(tanggal)}` : ''}`,
} as const;

/** Widget yang terpengaruh item antrean offline berjenis `jenis` (`absensi.*`, `tugas*`). */
export function widgetUntukJenisAntrean(jenis: string): NamaWidget[] {
  if (jenis.startsWith('absensi.')) {
    return ['CheckIn', 'TugasHariIni'];
  }
  return jenis.startsWith('tugas') ? ['TugasHariIni'] : [];
}

/** Widget yang terpengaruh mutasi API sukses (path relatif, mis. `absensi/check-in`, `tugas/ABC/status`, `rapat/ABC/kehadiran`). */
export function widgetUntukMutasi(path: string): NamaWidget[] {
  const p = path.replace(/^\/+/, '');
  if (p.startsWith('absensi/check-in') || p.startsWith('absensi/check-out')) {
    // Rencana kerja saat absen masuk membuat tugas "dari absen".
    return ['CheckIn', 'TugasHariIni'];
  }
  if (p === 'tugas' || p.startsWith('tugas/')) {
    return ['TugasHariIni'];
  }
  return p === 'rapat' || p.startsWith('rapat/') ? ['RapatBerikutnya'] : [];
}

/** Aksi klik kustom (bukan OPEN_URI/OPEN_APP): muat ulang data widget tanpa membuka aplikasi. */
export const AKSI_SEGARKAN = 'SEGARKAN';

// ── Waktu (WIB) ──────────────────────────────────────────────────────────────

const WIB_MS = 7 * 3_600_000;
const HARI_SINGKAT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'] as const;
const BULAN_SINGKAT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'] as const;

function keMs(nilai: string | number | Date | null | undefined): number | null {
  if (nilai === null || nilai === undefined || nilai === '') {
    return null;
  }
  const ms = nilai instanceof Date ? nilai.getTime() : typeof nilai === 'number' ? nilai : Date.parse(nilai);
  return Number.isFinite(ms) ? ms : null;
}

function dua(n: number): string {
  return String(n).padStart(2, '0');
}

/** "07.52" (WIB); "—" bila tidak valid. */
export function jamWib(nilai: string | number | Date | null | undefined): string {
  const ms = keMs(nilai);
  if (ms === null) {
    return '—';
  }
  const d = new Date(ms + WIB_MS);
  return `${dua(d.getUTCHours())}.${dua(d.getUTCMinutes())}`;
}

/** "2026-10-13" (tanggal kantor WIB) dari waktu. */
export function ymdWib(nilai: string | number | Date): string {
  const ms = keMs(nilai) ?? 0;
  const d = new Date(ms + WIB_MS);
  return `${d.getUTCFullYear()}-${dua(d.getUTCMonth() + 1)}-${dua(d.getUTCDate())}`;
}

/** "Rab, 14 Okt" (WIB). */
export function hariSingkatWib(nilai: string | number | Date): string {
  const ms = keMs(nilai) ?? 0;
  const d = new Date(ms + WIB_MS);
  return `${HARI_SINGKAT[d.getUTCDay()] ?? ''}, ${d.getUTCDate()} ${BULAN_SINGKAT[d.getUTCMonth()] ?? ''}`;
}

/** "8 j 12 m" dari menit kerja. */
export function durasiKerja(menit: number): string {
  const m = Math.max(0, Math.round(menit));
  return `${Math.floor(m / 60)} j ${m % 60} m`;
}

/** "5 menit lagi" · "2 jam lagi" · "sebentar lagi" dari selisih ms (> 0). */
export function labelLagi(selisihMs: number): string {
  const menit = Math.ceil(selisihMs / 60_000);
  if (menit <= 1) {
    return 'sebentar lagi';
  }
  if (menit < 60) {
    return `${menit} menit lagi`;
  }
  return `${Math.round(menit / 60)} jam lagi`;
}

// ── Check-in ─────────────────────────────────────────────────────────────────

export type IkonCheckIn = 'log-in' | 'log-out' | 'check' | 'coffee' | 'cloud-upload' | 'refresh-cw' | 'lock';
export type JenisCheckIn = 'belum' | 'masuk' | 'pulang' | 'libur' | 'antre' | 'lama' | 'sesi';

export interface KeadaanCheckIn {
  jenis: JenisCheckIn;
  judul: string;
  sub: string;
  ikon: IkonCheckIn;
  /** Tombol bulat berwarna gradien (aksi utama) atau tonal abu. */
  menonjol: boolean;
  /** Ketuk tombol/kartu memuat ulang data (data lama) alih-alih membuka layar Absen. */
  segarkan: boolean;
  /** Ketuk kartu membuka aplikasi (sesi berakhir) alih-alih tab Absen. */
  bukaAplikasi: boolean;
  /** Label TalkBack utuh. */
  label: string;
}

/** Item antrean absen (tabel `antrean`, jenis `absensi.*`) yang belum terkirim. */
export interface ItemAntreAbsen {
  arah: 'masuk' | 'pulang';
  /** ISO jam perangkat saat tombol absen ditekan. */
  waktu: string;
}

export interface MasukanCheckIn {
  sekarang: number;
  /** false = tanpa sesi tersimpan / token ditolak (401). */
  adaSesi: boolean;
  absen: HariIni | null;
  /** Jawaban berasal dari cache baca (jaringan gagal). */
  dariCache: boolean;
  /** Epoch ms data cache disimpan. */
  cachedAt: number | null;
  antre: readonly ItemAntreAbsen[];
}

const JAM20 = 20 * 3_600_000;

/** Antrean absen yang relevan sekarang (pulang menang atas masuk); item lebih tua dari 20 jam diabaikan. */
export function antreAktif(antre: readonly ItemAntreAbsen[], sekarang: number): ItemAntreAbsen | null {
  const baru = antre.filter((i) => {
    const ms = keMs(i.waktu);
    return ms !== null && sekarang - ms < JAM20 && ms <= sekarang + 5 * 60_000;
  });
  const terakhir = (arah: 'masuk' | 'pulang'): ItemAntreAbsen | null => {
    const daftar = baru.filter((i) => i.arah === arah).sort((a, b) => (keMs(a.waktu) ?? 0) - (keMs(b.waktu) ?? 0));
    return daftar[daftar.length - 1] ?? null;
  };
  return terakhir('pulang') ?? terakhir('masuk');
}

function susunCheckIn(jenis: JenisCheckIn, judul: string, sub: string, ikon: IkonCheckIn, ekstra: Partial<Pick<KeadaanCheckIn, 'menonjol' | 'segarkan' | 'bukaAplikasi'>> = {}): KeadaanCheckIn {
  return {
    jenis,
    judul,
    sub,
    ikon,
    menonjol: ekstra.menonjol ?? false,
    segarkan: ekstra.segarkan ?? false,
    bukaAplikasi: ekstra.bukaAplikasi ?? false,
    label: `Absen. ${judul}. ${sub}.${ekstra.segarkan ? ' Ketuk untuk menyegarkan.' : ekstra.bukaAplikasi ? ' Ketuk untuk membuka aplikasi.' : ' Ketuk untuk membuka layar Absen.'}`,
  };
}

export function keadaanCheckIn(m: MasukanCheckIn): KeadaanCheckIn {
  if (!m.adaSesi) {
    return susunCheckIn('sesi', 'Masuk dulu', 'Sesi berakhir', 'lock', { menonjol: true, bukaAplikasi: true });
  }
  const antre = antreAktif(m.antre, m.sekarang);
  if (antre !== null) {
    return susunCheckIn('antre', `${antre.arah === 'masuk' ? 'Masuk' : 'Selesai'} ${jamWib(antre.waktu)}`, 'Menunggu sinyal', 'cloud-upload');
  }
  if (m.absen === null || m.dariCache) {
    return susunCheckIn('lama', 'Data lama', m.cachedAt !== null ? `Terakhir ${jamWib(m.cachedAt)}` : 'Belum ada data', 'refresh-cw', { segarkan: true });
  }

  const { today } = m.absen;
  const st = m.absen.state;
  const hari = today.day;
  const masukIso = st?.checkedInAt ?? hari?.checkInAt ?? null;
  const pulangIso = st?.checkedOutAt ?? hari?.checkOutAt ?? null;

  if (pulangIso !== null) {
    const menit = hari?.workMinutes ?? null;
    return susunCheckIn('pulang', `Selesai ${jamWib(pulangIso)}`, menit !== null && menit > 0 ? `Kerja ${durasiKerja(menit)}` : (hari?.statusLabel ?? 'Absen pulang tercatat'), 'check');
  }
  if (masukIso !== null) {
    const telat = st?.lateMinutes ?? hari?.lateMinutes ?? 0;
    const terlambat = st?.punctuality === 'late' || telat > 0;
    return susunCheckIn('masuk', `Masuk ${jamWib(masukIso)}`, terlambat ? (telat > 0 ? `Terlambat ${telat} mnt` : 'Terlambat') : 'Tepat waktu', 'log-out');
  }

  if (st?.code === 'day_has_request') {
    return susunCheckIn('libur', 'Tidak masuk', st.request?.statusLabel ?? st.label, 'coffee');
  }
  // Only a real holiday is 'libur': a day without a schedule still lets the employee check in (server state `not_checked_in`).
  const libur = st !== null ? st.code === 'holiday' || st.isHoliday : today.schedule.isHoliday;
  if (libur) {
    const namaLibur = st?.holidayName ?? today.schedule.holidayName ?? null;
    return susunCheckIn('libur', 'Hari libur', namaLibur ?? 'Libur', 'coffee');
  }
  const mulai = st?.scheduledStart ?? today.schedule.start ?? null;
  const tanpaJadwal = mulai === null && (st !== null ? !st.isWorkday : !today.schedule.isWorkday);
  return susunCheckIn('belum', 'Belum masuk', mulai !== null ? `Mulai ${jamWib(mulai)}` : tanpaJadwal ? 'Tanpa jadwal' : (st?.label ?? 'Belum absen'), 'log-in', { menonjol: true });
}

// ── Tugas hari ini ───────────────────────────────────────────────────────────

export type Segmen = 'pribadi' | 'tim' | 'semua';
export const LABEL_SEGMEN: Record<Segmen, string> = { pribadi: 'Pribadi', tim: 'Tim', semua: 'Semua' };

export interface SetelanTugas {
  segmen: Segmen;
  /** Tampilkan tugas selesai (dicoret) di bawah tugas terbuka. */
  tampilkanSelesai: boolean;
  /** Latar kartu tembus pandang (ikuti wallpaper). */
  transparan: boolean;
}

export const SETELAN_BAWAAN: SetelanTugas = { segmen: 'pribadi', tampilkanSelesai: true, transparan: false };

/** Setelan tersimpan (JSON bebas) → nilai aman; kunci rusak jatuh ke bawaan. */
export function normalisasiSetelan(mentah: unknown): SetelanTugas {
  const o = typeof mentah === 'object' && mentah !== null ? (mentah as Record<string, unknown>) : {};
  return {
    segmen: o.segmen === 'tim' || o.segmen === 'semua' || o.segmen === 'pribadi' ? o.segmen : SETELAN_BAWAAN.segmen,
    tampilkanSelesai: typeof o.tampilkanSelesai === 'boolean' ? o.tampilkanSelesai : SETELAN_BAWAAN.tampilkanSelesai,
    transparan: typeof o.transparan === 'boolean' ? o.transparan : SETELAN_BAWAAN.transparan,
  };
}

/** Baris tugas terlambat dari `GET /tugas?tenggat=overdue` (hanya kolom yang dipakai). */
export interface TugasTerlambatApi {
  id: string;
  title: string;
  days_late: number;
  workspace: { type: string };
  status: { category: string; is_done: boolean };
  source?: string;
}

/** Item `GET /tugas/hari-ini`: bentuk `TodayTaskItem` + penanda penugasan atasan. */
export interface TugasHariApi extends TodayTaskItem {
  assigned_by_other?: boolean;
}

export interface TugasHariIniApi {
  today: string;
  pribadi: readonly TugasHariApi[];
  tim: readonly TugasHariApi[];
  semua: readonly TugasHariApi[];
  counts: { pribadi: number; tim: number; semua: number };
}

export type CincinTugas = 'bahaya' | 'peringatan' | 'primer' | 'netral' | 'selesai';
export type NadaMeta = 'bahaya' | 'redam' | 'sukses';

export interface BarisTugas {
  id: string;
  judul: string;
  meta: string;
  nadaMeta: NadaMeta;
  cincin: CincinTugas;
  selesai: boolean;
}

export type JenisTugas = 'normal' | 'semuaSelesai' | 'kosong' | 'sesi' | 'tanpaData';

export interface KeadaanTugas {
  jenis: JenisTugas;
  segmenLabel: string;
  /** Sudah selesai dari total yang jatuh tempo hari ini (segmen terpilih); null = tidak diketahui. */
  selesai: number | null;
  total: number | null;
  baris: BarisTugas[];
  /** Jumlah baris yang tidak muat ("+n lagi"). */
  tersembunyi: number;
  terlambat: number;
  /** Data dari cache: jam data (epoch ms) — null bila tak diketahui. Null di luar keadaan data lama. */
  lama: { ts: number | null } | null;
  /** Teks utama keadaan non-daftar (kosong/semua selesai/sesi/tanpa data). */
  judul: string;
  sub: string;
  label: string;
}

export interface MasukanTugas {
  sekarang: number;
  adaSesi: boolean;
  hari: TugasHariIniApi | null;
  terlambat: readonly TugasTerlambatApi[];
  dariCache: boolean;
  cachedAt: number | null;
  setelan: SetelanTugas;
}

/**
 * Baris tugas yang muat di kartu (dp). Kartu 4×2 (196 dp) memuat 3 baris 44 dp — juga saat ada
 * "+n lagi" (baris 16 dp memakai sisa bantalan bawah 10 → 4 dp) atau catatan data lama.
 */
export const TINGGI_BARIS = 44;
const PAD_ATAS = 12;
const PAD_BAWAH = 10;
const TINGGI_KEPALA = 30;
/** Ruang tambahan di atas bantalan bawah untuk baris "+n lagi" / catatan data lama (16 dp − 6 dp bantalan terpakai). */
const EXTRA_BARIS_KECIL = 10;

function lapangDasar(tinggiDp: number, adaFooter: boolean): number {
  return tinggiDp - PAD_ATAS - TINGGI_KEPALA - PAD_BAWAH - (adaFooter ? EXTRA_BARIS_KECIL : 0);
}

export function kapasitasBaris(tinggiDp: number, adaFooter: boolean): number {
  return Math.max(1, Math.min(6, Math.floor(lapangDasar(tinggiDp, adaFooter) / TINGGI_BARIS)));
}

/** Pilih baris yang ditampilkan + hitung yang tersembunyi (menyisakan ruang untuk "+n lagi"). */
export function potongBaris<T>(semua: readonly T[], tinggiDp: number, adaFooter: boolean): { tampil: T[]; tersembunyi: number } {
  if (semua.length <= kapasitasBaris(tinggiDp, adaFooter)) {
    return { tampil: [...semua], tersembunyi: 0 };
  }
  const muat = Math.max(1, Math.min(6, Math.floor((lapangDasar(tinggiDp, adaFooter) - EXTRA_BARIS_KECIL) / TINGGI_BARIS)));
  return { tampil: semua.slice(0, muat), tersembunyi: semua.length - muat };
}

function prioritasTinggi(p: string): boolean {
  const l = p.toLowerCase();
  return l === 'urgent' || l === 'tinggi';
}

/** Baris tugas yang jatuh tempo hari ini. */
export function barisHariIni(t: TugasHariApi): BarisTugas {
  const selesai = t.status.is_done;
  const tinggi = prioritasTinggi(t.priority);
  const meta = selesai ? 'selesai' : tinggi ? t.priority : t.source === 'attendance' ? 'dari absen' : t.assigned_by_other === true ? 'dari atasan' : t.status.name;
  return {
    id: t.id,
    judul: t.title,
    meta,
    nadaMeta: selesai ? 'sukses' : 'redam',
    cincin: selesai ? 'selesai' : tinggi ? 'peringatan' : t.status.category === 'in_progress' ? 'primer' : 'netral',
    selesai,
  };
}

export function barisTerlambat(t: TugasTerlambatApi): BarisTugas {
  const hari = Math.max(1, Math.round(t.days_late));
  return { id: t.id, judul: t.title, meta: `terlambat ${hari} hari`, nadaMeta: 'bahaya', cincin: 'bahaya', selesai: false };
}

function cocokSegmen(t: TugasTerlambatApi, segmen: Segmen): boolean {
  if (t.status.is_done) {
    return false;
  }
  const pribadi = t.workspace.type === 'personal';
  return segmen === 'semua' || (segmen === 'pribadi' ? pribadi : !pribadi);
}

export function keadaanTugas(m: MasukanTugas, tinggiDp: number): KeadaanTugas {
  const segmenLabel = LABEL_SEGMEN[m.setelan.segmen];
  const dasar = { segmenLabel, selesai: null, total: null, baris: [] as BarisTugas[], tersembunyi: 0, terlambat: 0, lama: null };
  if (!m.adaSesi) {
    return { ...dasar, jenis: 'sesi', judul: 'Masuk dulu untuk melihat tugas', sub: '', label: 'Tugas hari ini. Masuk dulu untuk melihat tugas. Ketuk untuk membuka aplikasi.' };
  }
  // Salinan lama dari hari sebelumnya bukan "tugas hari ini": jangan ditampilkan sebagai tugas hari ini.
  const hari = m.hari !== null && m.dariCache && m.hari.today !== ymdWib(m.sekarang) ? null : m.hari;
  if (hari === null) {
    const kemarin = m.hari !== null;
    return {
      ...dasar,
      jenis: 'tanpaData',
      lama: { ts: m.cachedAt },
      judul: 'Belum ada data',
      sub: kemarin ? 'Data hari sebelumnya · ketuk untuk menyegarkan' : 'Ketuk untuk menyegarkan',
      label: `Tugas hari ini. Belum ada data${kemarin ? ' (data hari sebelumnya)' : ''}. Ketuk untuk menyegarkan.`,
    };
  }

  const daftar = hari[m.setelan.segmen];
  const total = hari.counts[m.setelan.segmen] ?? daftar.length;
  const terbuka = daftar.filter((t) => !t.status.is_done);
  const tuntas = daftar.filter((t) => t.status.is_done);
  const telat = m.terlambat.filter((t) => cocokSegmen(t, m.setelan.segmen));
  const lama = m.dariCache ? { ts: m.cachedAt } : null;

  const semua: BarisTugas[] = [...telat.map(barisTerlambat), ...terbuka.map(barisHariIni), ...(m.setelan.tampilkanSelesai ? tuntas.map(barisHariIni) : [])];
  const { tampil, tersembunyi } = potongBaris(semua, tinggiDp, lama !== null);
  const selesai = tuntas.length;
  const ringkas = `${selesai} dari ${total} tugas selesai`;
  const lamaTeks = lama !== null ? ` Data lama${lama.ts !== null ? `, terakhir ${jamWib(lama.ts)}` : ''}.` : '';

  const hasil = { segmenLabel, selesai, total, baris: tampil, tersembunyi, terlambat: telat.length, lama };
  if (total === 0 && telat.length === 0) {
    return { ...hasil, jenis: 'kosong', judul: 'Belum ada tugas hari ini', sub: 'Ketuk untuk melihat tugas', label: `Tugas hari ini, ${segmenLabel}. Belum ada tugas hari ini.${lamaTeks}` };
  }
  if (terbuka.length === 0 && telat.length === 0) {
    return { ...hasil, jenis: 'semuaSelesai', judul: 'Semua tugas hari ini selesai', sub: 'Ketuk untuk melihat tugas besok', label: `Tugas hari ini, ${segmenLabel}. Semua tugas hari ini selesai.${lamaTeks}` };
  }
  return {
    ...hasil,
    jenis: 'normal',
    judul: 'Tugas hari ini',
    sub: '',
    label: `Tugas hari ini, ${segmenLabel}. ${ringkas}.${telat.length > 0 ? ` ${telat.length} terlambat.` : ''}${lamaTeks} Ketuk judul untuk membuka tab Tugas.`,
  };
}

// ── Rapat berikutnya ─────────────────────────────────────────────────────────

export type IkonRapat = 'video' | 'calendar-check' | 'calendar-x' | 'cloud-off' | 'lock';
export type JenisRapat = 'berlangsung' | 'berikutnya' | 'tidakAda' | 'lama' | 'sesi' | 'mati';

export interface KeadaanRapat {
  jenis: JenisRapat;
  /** Overline kecil ("RAPAT BERIKUTNYA"); null bila diganti chip. */
  overline: string | null;
  /** Chip hijau ("Berlangsung sekarang"). */
  chip: string | null;
  judul: string;
  sub: string;
  ikon: IkonRapat;
  /** Tombol kanan; `tautan` null + `segarkan` = muat ulang; keduanya null = buka aplikasi. */
  aksi: { label: string; tautan: string | null; segarkan: boolean; menonjol: boolean } | null;
  /** Tujuan ketuk badan kartu (null = muat ulang bila `segarkanKartu`). */
  tautanKartu: string | null;
  segarkanKartu: boolean;
  bukaAplikasi: boolean;
  label: string;
}

export interface MasukanRapat {
  sekarang: number;
  adaSesi: boolean;
  /** `GET /rapat?rentang=hari-ini`; null = gagal tanpa cache. */
  hariIni: readonly MeetingItem[] | null;
  /** `GET /rapat?rentang=akan-datang` (hanya diambil bila tak ada rapat tersisa hari ini). */
  akanDatang: readonly MeetingItem[] | null;
  /** Modul rapat dimatikan (404). */
  fiturMati: boolean;
  dariCache: boolean;
  cachedAt: number | null;
}

/** Jendela gabung: 15 menit sebelum s.d. 2 jam sesudah mulai (PRD M3). */
export const JENDELA_SEBELUM_MS = 15 * 60_000;
export const JENDELA_SESUDAH_MS = 2 * 3_600_000;

export function dalamJendelaGabung(mulaiMs: number, sekarang: number): boolean {
  return sekarang >= mulaiMs - JENDELA_SEBELUM_MS && sekarang <= mulaiMs + JENDELA_SESUDAH_MS;
}

/** Rapat aktif terdekat: belum berakhir, tidak dibatalkan, urut waktu mulai. */
export function pilihRapat(items: readonly MeetingItem[], sekarang: number): MeetingItem | null {
  const sisa = items
    .filter((i) => !i.canceled)
    .filter((i) => {
      const akhir = keMs(i.ends_at);
      return akhir !== null && akhir > sekarang;
    })
    .sort((a, b) => (keMs(a.starts_at) ?? 0) - (keMs(b.starts_at) ?? 0));
  return sisa[0] ?? null;
}

function susunRapat(k: Omit<KeadaanRapat, 'label' | 'segarkanKartu' | 'bukaAplikasi'> & Partial<Pick<KeadaanRapat, 'segarkanKartu' | 'bukaAplikasi'>>): KeadaanRapat {
  const aksi = k.aksi ? ` Tombol ${k.aksi.label}.` : '';
  return {
    ...k,
    segarkanKartu: k.segarkanKartu ?? false,
    bukaAplikasi: k.bukaAplikasi ?? false,
    label: `${k.chip ?? k.overline ?? 'Rapat'}. ${k.judul}. ${k.sub}.${aksi}`,
  };
}

export function keadaanRapat(m: MasukanRapat): KeadaanRapat {
  if (!m.adaSesi) {
    return susunRapat({ jenis: 'sesi', overline: 'Rapat berikutnya', chip: null, judul: 'Masuk dulu', sub: 'Sesi berakhir', ikon: 'lock', aksi: { label: 'Masuk', tautan: null, segarkan: false, menonjol: true }, tautanKartu: null, bukaAplikasi: true });
  }
  if (m.fiturMati) {
    return susunRapat({ jenis: 'mati', overline: 'Rapat berikutnya', chip: null, judul: 'Rapat belum aktif', sub: 'Modul rapat belum diaktifkan', ikon: 'calendar-x', aksi: null, tautanKartu: null, bukaAplikasi: true });
  }
  if (m.hariIni === null || m.dariCache) {
    return susunRapat({
      jenis: 'lama',
      overline: 'Rapat berikutnya',
      chip: null,
      judul: 'Belum diperbarui',
      sub: m.cachedAt !== null ? `Terakhir ${jamWib(m.cachedAt)} · ketuk untuk menyegarkan` : 'Ketuk untuk menyegarkan',
      ikon: 'cloud-off',
      aksi: { label: 'Segarkan', tautan: null, segarkan: true, menonjol: false },
      tautanKartu: null,
      segarkanKartu: true,
    });
  }

  const hariIni = pilihRapat(m.hariIni, m.sekarang);
  if (hariIni !== null) {
    const mulai = keMs(hariIni.starts_at) ?? m.sekarang;
    const berlangsung = mulai <= m.sekarang;
    const video = hariIni.platform === 'video';
    const gabung = video && dalamJendelaGabung(mulai, m.sekarang);
    const rentang = `${jamWib(hariIni.starts_at)}–${jamWib(hariIni.ends_at)}`;
    const tanggal = hariIni.occurrence_date || null;
    const sub = `${rentang} · ${hariIni.platform_label}${berlangsung ? '' : ` · ${labelLagi(mulai - m.sekarang)}`}`;
    return susunRapat({
      jenis: berlangsung ? 'berlangsung' : 'berikutnya',
      overline: berlangsung ? null : 'Rapat berikutnya',
      chip: berlangsung ? 'Berlangsung sekarang' : null,
      judul: hariIni.title,
      sub,
      ikon: 'video',
      aksi: gabung
        ? { label: 'Gabung', tautan: TAUTAN.praGabung(hariIni.id, tanggal), segarkan: false, menonjol: true }
        : { label: 'Detail', tautan: TAUTAN.detailRapat(hariIni.id, tanggal), segarkan: false, menonjol: false },
      tautanKartu: TAUTAN.detailRapat(hariIni.id, tanggal),
    });
  }

  const berikut = m.akanDatang !== null ? pilihRapat(m.akanDatang, m.sekarang) : null;
  return susunRapat({
    jenis: 'tidakAda',
    overline: 'Rapat berikutnya',
    chip: null,
    judul: 'Tidak ada rapat lagi hari ini',
    sub: berikut !== null ? `Rapat berikut: ${hariSingkatWib(berikut.starts_at)} ${jamWib(berikut.starts_at)} · ${berikut.title}` : 'Tidak ada rapat terjadwal',
    ikon: 'calendar-check',
    aksi: null,
    tautanKartu: berikut !== null ? TAUTAN.detailRapat(berikut.id, berikut.occurrence_date || null) : TAUTAN.daftarRapat,
  });
}
