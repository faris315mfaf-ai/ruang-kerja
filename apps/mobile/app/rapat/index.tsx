/**
 * Agenda rapat — segmented Hari ini · Minggu ini · Akan datang (rentang
 * endpoint /rapat). Baris: judul, tanggal kemunculan + jam WIB, platform/
 * lokasi, penyelenggara, lencana RSVP saya + status notulen + batal.
 * Flag features.meetings mati (404) → layar kosong ramah.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { agendaRapat } from '@/api/endpoints';
import type { MeetingItem, RentangRapat } from '@/api/types';
import { Badge, Card, EmptyState, ErrorState, Loading, Meta, Screen, Segmented } from '@/components/ui';
import { jam, tanggalDariYMD } from '@/lib/format';
import { LABEL_NOTULEN, LABEL_RSVP, TONE_NOTULEN, TONE_RSVP, labelPengulangan } from '@/lib/rapat';
import { useTheme } from '@/lib/theme';

function BarisRapat({ item, onTekan }: { item: MeetingItem; onTekan: () => void }): React.JSX.Element {
  const { colors } = useTheme();
  const sub = [
    `${tanggalDariYMD(item.occurrence_date)} · ${jam(item.starts_at)}–${jam(item.ends_at)} WIB`,
    item.location ? `${item.platform_label} · ${item.location}` : item.platform_label,
    item.organizer.name ? `Oleh ${item.organizer.name}` : null,
  ]
    .filter((bagian): bagian is string => bagian !== null)
    .join(' · ');

  return (
    <Card onPress={onTekan} accessibilityLabel={`Rapat ${item.title}, ${jam(item.starts_at)} WIB`} style={gaya.kartu}>
      <View style={gaya.kepala}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[gaya.judul, { color: colors.text }]} numberOfLines={2}>
            {item.title}
          </Text>
          <Meta numberOfLines={2}>{sub}</Meta>
        </View>
        {item.rsvp_saya !== null ? (
          <Badge tone={TONE_RSVP[item.rsvp_saya]}>{LABEL_RSVP[item.rsvp_saya]}</Badge>
        ) : null}
      </View>
      <View style={gaya.lencana}>
        {item.canceled ? <Badge tone="danger">Dibatalkan</Badge> : null}
        {item.minutes_status !== 'none' ? (
          <Badge tone={TONE_NOTULEN[item.minutes_status]}>{LABEL_NOTULEN[item.minutes_status]}</Badge>
        ) : null}
        {labelPengulangan(item.recurrence, item.recurrence_until) ? (
          <Badge tone="neutral">{labelPengulangan(item.recurrence, item.recurrence_until)}</Badge>
        ) : null}
        <Meta>{item.peserta_count} peserta</Meta>
      </View>
    </Card>
  );
}

export default function LayarAgendaRapat(): React.JSX.Element {
  const { colors } = useTheme();
  const [rentang, setRentang] = useState<RentangRapat>('minggu-ini');
  const [items, setItems] = useState<MeetingItem[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [menyegarkan, setMenyegarkan] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [mati, setMati] = useState(false);

  // Request id: a slower response for an earlier range must not override a newer one.
  const permintaan = useRef(0);

  const muat = useCallback(
    async (pilih: RentangRapat, diam: boolean): Promise<void> => {
      const idMuat = ++permintaan.current;
      if (!diam) {
        setMemuat(true);
      }
      setGalat(null);
      try {
        const hasil = await agendaRapat(pilih);
        if (idMuat !== permintaan.current) {
          return;
        }
        setItems(hasil.items);
        setMati(false);
      } catch (err) {
        if (idMuat !== permintaan.current) {
          return;
        }
        if (err instanceof ApiError && err.status === 404) {
          setMati(true);
          setItems([]);
        } else {
          setGalat(err instanceof ApiError ? err.message : 'Tidak dapat memuat agenda.');
          if (!diam) {
            setItems([]);
          }
        }
      } finally {
        if (idMuat === permintaan.current) {
          setMemuat(false);
          setMenyegarkan(false);
        }
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      void muat(rentang, false);
    }, [muat, rentang]),
  );

  const keDetail = (item: MeetingItem): void => {
    router.push({
      pathname: '/rapat/[id]/index',
      params: { id: item.id, tanggal: item.occurrence_date, judul: item.title },
    });
  };

  if (mati) {
    return (
      <Screen>
        <Text style={[gaya.judulLayar, { color: colors.text }]}>Rapat</Text>
        <EmptyState
          icon="cloud-offline-outline"
          title="Rapat belum diaktifkan"
          description="Fitur rapat sedang tidak tersedia di server. Silakan gunakan RuangKerja web atau hubungi admin."
        />
      </Screen>
    );
  }

  return (
    <Screen
      refreshing={menyegarkan}
      onRefresh={() => {
        setMenyegarkan(true);
        void muat(rentang, true);
      }}
    >
      <Text style={[gaya.judulLayar, { color: colors.text }]}>Rapat</Text>
      <Segmented<RentangRapat>
        value={rentang}
        onChange={(nilai) => {
          setRentang(nilai);
          void muat(nilai, false);
        }}
        options={[
          { value: 'hari-ini', label: 'Hari ini' },
          { value: 'minggu-ini', label: 'Minggu ini' },
          { value: 'akan-datang', label: 'Akan datang' },
        ]}
      />

      {memuat && items.length === 0 ? (
        <Loading label="Memuat agenda…" />
      ) : galat && items.length === 0 ? (
        <ErrorState
          message={galat}
          onRetry={() => {
            void muat(rentang, false);
          }}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon="calendar-clear-outline"
          title="Tidak ada rapat"
          description={
            rentang === 'hari-ini'
              ? 'Tidak ada rapat untuk Anda hari ini.'
              : rentang === 'minggu-ini'
                ? 'Tidak ada rapat untuk Anda pekan ini.'
                : 'Tidak ada rapat yang akan datang dalam 30 hari.'
          }
        />
      ) : (
        <>
          {galat ? <Meta>{galat}</Meta> : null}
          <View style={{ gap: 10 }}>
            {items.map((item) => (
              <BarisRapat key={item.key} item={item} onTekan={() => keDetail(item)} />
            ))}
          </View>
          <Meta style={{ textAlign: 'center' }}>Rentang &quot;Akan datang&quot; mencakup 30 hari ke depan.</Meta>
        </>
      )}
    </Screen>
  );
}

const gaya = StyleSheet.create({
  judulLayar: { fontSize: 26, fontWeight: '800', marginBottom: 2 },
  kartu: { padding: 14 },
  kepala: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  judul: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  lencana: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
});
