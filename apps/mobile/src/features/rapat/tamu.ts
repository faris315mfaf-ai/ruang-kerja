/**
 * Logika murni tamu eksternal rapat video (kontrak: docs/sesi/rapat-tamu-eksternal.md).
 * Tanpa impor React Native / alias `@/` supaya bisa diuji dengan `node
 * scripts/cek-rapat-tamu.mjs`: validasi email/nama (cermin `GuestNames` server),
 * status ruang tunggu, polling (jeda + backoff), deteksi tamu baru, penyaringan
 * identitas `guest:*`, dan pesan galat Indonesia.
 */

// ── Identitas tamu di ruang LiveKit ────────────────────────────────────────────

export const AWALAN_IDENTITAS_TAMU = 'guest:';
export const AKHIRAN_NAMA_TAMU = ' (Tamu)';

/** `guest:{id}` (atau `metadata.guest === true`) = tamu eksternal; karyawan memakai ULID user. */
export function adalahIdentitasTamu(identity: string | null | undefined): boolean {
  return typeof identity === 'string' && identity.toLowerCase().startsWith(AWALAN_IDENTITAS_TAMU);
}

/** Metadata peserta LiveKit berupa JSON; rusak/kosong → bukan tamu. Tidak pernah melempar. */
export function metadataTamu(metadata: string | null | undefined): boolean {
  if (typeof metadata !== 'string' || metadata === '') {
    return false;
  }
  try {
    const nilai: unknown = JSON.parse(metadata);
    return typeof nilai === 'object' && nilai !== null && (nilai as { guest?: unknown }).guest === true;
  } catch {
    return false;
  }
}

export function adalahPesertaTamu(identity: string | null | undefined, metadata?: string | null): boolean {
  return adalahIdentitasTamu(identity) || metadataTamu(metadata);
}

/** Identitas LiveKit dari id peserta rapat (ULID huruf kecil seperti di server). */
export function identitasDariIdTamu(id: string): string {
  return `${AWALAN_IDENTITAS_TAMU}${id.trim().toLowerCase()}`;
}

/** `guest:01jb…` → `01jb…` (huruf kecil); null bila bukan identitas tamu atau id kosong. */
export function idTamuDariIdentitas(identity: string | null | undefined): string | null {
  if (!adalahIdentitasTamu(identity)) {
    return null;
  }
  const id = (identity as string).slice(AWALAN_IDENTITAS_TAMU.length).trim().toLowerCase();
  return /^[0-9a-z]{20,40}$/.test(id) ? id : null;
}

/** Nama tanpa akhiran " (Tamu)" (untuk inisial avatar). */
export function tanpaAkhiranTamu(nama: string): string {
  return nama.replace(/\s*\(tamu\)\s*$/i, '').trim();
}

/** Nama selalu berakhiran " (Tamu)" (server sudah menandatanganinya; ini sabuk pengaman tampilan). */
export function pastikanAkhiranTamu(nama: string | null | undefined): string {
  const dasar = tanpaAkhiranTamu(nama ?? '');
  return dasar === '' ? 'Tamu' : `${dasar}${AKHIRAN_NAMA_TAMU}`;
}

export function namaDepanTamu(nama: string): string {
  return tanpaAkhiranTamu(nama).split(/\s+/)[0] ?? '';
}

// ── Isian email & nama ─────────────────────────────────────────────────────────

export const POLA_EMAIL_TAMU = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MAKS_EMAIL_TAMU = 190;
export const MIN_NAMA_TAMU = 2;
export const MAKS_NAMA_TAMU = 60;
export const MAKS_TAMU = 30;

export function normalisasiEmailTamu(email: string): string {
  return email.trim().toLowerCase();
}

export function emailTamuValid(email: string): boolean {
  const e = normalisasiEmailTamu(email);
  return e.length <= MAKS_EMAIL_TAMU && POLA_EMAIL_TAMU.test(e);
}

/**
 * Cermin `GuestNames::clean` server: buang tag HTML dan karakter kontrol, rapikan
 * spasi, buang penanda "(Tamu)", minimal 2 karakter, maksimal 60. Null = tidak ada nama.
 */
