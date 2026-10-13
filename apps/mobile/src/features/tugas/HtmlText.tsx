/**
 * Penampil HTML aman untuk deskripsi & komentar (tanpa WebView): hanya tag
 * p, br, strong/b, em/i, u, s/del, code, pre, a, ul/ol/li, blockquote, h1–h3,
 * dan span mention/rujukan. Tag lain diperlakukan sebagai teks mengalir;
 * skrip/gaya dibuang. Tautan hanya http(s)/mailto.
 */
import { router } from 'expo-router';
import { Linking, StyleSheet, View, type TextStyle } from 'react-native';

import { font, type, useTheme } from '@/theme';
import { Text } from '@/ui';

interface Simpul {
  tag: string;
  attrs: Record<string, string>;
  anak: (Simpul | string)[];
}

const ENTITAS: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

function dekode(teks: string): string {
  return teks.replace(/&(#?[a-z0-9]+);/gi, (m, k: string) => {
    if (ENTITAS[k.toLowerCase()] !== undefined) {
      return ENTITAS[k.toLowerCase()] as string;
    }
    if (k.startsWith('#x')) {
      return String.fromCodePoint(parseInt(k.slice(2), 16) || 63);
    }
    if (k.startsWith('#')) {
      return String.fromCodePoint(parseInt(k.slice(1), 10) || 63);
    }
    return m;
  });
}

const KOSONG = new Set(['br', 'hr', 'img', 'input']);

function parseAttr(s: string): Record<string, string> {
  const hasil: Record<string, string> = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m: RegExpExecArray | null = re.exec(s);
  while (m) {
    hasil[m[1]!.toLowerCase()] = dekode(m[2] ?? m[3] ?? m[4] ?? '');
    m = re.exec(s);
  }
  return hasil;
}

export function parseHtml(html: string): Simpul {
  const akar: Simpul = { tag: 'root', attrs: {}, anak: [] };
  const tumpuk: Simpul[] = [akar];
  const bersih = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^>]*?)?)\s*(\/?)>|([^<]+|<)/g;
  let m: RegExpExecArray | null = re.exec(bersih);
  while (m) {
    const atas = tumpuk[tumpuk.length - 1] as Simpul;
    if (m[5] !== undefined) {
      atas.anak.push(dekode(m[5]));
    } else {
      const tutup = m[1] === '/';
      const tag = (m[2] as string).toLowerCase();
      if (tutup) {
        const idx = tumpuk.map((n) => n.tag).lastIndexOf(tag);
        if (idx > 0) {
          tumpuk.length = idx;
        }
      } else {
        const node: Simpul = { tag, attrs: parseAttr(m[3] ?? ''), anak: [] };
        atas.anak.push(node);
        if (!KOSONG.has(tag) && m[4] !== '/') {
          tumpuk.push(node);
        }
      }
    }
    m = re.exec(bersih);
  }
  return akar;
}

