/**
 * Mesin simpan catatan per catatan — dipindah dari komponen layar agar
 * simpanan tetap jalan di latar setelah editor ditutup (pil "Catatan belum
 * tersimpan") dan agar tombol kembali bisa menyiram simpanan dulu.
 *
 * Semantik (dipertahankan dari editor lama): SATU antrean simpan untuk judul
 * DAN isi (mencegah PATCH tumpang tindih); `updated_at` dasar diperbarui dari
 * SETIAP respons (rename juga memajukannya, kalau tidak PATCH isi berikutnya
 * mendapat 409 palsu); isi dikirim sebagai snapshot sehingga ketikan selama
 * permintaan berjalan dikirim pada putaran berikutnya. 409 `rich_note` bukan
 * konflik versi (catatan berformat lengkap → baca-saja).
 */
import { ApiError } from '@/api/client';
import { ubahIsi, ubahJudul, type CatatanDetail } from '@/api/catatan';

import { createStore } from './store';

export type StatusSimpan = 'idle' | 'menyimpan' | 'tersimpan' | 'gagal' | 'konflik';

export interface GalatSimpan {
  /** 0 = tanpa koneksi. */
  status: number;
  pesan: string;
}

export interface SesiState {
  status: StatusSimpan;
  tersimpanPada: Date | null;
  galat: GalatSimpan | null;
  judulGalat: string | null;
  /** Ada perubahan yang belum sampai ke server (isi, judul antre, atau gagal/konflik). */
  kotor: boolean;
  kaya: boolean;
  catatan: CatatanDetail | null;
}

const DEBOUNCE_MS = 1500;
const ULANG_MS = 10_000;
const TAMPIL_TERSIMPAN_MS = 2000;

