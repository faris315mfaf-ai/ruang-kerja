/**
 * Ikon khas tugas: cincin status (6 keadaan), batang prioritas, dan ubin
 * workspace. Status/prioritas selalu berpasangan dengan label (tidak warna saja).
 */
import { View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import type { JenisWorkspace, KategoriStatus } from '@/api/tugas';
import { useTheme } from '@/theme';
import { Gradient, Text } from '@/ui';

export function StatusRing({ kategori, size = 26 }: { kategori: KategoriStatus; size?: number }): React.JSX.Element {
  const { colors } = useTheme();
  const c = size / 2;
  const r = c - 2.2;
  const sw = 2.2;
  const warna =
    kategori === 'in_progress' ? colors.fill.warning : kategori === 'review' ? colors.accentBlue : kategori === 'done' ? colors.success : colors.borderStrong;
  // Irisan pai dari jam 12 searah jarum jam.
  const irisan = (frak: number): string => {
    const sudut = frak * Math.PI * 2;
    const x = c + r * Math.sin(sudut);
    const y = c - r * Math.cos(sudut);
    const besar = frak > 0.5 ? 1 : 0;
    return `M ${c} ${c} L ${c} ${c - r} A ${r} ${r} 0 ${besar} 1 ${x} ${y} Z`;
  };
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {kategori === 'done' ? (
          <>
            <Circle cx={c} cy={c} r={r + 1} fill={warna} />
            <Path d={`M ${c - r * 0.45} ${c} L ${c - r * 0.1} ${c + r * 0.36} L ${c + r * 0.5} ${c - r * 0.3}`} stroke="#FFFFFF" strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : (
          <>
            <Circle
              cx={c}
              cy={c}
              r={r}
              stroke={warna}
              strokeWidth={sw}
              fill="none"
              strokeDasharray={kategori === 'backlog' ? '3.2 3.2' : undefined}
            />
            {kategori === 'in_progress' ? <Path d={irisan(0.5)} fill={warna} /> : null}
            {kategori === 'review' ? <Path d={irisan(0.75)} fill={warna} /> : null}
            {kategori === 'canceled' ? (
              <Line x1={c - r * 0.6} y1={c + r * 0.6} x2={c + r * 0.6} y2={c - r * 0.6} stroke={warna} strokeWidth={sw} strokeLinecap="round" />
            ) : null}
          </>
        )}
      </Svg>
    </View>
  );
}

/** 3 batang naik; urgent = kotak merah "!". 0 = tidak tampil. */
export function PriorityBars({ nilai, size = 18 }: { nilai: number; size?: number }): React.JSX.Element | null {
  const { colors } = useTheme();
  if (nilai === 0) {
    return null;
  }
  if (nilai === 1) {
    return (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ width: size, height: size, borderRadius: 5, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ color: '#FFFFFF', fontSize: size * 0.72, lineHeight: size * 0.9 }} weight={800} maxFontSizeMultiplier={1}>
          !
        </Text>
      </View>
    );
  }
  const terisi = nilai === 2 ? 3 : nilai === 3 ? 2 : 1;
  const warna = nilai === 2 ? colors.warning : nilai === 3 ? colors.muted : colors.subtle;
  const bar = size / 5;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size, flexDirection: 'row', alignItems: 'flex-end', gap: bar * 0.7 }}>
      {[0.42, 0.7, 1].map((tinggi, i) => (
        <View key={i} style={{ width: bar, height: size * tinggi, borderRadius: 1.5, backgroundColor: i < terisi ? warna : colors.border }} />
      ))}
    </View>
  );
}

const GRAD: Record<JenisWorkspace, 'slate' | 'merek' | 'hangat' | 'indigo'> = {
  personal: 'slate',
  team: 'merek',
  division: 'hangat',
  project: 'indigo',
};

/** Ubin huruf workspace (pribadi gelap, tim teal, divisi hangat, proyek indigo). */
export function UbinWorkspace({ nama, jenis, size = 22 }: { nama: string; jenis: JenisWorkspace; size?: number }): React.JSX.Element {
  return (
    <Gradient
      name={GRAD[jenis] ?? 'merek'}
      style={{ width: size, height: size, borderRadius: size * 0.3, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ color: '#FFFFFF', fontSize: size * 0.5, lineHeight: size * 0.62 }} weight={800} maxFontSizeMultiplier={1}>
        {(nama.trim()[0] ?? '?').toUpperCase()}
      </Text>
    </Gradient>
  );
}
