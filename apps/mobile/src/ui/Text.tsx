import { Text as RNText, type StyleProp, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { font, type FontWeight, type TextVariant, type Colors, useTheme } from '@/theme';
import { type } from '@/theme/typography';

export type TextTone =
  | 'text'
  | 'muted'
  | 'subtle'
  | 'primary'
  | 'link'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'onPrimary'
  | 'onInverse'
  | 'onActive';

export function toneColor(colors: Colors, tone: TextTone): string {
  switch (tone) {
    case 'muted':
      return colors.muted;
    case 'subtle':
      return colors.subtle;
    case 'primary':
      return colors.primary;
    case 'link':
      return colors.link;
    case 'success':
      return colors.success;
    case 'warning':
      return colors.warning;
    case 'danger':
      return colors.danger;
    case 'info':
      return colors.info;
    case 'onPrimary':
      return '#FFFFFF';
    case 'onInverse':
      return colors.onInverse;
    case 'onActive':
      return colors.onActive;
    default:
      return colors.text;
  }
}

export interface TextProps extends Omit<RNTextProps, 'style'> {
  /** Varian skala tipografi (default `body`). `meta` default berwarna `muted`, `overline` `link`. */
  variant?: TextVariant;
  tone?: TextTone;
  /** Override bobot Figtree (mis. 700 pada `body`). */
  weight?: FontWeight;
  align?: TextStyle['textAlign'];
  style?: StyleProp<TextStyle>;
}

const toneBawaan: Partial<Record<TextVariant, TextTone>> = {
  meta: 'muted',
  overline: 'link',
};

export function Text({
  variant = 'body',
  tone,
  weight,
  align,
  style,
  maxFontSizeMultiplier = 2,
  ...rest
}: TextProps): React.JSX.Element {
  const { colors } = useTheme();
  const warna = toneColor(colors, tone ?? toneBawaan[variant] ?? 'text');
  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      {...rest}
      style={[
        type[variant],
        { color: warna },
        weight ? { fontFamily: font(weight) } : null,
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}
