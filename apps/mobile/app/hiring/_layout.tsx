/** Tumpukan Hiring: daftar (Kandidat · Lowongan · Pengaturan) → profil kandidat / pengaturan lowongan. */
import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

export default function HiringLayout(): React.JSX.Element {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', animationDuration: 180, contentStyle: { backgroundColor: colors.bg } }} />;
}
