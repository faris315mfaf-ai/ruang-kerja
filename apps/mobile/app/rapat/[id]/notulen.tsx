/**
 * Notulen rapat (baca-saja) — status draf/final, kehadiran (hadir/tidak
 * dengan nama dari `people`), seksi pembahasan (judul + isi teks polos),
 * keputusan, dan tindak lanjut dengan status + kunci tugas. id null =
 * belum ditulis → draf kosong dari agenda. Menulis/finalisasi tetap di web.
 */
import { Ionicons } from '@/ui/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { notulenRapat } from '@/api/endpoints';
import type { MeetingMinutesResponse } from '@/api/types';
import { Badge, Body, Card, CardTitle, Divider, EmptyState, ErrorState, Loading, Meta, Screen } from '@/components/ui';
import { jam, tanggalDariYMD, ymdJakarta } from '@/lib/format';
import { useTheme } from '@/lib/theme';

export default function LayarNotulenRapat(): React.JSX.Element {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { id, tanggal } = useLocalSearchParams<{ id: string; tanggal?: string }>();

  const [data, setData] = useState<MeetingMinutesResponse | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);

  const muat = useCallback(async (): Promise<void> => {
    if (typeof id !== 'string') {
      setGalat('Notulen tidak ditemukan.');
      setMemuat(false);
      return;
    }
    setMemuat(true);
    setGalat(null);
    try {
      setData(await notulenRapat(id, typeof tanggal === 'string' ? tanggal : null));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setGalat('Notulen tidak ditemukan atau Anda tidak memiliki akses.');
      } else {
        setGalat(err instanceof ApiError ? err.message : 'Tidak dapat memuat notulen.');
      }
    } finally {
      setMemuat(false);
    }
  }, [id, tanggal]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pemuatan data saat layar dibuka
    void muat();
  }, [muat]);

  const namaOrang = (userId: string): string =>
    data?.people.find((orang) => orang.id === userId)?.name ?? '—';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Kembali"
        style={[notulen.punggung, { paddingTop: insets.top + 10 }]}
        hitSlop={8}
      >
        <Ionicons name="arrow-back" size={24} color={colors.text} />
        <Text style={[notulen.judulAtas, { color: colors.text, flexShrink: 1 }]} numberOfLines={1}>
          Notulen rapat
        </Text>
      </Pressable>

      {memuat && !data ? (
        <Loading label="Memuat notulen…" />
      ) : galat && !data ? (
        <ErrorState message={galat} onRetry={() => void muat()} />
      ) : data ? (
        <Screen contentStyle={{ paddingBottom: 48 }}>
          <View style={{ gap: 6 }}>
            <View style={notulen.lencanaBaris}>
              <Badge tone={data.notulen.status === 'final' ? 'success' : 'warning'}>
                {data.notulen.status === 'final' ? 'Final' : 'Draf'}
              </Badge>
              {data.notulen.id === null ? <Badge tone="neutral">Belum ditulis</Badge> : null}
            </View>
            <Text style={[notulen.judul, { color: colors.text }]}>{data.meeting.title}</Text>
            <Meta>
              {tanggalDariYMD(data.meeting.occurrence_date)} · {jam(data.meeting.starts_at)}–
              {jam(data.meeting.ends_at)} WIB
              {data.notulen.saved_at ? ` · disimpan ${tanggalDariYMD(ymdJakarta(data.notulen.saved_at))}` : ''}
            </Meta>
          </View>

          {data.notulen.id === null ? (
            <Card>
              <EmptyState
                icon="document-text-outline"
                title="Notulen belum ditulis"
                description="Ini draf awal dari agenda. Notulis akan mengisinya setelah rapat."
              />
            </Card>
          ) : null}

          {/* Kehadiran */}
          <Card>
            <CardTitle>Kehadiran</CardTitle>
            <View style={{ gap: 0 }}>
              {data.notulen.attendance.map((tanda, indeks) => (
                <View key={tanda.user_id}>
                  {indeks > 0 ? <Divider /> : null}
                  <View style={notulen.barisHadir}>
                    <Ionicons
                      name={tanda.present ? 'checkmark-circle' : 'close-circle'}
                      size={18}
                      color={tanda.present ? colors.success : colors.danger}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[notulen.nama, { color: colors.text }]} numberOfLines={1}>
                        {namaOrang(tanda.user_id)}
                      </Text>
                      {!tanda.present && tanda.reason ? <Meta>{tanda.reason}</Meta> : null}
                    </View>
                  </View>
                </View>
              ))}
              {data.notulen.attendance.length === 0 ? <Meta>Belum ada catatan kehadiran.</Meta> : null}
            </View>
          </Card>

          {/* Seksi pembahasan */}
          <Card>
            <CardTitle>Pembahasan</CardTitle>
            {data.notulen.sections.length === 0 ? (
              <Meta>Tidak ada seksi.</Meta>
            ) : (
              <View style={{ gap: 12 }}>
                {data.notulen.sections.map((seksi, indeks) => (
                  <View key={`${indeks}-${seksi.title}`} style={{ gap: 4 }}>
                    <Text style={[notulen.judulSeksi, { color: colors.text }]}>
                      {indeks + 1}. {seksi.title}
                    </Text>
                    <Body muted>
                      {seksi.body.trim() === '' ? 'Tidak ada catatan.' : seksi.body}
                    </Body>
                  </View>
                ))}
              </View>
            )}
          </Card>

          {/* Keputusan */}
          <Card>
            <CardTitle>Keputusan</CardTitle>
            {data.notulen.decisions.length === 0 ? (
              <Meta>Belum ada keputusan.</Meta>
            ) : (
              <View style={{ gap: 6 }}>
                {data.notulen.decisions.map((keputusan, indeks) => (
                  <View key={`${indeks}-${keputusan.slice(0, 24)}`} style={notulen.barisKeputusan}>
                    <Ionicons name="checkmark-done-outline" size={16} color={colors.link} />
                    <Body muted style={{ flex: 1 }}>
                      {keputusan}
                    </Body>
                  </View>
                ))}
              </View>
            )}
          </Card>

          {/* Tindak lanjut */}
          <Card>
            <CardTitle>Tindak lanjut</CardTitle>
            {data.notulen.action_items.length === 0 ? (
              <Meta>Belum ada tindak lanjut.</Meta>
            ) : (
              <View style={{ gap: 0 }}>
                {data.notulen.action_items.map((tindak, indeks) => (
                  <View key={tindak.id}>
                    {indeks > 0 ? <Divider /> : null}
                    <View style={notulen.barisTindak}>
                      <Ionicons
                        name={tindak.done ? 'checkmark-circle' : 'ellipse-outline'}
                        size={18}
                        color={tindak.done ? colors.success : colors.subtle}
                      />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Body
                          muted={tindak.done}
                          style={[notulen.teksTindak, tindak.done && { textDecorationLine: 'line-through' }]}
                        >
                          {tindak.text}
                        </Body>
                        <View style={notulen.metaTindak}>
                          {tindak.task_key ? <Badge tone="primary">{tindak.task_key}</Badge> : null}
                          {tindak.due_date ? <Meta>tenggat {tanggalDariYMD(tindak.due_date)}</Meta> : null}
                        </View>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Card>

          <Meta style={{ textAlign: 'center' }}>
            {data.notulen.status === 'final' ? 'Notulen sudah difinalisasi.' : 'Notulen masih draf.'} Mengedit dan
            memfinalisasi dilakukan lewat RuangKerja web.
          </Meta>
        </Screen>
      ) : null}
    </View>
  );
}

const notulen = StyleSheet.create({
  punggung: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  judulAtas: { fontSize: 17, fontWeight: '700' },
  judul: { fontSize: 21, fontWeight: '800', lineHeight: 28 },
  lencanaBaris: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  barisHadir: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  nama: { fontSize: 14, fontWeight: '600' },
  judulSeksi: { fontSize: 15, fontWeight: '700', lineHeight: 21 },
  barisKeputusan: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  barisTindak: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingVertical: 4 },
  teksTindak: { fontSize: 14, lineHeight: 20 },
  metaTindak: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
});
