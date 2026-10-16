/**
 * Penampil Markdown ringkas untuk kebijakan privasi: paragraf, daftar
 * (bullet/bernomor), judul `###`, **tebal**, *miring*, dan tautan http(s)/mailto.
 * Tanpa HTML mentah, tanpa gambar — cukup untuk teks kebijakan.
 */
import { Linking, View } from 'react-native';

import { Text } from '@/ui';

type Blok =
  | { jenis: 'p'; teks: string }
  | { jenis: 'h'; teks: string }
  | { jenis: 'ul'; butir: string[] }
  | { jenis: 'ol'; butir: string[] };

export function uraiBlok(markdown: string): Blok[] {
  const hasil: Blok[] = [];
  const baris = markdown.replace(/\r\n?/g, '\n').split('\n');
  let paragraf: string[] = [];
  let daftar: { jenis: 'ul' | 'ol'; butir: string[] } | null = null;

  const tutupParagraf = (): void => {
    if (paragraf.length > 0) {
      hasil.push({ jenis: 'p', teks: paragraf.join(' ') });
      paragraf = [];
    }
  };
  const tutupDaftar = (): void => {
    if (daftar) {
      hasil.push(daftar);
      daftar = null;
    }
  };

  for (const mentah of baris) {
    const b = mentah.trim();
    if (b === '') {
      tutupParagraf();
      tutupDaftar();
      continue;
    }
    const judul = /^#{1,6}\s+(.*)$/.exec(b);
    if (judul) {
      tutupParagraf();
      tutupDaftar();
      hasil.push({ jenis: 'h', teks: judul[1] ?? '' });
      continue;
    }
    const bullet = /^[-*+]\s+(.*)$/.exec(b);
    const nomor = /^\d+[.)]\s+(.*)$/.exec(b);
    if (bullet || nomor) {
      tutupParagraf();
      const jenis = bullet ? 'ul' : 'ol';
      if (!daftar || daftar.jenis !== jenis) {
        tutupDaftar();
        daftar = { jenis, butir: [] };
      }
      daftar.butir.push((bullet ?? nomor)?.[1] ?? '');
      continue;
    }
    if (daftar) {
      // Lanjutan butir daftar (baris tanpa penanda).
      const terakhir = daftar.butir.length - 1;
      daftar.butir[terakhir] = `${daftar.butir[terakhir] ?? ''} ${b}`;
      continue;
    }
    paragraf.push(b);
  }
  tutupParagraf();
  tutupDaftar();
  return hasil;
}

const POLA = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\)|\*[^*\s][^*]*\*)/g;

function bukaTautan(url: string): void {
  if (/^(https?:\/\/|mailto:)/i.test(url)) {
    void Linking.openURL(url).catch(() => undefined);
  }
}

function Inline({ teks }: { teks: string }): React.JSX.Element {
  const potongan = teks.split(POLA).filter((x) => x !== '');
  return (
    <>
      {potongan.map((bagian, i) => {
        const tebal = /^\*\*([^*]+)\*\*$/.exec(bagian);
        if (tebal) {
          return (
            <Text key={i} weight={700}>
              {tebal[1]}
            </Text>
          );
        }
        const tautan = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(bagian);
        if (tautan) {
          return (
            <Text key={i} tone="link" weight={600} onPress={() => bukaTautan(tautan[2] ?? '')} accessibilityRole="link">
              {tautan[1]}
            </Text>
          );
        }
        const miring = /^\*([^*]+)\*$/.exec(bagian);
        if (miring) {
          return (
            <Text key={i} style={{ fontStyle: 'italic' }}>
              {miring[1]}
            </Text>
          );
        }
        return <Text key={i}>{bagian}</Text>;
      })}
    </>
  );
}

export function Markdown({ sumber }: { sumber: string }): React.JSX.Element {
  const blok = uraiBlok(sumber);
  return (
    <View style={{ gap: 12 }}>
      {blok.map((b, i) => {
        if (b.jenis === 'h') {
          return (
            <Text key={i} variant="title" accessibilityRole="header">
              {b.teks}
            </Text>
          );
        }
        if (b.jenis === 'p') {
          return (
            <Text key={i} variant="body" style={{ fontSize: 16, lineHeight: 25 }} selectable>
              <Inline teks={b.teks} />
            </Text>
          );
        }
        return (
          <View key={i} style={{ gap: 6 }}>
            {b.butir.map((butir, j) => (
              <View key={j} style={{ flexDirection: 'row', gap: 10, paddingRight: 8 }}>
                <Text variant="body" tone="muted" style={{ width: 22, fontSize: 16, lineHeight: 25 }}>
                  {b.jenis === 'ul' ? '•' : `${j + 1}.`}
                </Text>
                <Text variant="body" style={{ flex: 1, fontSize: 16, lineHeight: 25 }} selectable>
                  <Inline teks={butir} />
                </Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}
