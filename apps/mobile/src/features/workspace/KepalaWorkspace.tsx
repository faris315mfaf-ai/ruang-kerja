/**
 * Bar atas layar workspace (mockup 05 › 16): kembali, ubin, nama +
 * "KEY · N tugas · M anggota", menu ⋯. Menangani inset status bar.
 */
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass, IconButton, Text } from '@/ui';

import { UbinWorkspace } from './bagian';

export function KepalaWorkspace({
  nama,
  warna,
  tipe,
  subjudul,
  onMenu,
}: {
  nama: string;
  warna?: string | null;
  tipe?: string;
  subjudul?: string;
  onMenu?: () => void;
}): React.JSX.Element {
  const insets = useSafeAreaInsets();
  return (
    <Glass strong style={[s.bar, { paddingTop: insets.top + 6 }]}>
      <IconButton icon="arrow-left" label="Kembali" variant="ghost" onPress={() => (router.canGoBack() ? router.back() : router.replace('/workspace'))} />
      <UbinWorkspace nama={nama} warna={warna} tipe={tipe} ukuran={40} />
      <View style={{ flex: 1 }}>
        <Text variant="title" weight={800} numberOfLines={1} accessibilityRole="header">
          {nama}
        </Text>
        {subjudul ? (
          <Text variant="meta" numberOfLines={1}>
            {subjudul}
          </Text>
        ) : null}
      </View>
      {onMenu ? <IconButton icon="ellipsis-vertical" label="Menu workspace" variant="ghost" onPress={onMenu} /> : null}
    </Glass>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingBottom: 8, borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 0 },
});
