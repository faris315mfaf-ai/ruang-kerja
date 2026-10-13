import { useEffect } from 'react';

import { useAppLock } from '@/features/auth/appLock';

/**
 * Menahan kunci aplikasi selama layar terpasang (layar kamera/pemindai): dialog
 * izin Android dan pembukaan kamera memindahkan aplikasi ke latar sesaat.
 */
export function useTahanKunciSelama(): void {
  const { tahanKunci } = useAppLock();
  useEffect(() => {
    let lepas: (() => void) | undefined;
    const tunggu = new Promise<void>((selesai) => {
      lepas = selesai;
    });
    void tahanKunci(() => tunggu);
    return () => lepas?.();
  }, [tahanKunci]);
}
