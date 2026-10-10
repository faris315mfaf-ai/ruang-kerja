/**
 * Detail rapat — info kemunculan (tanggal, jam WIB, platform/lokasi,
 * penyelenggara, workspace, notulis), agenda + deskripsi, peserta dengan
 * RSVP masing-masing, "Kehadiran saya" (Hadir/Mungkin/Tidak → enum web
 * yes|maybe|no; berlaku seluruh seri), tombol gabung video (membuka
 * halaman prabergabung web di browser — tanpa token Livekit di API), dan
 * tombol ke notulen baca. 404 = rapat tak terlihat / fitur mati.
 */
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError, webBase } from '@/api/client';
import { detailRapat, rsvpRapat } from '@/api/endpoints';
import type { MeetingDetailData, MeetingDetailResponse, RsvpValue } from '@/api/types';
import { Badge, Body, Button, Card, CardTitle, Divider, ErrorState, Field, Loading, Meta, Screen } from '@/components/ui';
import { jam, tanggalDariYMD } from '@/lib/format';
import { LABEL_NOTULEN, LABEL_RSVP, TONE_NOTULEN, TONE_RSVP, labelPengulangan } from '@/lib/rapat';
import { radius, useTheme } from '@/lib/theme';

type Jawaban = Exclude<RsvpValue, 'pending'>;

const PILIHAN_JAWABAN: { nilai: Jawaban; label: string; ikon: keyof typeof Ionicons.glyphMap }[] = [
  { nilai: 'yes', label: 'Hadir', ikon: 'checkmark-circle-outline' },
  { nilai: 'maybe', label: 'Mungkin', ikon: 'help-circle-outline' },
  { nilai: 'no', label: 'Tidak hadir', ikon: 'close-circle-outline' },
];

function bukaTautan(url: string): void {
  Linking.openURL(url).catch(() => {
    Alert.alert('Tidak dapat membuka', 'Tautan tidak bisa dibuka di perangkat ini.');
  });
}

