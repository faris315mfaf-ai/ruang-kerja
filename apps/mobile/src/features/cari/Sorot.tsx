/** Teks dengan kata kunci disorot (kata dari `terms[]` server, tak peka huruf besar/kecil). */
import { fontFamily, useTheme } from '@/theme';
import { Text, type TextProps } from '@/ui';

function lolos(kata: string): string {
  return kata.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function potongSorotan(teks: string, terms: string[]): { teks: string; sorot: boolean }[] {
  const kata = terms.map((t) => t.trim()).filter((t) => t.length > 0);
  if (kata.length === 0 || teks === '') {
    return [{ teks, sorot: false }];
  }
  const pola = new RegExp(`(${kata.map(lolos).join('|')})`, 'giu');
  return teks
    .split(pola)
    .filter((x) => x !== '')
    .map((x) => ({ teks: x, sorot: kata.some((k) => k.toLowerCase() === x.toLowerCase()) }));
}

export function Sorot({ teks, terms, ...rest }: { teks: string; terms: string[] } & Omit<TextProps, 'children'>): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <Text {...rest}>
      {potongSorotan(teks, terms).map((b, i) =>
        b.sorot ? (
          <Text key={i} variant={rest.variant} style={{ backgroundColor: colors.linkSoft, color: colors.link, fontFamily: fontFamily[700] }}>
            {b.teks}
          </Text>
        ) : (
          b.teks
        ),
      )}
    </Text>
  );
}
