/**
 * Logika murni Obrolan: urutan linimasa, pengelompokan gelembung, isi pesan
 * Tiptap → rangkaian teks, pencarian token @/#, dan label kanal.
 */
import { router } from 'expo-router';

import { ApiError } from '@/api/client';
import type { DetailKanal, JenisKanal, KanalRingkas, Pesan, RingkasReaksi } from '@/api/obrolan';
import { jam, tanggalTanpaTahun, ymdJakarta } from '@/lib/format';
import { zonaKantor } from '@/lib/zonaKantor';

export const LABEL_JENIS: Record<JenisKanal, string> = {
  workspace: 'Workspace',
  public: 'Kanal publik',
  private: 'Kanal privat',
  dm: 'Pesan langsung',
  group: 'Grup',
};

export const URUTAN_JENIS: JenisKanal[] = ['workspace', 'public', 'private', 'dm', 'group'];

/** Subjudul header kanal. */
export function subjudulKanal(jenis: JenisKanal, jumlah: number): string {
  switch (jenis) {
    case 'workspace':
      return `Kanal workspace · ${jumlah} anggota`;
    case 'public':
      return `Kanal publik · ${jumlah} anggota`;
    case 'private':
      return `Kanal privat · ${jumlah} anggota`;
    case 'dm':
      return 'Pesan langsung';
    default:
      return `${jumlah} orang`;
  }
}

/** Nama yang tampil untuk kanal: "#umum", nama lawan bicara, dsb. */
export function namaKanal(kanal: { title?: string; name: string | null; type: JenisKanal; workspace?: { name: string } | null }): string {
  if (kanal.title && kanal.title.trim() !== '') {
    return kanal.title;
  }
  if (kanal.name && kanal.name.trim() !== '') {
    return kanal.name;
  }
  if (kanal.type === 'workspace' && kanal.workspace) {
    return kanal.workspace.name;
  }
  return LABEL_JENIS[kanal.type];
}

/** Teks galat siap tampil; 429 diterjemahkan, 0 = tanpa koneksi. */
export function pesanGalat(err: unknown, bawaan: string): string {
  if (err instanceof ApiError) {
    if (err.status === 429) {
      return err.retryAfter && err.retryAfter > 0
        ? `Terlalu banyak pesan terkirim. Coba lagi dalam ${err.retryAfter} detik.`
        : 'Terlalu banyak pesan terkirim. Tunggu sebentar lalu coba lagi.';
    }
    return err.firstValidationError ?? err.message;
  }
  return bawaan;
}

export function tanpaKoneksi(err: unknown): boolean {
  return err instanceof ApiError && err.status === 0;
}

/** Buka linimasa sebuah kanal (params hanya placeholder; detail dimuat ulang). `lr` = penunjuk baca sebelum dibuka (pemisah "belum dibaca"). */
/** Parameter layar percakapan (id, nama, jenis, penunjuk terakhir dibaca bila anggota). */
export function paramKanal(kanal: KanalRingkas | DetailKanal, saya?: string | null): { id: string; nama: string; jenis: string; lr?: string } {
  let terakhirDibaca = '';
  let punyaPenunjuk = false;
  if ('unread_count' in kanal && saya && kanal.is_member) {
    punyaPenunjuk = true;
    terakhirDibaca = kanal.members.find((m) => m.user_id === saya)?.last_read_message_id ?? '';
  }
  return { id: kanal.id, nama: namaKanal(kanal), jenis: kanal.type, ...(punyaPenunjuk ? { lr: terakhirDibaca } : {}) };
}

export function bukaKanal(kanal: KanalRingkas | DetailKanal, saya?: string | null, ganti = false): void {
  const target = {
    pathname: '/obrolan/[id]' as const,
    params: paramKanal(kanal, saya),
  };
  if (ganti) {
    router.replace(target);
  } else {
    router.push(target);
  }
}

// ── Urutan linimasa ─────────────────────────────────────────────────────────

