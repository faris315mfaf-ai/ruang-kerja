/**
 * Pengganti `@expo/vector-icons` Ionicons untuk layar lama: API sama
 * (`name`, `size`, `color`, `style`, `Ionicons.glyphMap`) tetapi dirender
 * sebagai Lucide. Kode baru memakai `<Icon name="..." />`.
 */
import type { StyleProp, ViewStyle } from 'react-native';

import { Icon } from './Icon';
import { glyphMap, type IoniconName } from './ionicons-map';

export type { IoniconName };

export function Ionicons({
  name,
  size = 24,
  color,
  style,
}: {
  name: IoniconName;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  return <Icon name={name} size={size} color={color} style={style} />;
}

Ionicons.glyphMap = glyphMap;
