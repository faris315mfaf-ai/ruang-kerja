/** Muat pohon catatan semua workspace (paralel terbatas) untuk layar Daftar catatan. */
import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '@/api/client';
import { pohonWorkspace, type PohonWorkspace } from '@/api/catatan';
import { daftarWorkspace } from '@/api/endpoints';

import type { RuangBuat } from './BuatSheet';

export interface PanelData extends RuangBuat {
  canCreate: boolean;
}

export type StatusDaftar = 'memuat' | 'siap' | 'galat' | 'offline' | 'mati';

/** Batas workspace yang dimuat sekaligus pada tampilan "Semua" (lainnya lewat `?workspace=`). */
const BATAS_WORKSPACE = 12;
const PARALEL = 4;

interface Hasil {
  status: StatusDaftar;
  pesan: string | null;
  panel: PanelData[];
  /** true bila ada workspace yang tidak ikut dimuat (melebihi batas). */
  terpotong: boolean;
  memuatUlang: boolean;
  muat: () => Promise<void>;
  muatUlangRuang: (workspaceId: string) => Promise<void>;
}

async function dalamBatch<T, R>(item: T[], jalankan: (x: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const hasil: PromiseSettledResult<R>[] = new Array<PromiseSettledResult<R>>(item.length);
  let kursor = 0;
  const kerja = async (): Promise<void> => {
    for (;;) {
      const i = kursor++;
      const x = item[i];
      if (i >= item.length || x === undefined) {
        return;
      }
      try {
        hasil[i] = { status: 'fulfilled', value: await jalankan(x) };
      } catch (reason) {
        hasil[i] = { status: 'rejected', reason };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALEL, item.length) }, kerja));
  return hasil;
}

function jadiPanel(p: PohonWorkspace, personal: boolean): PanelData {
  return { id: p.workspace.id, key: p.workspace.key, name: p.workspace.name, archived: p.workspace.archived, personal, tree: p.tree, canCreate: p.can_create && !p.workspace.archived };
}

export function useDaftarCatatan(workspaceParam: string | null): Hasil {
  const [status, setStatus] = useState<StatusDaftar>('memuat');
  const [pesan, setPesan] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelData[]>([]);
  const [terpotong, setTerpotong] = useState(false);
  const [memuatUlang, setMemuatUlang] = useState(false);
  const personalIds = useRef<Set<string>>(new Set());
  const adaData = useRef(false);

  const muat = useCallback(async (): Promise<void> => {
    setMemuatUlang(true);
    if (!adaData.current) {
      setStatus('memuat');
    }
    setPesan(null);
    try {
      const grup = await daftarWorkspace();
      const semua = grup.groups.flatMap((g) => g.items.map((item) => ({ item, personal: g.jenis === 'pribadi' })));
      personalIds.current = new Set(semua.filter((x) => x.personal).map((x) => x.item.id));

      let sasaran = semua;
      if (workspaceParam !== null) {
        const cocok = semua.filter((x) => x.item.id === workspaceParam || x.item.key === workspaceParam);
        sasaran = cocok.length > 0 ? cocok : [{ item: { id: workspaceParam, key: '', name: 'Workspace', arsip: false }, personal: false }];
      }
      const dipotong = sasaran.length > BATAS_WORKSPACE;
      const dimuat = sasaran.slice(0, BATAS_WORKSPACE);

      const hasil = await dalamBatch(dimuat, (x) => pohonWorkspace(x.item.id));
      const berhasil: PanelData[] = [];
      let galatPertama: unknown = null;
      let semua404 = true;
      hasil.forEach((h, i) => {
        const x = dimuat[i];
        if (h.status === 'fulfilled' && x) {
          berhasil.push(jadiPanel(h.value, x.personal));
          semua404 = false;
        } else if (h.status === 'rejected') {
          galatPertama ??= h.reason;
          if (!(h.reason instanceof ApiError && h.reason.status === 404)) {
            semua404 = false;
          }
        }
      });

      if (berhasil.length === 0 && dimuat.length > 0) {
        if (semua404) {
          setStatus('mati');
          return;
        }
        throw galatPertama;
      }
      adaData.current = true;
      setPanel(berhasil);
      setTerpotong(dipotong);
      setStatus('siap');
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) {
        setStatus(adaData.current ? 'siap' : 'offline');
        setPesan(err.message);
      } else if (err instanceof ApiError && err.status === 404) {
        setStatus('mati');
      } else {
        setStatus(adaData.current ? 'siap' : 'galat');
        setPesan(err instanceof ApiError ? err.message : 'Tidak dapat memuat catatan.');
      }
    } finally {
      setMemuatUlang(false);
    }
  }, [workspaceParam]);

  const muatUlangRuang = useCallback(async (workspaceId: string): Promise<void> => {
    try {
      const baru = await pohonWorkspace(workspaceId);
      setPanel((lama) => lama.map((p) => (p.id === workspaceId ? jadiPanel(baru, p.personal) : p)));
    } catch {
      // Gagal diam-diam: tarik-untuk-muat-ulang tetap tersedia.
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pemuatan data saat layar dibuka
    void muat();
  }, [muat]);

  return { status, pesan, panel, terpotong, memuatUlang, muat, muatUlangRuang };
}
