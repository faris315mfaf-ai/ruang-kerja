/**
 * Status formulir "Laporan hari ini": muat (`GET /laporan/hari-ini`), simpan
 * otomatis (debounce 1,2 dtk → `PUT`, item selalu dikirim utuh, `report_date`
 * = tanggal saat formulir dibuka), cadangan lokal saat offline, kirim
 * (`POST …/kirim`), galat 422 per isian, dan keadaan terkunci (403
 * `laporan_terkunci`). Isian lokal adalah sumber kebenaran selama layar
 * terbuka — respons server hanya memperbarui metadata (status, waktu simpan).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApiError } from '@/api/client';
import {
  kirimLaporan,
  laporanHariIni,
  simpanLaporan,
  type BodyLaporan,
  type HasilKirim,
  type ItemLaporan,
  type Laporan,
  type LaporanHariIniData,
  type OpsiTugas,
} from '@/api/laporan';
import { useSession } from '@/session/SessionProvider';

import { bacaDrafLokal, hapusDrafLokal, tulisDrafLokal } from './drafLokal';

export const JEDA_SIMPAN_MS = 1200;
const JEDA_ULANG_OFFLINE_MS = 15_000;

export interface ItemForm {
  kunci: string;
  taskId: string | null;
  taskKey: string | null;
  taskTitle: string | null;
  catatan: string;
  persen: number | null;
  jam: number | null;
  pindahKe: string | null;
}

export interface IsianForm {
  ringkasan: string;
  hambatan: string;
  catatan: string;
  items: ItemForm[];
}

export type StatusSimpan = 'bersih' | 'menunggu' | 'menyimpan' | 'tersimpan' | 'offline' | 'gagal' | 'terkunci';

/** Galat per isian: `summary` · `blockers` · `notes` · `items` · `umum` · `item:<kunci>:<field>`. */
export type GalatForm = Record<string, string>;

export type HasilKirimForm = { ok: true; hasil: HasilKirim } | { ok: false; alasan: 'validasi' | 'offline' | 'terkunci' | 'galat'; pesan: string };

let urutKunci = 0;
function kunciBaru(): string {
  urutKunci += 1;
  return `i${Date.now().toString(36)}${urutKunci}`;
}

function teksAtauNull(t: string): string | null {
  const bersih = t.trim();
  return bersih === '' ? null : t;
}

export function buatBody(tanggal: string, isian: IsianForm): BodyLaporan {
  return {
    report_date: tanggal,
    summary: teksAtauNull(isian.ringkasan),
    blockers: teksAtauNull(isian.hambatan),
    notes: teksAtauNull(isian.catatan),
    items: isian.items.map((i) => ({
      task_id: i.taskId,
      progress_note: i.catatan,
      percent: i.persen,
      hours: i.jam,
      move_status_id: i.taskId ? i.pindahKe : null,
    })),
  };
}

function itemDariServer(i: ItemLaporan, opsi: Record<string, OpsiTugas>): ItemForm {
  const o = i.task_id ? opsi[i.task_id] : undefined;
  return {
    kunci: kunciBaru(),
    taskId: i.task_id,
    taskKey: o?.key ?? i.task_key,
    taskTitle: o?.title ?? i.task_title,
    catatan: i.progress_note ?? '',
    persen: i.percent,
    jam: i.hours,
    pindahKe: i.move_status_id,
  };
}

function isianDariLaporan(r: Laporan, opsi: Record<string, OpsiTugas>): IsianForm {
  return {
    ringkasan: r.summary ?? '',
    hambatan: r.blockers ?? '',
    catatan: r.notes ?? '',
    items: r.items.map((i) => itemDariServer(i, opsi)),
  };
}

function isianDariBody(b: BodyLaporan, opsi: Record<string, OpsiTugas>, lama: Laporan): IsianForm {
  return {
    ringkasan: b.summary ?? '',
    hambatan: b.blockers ?? '',
    catatan: b.notes ?? '',
    items: b.items.map((i) => {
      const o = i.task_id ? opsi[i.task_id] : undefined;
      const dulu = i.task_id ? lama.items.find((x) => x.task_id === i.task_id) : undefined;
      return {
        kunci: kunciBaru(),
        taskId: i.task_id,
        taskKey: o?.key ?? dulu?.task_key ?? null,
        taskTitle: o?.title ?? dulu?.task_title ?? null,
        catatan: i.progress_note,
        persen: i.percent,
        jam: i.hours,
        pindahKe: i.move_status_id,
      };
    }),
  };
}

