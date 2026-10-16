/**
 * Overlay lokal CATATAN untuk daftar/pohon: catatan baru dari HP (id
 * sementara) dan judul/isi yang menunggu sinkron, diturunkan dari antrean.
 */
import { useMemo } from 'react';

import type { PohonNode } from '@/api/catatan';

import { useAntrean, type ItemAntrean } from '../antrean';
import type { StatusSinkronUi } from '../ChipMenunggu';
import { JENIS_CATATAN, catatanIdItem, type MetaBuatCatatan, type MetaPatchCatatan } from './catatan';

export interface ItemBuatCatatan {
  tmpId: string;
  meta: MetaBuatCatatan;
  judul: string;
  sinkron: StatusSinkronUi;
  dibuat: string;
}

export interface OverlayCatatan {
  buat: ItemBuatCatatan[];
  per: Record<string, { judul?: string; sinkron: StatusSinkronUi }>;
  ada: boolean;
}

const KOSONG: OverlayCatatan = { buat: [], per: {}, ada: false };
let memoItems: readonly ItemAntrean[] | null = null;
let memoHasil: OverlayCatatan = KOSONG;

export function hitungOverlayCatatan(items: readonly ItemAntrean[]): OverlayCatatan {
  if (items === memoItems) {
    return memoHasil;
  }
  const per: OverlayCatatan['per'] = {};
  const buat: ItemBuatCatatan[] = [];
  for (const item of items) {
    if (!item.jenis.startsWith('catatan.')) {
      continue;
    }
    const sink: StatusSinkronUi = item.status === 'konflik' || item.status === 'gagal' ? 'gagal' : 'menunggu';
    const id = catatanIdItem(item);
    if (!id) {
      continue;
    }
    if (item.jenis === JENIS_CATATAN.buat || item.jenis === JENIS_CATATAN.notulensi) {
      const m = item.meta as unknown as MetaBuatCatatan;
      buat.push({ tmpId: id, meta: m, judul: m.snapshot.title, sinkron: sink, dibuat: item.dibuatPada });
      continue;
    }
    const lama = per[id];
    const m = item.meta as unknown as MetaPatchCatatan;
    per[id] = { judul: item.jenis === JENIS_CATATAN.judul ? m.judul : lama?.judul, sinkron: lama?.sinkron === 'gagal' ? 'gagal' : sink };
  }
  memoItems = items;
  memoHasil = buat.length > 0 || Object.keys(per).length > 0 ? { buat, per, ada: true } : KOSONG;
  return memoHasil;
}

export function useOverlayCatatan(): OverlayCatatan {
  const items = useAntrean((s) => s.items);
  return useMemo(() => hitungOverlayCatatan(items), [items]);
}

function simpulBuat(b: ItemBuatCatatan, judul: string): PohonNode {
  return {
    id: b.tmpId,
    parent_id: b.meta.snapshot.parentId,
    kind: 'note',
    preset: b.meta.snapshot.preset,
    title: judul,
    access: 'workspace',
    invited_only: false,
    position: 'zzzz',
    penulis: null,
    penyunting: null,
    updated_at: b.dibuat,
    my_role: 'author',
    can_edit: true,
    children: [],
    sinkron: b.sinkron,
  };
}

/** Terapkan overlay ke pohon sebuah workspace (`personal` mencocokkan notulensi cepat yang belum tahu id workspace). */
export function terapkanPohonCatatan(tree: PohonNode[], ov: OverlayCatatan, wsId: string, personal: boolean): PohonNode[] {
  if (!ov.ada) {
    return tree;
  }
  const buat = ov.buat.filter((b) => b.meta.snapshot.workspace.id === wsId || (b.meta.snapshot.workspace.id === '' && personal));
  const terapkan = (nodes: PohonNode[], induk: string | null): PohonNode[] => {
    const hasil = nodes.map((n) => {
      const e = ov.per[n.id];
      const anak = terapkan(n.children, n.id);
      if (!e && anak === n.children) {
        return n;
      }
      return { ...n, ...(e?.judul ? { title: e.judul } : {}), ...(e ? { sinkron: e.sinkron } : {}), children: anak };
    });
    const baru = buat.filter((b) => b.meta.snapshot.parentId === induk).map((b) => simpulBuat(b, ov.per[b.tmpId]?.judul ?? b.judul));
    return baru.length > 0 ? [...hasil, ...baru] : hasil;
  };
  // Catatan baru di folder yang tidak ada di pohon (mis. induk tak terlihat) jatuh ke akar.
  const ada = new Set<string>();
  const kumpul = (nodes: PohonNode[]): void => nodes.forEach((n) => (ada.add(n.id), kumpul(n.children)));
  kumpul(tree);
  const yatim = buat.filter((b) => b.meta.snapshot.parentId !== null && !ada.has(b.meta.snapshot.parentId));
  const dasar = terapkan(tree, null);
  return yatim.length > 0 ? [...dasar, ...yatim.map((b) => simpulBuat(b, b.judul))] : dasar;
}
