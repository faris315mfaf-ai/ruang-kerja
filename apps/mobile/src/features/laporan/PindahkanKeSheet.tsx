/**
 * Sheet "Pindahkan ke" (mockup 29-5): kolom workspace tugas, urut papan.
 * "Tidak dipindahkan" = tetap di kolom sekarang. Dipindah saat laporan dikirim.
 */
import { StyleSheet, View } from 'react-native';

import type { OpsiTugas } from '@/api/laporan';
import { useTheme } from '@/theme';
import { BottomSheet, Pressable, Text } from '@/ui';

import { labelKategori } from './format';

function Pilihan({ label, keterangan, aktif, onPress }: { label: string; keterangan: string; aktif: boolean; onPress: () => void }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} scaleTo={1} accessibilityRole="radio" accessibilityState={{ selected: aktif }} accessibilityLabel={`${label}, ${keterangan}`} style={s.baris}>
      <View style={[s.radio, { borderColor: aktif ? colors.primary : colors.borderStrong }]}>{aktif ? <View style={[s.radioIsi, { backgroundColor: colors.primary }]} /> : null}</View>
      <Text variant="title" style={{ flex: 1 }} numberOfLines={1}>
        {label}
      </Text>
      <Text variant="meta" style={{ fontSize: 14 }} numberOfLines={1}>
        {keterangan}
      </Text>
    </Pressable>
  );
}

export function PindahkanKeSheet({
  opsi,
  pilihan,
  onPilih,
  onClose,
}: {
  opsi: OpsiTugas | null;
  pilihan: string | null;
  onPilih: (statusId: string | null) => void;
  onClose: () => void;
}): React.JSX.Element {
  return (
    <BottomSheet visible={opsi !== null} onClose={onClose} title="Pindahkan ke" scrollable>
      {opsi ? (
        <>
          <Text variant="meta" style={{ fontSize: 14, marginTop: -8 }}>
            {`${opsi.key} · kolom workspace ${opsi.workspace.name}`}
          </Text>
          <View accessibilityRole="radiogroup">
            <Pilihan label="Tidak dipindahkan" keterangan={`tetap ${opsi.status.name}`} aktif={pilihan === null || pilihan === opsi.status.id} onPress={() => onPilih(null)} />
            {opsi.statuses.map((k) => (
              <Pilihan
                key={k.id}
                label={k.name}
                keterangan={k.id === opsi.status.id ? 'saat ini' : labelKategori(k.category)}
                aktif={pilihan === k.id && k.id !== opsi.status.id}
                onPress={() => onPilih(k.id === opsi.status.id ? null : k.id)}
              />
            ))}
          </View>
          <Text variant="meta" style={{ fontSize: 14 }}>
            Dipindahkan saat laporan dikirim, mengikuti izin Anda atas tugas itu.
          </Text>
        </>
      ) : null}
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  baris: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioIsi: { width: 12, height: 12, borderRadius: 6 },
});
