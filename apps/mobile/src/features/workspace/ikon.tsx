/**
 * Ikon status tugas (cincin 6 keadaan) dan prioritas (3 batang; urgent =
 * kotak "!"). Status & prioritas selalu disertai teks di tempat pemakaian.
 */
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import type { BoardTaskCategory } from '@/api/types';
import { warnaPalet, warnaPrioritas } from '@/lib/palette';
import { useTheme } from '@/theme';
import { Text } from '@/ui';

export function IkonStatus({ kategori, warna, ukuran = 22 }: { kategori: BoardTaskCategory; warna?: string; ukuran?: number }): React.JSX.Element {
  const { colors, dark } = useTheme();
  const w = warna !== undefined ? warnaPalet(warna, dark) : colors.muted;
  const c = ukuran / 2;
  const r = c - 2;
  const sapuan = 2;
  // Irisan pai dari pukul 12 sebanyak `bagian` (0–1).
  const irisan = (bagian: number): string => {
    const sudut = bagian * Math.PI * 2;
    const x = c + r * Math.sin(sudut);
    const y = c - r * Math.cos(sudut);
    return `M ${c} ${c} L ${c} ${c - r} A ${r} ${r} 0 ${bagian > 0.5 ? 1 : 0} 1 ${x} ${y} Z`;
  };
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: ukuran, height: ukuran }}>
      <Svg width={ukuran} height={ukuran} viewBox={`0 0 ${ukuran} ${ukuran}`}>
        {kategori === 'backlog' ? (
          <Circle cx={c} cy={c} r={r} stroke={w} strokeWidth={sapuan} strokeDasharray="3 3" fill="none" />
        ) : kategori === 'done' ? (
          <>
            <Circle cx={c} cy={c} r={r + 1} fill={colors.success} />
            <Path d={`M ${c - 4} ${c} L ${c - 1} ${c + 3} L ${c + 4.5} ${c - 3}`} stroke="#FFFFFF" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : kategori === 'canceled' ? (
          <>
            <Circle cx={c} cy={c} r={r} stroke={colors.subtle} strokeWidth={sapuan} fill="none" />
            <Path d={`M ${c - 3.5} ${c - 3.5} L ${c + 3.5} ${c + 3.5} M ${c + 3.5} ${c - 3.5} L ${c - 3.5} ${c + 3.5}`} stroke={colors.subtle} strokeWidth={1.8} strokeLinecap="round" />
          </>
        ) : (
          <>
            <Circle cx={c} cy={c} r={r} stroke={w} strokeWidth={sapuan} fill="none" />
            {kategori === 'in_progress' ? <Path d={irisan(0.5)} fill={w} /> : null}
            {kategori === 'review' ? <Path d={irisan(0.75)} fill={w} /> : null}
          </>
        )}
      </Svg>
    </View>
  );
}

export function IkonPrioritas({ nilai, ukuran = 20 }: { nilai: number; ukuran?: number }): React.JSX.Element {
  const { colors } = useTheme();
  if (nilai === 1) {
    return (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ width: ukuran, height: ukuran, borderRadius: 5, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text variant="meta" weight={800} style={{ color: colors.onDanger, fontSize: 13, lineHeight: 16 }}>
          !
        </Text>
      </View>
    );
  }
  const terisi = nilai === 2 ? 3 : nilai === 3 ? 2 : nilai === 4 ? 1 : 0;
  const warna = warnaPrioritas(nilai, colors);
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[s.batang, { height: ukuran }]}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ width: 4, height: 6 + i * 4, borderRadius: 1.5, backgroundColor: i < terisi ? warna : colors.borderStrong }} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  batang: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
});
