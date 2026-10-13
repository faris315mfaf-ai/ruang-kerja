/** Cari global (kontrak: docs/sesi/ponsel-b2c-inbox.md §3). */
import { apiRequest } from './client';

export type TipeCari = 'tugas' | 'orang' | 'workspace' | 'dokumen' | 'catatan' | 'pengajuan' | 'rapat';

export interface TargetCari {
  type: string;
  id: string | null;
  anchor: string | null;
  params: Record<string, string>;
}

export interface HasilCari {
  id: string;
  title: string;
  code: string | null;
  subtitle: string | null;
  meta: string | null;
  snippet: string | null;
  avatar: string | null;
  icon: string | null;
  url: string | null;
  external: boolean;
  target: TargetCari | null;
}

export interface GrupCari {
  key: string;
  label: string;
  has_more: boolean;
  items: HasilCari[];
}

export interface BalasanCari {
  q: string;
  tipe: TipeCari | null;
  terms: string[];
  groups: GrupCari[];
}

export const MIN_HURUF_CARI = 2;

export async function cari(q: string, tipe?: TipeCari | null): Promise<BalasanCari> {
  const hasil = await apiRequest<BalasanCari>('cari', { query: { q, tipe: tipe ?? null } });
  if (hasil === null) {
    throw new Error('Respons server kosong.');
  }
  return hasil;
}
