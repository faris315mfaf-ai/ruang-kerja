/**
 * Font Figtree 400–800 + JetBrains Mono 500/600 (di-bundle lewat
 * @expo-google-fonts, dimuat expo-font). RN memakai satu keluarga per bobot,
 * jadi `fontFamily` dipilih lewat `font(weight)` — jangan memakai
 * `fontWeight` bersama font khusus.
 */
// Impor per bobot (bukan barrel) agar hanya 7 berkas .ttf yang ikut paket.
import { Figtree_400Regular } from '@expo-google-fonts/figtree/400Regular';
import { Figtree_500Medium } from '@expo-google-fonts/figtree/500Medium';
import { Figtree_600SemiBold } from '@expo-google-fonts/figtree/600SemiBold';
import { Figtree_700Bold } from '@expo-google-fonts/figtree/700Bold';
import { Figtree_800ExtraBold } from '@expo-google-fonts/figtree/800ExtraBold';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium';
import { JetBrainsMono_600SemiBold } from '@expo-google-fonts/jetbrains-mono/600SemiBold';
import { useFonts } from 'expo-font';

export type FontWeight = 400 | 500 | 600 | 700 | 800;

export const fontFamily = {
  400: 'Figtree_400Regular',
  500: 'Figtree_500Medium',
  600: 'Figtree_600SemiBold',
  700: 'Figtree_700Bold',
  800: 'Figtree_800ExtraBold',
  mono500: 'JetBrainsMono_500Medium',
  mono600: 'JetBrainsMono_600SemiBold',
} as const;

export function font(weight: FontWeight): string {
  return fontFamily[weight];
}

const fontAssets = {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  Figtree_800ExtraBold,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
};

/** `true` bila font siap (atau gagal dimuat — aplikasi tetap tampil dengan font sistem). */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts(fontAssets);
  return loaded || error !== null;
}
