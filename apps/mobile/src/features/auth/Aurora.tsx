/**
 * Latar aurora layar Masuk / buka-kunci (`.ak-aurora` di mockup): navy malam
 * dengan tiga cahaya radial — teal kiri atas, biru kanan, ungu bawah. Selalu
 * gelap di kedua tema; bungkus isi dengan `DarkScope`.
 */
import { StyleSheet, View, useWindowDimensions, type ViewStyle } from 'react-native';

import { darkColors } from '@/theme';

type Cahaya = ViewStyle & { experimental_backgroundImage?: unknown };

function radial(
  rgb: string,
  alfa: number,
  ukuran: { x: number; y: number },
  posisi: { top?: number; left?: number; right?: number; bottom?: number },
): Cahaya['experimental_backgroundImage'] {
  return [
    {
      type: 'radial-gradient',
      shape: 'ellipse',
      size: ukuran,
      position: posisi as never,
      colorStops: [
        { color: `rgba(${rgb},${alfa})`, positions: ['0%'] },
        { color: `rgba(${rgb},0)`, positions: ['70%'] },
      ],
    },
  ];
}

export function Aurora(): React.JSX.Element {
  const { width, height } = useWindowDimensions();
  const tealStyle = { top: 0, left: 0, width: 420, height: 360, experimental_backgroundImage: radial('20,184,166', 0.55, { x: 420, y: 360 }, { top: 0, left: 0 }) } as Cahaya;
  const biruStyle = { top: height * 0.3 - 360, right: 0, width: 420, height: 720, experimental_backgroundImage: radial('47,123,234', 0.55, { x: 420, y: 360 }, { top: 360, right: 0 }) } as Cahaya;
  const unguStyle = { bottom: 0, left: width / 2 - 360, width: 720, height: 300, experimental_backgroundImage: radial('109,74,224', 0.45, { x: 360, y: 300 }, { bottom: 0, left: 360 }) } as Cahaya;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: darkColors.bg, overflow: 'hidden' }]}>
      <View style={[s.cahaya, tealStyle]} />
      <View style={[s.cahaya, biruStyle]} />
      <View style={[s.cahaya, unguStyle]} />
    </View>
  );
}

const s = StyleSheet.create({ cahaya: { position: 'absolute' } });
