/**
 * Keadaan formulir tugas baru (dipakai sheet cepat dan form lengkap):
 * daftar workspace, konteks workspace terpilih (kolom, label, anggota),
 * draf, validasi, dan pengiriman (+ butir checklist awal bila ada).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApiError } from '@/api/client';
import {
  anggotaUntukTugas,
  konteksWorkspace,
  workspaceUntukTugas,
  type BodyBuatTugas,
  type KelompokWorkspaceTugas,
  type KonteksWorkspace,
  type OpsiWorkspace,
  type Orang,
} from '@/api/tugas';
import { tulisBuatTugas, type HasilBuat } from '@/offline/fitur/tugas';
import { useSession } from '@/session/SessionProvider';

import { galatPerField, pesanGalat } from './util';

export interface DrafTugas {
  workspace: OpsiWorkspace | null;
  title: string;
  description: string;
  statusId: string | null;
  priority: number;
  assignees: string[];
  due: string | null;
  start: string | null;
  estimate: string;
  labels: string[];
  checklist: string[];
}

const DRAF_AWAL: DrafTugas = {
  workspace: null,
  title: '',
  description: '',
  statusId: null,
  priority: 3,
  assignees: [],
  due: null,
  start: null,
  estimate: '',
  labels: [],
  checklist: [],
};

/** Cache per pengguna + workspace: tampil seketika saat berpindah, lalu tetap disegarkan dari server. */
const cacheKonteks = new Map<string, { k: KonteksWorkspace; a: Orang[] }>();

/** Kolom awal sama dengan server (CreateTask::resolveStatus): kolom Todo pertama, lalu kolom pertama. */
export function statusBawaan(k: KonteksWorkspace | null): string | null {
  if (!k) {
    return null;
  }
  return (k.statuses.find((s) => s.category === 'todo') ?? k.statuses[0])?.id ?? null;
}

