/** Tumpukan layar Absensi (selfie, QR, hasil, persetujuan, riwayat): geser dari kanan, tanpa header bawaan. */
import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

export default function AbsensiLayout(): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', animationDuration: 180, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="selfie" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="qr" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="hasil" options={{ animation: 'fade', gestureEnabled: false }} />
    </Stack>
  );
}
