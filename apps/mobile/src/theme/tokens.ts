/**
 * Token desain Arus untuk React Native — diturunkan dari
 * resources/css/tokens.css (terang `:root`, malam `.dark`) dan kit mockup
 * Android (docs/mockups/android/_kit/kit.css). Satu-satunya tempat nilai
 * warna/ukuran ditulis; komponen hanya membaca lewat `useTheme()`.
 * Pemetaan lengkap: src/ui/README.md dan docs/mockups/android/spec/13-fondasi-desain.md §7.
 */
import { Easing } from 'react-native-reanimated';

export interface AvatarTone {
  bg: string;
  fg: string;
}

export interface Colors {
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  borderStrong: string;
  divider: string;
  text: string;
  muted: string;
  /** Hanya dekoratif/placeholder — kontras ≈ 3:1, bukan teks yang harus dibaca. */
  subtle: string;
  primary: string;
  primaryHover: string;
  primaryFg: string;
  ring: string;
  link: string;
  linkSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;
  onDanger: string;
  badge: string;
  onBadge: string;
  accentBlue: string;
  accentBlueStrong: string;
  onActive: string;
  inverse: string;
  onInverse: string;
  scrim: string;
  glass: string;
  glassStrong: string;
  glassBorder: string;
  marker: string;
  /** Legacy (ArusColors): dua warna gradien aksi. Dipertahankan untuk layar lama. */
  gradientFrom: string;
  gradientTo: string;
  brand: Record<50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900, string>;
  fill: { teal: string; warning: string; danger: string; violet: string };
  inverseStatus: { success: string; danger: string; warning: string; info: string };
  avatar: { blue: AvatarTone; teal: AvatarTone; amber: AvatarTone; neutral: AvatarTone };
}

/** Pasangan warna gradien + sudut (CSS 135° = kiri-atas → kanan-bawah). */
export type GradientDef = readonly [string, string];

export type GradientName = 'aksi' | 'merek' | 'hangat' | 'indigo' | 'slate' | 'soft' | 'active';

export type Gradients = Record<GradientName, GradientDef>;

const brand = {
  50: '#E8FBF8',
  100: '#C8F4EE',
  200: '#95E8DD',
  300: '#5AD6C8',
  400: '#2DBFB1',
  500: '#14A39C',
  600: '#0B7F86',
  700: '#09656E',
  800: '#0A4E57',
  900: '#0B3A42',
} as const;

export const lightColors: Colors = {
  bg: '#F3F6FA',
  surface: '#FFFFFF',
  surface2: '#EEF2F7',
  border: '#DDE4EC',
  borderStrong: '#C3CEDA',
  divider: '#EEF2F7',
  text: '#0B1A2B',
  muted: '#46576B',
  subtle: '#8495A8',
  primary: '#0B7F86',
  primaryHover: '#09656E',
  primaryFg: '#FFFFFF',
  ring: 'rgba(20,184,166,0.4)',
  link: '#09656E',
  linkSoft: '#E8FBF8',
  success: '#0F7A55',
  successSoft: '#E3F6EE',
  warning: '#9A5800',
  warningSoft: '#FFF1DC',
  danger: '#C42137',
  dangerSoft: '#FDE7EA',
  info: '#1A4CB0',
  infoSoft: '#E6EEFE',
  onDanger: '#FFFFFF',
  badge: '#C42137',
  onBadge: '#FFFFFF',
  accentBlue: '#2F7BEA',
  accentBlueStrong: '#1E5FD6',
  onActive: '#FFFFFF',
  inverse: '#0B1A2B',
  onInverse: '#FFFFFF',
  scrim: 'rgba(7,11,20,0.45)',
  // Opaque on Android: there is no live blur behind these surfaces (BlurView needs a
  // blurTarget per screen), and 6–18% see-through let text behind bleed through.
  glass: 'rgba(255,255,255,0.98)',
  glassStrong: '#FFFFFF',
  glassBorder: 'rgba(11,26,43,0.08)',
  marker: '#0B1A2B',
  gradientFrom: '#0B7F86',
  gradientTo: '#1E5FD6',
  brand,
  fill: { teal: '#14B8A6', warning: '#E08A00', danger: '#C42137', violet: '#6D4AE0' },
  inverseStatus: { success: '#4ADE9B', danger: '#FF7A8A', warning: '#F6B95C', info: '#A9C2FF' },
  avatar: {
    blue: { bg: '#D9E6FF', fg: '#1A4CB0' },
    teal: { bg: '#C8F4EE', fg: '#0A4E57' },
    amber: { bg: '#FFF1DC', fg: '#9A5800' },
    neutral: { bg: '#EEF2F7', fg: '#46576B' },
  },
};