/** Id akar sebuah pesan. */
export function akarDari(m: Pesan): string {
  return m.parent_id ?? m.id;
}

const banding = (a: Pesan, b: Pesan): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Urutan tampil: server mengirim satu halaman sebagai akar (tua→baru) diikuti
 * semua balasannya. Hapus duplikat per id (yang terakhir menang), urutkan akar
 * menurut id (ULID = waktu) dan taruh balasan tepat di bawah akarnya.
 */
export function urutkanTimeline(daftar: Pesan[]): Pesan[] {
  const perId = new Map<string, Pesan>();
  for (const m of daftar) {
    perId.set(m.id, m);
  }
  const balasan = new Map<string, Pesan[]>();
  const akar: Pesan[] = [];
  for (const m of perId.values()) {
    if (m.parent_id !== null && perId.has(m.parent_id)) {
      const grup = balasan.get(m.parent_id) ?? [];
      grup.push(m);
      balasan.set(m.parent_id, grup);
    } else {
      akar.push(m);
    }
  }
  akar.sort(banding);
  const hasil: Pesan[] = [];
  for (const m of akar) {
    hasil.push(m);
    const grup = balasan.get(m.id);
    if (grup) {
      hasil.push(...grup.sort(banding));
    }
  }
  return hasil;
}

/**
 * Gabungkan halaman terbaru (tanpa `sebelum`) ke daftar yang sudah dimuat:
 * thread dengan akar lebih tua dari akar tertua halaman baru dipertahankan,
 * sisanya diganti halaman baru (sunting/hapus/reaksi ikut segar).
 */
export function gabungTimeline(lama: Pesan[], halaman: Pesan[]): Pesan[] {
  if (halaman.length === 0) {
    return lama;
  }
  const akarHalaman = halaman.filter((m) => m.parent_id === null).map((m) => m.id).sort();
  const akarTerlama = akarHalaman[0] ?? halaman[0]?.id ?? '';
  const lebihTua = lama.filter((m) => akarDari(m) < akarTerlama);
  return urutkanTimeline([...lebihTua, ...halaman]);
}

/** Ganti satu pesan (hasil aksi) di daftar tanpa mengubah urutan. */
export function gantiPesan(daftar: Pesan[], baru: Pesan): Pesan[] {
  return daftar.map((m) => {
    if (m.id !== baru.id) {
      return m;
    }
    // Pertahankan ringkasan thread bila respons aksi tidak membawanya.
    return { ...baru, reply_count: baru.reply_count ?? m.reply_count, participants: baru.participants ?? m.participants, last_reply_at: baru.last_reply_at ?? m.last_reply_at };
  });
}

export function namaPenulis(m: Pesan): string {
  return m.penulis?.nama ?? m.author?.name ?? '';
}

export function pesanDihapus(m: Pesan): boolean {
  return m.deleted === true || m.deleted_at !== null;
}

/** Ringkasan reaksi; turun ke `reactions` lama bila `reaction_summary` tak ada. */
export function ringkasReaksi(m: Pesan, saya: string | null): RingkasReaksi[] {
  if (m.reaction_summary) {
    return m.reaction_summary;
  }
  return m.reactions
    .filter((r) => r.user_ids.length > 0)
    .map((r) => ({ emoji: r.emoji, count: r.user_ids.length, mine: saya !== null && r.user_ids.includes(saya) }));
}

// ── Baris linimasa ──────────────────────────────────────────────────────────

export type BarisLinimasa =
  | { jenis: 'hari'; kunci: string; hari: string }
  | { jenis: 'belum'; kunci: string; jumlah: number }
  | { jenis: 'pesan'; kunci: string; pesan: Pesan; awalKelompok: boolean; akhirKelompok: boolean };

const JEDA_KELOMPOK_MS = 5 * 60 * 1000;

function waktu(m: Pesan): number {
  return m.created_at ? new Date(m.created_at).getTime() : 0;
}

