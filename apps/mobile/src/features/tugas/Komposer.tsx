/**
 * Komposer komentar: teks + pemilih @orang dan #rujukan (kirim `mentions[]`
 * dan `task_refs[]`), kirim gagal bisa diulang, mode sunting komentar.
 */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { cariMention, cariRujukan, type BodyKomentar, type Orang, type RujukanTugas } from '@/api/tugas';
import { fontFamily, radius, useTheme } from '@/theme';
import { Avatar, Icon, IconButton, Pressable, Text } from '@/ui';

import { StatusRing } from './ikon';

export interface ModeSunting {
  id: string;
  teks: string;
}

export function Komposer({
  taskId,
  workspaceKey,
  sunting,
  onBatalSunting,
  onKirim,
  tutupKetikaSelesai = false,
}: {
  taskId: string;
  workspaceKey: string;
  sunting: ModeSunting | null;
  onBatalSunting: () => void;
  /** Mengembalikan pesan galat, atau null bila sukses. */
  onKirim: (body: BodyKomentar, sunting: ModeSunting | null) => Promise<string | null>;
  tutupKetikaSelesai?: boolean;
}): React.JSX.Element {
  const { colors } = useTheme();
  const [teks, setTeks] = useState('');
  const [galat, setGalat] = useState<string | null>(null);
  const [mengirim, setMengirim] = useState(false);
  const [orang, setOrang] = useState<Orang[]>([]);
  const [rujukan, setRujukan] = useState<RujukanTugas[]>([]);
  const mention = useRef(new Map<string, string>());
  const refs = useRef(new Map<string, string>());
  const input = useRef<TextInput>(null);
  const [fokus, setFokus] = useState(false);
  const idSunting = sunting?.id ?? null;
  const teksSunting = sunting?.teks ?? '';

  useEffect(() => {
    if (idSunting !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- isi komposer dari komentar yang disunting
      setTeks(teksSunting);
      setGalat(null);
      input.current?.focus();
    }
  }, [idSunting, teksSunting]);

  const mMention = /(?:^|\s)@([^\s@]{0,30})$/.exec(teks);
  const mRef = /(?:^|\s)#([^\s#]{0,30})$/.exec(teks);
  const qMention = mMention ? mMention[1] ?? '' : null;
  const qRef = !mMention && mRef ? mRef[1] ?? '' : null;

  useEffect(() => {
    if (qMention === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- membersihkan hasil bila pemicu hilang
      setOrang([]);
      return undefined;
    }
    const t = setTimeout(() => {
      void cariMention(taskId, qMention)
        .then(setOrang)
        .catch(() => setOrang([]));
    }, 220);
    return () => clearTimeout(t);
  }, [qMention, taskId]);

  useEffect(() => {
    if (qRef === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- membersihkan hasil bila pemicu hilang
      setRujukan([]);
      return undefined;
    }
    const t = setTimeout(() => {
      void cariRujukan(qRef, workspaceKey)
        .then(setRujukan)
        .catch(() => setRujukan([]));
    }, 220);
    return () => clearTimeout(t);
  }, [qRef, workspaceKey]);

  function pilihOrang(o: Orang): void {
    mention.current.set(o.id, o.name);
    setTeks((t) => t.replace(/@([^\s@]{0,30})$/, `@${o.name} `));
    setOrang([]);
    input.current?.focus();
  }
  function pilihRujukan(r: RujukanTugas): void {
    refs.current.set(r.id, r.key);
    setTeks((t) => t.replace(/#([^\s#]{0,30})$/, `#${r.key} `));
    setRujukan([]);
    input.current?.focus();
  }

  async function kirim(): Promise<void> {
    const isi = teks.trim();
    if (isi === '' || mengirim) {
      return;
    }
    setMengirim(true);
    setGalat(null);
    const body: BodyKomentar = {
      body: isi,
      mentions: [...mention.current.entries()].filter(([, nama]) => isi.includes(`@${nama}`)).map(([id]) => id),
      task_refs: [...refs.current.entries()].filter(([, key]) => isi.includes(`#${key}`)).map(([id]) => id),
    };
    const pesan = await onKirim(body, sunting);
    setMengirim(false);
    if (pesan) {
      setGalat(pesan);
    } else {
      setTeks('');
      mention.current.clear();
      refs.current.clear();
      if (tutupKetikaSelesai) {
        input.current?.blur();
      }
    }
  }

  const bisaKirim = teks.trim() !== '' && !mengirim;

  return (
    <View style={{ gap: 8 }}>
      {orang.length > 0 ? (
        <View style={[s.picker, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text variant="overline" tone="muted" style={{ paddingHorizontal: 12, paddingTop: 8 }}>
            SEBUT ORANG · HANYA YANG PUNYA AKSES
          </Text>
          {orang.map((o) => (
            <Pressable key={o.id} onPress={() => pilihOrang(o)} scaleTo={1} accessibilityRole="button" accessibilityLabel={`Sebut ${o.name}`} style={s.baris}>
              <Avatar name={o.name} size="md" />
              <Text variant="title">{o.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {rujukan.length > 0 ? (
        <View style={[s.picker, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text variant="overline" tone="muted" style={{ paddingHorizontal: 12, paddingTop: 8 }}>
            RUJUK TUGAS
          </Text>
          {rujukan.map((r) => (
            <Pressable key={r.id} onPress={() => pilihRujukan(r)} scaleTo={1} accessibilityRole="button" accessibilityLabel={`Rujuk ${r.key} ${r.title}`} style={s.baris}>
              <StatusRing kategori={r.status_category} size={22} />
              <View style={{ flex: 1 }}>
                <Text variant="label" numberOfLines={1}>
                  {r.title}
                </Text>
                <Text variant="meta" numberOfLines={1}>
                  {r.key} · {r.workspace.name}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
      {sunting ? (
        <View style={s.sunting}>
          <Icon name="pencil" size={16} color={colors.link} />
          <Text variant="meta" tone="link" weight={700} style={{ flex: 1 }}>
            Menyunting komentar
          </Text>
          <Pressable onPress={() => { setTeks(''); setGalat(null); onBatalSunting(); }} accessibilityRole="button" accessibilityLabel="Batal menyunting" hitSlop={8}>
            <Text variant="label" tone="link">
              Batal
            </Text>
          </Pressable>
        </View>
      ) : null}
      {galat ? (
        <View style={[s.galat, { backgroundColor: colors.dangerSoft }]} accessibilityRole="alert">
          <Icon name="circle-alert" size={16} color={colors.danger} />
          <Text variant="meta" tone="danger" style={{ flex: 1 }}>
            {galat}
          </Text>
          <Pressable onPress={() => void kirim()} accessibilityRole="button" accessibilityLabel="Coba kirim lagi" hitSlop={8}>
            <Text variant="label" tone="danger" weight={700}>
              Coba lagi
            </Text>
          </Pressable>
        </View>
      ) : null}
      <View style={s.baris2}>
        <IconButton icon="at-sign" label="Sebut orang" variant="ghost" size={44} onPress={() => { setTeks((t) => (t === '' || /\s$/.test(t) ? `${t}@` : `${t} @`)); input.current?.focus(); }} />
        <IconButton icon="hash" label="Rujuk tugas" variant="ghost" size={44} onPress={() => { setTeks((t) => (t === '' || /\s$/.test(t) ? `${t}#` : `${t} #`)); input.current?.focus(); }} />
        <View style={[s.kotak, { backgroundColor: colors.surface, borderColor: fokus ? colors.primary : colors.borderStrong }]}>
          <TextInput
            ref={input}
            value={teks}
            onChangeText={(v) => { setTeks(v); setGalat(null); }}
            onFocus={() => setFokus(true)}
            onBlur={() => setFokus(false)}
            placeholder="Tulis komentar…"
            placeholderTextColor={colors.subtle}
            multiline
            maxLength={20000}
            accessibilityLabel="Komentar"
            style={[s.isian, { color: colors.text }]}
          />
        </View>
        <Pressable
          onPress={() => void kirim()}
          disabled={!bisaKirim}
          scaleTo={0.94}
          accessibilityRole="button"
          accessibilityLabel={sunting ? 'Simpan komentar' : mengirim ? 'Mengirim' : 'Kirim komentar'}
          accessibilityState={{ disabled: !bisaKirim }}
          style={[s.kirim, { backgroundColor: bisaKirim ? colors.primary : colors.surface2 }]}
        >
          <Icon name={mengirim ? 'loader-circle' : sunting ? 'check' : 'send'} size={20} color={bisaKirim ? colors.primaryFg : colors.subtle} />
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  picker: { borderRadius: radius.lg, borderWidth: 1, paddingBottom: 4, maxHeight: 280, overflow: 'hidden' },
  baris: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 12, paddingVertical: 6 },
  baris2: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  kotak: { flex: 1, minHeight: 48, maxHeight: 120, borderRadius: 24, borderWidth: 1.5, paddingHorizontal: 16, justifyContent: 'center' },
  isian: { fontFamily: fontFamily[400], fontSize: 17, paddingVertical: 10, maxHeight: 110 },
  kirim: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  sunting: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  galat: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8 },
});
