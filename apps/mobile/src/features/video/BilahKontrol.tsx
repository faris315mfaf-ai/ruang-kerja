/**
 * Bilah kontrol ringkas ruang video (selalu gelap, `roomBar`): Mikrofon ·
 * Kamera · [Layar saat berbagi] · Tangan · Obrolan · Kehadiran · ⋯ · Keluar
 * (merah). Keputusan mockup 08: bilah potret 7 tombol; berbagi layar,
 * subtitle, keluaran suara ada di menu ⋯.
 */
import { StyleSheet, View } from 'react-native';

import { radius, useTheme } from '@/theme';
import { Icon, Pressable, Text, type AnyIconName } from '@/ui';

interface Tombol {
  key: string;
  ikon: AnyIconName;
  label: string;
  onPress: () => void;
  /** Mati/keluar: merah. Aktif (tangan/layar): terang. */
  nada?: 'biasa' | 'mati' | 'aktif' | 'keluar';
  lencana?: number;
  disabled?: boolean;
}

export function BilahKontrol({ tombol, lebar }: { tombol: Tombol[]; lebar?: number }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={[s.bilah, { backgroundColor: colors.roomBar, maxWidth: lebar }]} accessibilityRole="toolbar">
      {tombol.map((t) => {
        const bg = t.nada === 'keluar' || t.nada === 'mati' ? colors.badge : t.nada === 'aktif' ? colors.roomOnBar : colors.roomKey;
        const fg = t.nada === 'keluar' || t.nada === 'mati' ? colors.onBadge : t.nada === 'aktif' ? colors.roomBar : colors.roomOnBar;
        return (
          <Pressable
            key={t.key}
            onPress={t.onPress}
            disabled={t.disabled}
            accessibilityRole="button"
            accessibilityLabel={t.lencana ? `${t.label}, ${t.lencana}` : t.label}
            accessibilityState={{ disabled: t.disabled, selected: t.nada === 'aktif' }}
            scaleTo={0.9}
            style={[s.kunci, { backgroundColor: bg, opacity: t.disabled ? 0.5 : 1, flex: t.nada === 'keluar' ? 1.25 : 1 }]}
          >
            <Icon name={t.ikon} size={22} color={fg} />
            {t.lencana ? (
              <View style={[s.lencana, { backgroundColor: colors.badge, borderColor: colors.roomBar }]}>
                <Text variant="meta" weight={700} style={{ color: colors.onBadge, fontSize: 11, lineHeight: 14 }}>
                  {t.lencana > 99 ? '99+' : t.lencana}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export type { Tombol as TombolKontrol };

const s = StyleSheet.create({
  bilah: { flexDirection: 'row', alignSelf: 'center', width: '100%', gap: 6, padding: 8, borderRadius: radius['2xl'] },
  kunci: { height: 52, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  lencana: { position: 'absolute', top: 2, right: 2, minWidth: 20, height: 20, paddingHorizontal: 4, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
