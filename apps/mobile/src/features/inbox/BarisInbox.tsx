/**
 * Satu baris notifikasi (spec 10 §4): ubin ikon bernada, judul dengan nama
 * pelaku/kode tugas ditebalkan (seluruh judul tebal selagi belum dibaca),
 * baris kedua `jam · konteks · kutipan`, lencana "Perlu tindakan", titik
 * belum dibaca. Mode pilih mengganti ubin dengan lingkaran centang.
 */
import { StyleSheet, View } from 'react-native';

import { fontFamily, radius, useTheme } from '@/theme';
import { Badge, Gradient, Icon, IconTile, Text } from '@/ui';

import type { EntriInbox } from '@/api/inbox';

import { ikonNotifikasi, nadaNotifikasi } from './ikon';
import { jamKantor } from './waktu';

interface Bagian {
  teks: string;
  jenis: 'biasa' | 'nama' | 'kode';
}

/** Pecah judul menjadi potongan; nama pelaku & kode subjek ditandai. */
export function bagianJudul(judul: string, nama: string | null | undefined, kode: string | null | undefined): Bagian[] {
  const token = [nama, kode].filter((t): t is string => typeof t === 'string' && t !== '' && judul.includes(t));
  if (token.length === 0) {
    return [{ teks: judul, jenis: 'biasa' }];
  }
  const hasil: Bagian[] = [];
  let sisa = judul;
  while (sisa.length > 0) {
    let awal = -1;
    let pilih = '';
    for (const t of token) {
      const i = sisa.indexOf(t);
      if (i >= 0 && (awal < 0 || i < awal)) {
        awal = i;
        pilih = t;
      }
    }
    if (awal < 0) {
      hasil.push({ teks: sisa, jenis: 'biasa' });
      break;
    }
    if (awal > 0) {
      hasil.push({ teks: sisa.slice(0, awal), jenis: 'biasa' });
    }
    hasil.push({ teks: pilih, jenis: pilih === kode ? 'kode' : 'nama' });
    sisa = sisa.slice(awal + pilih.length);
  }
  return hasil;
}

export function BarisInbox({
  item,
  mode,
  dipilih,
}: {
  item: EntriInbox;
  mode: 'biasa' | 'pilih';
  dipilih: boolean;
}): React.JSX.Element {
  const { colors } = useTheme();
  const belum = item.read_at === null;
  const bagian = bagianJudul(item.title, item.actor?.name, item.subject?.code);
  const kodeDiJudul = item.subject?.code ? item.title.includes(item.subject.code) : false;

  const nadaKonteks = item.meta.context_tone;
  const warnaKonteks =
    nadaKonteks === 'danger' ? colors.danger : nadaKonteks === 'success' ? colors.success : nadaKonteks === 'warning' ? colors.warning : nadaKonteks === 'info' ? colors.info : colors.muted;

  const sekunder: React.ReactNode[] = [];
  if (item.category === 'info') {
    sekunder.push(
      <Text key="jenis" variant="meta" style={s.meta}>
        {item.type_label}
        {' · '}
      </Text>,
    );
  }
  const jam = jamKantor(item.created_at);
  if (jam) {
    sekunder.push(
      <Text key="jam" variant="meta" style={s.meta}>
        {jam}
      </Text>,
    );
  }
  if (item.subject?.code && !kodeDiJudul) {
    sekunder.push(
      <Text key="kode" variant="meta" style={[s.meta, { fontFamily: fontFamily.mono600, color: colors.muted }]}>
        {' · '}
        {item.subject.code}
      </Text>,
    );
  }
  if (item.meta.context) {
    sekunder.push(
      <Text key="konteks" variant="meta" style={[s.meta, { color: warnaKonteks, fontFamily: fontFamily[nadaKonteks && nadaKonteks !== 'neutral' ? 700 : 500] }]}>
        {' · '}
        {item.meta.context}
      </Text>,
    );
  }
  const judulSubjek = item.subject?.title && !item.title.includes(item.subject.title) ? item.subject.title : null;
  const ekor = item.meta.quote ? `“${item.meta.quote}”` : judulSubjek;
  if (ekor) {
    sekunder.push(
      <Text key="ekor" variant="meta" style={s.meta}>
        {' · '}
        {ekor}
      </Text>,
    );
  } else if (item.category === 'info' && item.actor?.name) {
    sekunder.push(
      <Text key="aktor" variant="meta" style={s.meta}>
        {' · '}
        {item.actor.name}
      </Text>,
    );
  }

  return (
    <View style={[s.baris, dipilih ? { backgroundColor: colors.linkSoft } : null]}>
      {mode === 'pilih' ? (
        <View style={[s.centang, { borderColor: dipilih ? 'transparent' : colors.borderStrong }]}>
          {dipilih ? (
            <>
              <Gradient name="aksi" style={[StyleSheet.absoluteFill, { borderRadius: 22 }]} />
              <Icon name="check" size={24} color="#FFFFFF" strokeWidth={2.6} />
            </>
          ) : null}
        </View>
      ) : (
        <IconTile icon={ikonNotifikasi(item.icon)} tone={nadaNotifikasi(item.tone)} />
      )}
      <View style={{ flex: 1, gap: 3 }}>
        <Text variant="title" style={{ fontFamily: fontFamily[belum ? 700 : 400] }} numberOfLines={3}>
          {bagian.map((b, i) => (
            <Text
              key={`${i}-${b.teks}`}
              variant="title"
              style={{
                fontFamily: b.jenis === 'kode' ? fontFamily.mono600 : fontFamily[belum || b.jenis === 'nama' ? 700 : 400],
                fontSize: b.jenis === 'kode' ? 16 : undefined,
              }}
            >
              {b.teks}
            </Text>
          ))}
        </Text>
        <Text variant="meta" numberOfLines={1} style={s.meta}>
          {sekunder}
        </Text>
        {item.action_required ? (
          <View style={{ alignSelf: 'flex-start', marginTop: 2 }}>
            <Badge tone="warning" dot={false}>
              Perlu tindakan
            </Badge>
          </View>
        ) : null}
      </View>
      {belum && mode === 'biasa' ? <Gradient name="merek" style={s.titik} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  baris: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 16, paddingHorizontal: 16 },
  meta: { fontSize: 14, lineHeight: 20 },
  titik: { width: 10, height: 10, borderRadius: radius.full, marginTop: 6 },
  centang: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