function escapeHtml(teks: string): string {
  return teks.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Baris teks polos → paragraf HTML sederhana (node whitelist Tiptap). */
export function teksKeHtml(teks: string): string {
  if (teks.trim() === '') {
    return '';
  }
  return teks
    .split('\n')
    .map((baris) => `<p>${escapeHtml(baris)}</p>`)
    .join('');
}

export class SesiSimpan {
  readonly id: string;
  readonly state = createStore<SesiState>({
    status: 'idle',
    tersimpanPada: null,
    galat: null,
    judulGalat: null,
    kotor: false,
    kaya: false,
    catatan: null,
  });

  /** Editor yang sedang menampilkan sesi ini (pil global menyembunyikan sesi terpasang). */
  terpasang = false;
  teks = '';
  private teksTersimpan = '';
  private judulTersimpan = '';
  private judulIngin: string | null = null;
  private dasar: string | null = null;
  private konflik = false;
  private kaya = false;
  private boleh = false;
  private sedang: Promise<boolean> | null = null;
  private timerSimpan: ReturnType<typeof setTimeout> | null = null;
  private timerUlang: ReturnType<typeof setTimeout> | null = null;
  private timerBersih: ReturnType<typeof setTimeout> | null = null;
  private dibuang = false;

  constructor(id: string) {
    this.id = id;
  }

  get judulSaatIni(): string {
    return this.judulIngin ?? this.judulTersimpan;
  }

  get sudahDimuat(): boolean {
    return this.state.get().catatan !== null;
  }

  private hitungKotor(): boolean {
    if (!this.boleh) {
      return false;
    }
    const s = this.state.get();
    return this.judulIngin !== null || (!this.kaya && this.teks !== this.teksTersimpan) || this.konflik || s.status === 'gagal';
  }

  private terbit(ubah: Partial<SesiState> = {}): void {
    this.state.set((lama) => ({ ...lama, ...ubah }));
    const kotor = this.hitungKotor();
    if (kotor !== this.state.get().kotor) {
      this.state.set((lama) => ({ ...lama, kotor }));
    }
    ringkasanSesi();
  }

  /** Terapkan keadaan server (muat awal / muat ulang). Menimpa suntingan lokal. */
  terapkanServer(detail: CatatanDetail): void {
    this.batalkanTimer();
    this.teksTersimpan = detail.body_text ?? '';
    this.teks = this.teksTersimpan;
    this.judulTersimpan = detail.title;
    this.judulIngin = null;
    this.dasar = detail.updated_at;
    this.konflik = false;
    this.kaya = detail.mobile_editable === false;
    this.boleh = detail.can_edit === true;
    this.terbit({ catatan: detail, status: 'idle', galat: null, judulGalat: null, kaya: this.kaya });
  }

  /** Perbarui metadata detail tanpa menyentuh suntingan lokal (mis. setelah pindah/pulihkan). */
  terapkanMeta(detail: CatatanDetail): void {
    this.dasar = detail.updated_at;
    this.judulTersimpan = detail.title;
    this.terbit({ catatan: { ...detail, body_text: this.state.get().catatan?.body_text ?? detail.body_text } });
  }

  ubahTeks(nilai: string): void {
    this.teks = nilai;
    this.terbit();
    this.jadwalkanSimpan();
  }

  /** Antrekan judul baru (maksud terpisah dari isi). `true` bila perlu dikirim. */
  antreJudul(baru: string): boolean {
    if (!this.boleh) {
      return false;
    }
    const bersih = baru.trim();
    if (bersih === '' || bersih === this.judulTersimpan) {
      this.judulIngin = null;
      this.terbit();
      return false;
    }
    this.judulIngin = bersih;
    this.terbit();
    return true;
  }

  private jadwalkanSimpan(): void {
    if (this.timerSimpan) {
      clearTimeout(this.timerSimpan);
    }
    if (!this.boleh || this.kaya || this.konflik) {
      return;
    }
    this.timerSimpan = setTimeout(() => {
      this.timerSimpan = null;
      void this.siram();
    }, DEBOUNCE_MS);
  }

  private batalkanTimer(): void {
    for (const t of [this.timerSimpan, this.timerUlang, this.timerBersih]) {
      if (t) {
        clearTimeout(t);
      }
    }
    this.timerSimpan = null;
    this.timerUlang = null;
    this.timerBersih = null;
  }

  /** Simpan sekarang (judul lalu isi). `true` bila tidak ada yang tertinggal. */
  siram(): Promise<boolean> {
    if (this.dibuang || !this.boleh) {
      return Promise.resolve(true);
    }
    if (this.timerSimpan) {
      clearTimeout(this.timerSimpan);
      this.timerSimpan = null;
    }
    if (this.sedang) {
      return this.sedang;
    }
    const janji = this.jalankan().finally(() => {
      this.sedang = null;
    });
    this.sedang = janji;
    return janji;
  }

  private async jalankan(): Promise<boolean> {
    let semuaBerhasil = true;
    for (;;) {
      const judulIngin = this.judulIngin;
      if (judulIngin !== null) {
        this.judulIngin = null;
        this.terbit({ status: 'menyimpan' });
        try {
          const hasil = await ubahJudul(this.id, judulIngin);
          this.judulTersimpan = hasil.title;
          this.dasar = hasil.updated_at;
          this.terbit({ catatan: this.gabung(hasil, null), judulGalat: null });
        } catch (err) {
          semuaBerhasil = false;
          this.judulIngin = null;
          this.terbit({
            judulGalat: err instanceof ApiError ? (err.firstValidationError ?? err.message) : 'Gagal menyimpan judul.',
          });
        }
        continue;
      }

      if (this.konflik || this.kaya || this.teks === this.teksTersimpan) {
        break;
      }

      const snapshot = this.teks;
      this.terbit({ status: 'menyimpan' });
      try {
        const hasil = await ubahIsi(this.id, teksKeHtml(snapshot), this.dasar ?? '');
        this.dasar = hasil.updated_at;
        this.teksTersimpan = snapshot;
        this.judulTersimpan = hasil.title;
        this.terbit({ catatan: this.gabung(hasil, snapshot) });
      } catch (err) {
        if (err instanceof ApiError && err.status === 409 && err.code === 'rich_note') {
          // Server menolak menyunting isi berformat lengkap — bukan konflik versi.
          this.kaya = true;
          this.teks = this.teksTersimpan;
          this.terbit({ kaya: true });
          continue;
        }
        if (err instanceof ApiError && err.status === 409) {
          this.konflik = true;
          this.terbit({ status: 'konflik', galat: { status: 409, pesan: err.message } });
          return false;
        }
        const status = err instanceof ApiError ? err.status : 0;
        const pesan = err instanceof ApiError ? err.message : 'Tidak dapat menyimpan catatan.';
        this.terbit({ status: 'gagal', galat: { status, pesan } });
        this.jadwalkanUlang(status);
        return false;
      }
    }

    if (this.konflik) {
      this.terbit({ status: 'konflik' });
      return false;
    }
    if (!semuaBerhasil) {
      this.terbit({ status: 'gagal', galat: { status: 422, pesan: 'Judul gagal disimpan.' } });
      return false;
    }
    this.terbit({ status: 'tersimpan', tersimpanPada: new Date(), galat: null });
    this.bersihkanBilaTertinggal();
    return true;
  }

  private gabung(hasil: CatatanDetail, snapshotTeks: string | null): CatatanDetail {
    const lama = this.state.get().catatan;
    if (lama === null) {
      return hasil;
    }
    return { ...lama, ...hasil, body_text: snapshotTeks ?? lama.body_text };
  }

  private jadwalkanUlang(status: number): void {
    if (this.timerUlang) {
      clearTimeout(this.timerUlang);
      this.timerUlang = null;
    }
    // Hanya galat sementara (tanpa koneksi / server / throttle) yang dicoba ulang.
    if (status !== 0 && status < 500 && status !== 429) {
      return;
    }
    this.timerUlang = setTimeout(() => {
      this.timerUlang = null;
      void this.siram();
    }, ULANG_MS);
  }

  /** Sesi yang tidak lagi terpasang dan sudah bersih dilepas setelah "Tersimpan ✓" tampil sebentar. */
  private bersihkanBilaTertinggal(): void {
    if (this.terpasang) {
      return;
    }
    if (this.timerBersih) {
      clearTimeout(this.timerBersih);
    }
    this.timerBersih = setTimeout(() => {
      this.timerBersih = null;
      if (!this.terpasang && !this.hitungKotor()) {
        this.buang();
      }
    }, TAMPIL_TERSIMPAN_MS);
  }

  /** Editor ditutup: simpanan terakhir berlanjut di latar; sesi bersih langsung dilepas. */
  lepas(): void {
    this.terpasang = false;
    if (!this.hitungKotor() && this.state.get().status !== 'menyimpan') {
      this.buang();
    } else {
      ringkasanSesi();
    }
  }

  /** Buang sesi dan seluruh suntingan lokal yang belum tersimpan. */
  buang(): void {
    this.dibuang = true;
    this.batalkanTimer();
    registri.delete(this.id);
    ringkasanSesi();
  }
}

const registri = new Map<string, SesiSimpan>();

export interface RingkasanSesi {
  id: string;
  judul: string;
  status: StatusSimpan;
  kotor: boolean;
  galat: GalatSimpan | null;
}

/** Sesi yang tidak sedang dibuka di editor: sumber pil global "Catatan belum tersimpan". */
export const ringkasanStore = createStore<RingkasanSesi[]>([]);

function ringkasanSesi(): void {
  const daftar: RingkasanSesi[] = [];
  for (const s of registri.values()) {
    if (s.terpasang) {
      continue;
    }
    const st = s.state.get();
    if (st.kotor || st.status === 'menyimpan' || st.status === 'tersimpan') {
      daftar.push({ id: s.id, judul: s.judulSaatIni, status: st.status, kotor: st.kotor, galat: st.galat });
    }
  }
  const lama = ringkasanStore.get();
  const sama =
    lama.length === daftar.length &&
    lama.every((l, i) => {
      const d = daftar[i];
      return d !== undefined && l.id === d.id && l.judul === d.judul && l.status === d.status && l.kotor === d.kotor && l.galat === d.galat;
    });
  if (!sama) {
    ringkasanStore.set(daftar);
  }
}

/** Ambil (atau buat) sesi simpan untuk sebuah catatan. */
export function sesiUntuk(id: string): SesiSimpan {
  let s = registri.get(id);
  if (s === undefined) {
    s = new SesiSimpan(id);
    registri.set(id, s);
  }
  return s;
}

export function cariSesi(id: string): SesiSimpan | undefined {
  return registri.get(id);
}

/** Pasang sesi ke editor (menyembunyikan dari pil) dan segarkan ringkasan. */
export function pasangSesi(s: SesiSimpan): void {
  s.terpasang = true;
  ringkasanSesi();
}