export function bersihNamaTamu(nilai: string | null | undefined): string | null {
  if (typeof nilai !== 'string') {
    return null;
  }
  let teks = nilai.replace(/<[^>]*>/g, '');
  // Karakter kontrol dan pemisah baris/paragraf diganti spasi (cermin GuestNames::clean).
  teks = teks.replace(/[\u0000-\u001F\u007F-\u009F\u2028\u2029]+/g, ' ');
  teks = teks.replace(/\s+/g, ' ').trim();
  teks = teks.replace(/\(tamu\)/gi, '').replace(/\s+/g, ' ').trim();
  return teks.length >= MIN_NAMA_TAMU ? Array.from(teks).slice(0, MAKS_NAMA_TAMU).join('') : null;
}

export interface HasilValidasiTamu {
  email: string;
  nama: string | null;
  galatEmail: string | null;
  galatNama: string | null;
  valid: boolean;
}

/** `sudahAda` = email tamu yang sudah terdaftar (huruf kecil). Menambah email yang sama hanya memperbarui nama. */
export function validasiTamu(emailMentah: string, namaMentah: string, jumlahTamu: number): HasilValidasiTamu {
  const email = normalisasiEmailTamu(emailMentah);
  const nama = bersihNamaTamu(namaMentah);
  let galatEmail: string | null = null;
  let galatNama: string | null = null;
  if (email === '') {
    galatEmail = 'Isi alamat email tamu.';
  } else if (!emailTamuValid(email)) {
    galatEmail = 'Alamat email tidak valid.';
  } else if (jumlahTamu >= MAKS_TAMU) {
    galatEmail = `Maksimal ${MAKS_TAMU} tamu per rapat.`;
  }
  if (namaMentah.trim() !== '' && nama === null) {
    galatNama = `Nama minimal ${MIN_NAMA_TAMU} karakter.`;
  }
  return { email, nama, galatEmail, galatNama, valid: galatEmail === null && galatNama === null };
}

/**
 * `guest_names` untuk formulir buat/ubah rapat: hanya email yang masih ada di daftar
 * dan bernama; email tanpa nama tidak dikirim (server tidak menimpa nama yang sudah ada).
 */
export function susunNamaTamuForm(emails: readonly string[], nama: Readonly<Record<string, string>>): Record<string, string> {
  const hasil: Record<string, string> = {};
  for (const email of emails) {
    const kunci = normalisasiEmailTamu(email);
    const bersih = bersihNamaTamu(nama[kunci] ?? nama[email]);
    if (bersih !== null) {
      hasil[kunci] = bersih;
    }
  }
  return hasil;
}

// ── Status ruang tunggu ────────────────────────────────────────────────────────

export type StatusTamu = 'none' | 'waiting' | 'admitted' | 'denied' | 'removed';
export type NadaTamu = 'neutral' | 'warning' | 'success' | 'danger';

const LABEL_STATUS: Record<StatusTamu, string> = {
  none: 'Belum masuk',
  waiting: 'Menunggu',
  admitted: 'Diizinkan',
  denied: 'Ditolak',
  removed: 'Dikeluarkan',
};

const NADA_STATUS: Record<StatusTamu, NadaTamu> = {
  none: 'neutral',
  waiting: 'warning',
  admitted: 'success',
  denied: 'danger',
  removed: 'danger',
};

export function statusTamuDikenal(status: unknown): status is StatusTamu {
  return typeof status === 'string' && status in LABEL_STATUS;
}

/** Label tetap di aplikasi; nilai tak dikenal jatuh ke label server (atau "Belum masuk"). */
export function labelStatusTamu(status: string, labelServer?: string | null): string {
  return statusTamuDikenal(status) ? LABEL_STATUS[status] : labelServer || LABEL_STATUS.none;
}

export function nadaStatusTamu(status: string): NadaTamu {
  return statusTamuDikenal(status) ? NADA_STATUS[status] : 'neutral';
}

/** Izinkan boleh dari menunggu/ditolak/dikeluarkan; tolak hanya dari menunggu (kontrak §4.3). */
export function bolehIzinkan(status: string): boolean {
  return status === 'waiting' || status === 'denied' || status === 'removed';
}

export function bolehTolak(status: string): boolean {
  return status === 'waiting';
}

// ── Kemampuan dari ringkasan video detail rapat ────────────────────────────────

export interface RingkasVideoDetail {
  platform: string;
  canceled: boolean;
  /** Penonton = penyelenggara rapat (`rapat.organizer.id`). */
  penyelenggara: boolean;
  /** Penonton terundang: penyelenggara, notulis, atau peserta internal (bukan pengamat rapat pimpinan). */
  terundang: boolean;
}