export function sekelompok(a: Pesan, b: Pesan): boolean {
  return (
    a.user_id === b.user_id &&
    !pesanDihapus(a) &&
    !pesanDihapus(b) &&
    ymdJakarta(a.created_at) === ymdJakarta(b.created_at) &&
    Math.abs(waktu(b) - waktu(a)) <= JEDA_KELOMPOK_MS
  );
}

/**
 * Baris yang dirender: hanya pesan akar (balasan hidup di layar thread), pemisah
 * hari, dan pemisah "N pesan belum dibaca" sebelum pesan akar pertama setelah
 * `batasBaca` milik orang lain. Kunci selalu unik (id pesan).
 */
export function susunBaris(daftar: Pesan[], batasBaca: string | null, saya: string | null): BarisLinimasa[] {
  const akar = daftar.filter((m) => m.parent_id === null);
  const belumIds = batasBaca === null ? [] : akar.filter((m) => m.id > batasBaca && m.user_id !== saya).map((m) => m.id);
  const pertamaBelum = belumIds[0] ?? null;
  const baris: BarisLinimasa[] = [];
  let hariSebelumnya = '';
  akar.forEach((m, i) => {
    const hari = ymdJakarta(m.created_at);
    let potong = false;
    if (hari !== '' && hari !== hariSebelumnya) {
      baris.push({ jenis: 'hari', kunci: `hari-${m.id}`, hari });
      hariSebelumnya = hari;
      potong = true;
    }
    if (pertamaBelum !== null && m.id === pertamaBelum) {
      baris.push({ jenis: 'belum', kunci: `belum-${m.id}`, jumlah: belumIds.length });
      potong = true;
    }
    const sebelum = akar[i - 1];
    const sesudah = akar[i + 1];
    const awal = potong || sebelum === undefined || !sekelompok(sebelum, m);
    const sesudahHariSama = sesudah !== undefined && ymdJakarta(sesudah.created_at) === hari;
    const akhir = sesudah === undefined || !sesudahHariSama || !sekelompok(m, sesudah) || (pertamaBelum !== null && sesudah.id === pertamaBelum);
    baris.push({ jenis: 'pesan', kunci: m.id, pesan: m, awalKelompok: awal, akhirKelompok: akhir });
  });
  return baris;
}

// ── Isi pesan (Tiptap) ──────────────────────────────────────────────────────

export type Potongan =
  | { jenis: 'teks'; teks: string; tebal?: boolean; miring?: boolean; kode?: boolean; tautan?: string }
  | { jenis: 'mention'; teks: string; id: string }
  | { jenis: 'tugas'; teks: string; id: string };

interface NodeTiptap {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type?: string; attrs?: Record<string, unknown> }[];
  content?: NodeTiptap[];
}

function labelAttr(node: NodeTiptap): string {
  const l = node.attrs?.label;
  return typeof l === 'string' ? l : '';
}

function idAttr(node: NodeTiptap): string {
  const v = node.attrs?.id;
  return typeof v === 'string' ? v : '';
}

