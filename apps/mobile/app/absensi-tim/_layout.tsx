/** Tumpukan Absensi tim (HR, Direksi, SA, Kepala Divisi, atasan): tab → perlu ditinjau / rekap karyawan. */
import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

export default function AbsensiTimLayout(): React.JSX.Element {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', animationDuration: 180, contentStyle: { backgroundColor: colors.bg } }} />;
}
