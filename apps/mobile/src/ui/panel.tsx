/**
 * Konteks "panel": layar detail (tugas, percakapan, thread) yang ditanam di
 * samping daftar pada tablet, bukan didorong sebagai layar penuh. Komponen
 * kerangka (`SubAppBar`, header obrolan) membaca ini untuk mengganti tombol
 * Kembali dengan Tutup (atau menyembunyikannya), dan layar memakai
 * `useKembali()` alih-alih `router.back()`.
 */
import { router } from 'expo-router';
import { createContext, useContext, useMemo } from 'react';

interface PanelValue {
  /** `true` bila layar dirender sebagai panel di dalam layar lain. */
  tertanam: boolean;
  /** Menutup panel (tanpa ini tombol kembali disembunyikan). */
  tutup?: () => void;
}

const PanelContext = createContext<PanelValue>({ tertanam: false });

export function PanelProvider({ tutup, children }: { tutup?: () => void; children: React.ReactNode }): React.JSX.Element {
  const value = useMemo(() => ({ tertanam: true, tutup }), [tutup]);
  return <PanelContext.Provider value={value}>{children}</PanelContext.Provider>;
}

export function usePanel(): PanelValue {
  return useContext(PanelContext);
}

/** Aksi "kembali" yang benar untuk layar biasa (`router.back`) maupun panel (tutup panel). */
export function useKembali(): () => void {
  const { tertanam, tutup } = usePanel();
  return useMemo(() => (tertanam ? (tutup ?? (() => undefined)) : () => router.back()), [tertanam, tutup]);
}
