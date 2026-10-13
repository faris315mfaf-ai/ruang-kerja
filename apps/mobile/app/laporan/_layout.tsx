/** Tumpukan Laporan harian: riwayat → formulir hari ini / detail / laporan tim / riwayat orang. */
import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

export default function LaporanLayout(): React.JSX.Element {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', animationDuration: 180, contentStyle: { backgroundColor: colors.bg } }} />;
}