export interface KemampuanTamu {
  /** Daftar tamu + tautan, tambah, putar, cabut (`manageGuests`: penyelenggara). */
  kelola: boolean;
  /** Ruang tunggu: izinkan/tolak (`manageLobby`: penyelenggara, notulis, peserta internal). */
  ruangTunggu: boolean;
}

/**
 * Turunan `MeetingPolicy` di sisi klien. Detail rapat API v1 belum mengirim `manage_guests`/
 * `manage_lobby`, dan `video.can_join` ikut jendela gabung (bukan `openVideo`), jadi hak
 * diturunkan dari peran di rapat itu; server tetap hakim (403/404 ditangani).
 */
export function kemampuanTamu(d: RingkasVideoDetail): KemampuanTamu {
  if (d.platform !== 'video' || d.canceled) {
    return { kelola: false, ruangTunggu: false };
  }
  return { kelola: d.penyelenggara, ruangTunggu: d.penyelenggara || d.terundang };
}

/** Baris peserta tanpa akun (hanya email) = tamu eksternal. */
export function jumlahTamuDariPeserta(peserta: readonly { user_id: string | null; email: string | null }[]): number {
  return peserta.filter((p) => p.user_id === null && p.email !== null && p.email !== '').length;
}

// ── Polling ruang tunggu ───────────────────────────────────────────────────────

export const JEDA_RUANG_TUNGGU_MS = 4000;
export const JEDA_RUANG_TUNGGU_MAKS_MS = 30_000;

/** 4 dtk saat sehat; tiap kegagalan berturut-turut berlipat dua, maksimal 30 dtk. */
export function jedaRuangTunggu(gagalBerturut: number): number {
  if (!Number.isFinite(gagalBerturut) || gagalBerturut <= 0) {
    return JEDA_RUANG_TUNGGU_MS;
  }
  return Math.min(JEDA_RUANG_TUNGGU_MS * 2 ** Math.min(Math.floor(gagalBerturut), 6), JEDA_RUANG_TUNGGU_MAKS_MS);
}

/** 403/404/410: tidak berwenang atau rapat hilang/selesai — berhenti memantau, jangan terus mengetuk server. */
export function hentikanPantau(status: number): boolean {
  return status === 403 || status === 404 || status === 410;
}

/** Polling hanya saat aplikasi di latar depan dan layar yang memantau aktif. */
export function bolehPantau(opsi: { aktif: boolean; berwenang: boolean; appAktif: boolean }): boolean {
  return opsi.aktif && opsi.berwenang && opsi.appAktif;
}

export interface PenungguRingkas {
  id: string;
}

/** Tamu menunggu yang belum pernah diumumkan; tamu yang tidak lagi menunggu dilupakan agar permintaan baru berbunyi lagi. */
export function tamuBaru<T extends PenungguRingkas>(sudahDiumumkan: ReadonlySet<string>, menunggu: readonly T[]): { baru: T[]; tercatat: Set<string> } {
  const sekarang = new Set(menunggu.map((m) => m.id));
  const baru = menunggu.filter((m) => !sudahDiumumkan.has(m.id));
  return { baru, tercatat: sekarang };
}

/** "Budi menunggu masuk" / "Budi dan Sari menunggu masuk" / "3 tamu menunggu masuk". */
export function teksTamuBaru(nama: readonly (string | null | undefined)[]): string {
  const bersih = nama.map((n) => (n ? tanpaAkhiranTamu(n) : '') || 'Tamu');
  if (bersih.length === 0) {
    return '';
  }
  if (bersih.length === 1) {
    return `${bersih[0]} menunggu masuk`;
  }
  if (bersih.length === 2) {
    return `${bersih[0]} dan ${bersih[1]} menunggu masuk`;
  }
  return `${bersih.length} tamu menunggu masuk`;
}

/** "Menunggu 2 mnt" / "Baru saja"; waktu kosong/rusak → null. */
export function lamaMenunggu(requestedAt: string | null | undefined, sekarang: number): string | null {
  if (!requestedAt) {
    return null;
  }
  const t = Date.parse(requestedAt);
  if (Number.isNaN(t)) {
    return null;
  }
  const menit = Math.floor(Math.max(0, sekarang - t) / 60_000);
  if (menit < 1) {
    return 'Baru saja';
  }
  return menit < 60 ? `Menunggu ${menit} mnt` : `Menunggu ${Math.floor(menit / 60)} jam`;
}

