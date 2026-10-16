/** Tumpukan Karyawan (HR/Direksi/SA): daftar → profil → permintaan reset sandi. */
import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

export default function KaryawanLayout(): React.JSX.Element {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', animationDuration: 180, contentStyle: { backgroundColor: colors.bg } }} />;
}
