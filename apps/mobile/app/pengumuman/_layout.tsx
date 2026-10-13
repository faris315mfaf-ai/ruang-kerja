/** Tumpukan Pengumuman: daftar → detail (geser kanan), formulir baru naik dari bawah. */
import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

export default function PengumumanLayout(): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', animationDuration: 180, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="baru" options={{ animation: 'slide_from_bottom' }} />
    </Stack>
  );
}
