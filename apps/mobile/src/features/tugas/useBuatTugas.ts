/**
 * Keadaan formulir tugas baru (dipakai sheet cepat dan form lengkap):
 * daftar workspace, konteks workspace terpilih (kolom, label, anggota),
 * draf, validasi, dan pengiriman (+ butir checklist awal bila ada).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApiError } from '@/api/client';
import {
  anggotaUntukTugas,
  buatTugasBaru,
  konteksWorkspace,
  tambahButir,
  workspaceUntukTugas,
  type DetailTugasPenuh,
  type KelompokWorkspaceTugas,
  type KonteksWorkspace,
  type OpsiWorkspace,
  type Orang,
} from '@/api/tugas';
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

const cacheKonteks = new Map<string, { k: KonteksWorkspace; a: Orang[] }>();

/** "1,5" atau "1.5" → 1.5; kosong → null; salah → NaN. */
export function parseEstimasi(teks: string): number | null {
  const t = teks.trim().replace(',', '.');
  if (t === '') {
    return null;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : Number.NaN;
}

export function useBuatTugas(awal: { workspace?: string; judul?: string }): {
  draf: DrafTugas;
  ubah: (p: Partial<DrafTugas>) => void;
  pilihWorkspace: (w: OpsiWorkspace) => void;
  kelompok: KelompokWorkspaceTugas[];
  konteks: KonteksWorkspace | null;
  anggota: Orang[];
  memuat: boolean;
  galatMuat: string | null;
  kirim: () => Promise<DetailTugasPenuh | null>;
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
  const awalDipakai = useRef(false);
  const idSaya = user?.id ?? null;

  const muatKonteks = useCallback(async (w: OpsiWorkspace): Promise<void> => {
    const kunci = w.id;
    const sudah = cacheKonteks.get(kunci);
    if (sudah) {
      setKonteks(sudah.k);
      setAnggota(sudah.a);
      return;
    }
    setKonteks(null);
    setAnggota([]);
    try {
      const [k, a] = await Promise.all([konteksWorkspace(w.id), anggotaUntukTugas(w.id)]);
      cacheKonteks.set(kunci, { k, a });
      setKonteks(k);
      setAnggota(a);
    } catch {
      // Konteks hanya pelengkap (kolom/label/anggota): form tetap bisa dikirim.
    }
  }, []);

  const pilihWorkspace = useCallback(
    (w: OpsiWorkspace): void => {
      setDraf((d) => ({ ...d, workspace: w, statusId: null, labels: [], assignees: idSaya ? [idSaya] : [] }));
      setGalat({});
      setGalatUmum(null);
      void muatKonteks(w);
    },
    [idSaya, muatKonteks],
  );

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
        const pilih = (awal.workspace ? semua.find((w) => w.id === awal.workspace || w.key.toLowerCase() === awal.workspace?.toLowerCase()) : undefined) ?? semua.find((w) => w.type === 'personal' && boleh(w)) ?? semua.find(boleh);
        if (pilih) {
          pilihWorkspace(pilih);
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

  const kirim = useCallback(async (): Promise<DetailTugasPenuh | null> => {
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
      const tugas = await buatTugasBaru({
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
      });
      for (const butir of draf.checklist) {
        try {
          await tambahButir(tugas.id, butir);
        } catch {
          // Checklist awal bersifat pelengkap; sisanya bisa ditambah dari detail.
        }
      }
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
  }, [draf]);

  const bersih = useCallback((): void => {
    setDraf((d) => ({ ...DRAF_AWAL, workspace: d.workspace, assignees: idSaya ? [idSaya] : [] }));
    setGalat({});
    setGalatUmum(null);
  }, [idSaya]);

  const adaPerubahan = useMemo(
    () => draf.title.trim() !== '' || draf.description.trim() !== '' || draf.checklist.length > 0 || draf.due !== null || draf.start !== null || draf.estimate !== '',
    [draf],
  );

  return { draf, ubah, pilihWorkspace, kelompok, konteks, anggota, memuat, galatMuat, kirim, mengirim, galat, galatUmum, bersih, adaPerubahan, muatUlang: () => void muatDaftar() };
}
