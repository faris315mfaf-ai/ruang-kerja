/** Tumpukan layar Pengaturan: geser dari kanan (180 ms), tanpa header bawaan. */
import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

export default function PengaturanLayout(): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', animationDuration: 180, contentStyle: { backgroundColor: colors.bg } }} />
  );
}