/** Galat 422 server → galat per isian (indeks item dipetakan ke kunci item yang dikirim). */
function petakanGalat(err: ApiError, terkirim: ItemForm[]): GalatForm {
  const hasil: GalatForm = {};
  for (const [kunci, pesan] of Object.entries(err.errors)) {
    const teks = pesan[0];
    if (!teks) continue;
    const cocok = /^items\.(\d+)\.(\w+)$/.exec(kunci);
    if (cocok) {
      const item = terkirim[Number(cocok[1])];
      if (item) {
        hasil[`item:${item.kunci}:${cocok[2]}`] = teks;
        continue;
      }
    }
    if (kunci === 'summary' || kunci === 'blockers' || kunci === 'notes' || kunci === 'items') {
      hasil[kunci] = teks;
    } else {
      hasil.umum = hasil.umum ?? teks;
    }
  }
  if (Object.keys(hasil).length === 0) {
    hasil.umum = err.message;
  }
  return hasil;
}

function terkunciDari(err: unknown): boolean {
  return err instanceof ApiError && err.status === 403 && err.code === 'laporan_terkunci';
}

export interface FormLaporan {
  muat: { status: 'memuat' | 'galat' | 'siap'; pesan: string | null; kode: number | null };
  data: LaporanHariIniData | null;
  /** Metadata laporan dari respons server terakhir. */
  laporan: Laporan | null;
  opsi: Record<string, OpsiTugas>;
  isian: IsianForm;
  galat: GalatForm;
  statusSimpan: StatusSimpan;
  pesanSimpan: string | null;
  /** ISO waktu simpan terakhir yang diterima server. */
  tersimpanPada: string | null;
  /** Draf diambil dari cadangan perangkat saat dibuka. */
  dipulihkan: boolean;
  mengirim: boolean;
  /** Bertambah setiap kali data dimuat ulang (kunci item lokal dibuat baru). */
  muatKe: number;
  muatUlang: () => Promise<void>;
  ubahTeks: (field: 'ringkasan' | 'hambatan' | 'catatan', nilai: string) => void;
  ubahItem: (kunci: string, patch: Partial<Omit<ItemForm, 'kunci'>>) => void;
  tambahTugas: (opsi: OpsiTugas) => string | null;
  tambahDiLuar: () => string | null;
  hapusItem: (kunci: string) => void;
  simpanSekarang: () => void;
  kirim: () => Promise<HasilKirimForm>;
  validasiKirim: () => GalatForm;
}

const KOSONG: IsianForm = { ringkasan: '', hambatan: '', catatan: '', items: [] };