/** Ratakan dokumen Tiptap jadi potongan teks sebaris (paragraf dipisah baris baru). */
export function potongPesan(body: Record<string, unknown> | null, teksPolos: string): Potongan[] {
  if (body === null || body.type !== 'doc') {
    return teksPolos === '' ? [] : [{ jenis: 'teks', teks: teksPolos }];
  }
  const hasil: Potongan[] = [];
  let perluBarisBaru = false;
  const dorong = (p: Potongan): void => {
    if (perluBarisBaru && hasil.length > 0) {
      hasil.push({ jenis: 'teks', teks: '\n' });
    }
    perluBarisBaru = false;
    hasil.push(p);
  };
  const jalan = (node: NodeTiptap, awalanDaftar?: string): void => {
    switch (node.type) {
      case 'text': {
        const tebal = node.marks?.some((m) => m.type === 'bold') ?? false;
        const miring = node.marks?.some((m) => m.type === 'italic') ?? false;
        const kode = node.marks?.some((m) => m.type === 'code') ?? false;
        const href = node.marks?.find((m) => m.type === 'link')?.attrs?.href;
        dorong({ jenis: 'teks', teks: node.text ?? '', tebal, miring, kode, tautan: typeof href === 'string' ? href : undefined });
        return;
      }
      case 'mention':
        dorong({ jenis: 'mention', teks: `@${labelAttr(node)}`, id: idAttr(node) });
        return;
      case 'taskReference':
        dorong({ jenis: 'tugas', teks: labelAttr(node), id: idAttr(node) });
        return;
      case 'hardBreak':
        hasil.push({ jenis: 'teks', teks: '\n' });
        return;
      case 'bulletList':
      case 'orderedList':
      case 'taskList': {
        (node.content ?? []).forEach((anak, i) => {
          perluBarisBaru = hasil.length > 0;
          jalan(anak, node.type === 'orderedList' ? `${i + 1}. ` : '• ');
        });
        perluBarisBaru = true;
        return;
      }
      case 'listItem':
      case 'taskItem': {
        if (awalanDaftar) {
          dorong({ jenis: 'teks', teks: awalanDaftar });
        }
        (node.content ?? []).forEach((anak) => jalan(anak));
        return;
      }
      default: {
        // paragraph, heading, blockquote, codeBlock, dll.
        const blok = node.type === 'paragraph' || node.type === 'heading' || node.type === 'blockquote' || node.type === 'codeBlock';
        if (blok && hasil.length > 0) {
          perluBarisBaru = true;
        }
        (node.content ?? []).forEach((anak) => jalan(anak));
        if (blok) {
          perluBarisBaru = true;
        }
      }
    }
  };
  jalan(body as NodeTiptap);
  return hasil;
}

/** Id mention + rujukan tugas yang sudah ada di dokumen (untuk mode sunting). */
export function acuanDariBody(body: Record<string, unknown> | null): { mentions: { id: string; nama: string }[]; tugas: { id: string; key: string }[] } {
  const mentions: { id: string; nama: string }[] = [];
  const tugas: { id: string; key: string }[] = [];
  const jalan = (node: NodeTiptap): void => {
    if (node.type === 'mention' && idAttr(node) !== '') {
      mentions.push({ id: idAttr(node), nama: labelAttr(node) });
    } else if (node.type === 'taskReference' && idAttr(node) !== '') {
      tugas.push({ id: idAttr(node), key: labelAttr(node) });
    }
    (node.content ?? []).forEach(jalan);
  };
  if (body !== null) {
    jalan(body as NodeTiptap);
  }
  return { mentions, tugas };
}

// ── Token @ / # di komposer ─────────────────────────────────────────────────

export interface TokenSaran {
  jenis: 'mention' | 'tugas';
  /** Teks setelah @ / # (tanpa penanda). */
  query: string;
  /** Awal token (indeks '@' / '#') di teks. */
  awal: number;
}

/** Token aktif tepat sebelum kursor: "@ri" atau "#PLQ-1" (harus di awal atau sesudah spasi). */
export function tokenSaran(teks: string, kursor: number): TokenSaran | null {
  const sebelum = teks.slice(0, kursor);
  const mention = /(^|\s)@([^\s@]{0,30})$/u.exec(sebelum);
  if (mention) {
    const q = mention[2] ?? '';
    return { jenis: 'mention', query: q, awal: sebelum.length - q.length - 1 };
  }
  const tugas = /(^|\s)#([A-Za-z0-9-]{1,20})$/u.exec(sebelum);
  if (tugas) {
    const q = tugas[2] ?? '';
    return { jenis: 'tugas', query: q, awal: sebelum.length - q.length - 1 };
  }
  return null;
}

