/**
 * Shim lama: tema kini ada di `@/theme` (token Arus lengkap, font, mode
 * Terang/Gelap). Berkas ini mempertahankan ekspor yang dipakai layar lama.
 *
 * `radius` DI SINI adalah skala lama RN ({sm:12, md:16, lg:20, xl:24});
 * kode baru memakai `radius` dari `@/theme` (skala web: xs 6 … 3xl 28).
 */
export { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
export type { Colors as ArusColors } from '@/theme/tokens';

export const radius = { sm: 12, md: 16, lg: 20, xl: 24 } as const;
