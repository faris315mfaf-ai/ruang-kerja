/**
 * Kelas lebar jendela Android + kebijakan orientasi (spec 12 §4.10, keputusan
 * pemilik 13 Okt 2026). Data & logika layar sama di semua lebar; hanya tata
 * letak yang berbeda.
 *
 * | Lebar jendela | Kelas    | Kerangka                                      |
 * |---------------|----------|-----------------------------------------------|
 * | < 600 dp      | compact  | tab bar kapsul (ponsel, lipat tertutup)       |
 * | 600–839 dp    | medium   | Rail 96 dp; Tugas/Obrolan dua panel ≥ 720 dp   |
 * | ≥ 840 dp      | expanded | Rail 96 dp; Obrolan tiga kolom ≥ 1000 dp       |
 *
 * Yang diukur adalah **jendela** (`useWindowDimensions`), bukan jenis
 * perangkat: layar terbagi di tablet bisa kembali ke kapsul.
 */
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect } from 'react';
import { Dimensions, useWindowDimensions } from 'react-native';

export type KelasLebar = 'compact' | 'medium' | 'expanded';

export const BATAS = {
  /** Rail menggantikan kapsul tab bar. */
  rail: 600,
  /** Daftar + detail berdampingan (Tugas, Obrolan). */
  duaPanel: 720,
  expanded: 840,
  /** Obrolan: daftar · percakapan · thread. */
  tigaKolom: 1000,
} as const;

/** Lebar Rail navigasi (dp). */
export const LEBAR_RAIL = 96;

export interface TataLetak {
  lebar: number;
  tinggi: number;
  kelas: KelasLebar;
  /** Rail 96 dp di kiri, tanpa kapsul tab bar. */
  rail: boolean;
  duaPanel: boolean;
  tigaKolom: boolean;
  lanskap: boolean;
}

export function hitungTataLetak(lebar: number, tinggi: number): TataLetak {
  return {
    lebar,
    tinggi,
    kelas: lebar >= BATAS.expanded ? 'expanded' : lebar >= BATAS.rail ? 'medium' : 'compact',
    rail: lebar >= BATAS.rail,
    duaPanel: lebar >= BATAS.duaPanel,
    tigaKolom: lebar >= BATAS.tigaKolom,
    lanskap: lebar > tinggi,
  };
}

export function useTataLetak(): TataLetak {
  const { width, height } = useWindowDimensions();
  return hitungTataLetak(width, height);
}

/** Lebar kolom daftar pada tampilan dua panel (mockup 17/18: 320 di 834, 380 di 1112). */
export function lebarDaftar(t: TataLetak, jenis: 'tugas' | 'obrolan'): number {
  if (jenis === 'obrolan') {
    return t.tigaKolom ? 300 : 320;
  }
  return t.kelas === 'expanded' ? 380 : 320;
}

/**
 * Perangkat "lebar" = sisi terpendek **layar** ≥ 600 dp (tablet, lipat
 * terbuka). Memakai layar, bukan jendela, supaya layar terbagi di tablet
 * tidak mengunci potret.
 */
function perangkatLebar(): boolean {
  const { width, height } = Dimensions.get('screen');
  return Math.min(width, height) >= BATAS.rail;
}

/**
 * Ponsel tetap potret (manifest `screenOrientation=portrait` dari app.json);
 * tablet & lipat terbuka boleh diputar mengikuti setelan Putar otomatis.
 * Dievaluasi ulang saat layar berubah (lipat dibuka/ditutup).
 */
export function useKebijakanOrientasi(): void {
  useEffect(() => {
    let terakhir: boolean | null = null;
    const terapkan = (): void => {
      const lebar = perangkatLebar();
      if (lebar === terakhir) {
        return;
      }
      terakhir = lebar;
      const kerja = lebar ? ScreenOrientation.unlockAsync() : ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      kerja.catch(() => undefined);
    };
    terapkan();
    const langganan = Dimensions.addEventListener('change', terapkan);
    return () => langganan.remove();
  }, []);
}
