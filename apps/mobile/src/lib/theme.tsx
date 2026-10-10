/**
 * Tema Arus — diturunkan dari resources/css/tokens.css (light `:root`,
 * dark `.dark`). Hanya token yang dipakai; tidak ada warna liar di layar.
 */
import { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

export interface ArusColors {
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  borderStrong: string;
  text: string;
  muted: string;
  subtle: string;
  primary: string;
  primaryHover: string;
  primaryFg: string;
  /** Dua warna gradasi "aksi" (#0B7F86 → #1E5FD6) untuk tombol utama. */
  gradientFrom: string;
  gradientTo: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;
  link: string;
  linkSoft: string;
  badge: string;
  onBadge: string;
}

const light: ArusColors = {
  bg: '#F3F6FA',
  surface: '#FFFFFF',
  surface2: '#EEF2F7',
  border: '#DDE4EC',
  borderStrong: '#C3CEDA',
  text: '#0B1A2B',
  muted: '#46576B',
  subtle: '#8495A8',
  primary: '#0B7F86',
  primaryHover: '#09656E',
  primaryFg: '#FFFFFF',
  gradientFrom: '#0B7F86',
  gradientTo: '#1E5FD6',
  success: '#0F7A55',
  successSoft: '#E3F6EE',
  warning: '#9A5800',
  warningSoft: '#FFF1DC',
  danger: '#C42137',
  dangerSoft: '#FDE7EA',
  info: '#1A4CB0',
  infoSoft: '#E6EEFE',
  link: '#09656E',
  linkSoft: '#E8FBF8',
  badge: '#C42137',
  onBadge: '#FFFFFF',
};

const dark: ArusColors = {
  bg: '#070B14',
  surface: '#0F1622',
  surface2: '#172131',
  border: '#233247',
  borderStrong: '#34465E',
  text: '#EAF1F8',
  muted: '#A6B4C6',
  subtle: '#7D8FA5',
  primary: '#2DBFB1',
  primaryHover: '#5AD6C8',
  primaryFg: '#041421',
  gradientFrom: '#14B8A6',
  gradientTo: '#2F7BEA',
  success: '#4ADE9B',
  successSoft: '#0E2A20',
  warning: '#F6B95C',
  warningSoft: '#2E2210',
  danger: '#FF7A8A',
  dangerSoft: '#3A1520',
  info: '#A9C2FF',
  infoSoft: '#14223F',
  link: '#5AD6C8',
  linkSoft: '#0E2A2C',
  badge: '#C42137',
  onBadge: '#FFFFFF',
};

/** Radius Arus: kartu 16–20, panel 24. */
export const radius = { sm: 12, md: 16, lg: 20, xl: 24 } as const;

interface ThemeValue {
  colors: ArusColors;
  dark: boolean;
}

const ThemeContext = createContext<ThemeValue>({ colors: light, dark: false });

export function ThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const value = useMemo<ThemeValue>(
    () => ({ colors: isDark ? dark : light, dark: isDark }),
    [isDark],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}
