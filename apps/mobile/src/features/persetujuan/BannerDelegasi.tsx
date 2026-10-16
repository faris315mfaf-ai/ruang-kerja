/**
 * Banner delegasi di layar Persetujuan (mockup 24 p2/p3): "Delegasi aktif"
 * (pemberi, dengan Ubah · Hentikan) dan "Anda mewakili …" (penerima).
 */
import { View } from 'react-native';

import type { HalamanPersetujuan } from '@/api/persetujuan';
import { radius, useTheme } from '@/theme';
import { Icon, Pressable, Text } from '@/ui';

import { namaDepan, tanggalNumerikBerhari } from './format';

function Tautan({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }): React.JSX.Element {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }} hitSlop={8} style={{ minHeight: 44, justifyContent: 'center' }}>
      <Text variant="label" tone="info" weight={700} style={{ fontSize: 16, opacity: disabled ? 0.5 : 1 }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function BannerDelegasi({
  delegasi,
  nonaktif,
  onUbah,
  onHentikan,
}: {
  delegasi: HalamanPersetujuan['delegation'] | null | undefined;
  nonaktif: boolean;
  onUbah: () => void;
  onHentikan: (id: string, nama: string) => void;
}): React.JSX.Element | null {
  const { colors } = useTheme();
  if (!delegasi) {
    return null;
  }
  const aktif = delegasi.active;
  const mewakili = delegasi.representing;
  if (!aktif && mewakili.length === 0) {
    return null;
  }
  const kotak = { flexDirection: 'row' as const, gap: 12, padding: 16, borderRadius: radius.lg + 2, backgroundColor: colors.infoSoft };
  return (
    <View style={{ gap: 10 }}>
      {aktif ? (
        <View style={kotak}>
          <Icon name="user-cog" size={22} color={colors.info} style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text variant="body" tone="info" style={{ fontSize: 16, lineHeight: 23 }}>
              <Text variant="body" tone="info" weight={700} style={{ fontSize: 16, lineHeight: 23 }}>
                Delegasi aktif.
              </Text>
              {' Pengajuan baru diteruskan ke '}
              <Text variant="body" tone="info" weight={700} style={{ fontSize: 16, lineHeight: 23 }}>
                {aktif.delegate.name}
              </Text>
              {` sampai ${tanggalNumerikBerhari(aktif.ends_on)}.`}
            </Text>
            <View style={{ flexDirection: 'row', gap: 24 }}>
              <Tautan label="Ubah" onPress={onUbah} disabled={nonaktif} />
              <Tautan label="Hentikan" onPress={() => onHentikan(aktif.id, aktif.delegate.name)} disabled={nonaktif} />
            </View>
          </View>
        </View>
      ) : null}
      {mewakili.map((r) => (
        <View key={r.id} style={kotak}>
          <Icon name="user-cog" size={22} color={colors.info} style={{ marginTop: 1 }} />
          <Text variant="body" tone="info" style={{ flex: 1, fontSize: 16, lineHeight: 23 }}>
            <Text variant="body" tone="info" weight={700} style={{ fontSize: 16, lineHeight: 23 }}>
              {`Anda mewakili ${r.delegator.name}`}
            </Text>
            {` sampai ${tanggalNumerikBerhari(r.ends_on)}. Keputusan Anda tercatat atas nama Anda, atas delegasi ${namaDepan(r.delegator.name)}.`}
          </Text>
        </View>
      ))}
    </View>
  );
}
