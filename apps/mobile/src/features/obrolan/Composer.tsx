/**
 * Komposer pesan (mockup 11–13): isian pil multibaris, pemilih @mention
 * (anggota kanal) dan #rujukan tugas, lampiran Drive, penghitung karakter,
 * mode sunting, dan keadaan terkunci. Kirim/sunting dikerjakan induk lewat
 * `onKirim`; komposer hanya mengosongkan isian bila induk menjawab `true`
 * (teks dipertahankan saat 429/422).
 */
import { useEffect, useRef, useState } from 'react';
import { Keyboard, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { saranRujukanTugas, MAKS_PESAN, type AnggotaKanal, type FileDrive, type MuatanKirim, type Pesan, type RujukanTugas } from '@/api/obrolan';
import { fontFamily, radius, useTheme } from '@/theme';
import { Avatar, Gradient, Icon, IconButton, Pressable, Text, toneColor } from '@/ui';

import { LampiranSheet } from './LampiranSheet';
import { acuanDariBody, ikonBerkas, tokenSaran } from './util';

export interface KomposerProps {
  kanalId: string;
  placeholder: string;
  anggota: AnggotaKanal[];
  saya: string | null;
  /** Dikirim induk; `true` = berhasil (isian dikosongkan). */
  onKirim: (muatan: MuatanKirim, editId: string | null) => Promise<boolean>;
  /** Pesan yang sedang disunting (isian terisi; induk memberi `key` baru per pesan). */
  edit?: Pesan | null;
  onBatalEdit?: () => void;
  /** Alasan terkunci (offline, arsip) — menggantikan isian. */
  terkunci?: string | null;
  /** Pita galat/429 di atas isian. */
  galat?: string | null;
  bolehLampir?: boolean;
}

interface SaranTugasHasil {
  q: string;
  tasks: RujukanTugas[];
}

export function Komposer({ kanalId, placeholder, anggota, saya, onKirim, edit = null, onBatalEdit, terkunci = null, galat = null, bolehLampir = true }: KomposerProps): React.JSX.Element {
  const { colors, shadows } = useTheme();
  const putih = toneColor(colors, 'onPrimary');
  const insets = useSafeAreaInsets();
  const awalEdit = edit !== null ? acuanDariBody(edit.body) : null;

  const [teks, setTeks] = useState(edit?.body_text ?? '');
  const [kursor, setKursor] = useState(edit?.body_text.length ?? 0);
  const [mentions, setMentions] = useState<{ id: string; nama: string }[]>(awalEdit?.mentions ?? []);
  const [tugas, setTugas] = useState<{ id: string; key: string }[]>(awalEdit?.tugas ?? []);
  const [lampiran, setLampiran] = useState<FileDrive[]>([]);
  const [tahap, setTahap] = useState<'menu' | 'drive' | null>(null);
  const [mengirim, setMengirim] = useState(false);
  const [papanKetik, setPapanKetik] = useState(false);
  const [saranTugas, setSaranTugas] = useState<SaranTugasHasil | null>(null);
  const input = useRef<TextInput | null>(null);

  useEffect(() => {
    const a = Keyboard.addListener('keyboardDidShow', () => setPapanKetik(true));
    const b = Keyboard.addListener('keyboardDidHide', () => setPapanKetik(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);

  const token = tokenSaran(teks, kursor);
  const queryTugas = token?.jenis === 'tugas' ? token.query : null;

  useEffect(() => {
    if (queryTugas === null) {
      return undefined;
    }
    let batal = false;
    const pewaktu = setTimeout(() => {
      saranRujukanTugas(queryTugas)
        .then((r) => {
          if (!batal) {
            setSaranTugas({ q: queryTugas, tasks: r.tasks });
          }
        })
        .catch(() => {
          if (!batal) {
            setSaranTugas({ q: queryTugas, tasks: [] });
          }
        });
    }, 250);
    return () => {
      batal = true;
      clearTimeout(pewaktu);
    };
  }, [queryTugas]);

  const kandidatMention =
    token?.jenis === 'mention'
      ? anggota
          .filter((a) => a.user_id !== saya && (token.query === '' || a.name.toLowerCase().split(/\s+/).some((k) => k.startsWith(token.query.toLowerCase())) || a.name.toLowerCase().includes(token.query.toLowerCase())))
          .slice(0, 5)
      : [];
  const kandidatTugas = token?.jenis === 'tugas' && saranTugas?.q === token.query ? saranTugas.tasks.slice(0, 5) : [];

  const sisip = (pengganti: string): void => {
    if (token === null) {
      return;
    }
    const baru = `${teks.slice(0, token.awal)}${pengganti} ${teks.slice(kursor)}`;
    setTeks(baru);
    setKursor(token.awal + pengganti.length + 1);
  };

  const panjang = teks.length;
  const kosong = teks.trim() === '' && lampiran.length === 0;
  const kelebihan = panjang > MAKS_PESAN;
  const bisaKirim = !kosong && !kelebihan && !mengirim;
  const tampilHitung = panjang >= 200 || teks.includes('\n');

  const kirim = async (): Promise<void> => {
    if (!bisaKirim) {
      return;
    }
    setMengirim(true);
    const isi = teks.trim();
    const muatan: MuatanKirim = {
      body: isi,
      mentions: mentions.filter((m) => isi.includes(`@${m.nama}`)).map((m) => m.id),
      task_refs: tugas.filter((t) => isi.includes(t.key)).map((t) => t.id),
      attachments: lampiran.map((l) => l.id),
    };
    try {
      const ok = await onKirim(muatan, edit?.id ?? null);
      if (ok) {
        setTeks('');
        setKursor(0);
        setMentions([]);
        setTugas([]);
        setLampiran([]);
      }
    } finally {
      setMengirim(false);
    }
  };

  const adaSaran = kandidatMention.length > 0 || kandidatTugas.length > 0;
  const bawah = papanKetik ? 8 : Math.max(insets.bottom, 8);

  if (terkunci !== null) {
    return (
      <View style={[s.bungkus, { backgroundColor: colors.glassStrong, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 8) }]}>
        <View style={[s.terkunci, { backgroundColor: colors.surface2 }]} accessibilityRole="alert">
          <Icon name="lock" size={18} color={colors.muted} />
          <Text variant="label" tone="muted" style={{ flex: 1 }}>
            {terkunci}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.bungkus, { backgroundColor: colors.glassStrong, borderTopColor: colors.border, paddingBottom: bawah }]}>
      {adaSaran ? (
        <View style={[s.saran, { backgroundColor: colors.surface, borderColor: colors.border, boxShadow: shadows.float }]} accessibilityLiveRegion="polite">
          <Text variant="overline" tone="muted" style={{ marginBottom: 4, paddingHorizontal: 8 }}>
            {token?.jenis === 'mention' ? 'Sebut rekan' : 'Rujuk tugas'}
          </Text>
          {kandidatMention.map((a) => (
            <Pressable
              key={a.user_id}
              onPress={() => {
                setMentions((lama) => [...lama.filter((m) => m.id !== a.user_id), { id: a.user_id, nama: a.name }]);
                sisip(`@${a.name}`);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Sebut ${a.name}`}
              scaleTo={1}
              style={s.barisSaran}
            >
              <Avatar name={a.name} size="sm" />
              <View style={{ flex: 1 }}>
                <Text variant="label" numberOfLines={1}>
                  {a.name}
                </Text>
                {a.title ? (
                  <Text variant="meta" numberOfLines={1}>
                    {a.title}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
          {kandidatTugas.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => {
                setTugas((lama) => [...lama.filter((x) => x.id !== t.id), { id: t.id, key: t.key }]);
                sisip(`#${t.key}`);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Rujuk tugas ${t.key}, ${t.title}`}
              scaleTo={1}
              style={s.barisSaran}
            >
              <Text style={{ fontFamily: fontFamily.mono500, fontSize: 14, color: colors.link }}>{t.key}</Text>
              <Text variant="label" numberOfLines={1} style={{ flex: 1 }}>
                {t.title}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {galat ? (
        <View style={[s.pita, { backgroundColor: colors.dangerSoft }]} accessibilityRole="alert" accessibilityLiveRegion="assertive">
          <Icon name="circle-alert" size={18} color={colors.danger} />
          <Text variant="meta" weight={600} tone="danger" style={{ flex: 1 }}>
            {galat}
          </Text>
        </View>
      ) : null}

      {edit !== null ? (
        <View style={[s.pita, { backgroundColor: colors.linkSoft }]}>
          <Icon name="pencil" size={18} color={colors.link} />
          <Text variant="label" tone="link" style={{ flex: 1 }}>
            Menyunting pesan
          </Text>
          <IconButton icon="x" label="Batal sunting" variant="ghost" size={36} onPress={() => onBatalEdit?.()} />
        </View>
      ) : null}

      {lampiran.length > 0 ? (
        <View style={s.chipBaris}>
          {lampiran.map((l) => (
            <View key={l.id} style={[s.chipLampir, { backgroundColor: colors.infoSoft }]}>
              <Icon name={ikonBerkas(l.kind)} size={16} color={colors.info} />
              <Text variant="meta" weight={600} tone="info" numberOfLines={1} style={{ maxWidth: 160 }}>
                {l.name}
              </Text>
              <Pressable onPress={() => setLampiran((x) => x.filter((b) => b.id !== l.id))} accessibilityRole="button" accessibilityLabel={`Lepas ${l.name}`} hitSlop={12} scaleTo={1}>
                <Icon name="x" size={16} color={colors.info} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <View style={s.baris}>
        {bolehLampir && edit === null ? <IconButton icon="plus" label="Lampirkan" variant="ghost" onPress={() => setTahap('menu')} /> : <View style={{ width: 8 }} />}
        <TextInput
          ref={input}
          value={teks}
          onChangeText={setTeks}
          onSelectionChange={(e) => setKursor(e.nativeEvent.selection.end)}
          placeholder={placeholder}
          placeholderTextColor={colors.subtle}
          multiline
          accessibilityLabel={placeholder}
          style={[s.isian, { backgroundColor: colors.surface, borderColor: kelebihan ? colors.danger : colors.borderStrong, color: colors.text }]}
        />
        <Pressable
          onPress={() => void kirim()}
          disabled={!bisaKirim}
          accessibilityRole="button"
          accessibilityLabel={edit !== null ? 'Simpan perubahan' : 'Kirim pesan'}
          accessibilityState={{ disabled: !bisaKirim, busy: mengirim }}
          style={[s.kirim, !bisaKirim ? { backgroundColor: colors.surface2 } : { boxShadow: shadows.button }]}
        >
          {bisaKirim ? <Gradient name="aksi" style={[StyleSheet.absoluteFill, { borderRadius: 24 }]} /> : null}
          <Icon name={mengirim ? 'clock' : edit !== null ? 'check' : 'send'} size={22} color={bisaKirim ? putih : colors.subtle} />
        </Pressable>
      </View>

      {tampilHitung || kelebihan ? (
        <Text variant="meta" tone={kelebihan ? 'danger' : 'muted'} align="right" style={{ paddingRight: 8 }} accessibilityLiveRegion="polite">
          {kelebihan ? `Pesan maksimal ${MAKS_PESAN.toLocaleString('id-ID')} karakter. ` : ''}
          {panjang.toLocaleString('id-ID')}/{MAKS_PESAN.toLocaleString('id-ID')}
        </Text>
      ) : null}

      <LampiranSheet tahap={tahap} onTahap={setTahap} kanalId={kanalId} terpilih={lampiran} onPilih={setLampiran} />
    </View>
  );
}

const s = StyleSheet.create({
  bungkus: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, paddingHorizontal: 8, gap: 6 },
  baris: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  isian: {
    flex: 1,
    minHeight: 48,
    maxHeight: 144,
    borderWidth: 1,
    borderRadius: radius['3xl'] - 2,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 11,
    fontFamily: fontFamily[400],
    fontSize: 17,
    textAlignVertical: 'center',
  },
  kirim: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  saran: { borderWidth: 1, borderRadius: 20, padding: 8 },
  barisSaran: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 8, borderRadius: 14 },
  pita: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  chipBaris: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 8 },
  chipLampir: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, minHeight: 32, borderRadius: radius.full },
  terkunci: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, borderRadius: 26, paddingHorizontal: 16 },
});