export function useFormLaporan(): FormLaporan {
  const { user } = useSession();
  const userId = user?.id ?? '';
  const [muat, setMuat] = useState<FormLaporan['muat']>({ status: 'memuat', pesan: null, kode: null });
  const [data, setData] = useState<LaporanHariIniData | null>(null);
  const [laporan, setLaporan] = useState<Laporan | null>(null);
  const [opsi, setOpsi] = useState<Record<string, OpsiTugas>>({});
  const [isian, setIsian] = useState<IsianForm>(KOSONG);
  const [galat, setGalat] = useState<GalatForm>({});
  const [statusSimpan, setStatusSimpan] = useState<StatusSimpan>('bersih');
  const [pesanSimpan, setPesanSimpan] = useState<string | null>(null);
  const [tersimpanPada, setTersimpanPada] = useState<string | null>(null);
  const [dipulihkan, setDipulihkan] = useState(false);
  const [mengirim, setMengirim] = useState(false);
  const [muatKe, setMuatKe] = useState(0);

  const tanggalRef = useRef<string>('');
  const isianRef = useRef<IsianForm>(KOSONG);
  const versiRef = useRef(0);
  const versiTersimpanRef = useRef(0);
  const sedangSimpanRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const terkunciRef = useRef(false);
  const terpasangRef = useRef(true);
  const batasRef = useRef<number>(30);

  const userIdRef = useRef(userId);
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    terpasangRef.current = true;
    return () => {
      terpasangRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      // Keluar dari layar sebelum jeda simpan habis: kirim isian terakhir (tanpa menunggu).
      if (versiRef.current !== versiTersimpanRef.current && !terkunciRef.current && tanggalRef.current) {
        const body = buatBody(tanggalRef.current, isianRef.current);
        const pemilik = userIdRef.current;
        simpanLaporan(body)
          .then(() => hapusDrafLokal())
          .catch((err: unknown) => {
            if (!terkunciDari(err)) tulisDrafLokal({ userId: pemilik, body, savedAt: new Date().toISOString() });
          });
      }
    };
  }, []);

  const terapkanMeta = useCallback((r: Laporan) => {
    setLaporan(r);
    if (r.updated_at) setTersimpanPada(r.updated_at);
  }, []);

  const jalankanSimpan = useCallback(async (): Promise<void> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (terkunciRef.current || !tanggalRef.current) return;
    if (sedangSimpanRef.current) {
      // Simpan berikutnya dijadwalkan sesudah yang sedang berjalan selesai.
      return;
    }
    const versi = versiRef.current;
    if (versi === versiTersimpanRef.current) return;
    const terkirim = isianRef.current;
    const body = buatBody(tanggalRef.current, terkirim);
    sedangSimpanRef.current = true;
    setStatusSimpan('menyimpan');
    setPesanSimpan(null);
    let ulangOffline = false;
    try {
      const r = await simpanLaporan(body);
      if (!terpasangRef.current) return;
      versiTersimpanRef.current = Math.max(versiTersimpanRef.current, versi);
      terapkanMeta(r);
      setGalat((g) => {
        // Galat server untuk isian yang sudah diterima dihapus; galat validasi kirim (klien) dibiarkan.
        const sisa: GalatForm = {};
        for (const [k, v] of Object.entries(g)) {
          if (k.endsWith(':progress_note') || k === 'items') sisa[k] = v;
        }
        return sisa;
      });
      if (versi === versiRef.current) {
        hapusDrafLokal();
        setStatusSimpan('tersimpan');
      } else {
        setStatusSimpan('menunggu');
      }
    } catch (err) {
      if (!terpasangRef.current) return;
      if (terkunciDari(err)) {
        terkunciRef.current = true;
        hapusDrafLokal();
        setStatusSimpan('terkunci');
        setPesanSimpan(err instanceof ApiError ? err.message : null);
      } else if (err instanceof ApiError && err.status === 0) {
        tulisDrafLokal({ userId, body, savedAt: new Date().toISOString() });
        setStatusSimpan('offline');
        setPesanSimpan('Draf belum tersimpan');
        ulangOffline = true;
      } else if (err instanceof ApiError && err.status === 422) {
        setGalat((g) => ({ ...g, ...petakanGalat(err, terkirim.items) }));
        setStatusSimpan('gagal');
        setPesanSimpan(err.firstValidationError ?? err.message);
      } else {
        tulisDrafLokal({ userId, body, savedAt: new Date().toISOString() });
        setStatusSimpan('gagal');
        setPesanSimpan(err instanceof ApiError ? err.message : 'Gagal menyimpan draf.');
        ulangOffline = err instanceof ApiError && (err.status === 429 || err.status >= 500);
      }
    } finally {
      sedangSimpanRef.current = false;
    }
    if (!terpasangRef.current || terkunciRef.current) return;
    if (ulangOffline) {
      timerRef.current = setTimeout(() => void jalankanSimpan(), JEDA_ULANG_OFFLINE_MS);
    } else if (versiRef.current !== versiTersimpanRef.current && !sedangSimpanRef.current) {
      timerRef.current = setTimeout(() => void jalankanSimpan(), JEDA_SIMPAN_MS);
    }
  }, [terapkanMeta, userId]);

  const tandaiBerubah = useCallback(
    (baru: IsianForm) => {
      isianRef.current = baru;
      setIsian(baru);
      if (terkunciRef.current) return;
      versiRef.current += 1;
      setStatusSimpan((s) => (s === 'menyimpan' ? s : 'menunggu'));
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void jalankanSimpan(), JEDA_SIMPAN_MS);
    },
    [jalankanSimpan],
  );

  const muatUlang = useCallback(async (): Promise<void> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setMuat((m) => ({ ...m, status: 'memuat' }));
    try {
      const d = await laporanHariIni();
      if (!terpasangRef.current) return;
      const peta: Record<string, OpsiTugas> = {};
      for (const o of [...d.suggestions, ...d.chosen]) peta[o.id] = o;
      tanggalRef.current = d.date;
      terkunciRef.current = false;
      batasRef.current = d.limits.items;
      versiRef.current = 0;
      versiTersimpanRef.current = 0;
      let awal = isianDariLaporan(d.report, peta);
      let pulih = false;
      const lokal = userId ? bacaDrafLokal(userId, d.date) : null;
      if (lokal && (d.report.updated_at === null || new Date(lokal.savedAt).getTime() > new Date(d.report.updated_at).getTime())) {
        awal = isianDariBody(lokal.body, peta, d.report);
        pulih = true;
      } else if (lokal) {
        hapusDrafLokal();
      }
      isianRef.current = awal;
      setData(d);
      setOpsi(peta);
      setLaporan(d.report);
      setIsian(awal);
      setGalat({});
      setTersimpanPada(d.report.updated_at);
      setStatusSimpan(d.report.id ? 'tersimpan' : 'bersih');
      setPesanSimpan(null);
      setDipulihkan(pulih);
      setMuat({ status: 'siap', pesan: null, kode: null });
      setMuatKe((n) => n + 1);
      if (pulih) {
        versiRef.current = 1;
        setStatusSimpan('menunggu');
        timerRef.current = setTimeout(() => void jalankanSimpan(), 300);
      }
    } catch (err) {
      if (!terpasangRef.current) return;
      setMuat({
        status: 'galat',
        pesan: err instanceof ApiError ? err.message : 'Tidak dapat memuat laporan hari ini.',
        kode: err instanceof ApiError ? err.status : null,
      });
    }
  }, [jalankanSimpan, userId]);

  useEffect(() => {
    void muatUlang();
  }, [muatUlang]);

  const ubahTeks = useCallback(
    (field: 'ringkasan' | 'hambatan' | 'catatan', nilai: string) => {
      const kunciGalat = field === 'ringkasan' ? 'summary' : field === 'hambatan' ? 'blockers' : 'notes';
      setGalat((g) => {
        if (!(kunciGalat in g)) return g;
        const { [kunciGalat]: _hapus, ...sisa } = g;
        return sisa;
      });
      tandaiBerubah({ ...isianRef.current, [field]: nilai });
    },
    [tandaiBerubah],
  );

  const ubahItem = useCallback(
    (kunci: string, patch: Partial<Omit<ItemForm, 'kunci'>>) => {
      setGalat((g) => {
        const awalan = `item:${kunci}:`;
        const sisa: GalatForm = {};
        let berubah = false;
        for (const [k, v] of Object.entries(g)) {
          const field = k.startsWith(awalan) ? k.slice(awalan.length) : null;
          const terkena =
            field !== null &&
            ((field === 'progress_note' && 'catatan' in patch) ||
              (field === 'percent' && 'persen' in patch) ||
              (field === 'hours' && 'jam' in patch) ||
              (field === 'move_status_id' && 'pindahKe' in patch) ||
              field === 'task_id');
          if (terkena) {
            berubah = true;
          } else {
            sisa[k] = v;
          }
        }
        return berubah ? sisa : g;
      });
      tandaiBerubah({ ...isianRef.current, items: isianRef.current.items.map((i) => (i.kunci === kunci ? { ...i, ...patch } : i)) });
    },
    [tandaiBerubah],
  );

  const tambahTugas = useCallback(
    (o: OpsiTugas): string | null => {
      const sekarang = isianRef.current;
      if (sekarang.items.length >= batasRef.current) return null;
      const ada = sekarang.items.find((i) => i.taskId === o.id);
      if (ada) return ada.kunci;
      setOpsi((p) => ({ ...p, [o.id]: o }));
      const item: ItemForm = { kunci: kunciBaru(), taskId: o.id, taskKey: o.key, taskTitle: o.title, catatan: '', persen: null, jam: null, pindahKe: null };
      setGalat((g) => {
        if (!('items' in g)) return g;
        const { items: _hapus, ...sisa } = g;
        return sisa;
      });
      tandaiBerubah({ ...sekarang, items: [...sekarang.items, item] });
      return item.kunci;
    },
    [tandaiBerubah],
  );

  const tambahDiLuar = useCallback((): string | null => {
    const sekarang = isianRef.current;
    if (sekarang.items.length >= batasRef.current) return null;
    const item: ItemForm = { kunci: kunciBaru(), taskId: null, taskKey: null, taskTitle: null, catatan: '', persen: null, jam: null, pindahKe: null };
    setGalat((g) => {
      if (!('items' in g)) return g;
      const { items: _hapus, ...sisa } = g;
      return sisa;
    });
    tandaiBerubah({ ...sekarang, items: [...sekarang.items, item] });
    return item.kunci;
  }, [tandaiBerubah]);

  const hapusItem = useCallback(
    (kunci: string) => {
      setGalat((g) => {
        const sisa: GalatForm = {};
        for (const [k, v] of Object.entries(g)) {
          if (!k.startsWith(`item:${kunci}:`)) sisa[k] = v;
        }
        return sisa;
      });
      tandaiBerubah({ ...isianRef.current, items: isianRef.current.items.filter((i) => i.kunci !== kunci) });
    },
    [tandaiBerubah],
  );

  const simpanSekarang = useCallback(() => {
    if (versiRef.current === versiTersimpanRef.current) {
      // Tidak ada perubahan baru, tetapi pengguna meminta coba lagi: paksa kirim isi sekarang.
      versiRef.current += 1;
    }
    void jalankanSimpan();
  }, [jalankanSimpan]);

  const validasiKirim = useCallback((): GalatForm => {
    const g: GalatForm = {};
    const sekarang = isianRef.current;
    if (sekarang.items.length === 0) {
      g.items = 'Tambahkan minimal satu pekerjaan yang Anda kerjakan hari ini.';
    }
    for (const i of sekarang.items) {
      if (i.catatan.trim() === '') {
        g[`item:${i.kunci}:progress_note`] = 'Catatan progres wajib diisi.';
      }
    }
    return g;
  }, []);

  const kirim = useCallback(async (): Promise<HasilKirimForm> => {
    const lokal = validasiKirim();
    if (Object.keys(lokal).length > 0) {
      setGalat((g) => ({ ...g, ...lokal }));
      return { ok: false, alasan: 'validasi', pesan: lokal.items ?? 'Setiap pekerjaan butuh catatan progres.' };
    }
    if (terkunciRef.current) {
      return { ok: false, alasan: 'terkunci', pesan: 'Laporan tanggal itu sudah terkunci.' };
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const versi = versiRef.current;
    const terkirim = isianRef.current;
    const body = buatBody(tanggalRef.current, terkirim);
    setMengirim(true);
    try {
      const hasil = await kirimLaporan(body);
      if (terpasangRef.current) {
        versiTersimpanRef.current = Math.max(versiTersimpanRef.current, versi);
        terapkanMeta(hasil.report);
        setGalat({});
        // Tugas yang dipindah kini berada di kolom tujuannya.
        setOpsi((p) => {
          const baru = { ...p };
          for (const m of hasil.move_results) {
            const o = baru[m.task_id];
            if (m.moved && m.to && o) baru[m.task_id] = { ...o, status: m.to };
          }
          return baru;
        });
        if (versi === versiRef.current) {
          hapusDrafLokal();
          setStatusSimpan('tersimpan');
          setPesanSimpan(null);
        } else {
          timerRef.current = setTimeout(() => void jalankanSimpan(), JEDA_SIMPAN_MS);
        }
      }
      return { ok: true, hasil };
    } catch (err) {
      if (terkunciDari(err)) {
        terkunciRef.current = true;
        hapusDrafLokal();
        if (terpasangRef.current) {
          setStatusSimpan('terkunci');
          setPesanSimpan(err instanceof ApiError ? err.message : null);
        }
        return { ok: false, alasan: 'terkunci', pesan: err instanceof ApiError ? err.message : 'Laporan sudah terkunci.' };
      }
      if (err instanceof ApiError && err.status === 0) {
        tulisDrafLokal({ userId, body, savedAt: new Date().toISOString() });
        return { ok: false, alasan: 'offline', pesan: 'Tidak ada koneksi. Laporan belum terkirim; isian aman di perangkat.' };
      }
      if (err instanceof ApiError && err.status === 422) {
        if (terpasangRef.current) setGalat((g) => ({ ...g, ...petakanGalat(err, terkirim.items) }));
        return { ok: false, alasan: 'validasi', pesan: err.firstValidationError ?? err.message };
      }
      return { ok: false, alasan: 'galat', pesan: err instanceof ApiError ? err.message : 'Gagal mengirim laporan.' };
    } finally {
      if (terpasangRef.current) setMengirim(false);
    }
  }, [jalankanSimpan, terapkanMeta, userId, validasiKirim]);

  return useMemo(
    () => ({
      muat,
      data,
      laporan,
      opsi,
      isian,
      galat,
      statusSimpan,
      pesanSimpan,
      tersimpanPada,
      dipulihkan,
      mengirim,
      muatKe,
      muatUlang,
      ubahTeks,
      ubahItem,
      tambahTugas,
      tambahDiLuar,
      hapusItem,
      simpanSekarang,
      kirim,
      validasiKirim,
    }),
    [muat, data, laporan, opsi, isian, galat, statusSimpan, pesanSimpan, tersimpanPada, dipulihkan, mengirim, muatKe, muatUlang, ubahTeks, ubahItem, tambahTugas, tambahDiLuar, hapusItem, simpanSekarang, kirim, validasiKirim],
  );
}
