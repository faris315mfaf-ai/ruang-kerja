/** Isi catatan baca-saja (format lengkap / pembaca): blok teks dari `body_html` atau paragraf `body_text`. */
import { View } from 'react-native';

import { useTheme } from '@/theme';
import { Icon, Text } from '@/ui';

import { htmlKeBlok, type Blok } from './htmlKeBlok';

function daftarBlok(html: string | null, teks: string | null): Blok[] {
  const dariHtml = htmlKeBlok(html);
  if (dariHtml.length > 0) {
    return dariHtml;
  }
  return (teks ?? '')
    .split('\n')
    .filter((b) => b.trim() !== '')
    .map((b) => ({ jenis: 'p', teks: b }) as Blok);
}

export function BacaBlok({ html, teks, skala }: { html: string | null; teks: string | null; skala: number }): React.JSX.Element {
  const { colors } = useTheme();
  const blok = daftarBlok(html, teks);
  const k = skala / 100;
  if (blok.length === 0) {
    return (
      <Text variant="body" tone="muted">
        Catatan masih kosong.
      </Text>
    );
  }
  return (
    <View style={{ gap: 10 * k }}>
      {blok.map((b, i) => {
        const ukuran = 17 * k;
        const tinggi = 26 * k;
        switch (b.jenis) {
          case 'h1':
            return (
              <Text key={i} weight={800} style={{ fontSize: 26 * k, lineHeight: 32 * k, marginTop: 6 }}>
                {b.teks}
              </Text>
            );
          case 'h2':
            return (
              <Text key={i} weight={700} style={{ fontSize: 22 * k, lineHeight: 28 * k, marginTop: 6 }}>
                {b.teks}
              </Text>
            );
          case 'h3':
            return (
              <Text key={i} weight={700} style={{ fontSize: 19 * k, lineHeight: 26 * k, marginTop: 4 }}>
                {b.teks}
              </Text>
            );
          case 'bullet':
          case 'nomor':
          case 'todo':
            return (
              <View key={i} style={{ flexDirection: 'row', gap: 8, paddingLeft: 6 }}>
                {b.jenis === 'todo' ? (
                  <Icon name={b.selesai ? 'square-check-big' : 'square'} size={20 * k} color={b.selesai ? colors.success : colors.muted} />
                ) : (
                  <Text style={{ fontSize: ukuran, lineHeight: tinggi, width: 22 * k, color: colors.muted }}>{b.jenis === 'nomor' ? `${b.nomor ?? 1}.` : '•'}</Text>
                )}
                <Text style={{ fontSize: ukuran, lineHeight: tinggi, flex: 1, textDecorationLine: b.jenis === 'todo' && b.selesai ? 'line-through' : 'none' }}>{b.teks}</Text>
              </View>
            );
          case 'quote':
            return (
              <View key={i} style={{ borderLeftWidth: 3, borderLeftColor: colors.borderStrong, paddingLeft: 12 }}>
                <Text tone="muted" style={{ fontSize: ukuran, lineHeight: tinggi }}>
                  {b.teks}
                </Text>
              </View>
            );
          case 'code':
            return (
              <View key={i} style={{ backgroundColor: colors.surface2, borderRadius: 12, padding: 12 }}>
                <Text variant="mono" style={{ fontSize: 14 * k }}>
                  {b.teks}
                </Text>
              </View>
            );
          case 'baris':
            return (
              <View key={i} style={{ borderBottomWidth: 1, borderBottomColor: colors.divider, paddingVertical: 6 }}>
                <Text style={{ fontSize: 15 * k, lineHeight: 22 * k }}>{b.teks}</Text>
              </View>
            );
          default:
            return (
              <Text key={i} style={{ fontSize: ukuran, lineHeight: tinggi }}>
                {b.teks}
              </Text>
            );
        }
      })}
    </View>
  );
}