export const darkColors: Colors = {
  bg: '#070B14',
  surface: '#0F1622',
  surface2: '#172131',
  border: '#233247',
  borderStrong: '#34465E',
  divider: '#172131',
  text: '#EAF1F8',
  muted: '#A6B4C6',
  subtle: '#7D8FA5',
  primary: '#2DBFB1',
  primaryHover: '#5AD6C8',
  primaryFg: '#041421',
  ring: 'rgba(45,191,177,0.45)',
  link: '#5AD6C8',
  linkSoft: '#0E2A2C',
  success: '#4ADE9B',
  successSoft: '#0E2A20',
  warning: '#F6B95C',
  warningSoft: '#2E2210',
  danger: '#FF7A8A',
  dangerSoft: '#3A1520',
  info: '#A9C2FF',
  infoSoft: '#14223F',
  onDanger: '#2A0A10',
  badge: '#C42137',
  onBadge: '#FFFFFF',
  accentBlue: '#2F7BEA',
  accentBlueStrong: '#1E5FD6',
  onActive: '#041421',
  inverse: '#EAF1F8',
  onInverse: '#0B1A2B',
  scrim: 'rgba(0,0,0,0.6)',
  glass: 'rgba(15,22,34,0.98)',
  glassStrong: '#172131',
  glassBorder: 'rgba(255,255,255,0.10)',
  marker: '#3B4F6B',
  gradientFrom: '#0B7F86',
  gradientTo: '#1E5FD6',
  brand,
  fill: { teal: '#14B8A6', warning: '#E08A00', danger: '#FF7A8A', violet: '#6D4AE0' },
  inverseStatus: { success: '#0F7A55', danger: '#C42137', warning: '#9A5800', info: '#1A4CB0' },
  avatar: {
    blue: { bg: '#1C2D50', fg: '#A9C2FF' },
    teal: { bg: '#103A38', fg: '#5AD6C8' },
    amber: { bg: '#2E2210', fg: '#F6B95C' },
    neutral: { bg: '#172131', fg: '#A6B4C6' },
  },
};

const sharedGradients = {
  aksi: ['#0B7F86', '#1E5FD6'],
  merek: ['#14B8A6', '#2F7BEA'],
  hangat: ['#C2410C', '#BE185D'],
  indigo: ['#2F7BEA', '#6D4AE0'],
  slate: ['#46576B', '#0B1A2B'],
} as const;

export const lightGradients: Gradients = {
  ...sharedGradients,
  soft: ['#E8FBF8', '#EEF4FF'],
  active: ['#0B7F86', '#1E5FD6'],
};

export const darkGradients: Gradients = {
  ...sharedGradients,
  soft: ['#0E2A2C', '#14223F'],
  active: ['#2DBFB1', '#5B8CF6'],
};

/** Latar cahaya kembar (teal kiri atas, biru kanan atas) — `--page-glow`. */
export const pageGlow = {
  light: { teal: 'rgba(20,184,166,0.20)', blue: 'rgba(47,123,234,0.18)' },
  dark: { teal: 'rgba(20,184,166,0.16)', blue: 'rgba(47,123,234,0.14)' },
} as const;

/** `boxShadow` RN (New Architecture) per tema — `--shadow-1/-2`, `--elev-*`. */
export interface Shadows {
  card: string;
  float: string;
  glow: string;
  button: string;
  warm: string;
  inverse: string;
  knob: string;
  segment: string;
}

export const lightShadows: Shadows = {
  card: '0 1px 2px rgba(11,26,43,0.06), 0 8px 24px rgba(11,26,43,0.06)',
  float: '0 2px 6px rgba(11,26,43,0.08), 0 20px 48px rgba(11,26,43,0.16)',
  glow: '0 12px 28px rgba(30,95,214,0.30)',
  button: '0 8px 20px rgba(30,95,214,0.30)',
  warm: '0 12px 28px rgba(190,24,93,0.24)',
  inverse: '0 20px 48px rgba(11,26,43,0.24)',
  knob: '0 2px 6px rgba(11,26,43,0.25)',
  segment: '0 2px 8px rgba(11,26,43,0.12)',
};

export const darkShadows: Shadows = {
  card: '0 1px 2px rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.15)',
  float: '0 2px 6px rgba(0,0,0,0.4), 0 20px 48px rgba(0,0,0,0.5)',
  glow: '0 12px 28px rgba(0,0,0,0.4)',
  button: '0 8px 20px rgba(0,0,0,0.4)',
  warm: '0 12px 28px rgba(0,0,0,0.4)',
  inverse: '0 20px 48px rgba(0,0,0,0.5)',
  knob: '0 2px 6px rgba(0,0,0,0.4)',
  segment: '0 2px 8px rgba(0,0,0,0.3)',
};

/**
 * Skala radius — nama sama dengan web (`--radius-*`). `control`/`card`/
 * `cardTight` = pilihan sadar kit Android (kontrol 14, kartu 24, kartu ketat
 * 20). Skala lama RN ({sm:12, md:16, lg:20, xl:24}) hidup di `@/lib/theme`.
 */
export const radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  control: 14,
  card: 24,
  cardTight: 20,
  hero: 26,
  full: 999,
} as const;

/** Grid 4: `space[3]` = 12, dst. */
export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  16: 64,
} as const;

/** Tinggi kontrol (`h-control-*`) dan target sentuh. */
export const size = {
  controlSm: 36,
  controlMd: 44,
  controlLg: 52,
  controlXl: 56,
  /** Target sentuh minimum (hit-slop dipakai bila visual lebih kecil). */
  touch: 48,
  iconButton: 48,
  fab: 60,
} as const;

export const layout = {
  appBar: 56,
  tabBar: 70,
  tabInset: 12,
  tabLift: 14,
  /** Jarak tambahan konten di atas kapsul tab bar. */
  tabRaise: 16,
  tabCenter: 54,
  tabCenterRaise: 26,
  gutter: 16,
  /** Lebar maksimum kapsul tab bar. */
  tabMaxWidth: 420,
} as const;

/** Gerak: 120 ms tekan/toggle, 180 ms sheet/pil/snackbar, ease-brand. */
export const motion = {
  fast: 120,
  base: 180,
  ease: Easing.bezier(0.2, 0.8, 0.2, 1),
  pressScale: 0.98,
  tabIconPressScale: 0.9,
  fabPressScale: 0.95,
} as const;
