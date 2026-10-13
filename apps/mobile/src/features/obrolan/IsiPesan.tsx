/**
 * Isi pesan: dokumen Tiptap tersanitasi → teks sebaris. Mention disorot,
 * #KEY-n bisa diketuk (buka tugas), tautan dibuka di peramban. `sorot`
 * menandai kata hasil pencarian.
 */
import { router } from 'expo-router';
import { Linking } from 'react-native';

import type { Pesan } from '@/api/obrolan';
import { font, fontFamily, useTheme } from '@/theme';
import { Text, toneColor } from '@/ui';

import { potongPesan, type Potongan } from './util';

/** Pecah teks menurut kata pencarian (awalan kata, tanpa membedakan huruf). */
function pecahSorot(teks: string, kata: string[]): { teks: string; sorot: boolean }[] {
  if (kata.length === 0 || teks === '') {
    return [{ teks, sorot: false }];
  }
  const pola = new RegExp(`(${kata.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'giu');
  return teks
    .split(pola)
    .filter((b) => b !== '')
    .map((b) => ({ teks: b, sorot: kata.some((k) => k.toLowerCase() === b.toLowerCase()) }));
}

export function IsiPesan({
  pesan,
  milikSaya,
  sorot,
}: {
  pesan: Pesan;
  milikSaya: boolean;
  sorot?: string;
}): React.JSX.Element {
  const { colors } = useTheme();
  const potongan: Potongan[] = potongPesan(pesan.body, pesan.body_text);
  const kata = (sorot ?? '').trim().split(/\s+/).filter((k) => k.length >= 2);
  const putih = toneColor(colors, 'onPrimary');
  const warnaTeks = milikSaya ? putih : colors.text;

  return (
    <Text variant="body" style={{ color: warnaTeks }} selectable={false}>
      {potongan.map((p, i) => {
        if (p.jenis === 'mention') {
          return (
            <Text key={i} weight={700} style={{ color: milikSaya ? putih : colors.link, backgroundColor: milikSaya ? 'rgba(255,255,255,0.22)' : colors.linkSoft }}>
              {p.teks}
            </Text>
          );
        }
        if (p.jenis === 'tugas') {
          return (
            <Text
              key={i}
              onPress={() => router.push({ pathname: '/tugas/[id]', params: { id: p.id } })}
              accessibilityRole="link"
              accessibilityLabel={`Buka tugas ${p.teks}`}
              style={{ fontFamily: fontFamily.mono500, fontSize: 15, color: milikSaya ? putih : colors.link, backgroundColor: milikSaya ? 'rgba(255,255,255,0.22)' : colors.linkSoft }}
            >
              {` ${p.teks} `}
            </Text>
          );
        }
        const bagian = pecahSorot(p.teks, kata);
        return bagian.map((b, j) => (
          <Text
            key={`${i}-${j}`}
            onPress={p.tautan ? () => void Linking.openURL(p.tautan as string).catch(() => undefined) : undefined}
            style={{
              fontFamily: p.kode ? fontFamily.mono500 : p.tebal ? font(700) : undefined,
              fontStyle: p.miring ? 'italic' : undefined,
              textDecorationLine: p.tautan ? 'underline' : undefined,
              color: p.tautan && !milikSaya ? colors.link : warnaTeks,
              backgroundColor: b.sorot ? colors.warningSoft : undefined,
            }}
          >
            {b.teks}
          </Text>
        ));
      })}
    </Text>
  );
}
