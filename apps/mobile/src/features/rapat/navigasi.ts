/**
 * Navigasi modul Rapat. Pra-gabung video (`/rapat/[id]/video/pra-gabung`)
 * milik paket A4-Video: bila rutenya belum ada di build ini, jatuh ke
 * layar "Segera hadir".
 */
import * as Linking from 'expo-linking';
import { router, useSitemap, type SitemapType } from 'expo-router';
import { useCallback, useMemo } from 'react';

function cari(node: SitemapType | null, pola: RegExp): boolean {
  if (!node) {
    return false;
  }
  if (pola.test(node.contextKey)) {
    return true;
  }
  return node.children.some((anak) => cari(anak, pola));
}

/** `bukaPraGabung(id, tanggal)` — ke pra-gabung video (A4-Video) atau "Segera hadir". */
export function useBukaPraGabung(): (id: string, tanggal: string | null) => void {
  const peta = useSitemap();
  const ada = useMemo(() => cari(peta, /rapat\/\[id\]\/video\/pra-gabung/), [peta]);
  return useCallback(
    (id: string, tanggal: string | null) => {
      if (ada) {
        router.push({ pathname: '/rapat/[id]/video/pra-gabung' as never, params: { id, tanggal: tanggal ?? '' } } as never);
        return;
      }
      router.push({ pathname: '/segera', params: { judul: 'Rapat video', ikon: 'video', catatan: 'Ruang rapat video di aplikasi sedang disiapkan.' } } as never);
    },
    [ada],
  );
}

export function bukaDetail(id: string, tanggal?: string | null): void {
  router.push({ pathname: '/rapat/[id]', params: tanggal ? { id, tanggal } : { id } } as never);
}

export function bukaNotulen(id: string, tanggal?: string | null): void {
  router.push({ pathname: '/rapat/[id]/notulen', params: tanggal ? { id, tanggal } : { id } } as never);
}

export function bukaTranskrip(id: string, tanggal?: string | null): void {
  router.push({ pathname: '/rapat/[id]/transkrip', params: tanggal ? { id, tanggal } : { id } } as never);
}

export function bukaTautan(url: string): Promise<boolean> {
  const lengkap = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  return Linking.openURL(lengkap)
    .then(() => true)
    .catch(() => false);
}