export default function LayarDetailRapat(): React.JSX.Element {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { id, tanggal } = useLocalSearchParams<{ id: string; tanggal?: string }>();

  const [data, setData] = useState<MeetingDetailResponse | null>(null);
  const [rsvpSaya, setRsvpSaya] = useState<RsvpValue | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [galatAksi, setGalatAksi] = useState<string | null>(null);
  const [menyibuk, setMenyibuk] = useState(false);

  const muat = useCallback(async (): Promise<void> => {
    if (typeof id !== 'string') {
      setGalat('Rapat tidak ditemukan.');
      setMemuat(false);
      return;
    }
    setMemuat(true);
    setGalat(null);
    try {
      const hasil = await detailRapat(id, typeof tanggal === 'string' ? tanggal : null);
      setData(hasil);
      setRsvpSaya(hasil.meeting.rsvp_saya);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setGalat('Rapat tidak ditemukan atau Anda tidak memiliki akses.');
      } else {
        setGalat(err instanceof ApiError ? err.message : 'Tidak dapat memuat rapat.');
      }
    } finally {
      setMemuat(false);
    }
  }, [id, tanggal]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pemuatan data saat layar dibuka
    void muat();
  }, [muat]);

  async function jawab(nilai: Jawaban): Promise<void> {
    if (menyibuk || typeof id !== 'string') {
      return;
    }
    setMenyibuk(true);
    setGalatAksi(null);
    const lama = rsvpSaya;
    setRsvpSaya(nilai); // optimis; dibatalkan bila server menolak.
    try {
      const hasil = await rsvpRapat(id, nilai);
      setRsvpSaya(hasil);
    } catch (err) {
      setRsvpSaya(lama);
      setGalatAksi(err instanceof ApiError ? (err.firstValidationError ?? err.message) : 'Gagal menyimpan kehadiran.');
    } finally {
      setMenyibuk(false);
    }
  }

  const rapat: MeetingDetailData | null = data?.meeting ?? null;
  const video = data?.video ?? null;
  const bolehRsvp = data?.can.rsvp === true;

  const tautanVideo = video !== null && video.configured ? webBase() + video.join_href : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Kembali"
        style={[detail.punggung, { paddingTop: insets.top + 10 }]}
        hitSlop={8}
      >
        <Ionicons name="arrow-back" size={24} color={colors.text} />
        <Text style={[detail.judulAtas, { color: colors.text, flexShrink: 1 }]} numberOfLines={1}>
          Detail rapat
        </Text>
      </Pressable>

      {memuat && !rapat ? (
        <Loading label="Memuat rapat…" />
      ) : galat && !rapat ? (
        <ErrorState message={galat} onRetry={() => void muat()} />
      ) : rapat ? (
        <Screen contentStyle={{ paddingBottom: 48 }}>
          <View style={{ gap: 6 }}>
            <View style={detail.lencanaBaris}>
              <Badge tone="primary">{rapat.platform_label}</Badge>
              {rapat.canceled ? <Badge tone="danger">Dibatalkan</Badge> : null}
              {rapat.leadership ? <Badge tone="info">Rapat pimpinan</Badge> : null}
              {labelPengulangan(rapat.recurrence, rapat.recurrence_until) ? (
                <Badge tone="neutral">{labelPengulangan(rapat.recurrence, rapat.recurrence_until)}</Badge>
              ) : null}
            </View>
            <Text style={[detail.judul, { color: colors.text }]}>{rapat.title}</Text>
            <Meta>
              {rapat.key} · {tanggalDariYMD(rapat.occurrence_date)}
            </Meta>
          </View>

          <Card>
            <CardTitle>Waktu &amp; tempat</CardTitle>
            <Field label="Waktu (WIB)">
              <Body muted>
                {tanggalDariYMD(rapat.occurrence_date)} · {jam(rapat.starts_at)}–{jam(rapat.ends_at)}
              </Body>
            </Field>
            <Field label="Platform">
              <Body muted>{rapat.platform_label}</Body>
            </Field>
            {rapat.location ? (
              <Field label="Lokasi">
                <Body muted>{rapat.location}</Body>
              </Field>
            ) : null}
            {rapat.join_url ? (
              <Field label="Tautan gabung">
                <Pressable onPress={() => bukaTautan(rapat.join_url as string)} accessibilityRole="link" accessibilityLabel="Buka tautan gabung">
                  <Body style={{ color: colors.link }}>{rapat.join_url}</Body>
                </Pressable>
              </Field>
            ) : null}
          </Card>

          <Card>
            <CardTitle>Penyelenggara</CardTitle>
            <Field label="Oleh">
              <Body muted>{rapat.organizer.name ?? '—'}</Body>
            </Field>
            {rapat.minute_taker ? (
              <Field label="Notulis">
                <Body muted>{rapat.minute_taker.name ?? '—'}</Body>
              </Field>
            ) : null}
            {rapat.workspace ? (
              <Field label="Workspace">
                <Body muted>{rapat.workspace.name}</Body>
              </Field>
            ) : null}
            <Field label="Peserta">
              <Body muted>{rapat.peserta_count} orang diundang</Body>
            </Field>
          </Card>

          {rapat.agenda_items.length > 0 || rapat.description ? (
            <Card>
              <CardTitle>Agenda</CardTitle>
              {rapat.agenda_items.length > 0 ? (
                <View style={{ gap: 4 }}>
                  {rapat.agenda_items.map((poin, indeks) => (
                    <Body key={`${indeks}-${poin}`} muted>
                      {indeks + 1}. {poin}
                    </Body>
                  ))}
                </View>
              ) : null}
              {rapat.description ? (
                <Field label="Deskripsi">
                  <Body muted>{rapat.description}</Body>
                </Field>
              ) : null}
            </Card>
          ) : null}

          {/* Kehadiran saya */}
          <Card>
            <CardTitle>Kehadiran saya</CardTitle>
            {bolehRsvp ? (
              <>
                <View style={detail.jawaban}>
                  {PILIHAN_JAWABAN.map((pilihan) => {
                    const aktif = rsvpSaya === pilihan.nilai;
                    return (
                      <Pressable
                        key={pilihan.nilai}
                        onPress={() => void jawab(pilihan.nilai)}
                        accessibilityRole="radio"
                        accessibilityLabel={pilihan.label}
                        accessibilityState={{ selected: aktif }}
                        style={[
                          detail.chipJawaban,
                          {
                            backgroundColor: aktif ? colors.primary : colors.surface,
                            borderColor: aktif ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <Ionicons name={pilihan.ikon} size={16} color={aktif ? colors.primaryFg : colors.muted} />
                        <Text style={[detail.chipTeks, { color: aktif ? colors.primaryFg : colors.muted }]}>
                          {pilihan.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Meta>Jawaban berlaku untuk seluruh seri rapat.</Meta>
              </>
            ) : (
              <Meta>Anda tidak dapat menjawab undangan ini (mis. penyelenggara atau rapat pimpinan).</Meta>
            )}
          </Card>

          {/* Ruang video */}
          {video !== null ? (
            <Card>
              <CardTitle>Ruang video</CardTitle>
              {tautanVideo !== null ? (
                <>
                  <Button
                    title="Gabung video (browser)"
                    icon="videocam-outline"
                    onPress={() => bukaTautan(tautanVideo)}
                    accessibilityHint="Membuka halaman gabung rapat di browser"
                  />
                  <Meta>
                    {video.can_join
                      ? 'Membuka halaman RuangKerja web di browser untuk masuk ruang video.'
                      : (video.denied_reason ?? 'Ruang video belum bisa dibuka.')}
                  </Meta>
                </>
              ) : (
                <Meta>Ruang video belum dikonfigurasi. Hubungi penyelenggara untuk tautan rapat.</Meta>
              )}
            </Card>
          ) : null}

          {/* Peserta + RSVP mereka */}
          <Card>
            <CardTitle>Peserta ({rapat.participants.length})</CardTitle>
            <View style={{ gap: 0 }}>
              {rapat.participants.map((peserta, indeks) => (
                <View key={`${peserta.user_id ?? peserta.email}-${indeks}`}>
                  {indeks > 0 ? <Divider /> : null}
                  <View style={detail.barisPeserta}>
                    <View style={{ flex: 1 }}>
                      <Text style={[detail.namaPeserta, { color: colors.text }]} numberOfLines={1}>
                        {peserta.nama ?? peserta.email ?? 'Peserta'}
                        {peserta.user_id === rapat.organizer.id ? ' (penyelenggara)' : ''}
                      </Text>
                      {peserta.optional ? <Meta>Opsional</Meta> : null}
                    </View>
                    <Badge tone={TONE_RSVP[peserta.rsvp]}>{LABEL_RSVP[peserta.rsvp]}</Badge>
                  </View>
                </View>
              ))}
            </View>
          </Card>

          {/* Notulen */}
          <Card>
            <View style={detail.kepalaNotulen}>
              <CardTitle>Notulen</CardTitle>
              <Badge tone={TONE_NOTULEN[rapat.notulen.status]}>{LABEL_NOTULEN[rapat.notulen.status]}</Badge>
            </View>
            <Button
              title="Lihat notulen"
              variant="secondary"
              icon="document-text-outline"
              onPress={() => {
                if (typeof id === 'string') {
                  router.push({
                    pathname: '/rapat/[id]/notulen',
                    params: { id, tanggal: rapat.occurrence_date, judul: rapat.title },
                  });
                }
              }}
              accessibilityHint="Membuka notulen rapat (baca-saja)"
            />
            <Meta>Menulis dan memfinalisasi notulen dilakukan lewat RuangKerja web.</Meta>
          </Card>

          {galatAksi ? (
            <Card>
              <Text style={{ color: colors.danger, fontSize: 14 }} accessibilityRole="alert">
                {galatAksi}
              </Text>
            </Card>
          ) : null}
        </Screen>
      ) : null}
    </View>
  );
}

const detail = StyleSheet.create({
  punggung: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  judulAtas: { fontSize: 17, fontWeight: '700' },
  judul: { fontSize: 21, fontWeight: '800', lineHeight: 28 },
  lencanaBaris: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  jawaban: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipJawaban: {
    minHeight: 44,
    borderRadius: radius.sm + 2,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
  },
  chipTeks: { fontSize: 13, fontWeight: '700' },
  barisPeserta: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  namaPeserta: { fontSize: 14, fontWeight: '600' },
  kepalaNotulen: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
});
