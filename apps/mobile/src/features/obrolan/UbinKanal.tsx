/**
 * Ubin kanal: huruf workspace bergradien, `#` (publik), gembok (privat),
 * avatar lawan bicara (DM), ikon grup. Dipakai daftar, header, dan detail.
 */
import { StyleSheet, View } from 'react-native';

import type { JenisKanal } from '@/api/obrolan';
import { type GradientName, useTheme } from '@/theme';
import { Avatar, Gradient, Icon, Text } from '@/ui';

const GRADIEN_WORKSPACE: Record<string, GradientName> = {
  teal: 'merek',
  green: 'merek',
  blue: 'aksi',
  violet: 'indigo',
  slate: 'slate',
  gray: 'slate',
  amber: 'hangat',
  orange: 'hangat',
  red: 'hangat',
  pink: 'hangat',
};

export function UbinKanal({
  jenis,
  nama,
  workspace,
  ukuran = 48,
}: {
  jenis: JenisKanal;
  nama: string;
  workspace?: { key: string; color: string } | null;
  ukuran?: number;
}): React.JSX.Element {
  const { colors } = useTheme();
  const radius = Math.round(ukuran * 0.33);

  if (jenis === 'dm') {
    return <Avatar name={nama} size={ukuran >= 56 ? 'lg' : 'md'} />;
  }
  if (jenis === 'workspace') {
    const kunci = workspace?.key ?? nama.slice(0, 3).toUpperCase();
    return (
      <Gradient name={GRADIEN_WORKSPACE[workspace?.color ?? ''] ?? 'merek'} style={[s.ubin, { width: ukuran, height: ukuran, borderRadius: radius }]}>
        <Text weight={800} style={{ color: '#FFFFFF', fontSize: ukuran >= 56 ? 18 : 13, lineHeight: ukuran >= 56 ? 22 : 16 }} maxFontSizeMultiplier={1.2} numberOfLines={1}>
          {kunci}
        </Text>
      </Gradient>
    );
  }
  const isi =
    jenis === 'public'
      ? { icon: 'hash' as const, bg: colors.linkSoft, fg: colors.link }
      : jenis === 'private'
        ? { icon: 'lock' as const, bg: colors.surface2, fg: colors.muted }
        : { icon: 'users' as const, bg: colors.infoSoft, fg: colors.info };
  return (
    <View style={[s.ubin, { width: ukuran, height: ukuran, borderRadius: radius, backgroundColor: isi.bg }]}>
      <Icon name={isi.icon} size={Math.round(ukuran * 0.46)} color={isi.fg} />
    </View>
  );
}

const s = StyleSheet.create({
  ubin: { alignItems: 'center', justifyContent: 'center' },
});
