/** Tumpukan OKR (modul 06): layar bertumpuk tanpa tab bar, geser dari kanan. */
import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

export default function Layout(): React.JSX.Element {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', animationDuration: 180, contentStyle: { backgroundColor: colors.bg } }} />;
}