const BLOK = new Set(['p', 'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'pre', 'div', 'root']);

function bukaTautan(href: string): void {
  if (/^(https?:|mailto:)/i.test(href)) {
    void Linking.openURL(href).catch(() => undefined);
  }
}

export function HtmlText({
  html,
  fallback,
  variant = 'body',
  tone,
}: {
  html: string | null | undefined;
  /** Teks polos bila `html` kosong. */
  fallback?: string | null;
  variant?: 'body' | 'label';
  tone?: 'text' | 'muted';
}): React.JSX.Element | null {
  const { colors } = useTheme();
  if (!html && !fallback) {
    return null;
  }
  if (!html) {
    return (
      <Text variant={variant} tone={tone} selectable>
        {fallback}
      </Text>
    );
  }
  const dasar: TextStyle = { ...type[variant], color: tone === 'muted' ? colors.muted : colors.text };

  function inline(n: Simpul | string, kunci: string, gaya: TextStyle): React.ReactNode {
    if (typeof n === 'string') {
      return n;
    }
    if (n.tag === 'br') {
      return '\n';
    }
    let g: TextStyle = gaya;
    if (n.tag === 'strong' || n.tag === 'b') {
      g = { ...g, fontFamily: font(700) };
    } else if (n.tag === 'em' || n.tag === 'i') {
      g = { ...g, fontStyle: 'italic' };
    } else if (n.tag === 'u') {
      g = { ...g, textDecorationLine: 'underline' };
    } else if (n.tag === 's' || n.tag === 'del') {
      g = { ...g, textDecorationLine: 'line-through' };
    } else if (n.tag === 'code') {
      g = { ...g, fontFamily: font(500), backgroundColor: colors.surface2 };
    } else if (n.tag === 'a') {
      const href = n.attrs.href ?? '';
      return (
        <Text key={kunci} style={{ ...g, color: colors.link, textDecorationLine: 'underline' }} onPress={() => bukaTautan(href)} accessibilityRole="link">
          {n.anak.map((c, i) => inline(c, `${kunci}.${i}`, { ...g, color: colors.link, textDecorationLine: 'underline' }))}
        </Text>
      );
    } else if (n.tag === 'span') {
      const jenis = n.attrs['data-type'];
      if (jenis === 'mention') {
        return (
          <Text key={kunci} style={{ ...g, color: colors.link, backgroundColor: colors.linkSoft, fontFamily: font(600) }}>
            {n.anak.map((c, i) => inline(c, `${kunci}.${i}`, g))}
          </Text>
        );
      }
      if (jenis === 'taskreference' || jenis === 'taskReference') {
        const id = n.attrs['data-id'];
        return (
          <Text
            key={kunci}
            style={{ ...g, color: colors.link, backgroundColor: colors.linkSoft, fontFamily: font(600) }}
            onPress={id ? () => router.push(`/tugas/${id}`) : undefined}
            accessibilityRole="link"
          >
            {n.anak.map((c, i) => inline(c, `${kunci}.${i}`, g))}
          </Text>
        );
      }
    }
    return (
      <Text key={kunci} style={g}>
        {n.anak.map((c, i) => inline(c, `${kunci}.${i}`, g))}
      </Text>
    );
  }

  function blok(n: Simpul | string, kunci: string, gaya: TextStyle, nomor?: number): React.ReactNode {
    if (typeof n === 'string') {
      return n.trim() === '' ? null : (
        <Text key={kunci} style={gaya} selectable>
          {n}
        </Text>
      );
    }
    if (n.tag === 'ul' || n.tag === 'ol') {
      return (
        <View key={kunci} style={{ gap: 4 }}>
          {n.anak.map((c, i) => blok(c, `${kunci}.${i}`, gaya, n.tag === 'ol' ? i + 1 : 0))}
        </View>
      );
    }
    if (n.tag === 'li') {
      return (
        <View key={kunci} style={s.li}>
          <Text style={{ ...gaya, width: 22 }}>{nomor ? `${nomor}.` : '•'}</Text>
          <View style={{ flex: 1, gap: 4 }}>{kelompokInline(n.anak, kunci, gaya)}</View>
        </View>
      );
    }
    if (n.tag === 'blockquote') {
      return (
        <View key={kunci} style={{ borderLeftWidth: 3, borderLeftColor: colors.borderStrong, paddingLeft: 12, gap: 4 }}>
          {kelompokInline(n.anak, kunci, { ...gaya, color: colors.muted })}
        </View>
      );
    }
    if (n.tag === 'h1' || n.tag === 'h2' || n.tag === 'h3') {
      return (
        <Text key={kunci} style={{ ...gaya, fontFamily: font(700), fontSize: n.tag === 'h1' ? 22 : 19, lineHeight: n.tag === 'h1' ? 30 : 26 }}>
          {n.anak.map((c, i) => inline(c, `${kunci}.${i}`, { ...gaya, fontFamily: font(700) }))}
        </Text>
      );
    }
    if (n.tag === 'pre') {
      return (
        <View key={kunci} style={{ backgroundColor: colors.surface2, borderRadius: 10, padding: 10 }}>
          <Text style={{ ...gaya, fontFamily: font(500), fontSize: 14, lineHeight: 20 }} selectable>
            {n.anak.map((c, i) => inline(c, `${kunci}.${i}`, { ...gaya, fontSize: 14 }))}
          </Text>
        </View>
      );
    }
    if (n.tag === 'p' || n.tag === 'div' || n.tag === 'root') {
      return <View key={kunci} style={{ gap: 8 }}>{kelompokInline(n.anak, kunci, gaya)}</View>;
    }
    return (
      <Text key={kunci} style={gaya} selectable>
        {inline(n, kunci, gaya)}
      </Text>
    );
  }

  /** Anak campuran: jalankan inline berturut-turut dalam satu Text, blok sebagai View. */
  function kelompokInline(anak: (Simpul | string)[], kunci: string, gaya: TextStyle): React.ReactNode[] {
    const hasil: React.ReactNode[] = [];
    let buf: (Simpul | string)[] = [];
    const lepas = (): void => {
      if (buf.length > 0) {
        const isi = buf;
        buf = [];
        const kosong = isi.every((x) => typeof x === 'string' && x.trim() === '');
        if (!kosong || isi.some((x) => typeof x !== 'string')) {
          hasil.push(
            <Text key={`${kunci}.t${hasil.length}`} style={gaya} selectable>
              {isi.map((x, i) => inline(x, `${kunci}.i${hasil.length}.${i}`, gaya))}
            </Text>,
          );
        }
      }
    };
    anak.forEach((c, i) => {
      if (typeof c !== 'string' && BLOK.has(c.tag)) {
        lepas();
        hasil.push(blok(c, `${kunci}.b${i}`, gaya));
      } else {
        buf.push(c);
      }
    });
    lepas();
    return hasil;
  }

  return <>{blok(parseHtml(html), 'h', dasar)}</>;
}

const s = StyleSheet.create({ li: { flexDirection: 'row' } });
