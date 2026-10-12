/**
 * Tema Arus: mengikuti skema sistem, dengan pilihan manual Terang/Gelap
 * yang disimpan di SecureStore (`rk.tema`). Pilihan manual diteruskan ke
 * `Appearance.setColorScheme` supaya komponen native (papan ketik, dialog
 * sistem) ikut berganti; `useColorScheme()` lalu selalu benar.
 *
 * Provider ini harus SELALU membungkus akar aplikasi (jangan bersyarat).
 */
import * as SecureStore from 'expo-secure-store';
import * as SystemUI from 'expo-system-ui';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';

import {
  darkColors,
  darkGradients,
  darkShadows,
  lightColors,
  lightGradients,
  lightShadows,
  type Colors,
  type Gradients,
  type Shadows,
} from './tokens';

export type ThemeMode = 'system' | 'light' | 'dark';

const MODE_KEY = 'rk.tema';

export interface ThemeValue {
  colors: Colors;
  gradients: Gradients;
  shadows: Shadows;
  /** `true` bila tema malam sedang tampil. */
  dark: boolean;
  /** Pilihan pengguna: ikuti sistem, terang, atau gelap. */
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  /** Pilihan tersimpan sudah dibaca (akar menahan splash sampai siap). */
  ready: boolean;
}

const fallback: ThemeValue = {
  colors: lightColors,
  gradients: lightGradients,
  shadows: lightShadows,
  dark: false,
  mode: 'system',
  setMode: () => undefined,
  ready: true,
};

const ThemeContext = createContext<ThemeValue>(fallback);

function terapkanMode(mode: ThemeMode): void {
  Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode);
}

export function ThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const scheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let batal = false;
    void (async () => {
      try {
        const tersimpan = await SecureStore.getItemAsync(MODE_KEY);
        if (!batal && (tersimpan === 'light' || tersimpan === 'dark')) {
          terapkanMode(tersimpan);
          setModeState(tersimpan);
        }
      } catch {
        // Tanpa penyimpanan: ikuti sistem.
      } finally {
        if (!batal) {
          setReady(true);
        }
      }
    })();
    return () => {
      batal = true;
    };
  }, []);

  const setMode = useCallback((baru: ThemeMode): void => {
    terapkanMode(baru);
    setModeState(baru);
    const simpan = baru === 'system' ? SecureStore.deleteItemAsync(MODE_KEY) : SecureStore.setItemAsync(MODE_KEY, baru);
    simpan.catch(() => undefined);
  }, []);

  const dark = scheme === 'dark';

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(dark ? darkColors.bg : lightColors.bg).catch(() => undefined);
  }, [dark]);

  const value = useMemo<ThemeValue>(
    () => ({
      colors: dark ? darkColors : lightColors,
      gradients: dark ? darkGradients : lightGradients,
      shadows: dark ? darkShadows : lightShadows,
      dark,
      mode,
      setMode,
      ready,
    }),
    [dark, mode, setMode, ready],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}

/**
 * Memaksa subpohon ke tema malam (mis. layar Masuk beraurora, yang selalu
 * gelap seperti MLogin web). Komponen `@/ui` di dalamnya membaca token malam.
 */
export function DarkScope({ children }: { children: React.ReactNode }): React.JSX.Element {
  const induk = useTheme();
  const value = useMemo<ThemeValue>(
    () => ({ ...induk, colors: darkColors, gradients: darkGradients, shadows: darkShadows, dark: true }),
    [induk],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
