/**
 * Sheet "Pindahkan PLQ-21" (mockup 05 › 16-3): pilih kolom tujuan; kolom saat
 * ini diberi tanda, tanpa seret. PATCH /workspace/{ws}/papan/kartu/{task}.
 */
import { StyleSheet, View } from 'react-native';

import type { KartuWorkspace, KolomPapan, TipeWorkspace } from '@/api/workspace';
import { useTheme } from '@/theme';
import { BottomSheet, Icon, Pressable, Text } from '@/ui';

import { IkonStatus } from './ikon';

export function PindahkanSheet({
  tugas,
  kolom,
  tipe,
  onPilih,
  onClose,
}: {
  tugas: KartuWorkspace | null;
  kolom: KolomPapan[];
  tipe?: TipeWorkspace;
  onPilih: (kolomId: string) => void;
  onClose: () => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <BottomSheet visible={tugas !== null} onClose={onClose} title={tugas ? `Pindahkan ${tugas.key}` : 'Pindahkan'} scrollable>
      {tugas ? (
        <Text variant="body" tone="muted" numberOfLines={2} style={{ fontSize: 15, lineHeight: 22 }}>
          {tugas.title}
        </Text>
      ) : null}
      {kolom.map((k) => {
        const saatIni = tugas?.status_id === k.id;
        return (
          <Pressable
            key={k.id}
            onPress={() => (saatIni ? onClose() : onPilih(k.id))}
            scaleTo={1}
            accessibilityRole="button"
            accessibilityLabel={`${k.name}${saatIni ? ', kolom saat ini' : ''}`}
            accessibilityState={{ selected: saatIni }}
            style={[s.baris, saatIni ? { backgroundColor: colors.linkSoft } : null]}
          >
            <IkonStatus kategori={k.kategori} warna={k.color} />
            <View style={{ flex: 1 }}>
              <Text variant="title" weight={saatIni ? 700 : 600}>
                {k.name}
              </Text>
              {k.kategori === 'done' && tipe !== undefined && tipe !== 'personal' ? <Text variant="meta">Di workspace tim: lewat Review dulu</Text> : null}
            </View>
            {saatIni ? <Icon name="check" size={20} color={colors.link} /> : null}
          </Pressable>
        );
      })}
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  baris: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56, paddingHorizontal: 12, borderRadius: 14 },
});
