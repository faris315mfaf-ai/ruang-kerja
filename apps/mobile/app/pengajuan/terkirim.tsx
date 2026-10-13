/**
 * Pengajuan terkirim (mockup 04-pengajuan-persetujuan/11-1, 11-2, 15-4):
 * ikon kirim, nomor + status + jalur langkah, info notifikasi, aksi
 * "Lihat pengajuan" / "Selesai".
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { detailPengajuan, type ItemPengajuan } from '@/api/pengajuan';
import { KartuPengajuan } from '@/features/pengajuan/KartuPengajuan';
import { ambilTerkirim } from '@/features/pengajuan/simpanan';
import { layout, useTheme } from '@/theme';
import { Banner, Button, Gradient, Icon, IconButton, PageGlow, Text } from '@/ui';

export default function LayarTerkirim(): React.JSX.Element {
  const { colors, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<ItemPengajuan | null>(() => ambilTerkirim(id ?? ''));

  useEffect(() => {
    if (!item && id) {
      detailPengajuan(id)
        .then(setItem)
        .catch(() => undefined);
    }
  }, [id, item]);

  const penyetuju = item?.waiting?.approver?.name;
  const selesai = (): void => router.replace('/pengajuan');

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <PageGlow />
      <View style={[s.kepala, { paddingTop: insets.top, height: layout.appBar + insets.top }]}>
        <IconButton icon="x" label="Tutup" variant="ghost" onPress={selesai} />
        <Text variant="title" weight={700} accessibilityRole="header">
          {item && item.round > 1 ? 'Pengajuan terkirim ulang' : 'Pengajuan terkirim'}
        </Text>
      </View>
      <View style={s.isi}>
        <View style={[s.ikon, { boxShadow: shadows.glow }]}>
          <Gradient name="aksi" style={[StyleSheet.absoluteFill, { borderRadius: 26 }]} />
          <Icon name="send" size={40} color={colors.primaryFg} />
        </View>
        <Text variant="h2" weight={800} align="center">
          {item && item.round > 1 ? 'Pengajuan terkirim ulang' : 'Pengajuan terkirim'}
        </Text>
        <Text variant="body" tone="muted" align="center">
          {penyetuju ? `${penyetuju} sudah diberi tahu.` : 'Penyetuju sudah diberi tahu.'}
        </Text>
        {item ? <KartuPengajuan item={item} ringkas /> : null}
        <Banner tone="info" icon="bell" message="Anda akan mendapat notifikasi saat pengajuan diputuskan." />
      </View>
      <View style={[s.bawah, { paddingBottom: insets.bottom + 12, borderTopColor: colors.border }]}>
        <Button title="Lihat pengajuan" onPress={() => (item ? router.replace(`/pengajuan/${item.id}`) : selesai())} />
        <Button title="Selesai" variant="quiet" onPress={selesai} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  kepala: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8 },
  isi: { flex: 1, paddingHorizontal: 16, paddingTop: 32, gap: 14, alignItems: 'stretch' },
  ikon: { width: 88, height: 88, borderRadius: 26, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 12, overflow: 'hidden' },
  bawah: { paddingHorizontal: 16, paddingTop: 12, gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
});
