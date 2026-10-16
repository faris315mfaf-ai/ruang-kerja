import type { StyleProp, ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

import { ICONS, type IconName } from './icons';
import { glyphMap, type IoniconName } from './ionicons-map';

export type { IconName, IoniconName };

/** Nama Lucide (kebab-case) atau nama Ionicons lama (dipetakan otomatis). */
export type AnyIconName = IconName | IoniconName;

export function resolveIconName(name: AnyIconName): IconName {
  return name in ICONS ? (name as IconName) : glyphMap[name as IoniconName];
}

export interface IconProps {
  name: AnyIconName;
  /** Ukuran piksel (20 UI · 22–24 navigasi). */
  size?: number;
  /** Warna; bawaan `text`. Gunakan token tema (`colors.muted`, dst.). */
  color?: string;
  strokeWidth?: number;
  style?: StyleProp<ViewStyle>;
}

/** Ikon Lucide, garis 1,9 seperti web. Dekoratif: disembunyikan dari TalkBack. */
export function Icon({ name, size = 22, color, strokeWidth = 1.9, style }: IconProps): React.JSX.Element {
  const { colors } = useTheme();
  const Komponen = ICONS[resolveIconName(name)];
  return (
    <Komponen
      size={size}
      color={color ?? colors.text}
      strokeWidth={strokeWidth}
      style={style}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