// ── Pesan ──────────────────────────────────────────────────────────────────────

export type AksiTamu = 'memuat' | 'tambah' | 'putar' | 'cabut' | 'izinkan' | 'tolak' | 'ruangTunggu';

export interface GalatRingkas {
  status: number;
  code?: string | null;
  message?: string | null;
}

const NAMA_AKSI: Record<AksiTamu, string> = {
  memuat: 'memuat daftar tamu',
  tambah: 'menambah tamu',
  putar: 'memutar ulang tautan',
  cabut: 'mencabut tamu',
  izinkan: 'mengizinkan tamu',
  tolak: 'menolak tamu',
  ruangTunggu: 'memuat ruang tunggu',
};

/** Pesan Indonesia untuk galat API tamu (kontrak §4); 0 = tanpa jaringan (tidak diantrekan). */
export function pesanGalatTamu(aksi: AksiTamu, g: GalatRingkas): string {
  if (g.status === 0) {
    return `Butuh koneksi — ${NAMA_AKSI[aksi]} tidak bisa dilakukan saat offline.`;
  }
  if (g.status === 403) {
    return aksi === 'izinkan' || aksi === 'tolak' || aksi === 'ruangTunggu'
      ? 'Anda tidak bisa mengatur ruang tunggu rapat ini.'
      : 'Hanya penyelenggara yang dapat mengelola tamu rapat ini.';
  }
  if (g.status === 404) {
    return 'Rapat atau tamu tidak ditemukan. Mungkin sudah dicabut atau rapat sudah dihapus.';
  }
  if (g.status === 429) {
    return 'Terlalu banyak permintaan. Coba lagi sebentar lagi.';
  }
  if (g.code === 'terlalu_banyak_tamu') {
    return `Maksimal ${MAKS_TAMU} tamu per rapat.`;
  }
  if (g.code === 'status_berubah') {
    return 'Status tamu sudah berubah. Daftar dimuat ulang.';
  }
  if (g.code === 'belum_meminta') {
    return 'Tamu ini belum meminta masuk.';
  }
  if (g.code === 'ditutup') {
    return 'Rapat sudah selesai atau dibatalkan.';
  }
  if (g.code === 'kedaluwarsa') {
    return 'Tautan tamu sudah kedaluwarsa.';
  }
  if (g.message && g.message.trim() !== '') {
    return g.message;
  }
  return `Gagal ${NAMA_AKSI[aksi]}. Coba lagi.`;
}

/**
 * Teks yang dibagikan lewat sheet Bagikan sistem. Memuat tautan pribadi (rahasia);
 * jangan ditulis ke log/analitik. Hanya dibuat saat penyelenggara menekan Bagikan.
 */
export function pesanBagikanTautan(opsi: { judul: string; waktu: string; namaTamu: string | null; url: string }): string {
  const untuk = opsi.namaTamu ? ` untuk ${opsi.namaTamu}` : '';
  return [
    `Undangan rapat video "${opsi.judul}"`,
    opsi.waktu,
    `Tautan masuk pribadi${untuk} (jangan diteruskan ke orang lain). Buka di peramban, isi nama, lalu tunggu diizinkan penyelenggara:`,
    opsi.url,
  ]
    .filter((b) => b !== '')
    .join('\n');
}

/** Nama untuk daftar: nama yang diisi, selain itu bagian lokal email. */
export function namaTampilTamu(tamu: { name: string | null; email: string | null }): string {
  if (tamu.name && tamu.name.trim() !== '') {
    return tamu.name.trim();
  }
  return tamu.email ?? 'Tamu';
}

/** Tautan tamu yang sah (https://host/tamu/{58 karakter}); tidak mengembalikan token. */
export function tautanTamuSah(url: string | null | undefined): boolean {
  return typeof url === 'string' && /^https?:\/\/[^\s/]+\/tamu\/[0-9a-hjkmnp-tv-z]{26}[A-Za-z0-9_-]{32}$/.test(url);
}

/** Tampilan aman tautan untuk UI/log: tanpa token ("host/tamu/…"). */
export function samarkanTautan(url: string | null | undefined): string {
  if (typeof url !== 'string') {
    return '';
  }
  return url.replace(/^(https?:\/\/[^/\s]+\/tamu\/).*$/, '$1…').replace(/^https?:\/\//, '');
}