/** Slug kanal seperti server: huruf kecil, spasi → "-", hanya a-z 0-9 dan "-". */
export function slugKanal(nama: string): string {
  return nama
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Tanggal pemisah linimasa: "Hari ini", "Kemarin", atau "Senin, 12 Okt 2026". */
export function labelHari(ymd: string, hariIni: string, kemarin: string, format: (v: string) => string): string {
  if (ymd === hariIni) {
    return 'Hari ini';
  }
  if (ymd === kemarin) {
    return 'Kemarin';
  }
  return format(ymd);
}

/** "214 KB" / "1,2 MB". */
export function ukuranBerkas(byte: number | null | undefined): string {
  if (byte === null || byte === undefined || byte <= 0) {
    return '';
  }
  if (byte < 1024 * 1024) {
    return `${Math.max(1, Math.round(byte / 1024))} KB`;
  }
  return `${(byte / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

export const LABEL_BERKAS: Record<string, string> = {
  doc: 'Google Docs',
  sheet: 'Google Sheets',
  slide: 'Google Slides',
  pdf: 'PDF',
  image: 'Gambar',
  folder: 'Folder',
  other: 'Berkas',
};

export function ikonBerkas(kind: string): 'file-text' | 'file-spreadsheet' | 'presentation' | 'image' | 'folder' | 'file' {
  switch (kind) {
    case 'doc':
    case 'pdf':
      return 'file-text';
    case 'sheet':
      return 'file-spreadsheet';
    case 'slide':
      return 'presentation';
    case 'image':
      return 'image';
    case 'folder':
      return 'folder';
    default:
      return 'file';
  }
}

/** "Senin, 12 Okt 2026" dari YYYY-MM-DD (tanpa pergeseran zona). */
export function formatHariPendek(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) {
    return ymd;
  }
  return new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

/** Label pemisah hari linimasa. */
export function labelHariLinimasa(ymd: string): string {
  const hariIni = ymdJakarta(new Date());
  const kemarin = ymdJakarta(new Date(Date.now() - 86_400_000));
  return labelHari(ymd, hariIni, kemarin, formatHariPendek);
}

/** Waktu singkat di daftar: jam (hari ini), "Kemarin", nama hari (minggu ini), atau tanggal. */
export function waktuDaftar(iso: string | null | undefined): string {
  if (!iso) {
    return '';
  }
  const hari = ymdJakarta(iso);
  const hariIni = ymdJakarta(new Date());
  if (hari === hariIni) {
    return jam(iso);
  }
  if (hari === ymdJakarta(new Date(Date.now() - 86_400_000))) {
    return 'Kemarin';
  }
  const selisih = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  if (selisih < 6) {
    return new Intl.DateTimeFormat('id-ID', { weekday: 'long', timeZone: zonaKantor() }).format(new Date(iso));
  }
  return tanggalTanpaTahun(iso);
}

/** Baris pratinjau pesan terakhir daftar ("Anda: …", "Maya: …" untuk grup). */
export function pratinjauKanal(kanal: KanalRingkas, saya: string | null): string {
  if (!kanal.is_member) {
    const info = `${kanal.members_count} anggota`;
    return kanal.topic ? `${info} · ${kanal.topic}` : info;
  }
  const pesan = kanal.last_message;
  if (!pesan) {
    return 'Belum ada pesan';
  }
  if (pesan.deleted || pesan.body_text === '') {
    return 'Pesan dihapus';
  }
  let awalan = '';
  if (saya !== null && pesan.user_id === saya) {
    awalan = 'Anda: ';
  } else if (kanal.type === 'group') {
    const nama = kanal.members.find((m) => m.user_id === pesan.user_id)?.name;
    awalan = nama ? `${nama.split(/\s+/)[0]}: ` : '';
  }
  return `${awalan}${pesan.body_text}`;
}

/** Penanda bisu milik pengguna pada ringkasan kanal. */
export function kanalDibisukan(kanal: KanalRingkas, saya: string | null): boolean {
  return saya !== null && kanal.members.some((m) => m.user_id === saya && m.muted);
}