/** "1,5" atau "1.5" → 1.5; kosong → null; salah → NaN. */
export function parseEstimasi(teks: string): number | null {
  const t = teks.trim().replace(',', '.');
  if (t === '') {
    return null;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : Number.NaN;
}

/** Pilihan yang dibawa dari sheet cepat ke form lengkap (disaring lagi setelah konteks workspace dimuat). */
export type IsiBawaan = Partial<Pick<DrafTugas, 'statusId' | 'priority' | 'assignees' | 'labels' | 'due'>>;

export function useBuatTugas(awal: { workspace?: string; judul?: string; isi?: IsiBawaan }): {
  draf: DrafTugas;
  ubah: (p: Partial<DrafTugas>) => void;
  pilihWorkspace: (w: OpsiWorkspace, isi?: IsiBawaan) => void;
  kelompok: KelompokWorkspaceTugas[];
  konteks: KonteksWorkspace | null;
  anggota: Orang[];
  memuat: boolean;
  galatMuat: string | null;
  /** Kolom/label/anggota workspace terpilih sedang dimuat (setelah memilih/mengganti workspace). */
  memuatKonteks: boolean;
  galatKonteks: string | null;
  muatUlangKonteks: () => void;
  /** Buat tugas: langsung ke server, atau — saat offline — disimpan di antrean (`antre: true`). */
  kirim: (tambahan?: Pick<BodyBuatTugas, 'parent_id'>) => Promise<HasilBuat | null>;
  mengirim: boolean;
  galat: Record<string, string>;
  galatUmum: string | null;
  bersih: () => void;
  adaPerubahan: boolean;
  muatUlang: () => void;
} {
  const { user } = useSession();
  const [draf, setDraf] = useState<DrafTugas>({ ...DRAF_AWAL, title: awal.judul ?? '' });
  const [kelompok, setKelompok] = useState<KelompokWorkspaceTugas[]>([]);
  const [konteks, setKonteks] = useState<KonteksWorkspace | null>(null);
  const [anggota, setAnggota] = useState<Orang[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galatMuat, setGalatMuat] = useState<string | null>(null);
  const [mengirim, setMengirim] = useState(false);
  const [galat, setGalat] = useState<Record<string, string>>({});
  const [galatUmum, setGalatUmum] = useState<string | null>(null);
  const [memuatKonteks, setMemuatKonteks] = useState(false);
  const [galatKonteks, setGalatKonteks] = useState<string | null>(null);
  const awalDipakai = useRef(false);
  const awalIsi = useRef(awal.isi);
  const idSaya = user?.id ?? null;
  // Permintaan konteks terbaru: jawaban workspace lama yang datang terlambat (ganti cepat) diabaikan.
  const urutKonteks = useRef(0);
  const wsAktif = useRef<OpsiWorkspace | null>(null);
  const drafRef = useRef(draf);
  // Penanggung jawab yang dibawa dari workspace sebelumnya; disaring setelah anggota workspace baru dimuat.
  const bawaan = useRef<{ ws: string; sementara: string[]; bawa: string[] } | null>(null);

  useEffect(() => {
    drafRef.current = draf;
  }, [draf]);

  const terapkanKonteks = useCallback(
    (wsId: string, k: KonteksWorkspace, a: Orang[]): void => {
      setKonteks(k);
      setAnggota(a);
      const t = bawaan.current?.ws === wsId ? bawaan.current : null;
      bawaan.current = null;
      setDraf((d) => {
        if (d.workspace?.id !== wsId) {
          return d;
        }
        const statusId = d.statusId !== null && k.statuses.some((s) => s.id === d.statusId) ? d.statusId : statusBawaan(k);
        const labels = d.labels.filter((id) => k.labels.some((l) => l.id === id));
        const sumber = t && d.assignees === t.sementara ? t.bawa : d.assignees;
        let assignees = sumber;
        if (a.length > 0) {
          const ids = new Set(a.map((o) => o.id));
          assignees = sumber.filter((id) => ids.has(id));
          if (assignees.length === 0 && sumber.length > 0 && idSaya && ids.has(idSaya)) {
            assignees = [idSaya];
          }
        }
        return { ...d, statusId, labels, assignees };
      });
    },
    [idSaya],
  );

  const muatKonteks = useCallback(
    async (w: OpsiWorkspace): Promise<void> => {
      const urut = ++urutKonteks.current;
      const kunci = `${idSaya ?? ''}:${w.id}`;
      const sudah = cacheKonteks.get(kunci);
      setGalatKonteks(null);
      if (sudah) {
        terapkanKonteks(w.id, sudah.k, sudah.a);
      } else {
        setKonteks(null);
        setAnggota([]);
        setMemuatKonteks(true);
      }
      try {
        const [k, a] = await Promise.all([konteksWorkspace(w.id), anggotaUntukTugas(w.id)]);
        cacheKonteks.set(kunci, { k, a });
        if (urut === urutKonteks.current) {
          terapkanKonteks(w.id, k, a);
        }
      } catch (err) {
        // Form tetap bisa dikirim (server memakai kolom bawaan); pilihan kolom/label/anggota butuh konteks ini.
        if (urut === urutKonteks.current && !sudah) {
          setGalatKonteks(pesanGalat(err, 'Kolom, label, dan anggota workspace ini gagal dimuat.'));
        }
      } finally {
        if (urut === urutKonteks.current) {
          setMemuatKonteks(false);
        }
      }
    },
    [idSaya, terapkanKonteks],
  );

  const pilihWorkspace = useCallback(
    (w: OpsiWorkspace, isi?: IsiBawaan): void => {
      if (wsAktif.current?.id === w.id) {
        // Workspace yang sama: jangan buang pilihan (muat ulang konteks lewat muatUlangKonteks).
        return;
      }
      wsAktif.current = w;
      const d = drafRef.current;
      const bawa = isi?.assignees ?? (d.workspace === null ? (idSaya ? [idSaya] : []) : d.assignees);
      // Sampai anggota workspace baru dimuat, hanya "Saya" yang pasti valid (tanpa chip nama basi).
      const sementara = idSaya && bawa.includes(idSaya) ? [idSaya] : [];
      bawaan.current = { ws: w.id, sementara, bawa };
      const ganti = {
        workspace: w,
        statusId: isi?.statusId ?? null,
        labels: isi?.labels ?? [],
        assignees: sementara,
        ...(isi?.priority !== undefined ? { priority: isi.priority } : {}),
        ...(isi?.due !== undefined ? { due: isi.due } : {}),
      };
      setDraf((x) => ({ ...x, ...ganti }));
      drafRef.current = { ...d, ...ganti };
      setGalat({});
      setGalatUmum(null);
      void muatKonteks(w);
    },
    [idSaya, muatKonteks],
  );

  const muatUlangKonteks = useCallback((): void => {
    if (wsAktif.current) {
      void muatKonteks(wsAktif.current);
    }
  }, [muatKonteks]);

  const muatDaftar = useCallback(async (): Promise<void> => {
    setMemuat(true);
    setGalatMuat(null);
    try {
      const grup = await workspaceUntukTugas();
      setKelompok(grup);
      if (!awalDipakai.current) {
        awalDipakai.current = true;
        const semua = grup.flatMap((g) => g.items);
        const boleh = (w: OpsiWorkspace): boolean => !w.arsip && !w.view_only && w.my_role !== 'viewer';
        const diminta = awal.workspace ? semua.find((w) => w.id.toLowerCase() === awal.workspace?.toLowerCase() || w.key.toLowerCase() === awal.workspace?.toLowerCase()) : undefined;
        // Workspace yang diminta tetapi hanya-baca/diarsipkan tidak dipilih diam-diam: jatuh ke Pribadi + beri tahu.
        const pilih = (diminta && boleh(diminta) ? diminta : undefined) ?? semua.find((w) => w.type === 'personal' && boleh(w)) ?? semua.find(boleh);
        if (pilih) {
          pilihWorkspace(pilih, pilih === diminta ? awalIsi.current : undefined);
        }
        if (awal.workspace && (!diminta || !boleh(diminta))) {
          setGalatUmum(`Anda tidak bisa menambah tugas di ${diminta?.name ?? 'workspace itu'}${pilih ? '; workspace diganti ke ' + (pilih.type === 'personal' ? 'Pribadi' : pilih.name) : ''}.`);
        }
      }
    } catch (err) {
      setGalatMuat(pesanGalat(err, 'Tidak dapat memuat workspace.'));
    } finally {
      setMemuat(false);
    }
  }, [awal.workspace, pilihWorkspace]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pemuatan awal daftar workspace
    void muatDaftar();
  }, [muatDaftar]);

  const ubah = useCallback((p: Partial<DrafTugas>): void => {
    setDraf((d) => ({ ...d, ...p }));
    setGalat({});
    setGalatUmum(null);
  }, []);

  const kirim = useCallback(async (tambahan?: Pick<BodyBuatTugas, 'parent_id'>): Promise<HasilBuat | null> => {
    const g: Record<string, string> = {};
    if (!draf.workspace) {
      g.workspace = 'Pilih workspace lebih dulu.';
    }
    const judul = draf.title.trim();
    if (judul === '') {
      g.title = 'Judul tugas wajib diisi.';
    } else if (judul.length > 255) {
      g.title = `Judul tugas maksimal 255 karakter. (${judul.length}/255)`;
    }
    const est = parseEstimasi(draf.estimate);
    if (est !== null && (Number.isNaN(est) || est < 0 || est > 9999)) {
      g.estimate = 'Estimasi harus angka 0–9999 jam.';
    }
    if (draf.start && draf.due && draf.due < draf.start) {
      g.due = 'Tenggat tidak boleh sebelum tanggal mulai.';
    }
    if (Object.keys(g).length > 0 || !draf.workspace) {
      setGalat(g);
      return null;
    }
    setMengirim(true);
    setGalat({});
    setGalatUmum(null);
    try {
      const tugas = await tulisBuatTugas(
        {
          workspace_id: draf.workspace.id,
          title: judul,
          description: draf.description.trim() === '' ? undefined : draf.description.trim(),
          assignee_ids: draf.assignees.length > 0 ? draf.assignees : undefined,
          due_date: draf.due ?? undefined,
          priority: draf.priority,
          status_id: draf.statusId ?? undefined,
          label_ids: draf.labels.length > 0 ? draf.labels : undefined,
          start_date: draf.start ?? undefined,
          estimate_hours: est ?? undefined,
          ...(tambahan?.parent_id ? { parent_id: tambahan.parent_id } : {}),
        },
        {
          workspace: { id: draf.workspace.id, key: draf.workspace.key, name: draf.workspace.name, type: draf.workspace.type },
          statuses: konteks?.statuses ?? [],
          labels: konteks?.labels ?? [],
          orang: [...anggota, ...(user ? [{ id: user.id, name: user.name, avatar: null }] : [])],
          creator: user ? { id: user.id, name: user.name, avatar: null } : null,
          checklist: draf.checklist,
        },
      );
      return tugas;
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.errors).length > 0) {
        setGalat(galatPerField(err, { workspace_id: 'workspace', assignee_ids: 'assignees', estimate_hours: 'estimate', due_date: 'due', start_date: 'start', label_ids: 'labels', status_id: 'status' }));
      } else if (err instanceof ApiError && err.status === 403) {
        setGalatUmum(err.message || 'Anda tidak boleh menambah tugas di workspace ini.');
      } else if (err instanceof ApiError && err.status === 0) {
        setGalatUmum('Tidak ada koneksi. Tugas belum terkirim — periksa sambungan lalu coba lagi.');
      } else {
        setGalatUmum(pesanGalat(err, 'Gagal membuat tugas. Coba lagi.'));
      }
      return null;
    } finally {
      setMengirim(false);
    }
  }, [draf, konteks, anggota, user]);

  const bersih = useCallback((): void => {
    setDraf((d) => ({ ...DRAF_AWAL, workspace: d.workspace, statusId: statusBawaan(konteks), assignees: idSaya ? [idSaya] : [] }));
    setGalat({});
    setGalatUmum(null);
  }, [idSaya, konteks]);

  const adaPerubahan = useMemo(
    () => draf.title.trim() !== '' || draf.description.trim() !== '' || draf.checklist.length > 0 || draf.due !== null || draf.start !== null || draf.estimate !== '',
    [draf],
  );

  return { draf, ubah, pilihWorkspace, kelompok, konteks, anggota, memuat, galatMuat, memuatKonteks, galatKonteks, muatUlangKonteks, kirim, mengirim, galat, galatUmum, bersih, adaPerubahan, muatUlang: () => void muatDaftar() };
}
