/**
 * Agenda rapat (mockup 08 › 01–03): segmented Hari ini · Minggu ini · Akan
 * datang, strip hari, kartu sorotan "Rapat berikutnya"/"Sedang berlangsung",
 * baris rapat (platform, RSVP, notulen, seri), lembar filter, FAB Jadwalkan.
 * Keadaan: memuat, kosong, galat, offline (data tersimpan), fitur mati (404).
 */
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { agendaRapat } from '@/api/endpoints';
import type { MeetingAgenda, MeetingItem } from '@/api/types';
import { FILTER_AWAL, FilterAgenda, filterAktif, terapkanFilter, type FilterRapat } from '@/features/rapat/FilterAgenda';
import { BarisRapat, StripHari } from '@/features/rapat/komponen';
import { bukaDetail, bukaNotulen, bukaTautan, useBukaPraGabung } from '@/features/rapat/navigasi';
import { useMuat } from '@/features/rapat/useMuat';
import { PUTIH, faseRapat, judulHari, rentangJam, seninDari, tambahHari, teksSelang } from '@/features/rapat/util';
import { jam, ymdHariIni } from '@/lib/format';
import { radius, useTheme } from '@/theme';
import { Banner, Card, EmptyState, ErrorState, Fab, Gradient, Icon, Loading, Pressable, Screen, SegmentedTabs, SubAppBar, Text, useSnackbar } from '@/ui';
import { useSession } from '@/session/SessionProvider';

type Tab = 'hari-ini' | 'minggu-ini' | 'akan-datang';

function useSekarang(): number {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setT(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  return t;
}

function KartuSorotan({ item, sekarang, onBuka }: { item: MeetingItem; sekarang: number; onBuka: () => void }): React.JSX.Element {
  const { colors, shadows } = useTheme();
  const snackbar = useSnackbar();
  const bukaPraGabung = useBukaPraGabung();
  const fase = faseRapat(item.starts_at, item.ends_at, sekarang);
  const berlangsung = fase === 'berlangsung';
  const mulai = new Date(item.starts_at).getTime();
  const overline = berlangsung ? `SEDANG BERLANGSUNG · ${Math.max(1, Math.round((sekarang - mulai) / 60_000))} MNT` : `MULAI ${teksSelang(mulai - sekarang).toUpperCase()} LAGI`;
  const video = item.platform === 'video';
  const tautan = item.join_url;

  function gabung(): void {
    if (video) {
      bukaPraGabung(item.id, item.occurrence_date);
    } else if (tautan) {
      void bukaTautan(tautan).then((ok) => {
        if (!ok) {
          snackbar.show({ message: 'Tautan tidak bisa dibuka di perangkat ini.', variant: 'bad' });
        }
      });
    } else {
      onBuka();
    }
  }

  const labelGabung = video ? (berlangsung ? 'Gabung sekarang' : 'Gabung rapat video') : tautan ? (berlangsung ? 'Gabung sekarang' : `Buka ${item.platform_label}`) : 'Lihat detail';
  const sub = `${rentangJam(item.starts_at, item.ends_at)} WIB · ${item.peserta_count} peserta`;

  return (
    <Pressable onPress={onBuka} scaleTo={0.99} accessibilityRole="button" accessibilityLabel={`${item.title}. ${overline.toLowerCase()}`} style={[s.sorotan, { boxShadow: berlangsung ? shadows.warm : shadows.glow }]}>
      <Gradient name={berlangsung ? 'hangat' : 'aksi'} style={StyleSheet.absoluteFill} />
      <View style={s.overline}>
        <Icon name={berlangsung ? 'radio' : 'clock'} size={16} color={PUTIH} />
        <Text variant="meta" weight={700} style={{ color: PUTIH, letterSpacing: 0.6 }}>
          {overline}
        </Text>
      </View>
      <Text variant="h2" style={{ color: PUTIH }} numberOfLines={2}>
        {item.title}
      </Text>
      <Text variant="body" style={{ color: PUTIH, opacity: 0.92, fontSize: 15 }}>
        {sub}
      </Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable onPress={gabung} accessibilityRole="button" accessibilityLabel={labelGabung} style={[s.tombolPutih, { flex: 1 }]}>
          <Icon name={video || tautan ? 'video' : 'chevron-right'} size={20} color={berlangsung ? colors.danger : colors.link} />
          <Text variant="label" tone={berlangsung ? 'danger' : 'link'}>
            {labelGabung}
          </Text>
        </Pressable>
        {!berlangsung && item.minutes_status !== 'none' ? (
          <Pressable onPress={() => bukaNotulen(item.id, item.occurrence_date)} accessibilityRole="button" accessibilityLabel="Notulen" style={s.tombolKaca}>
            <Icon name="file-text" size={20} color={PUTIH} />
            <Text variant="label" style={{ color: PUTIH }}>
              Notulen
            </Text>
          </Pressable>
        ) : null}
      </View>
      {!berlangsung && video ? (
        <Text variant="meta" style={{ color: PUTIH, opacity: 0.9 }}>
          Ruang dibuka {jam(new Date(mulai - 15 * 60_000))} · hitung mundur otomatis
        </Text>
      ) : null}
    </Pressable>
  );
}

export default function LayarAgendaRapat(): React.JSX.Element {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const viewerId = user?.id ?? null;
  const sekarang = useSekarang();
  const hariIni = ymdHariIni();
  const [tab, setTab] = useState<Tab>('hari-ini');
  const [hariTerpilih, setHariTerpilih] = useState(hariIni);
  const [filter, setFilter] = useState<FilterRapat>(FILTER_AWAL);
  const [lembarFilter, setLembarFilter] = useState(false);

  const rentang = tab === 'akan-datang' ? 'akan-datang' : 'minggu-ini';
  const m = useMuat<MeetingAgenda>(`agenda:${rentang}`, () => agendaRapat(rentang));
  const semua = useMemo(() => m.data?.items ?? [], [m.data]);
  const tersaring = useMemo(() => terapkanFilter(semua, filter, viewerId), [semua, filter, viewerId]);

  const senin = seninDari(hariIni);
  const titik = useMemo(() => new Set(semua.filter((i) => !i.canceled).map((i) => i.occurrence_date)), [semua]);
  const hariStrip = useMemo(() => {
    const dasar = [0, 1, 2, 3, 4].map((n) => tambahHari(senin, n));
    for (const n of [5, 6]) {
      const ymd = tambahHari(senin, n);
      if (titik.has(ymd)) {
        dasar.push(ymd);
      }
    }
    return dasar;
  }, [senin, titik]);

  const hariAktif = tab === 'hari-ini' ? hariIni : hariTerpilih;
  const daftarHari = useMemo(() => tersaring.filter((i) => i.occurrence_date === hariAktif).sort((a, b) => a.starts_at.localeCompare(b.starts_at)), [tersaring, hariAktif]);

  const sorotan = useMemo(() => {
    if (tab !== 'hari-ini') {
      return null;
    }
    return semua.filter((i) => i.occurrence_date === hariIni && !i.canceled && new Date(i.ends_at).getTime() > sekarang).sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0] ?? null;
  }, [semua, tab, hariIni, sekarang]);

  const kelompokAkan = useMemo(() => {
    const peta = new Map<string, MeetingItem[]>();
    for (const i of [...tersaring].sort((a, b) => a.starts_at.localeCompare(b.starts_at))) {
      peta.set(i.occurrence_date, [...(peta.get(i.occurrence_date) ?? []), i]);
    }
    return [...peta.entries()];
  }, [tersaring]);

  const header = (
    <SubAppBar
      title="Rapat"
      actions={[
        { icon: 'calendar-days', label: 'Kalender', onPress: () => router.push('/kalender') },
        { icon: 'sliders-horizontal', label: filterAktif(filter) ? 'Filter agenda, aktif' : 'Filter agenda', onPress: () => setLembarFilter(true), badge: filterAktif(filter) ? true : undefined },
      ]}
    />
  );

  if (m.status === 'mati') {
    return (
      <Screen header={<SubAppBar title="Rapat" />}>
        <EmptyState icon="calendar-off" title="Rapat belum diaktifkan" description="Fitur rapat sedang tidak tersedia di server. Gunakan RuangKerja web atau hubungi admin." actionLabel="Kembali" onAction={() => router.back()} />
      </Screen>
    );
  }

  const isiDaftar = (items: MeetingItem[]): React.JSX.Element => (
    <Card variant="flat" style={{ padding: 0, overflow: 'hidden' }}>
      {items.map((item, i) => (
        <BarisRapat key={`${item.id}:${item.occurrence_date}`} item={item} viewerId={viewerId} sekarang={sekarang} divider={i > 0} onPress={() => bukaDetail(item.id, item.occurrence_date)} />
      ))}
    </Card>
  );

  let konten: React.ReactNode;
  if (m.status === 'memuat') {
    konten = <Loading label="Memuat agenda…" />;
  } else if (m.status === 'galat' || m.status === 'offline' || m.status === 'terlarang') {
    konten = <ErrorState kind={m.status === 'offline' ? 'offline' : 'umum'} title="Agenda tidak dapat dimuat" message={m.status === 'offline' ? 'Tanpa koneksi dan belum ada agenda tersimpan. Coba lagi saat tersambung.' : (m.galat?.message ?? 'Server tidak merespons. Periksa jaringan Anda lalu coba lagi.')} onRetry={() => void m.muat()} />;
  } else if (tab === 'akan-datang') {
    konten = (
      <>
        <Text variant="meta" align="center">
          30 hari ke depan · {tersaring.length} rapat
        </Text>
        {kelompokAkan.length === 0 ? (
          <EmptyState icon="calendar-search" title={filterAktif(filter) ? 'Tidak ada rapat yang cocok' : 'Belum ada rapat'} description={filterAktif(filter) ? 'Ubah atau atur ulang filter.' : 'Tidak ada rapat untuk Anda dalam 30 hari ke depan.'} actionLabel={filterAktif(filter) ? 'Atur ulang filter' : 'Jadwalkan'} onAction={filterAktif(filter) ? () => setFilter(FILTER_AWAL) : () => router.push('/rapat/baru' as never)} />
        ) : (
          kelompokAkan.map(([ymd, items]) => (
            <View key={ymd} style={{ gap: 10 }}>
              <Text variant="overline" tone={ymd === hariIni ? 'link' : 'muted'}>
                {judulHari(ymd).toUpperCase()}
                {ymd === hariIni ? ' · HARI INI' : ''}
              </Text>
              {isiDaftar(items)}
            </View>
          ))
        )}
        {kelompokAkan.length > 0 ? (
          <Text variant="meta" align="center">
            Rentang &quot;Akan datang&quot; mencakup 30 hari ke depan.
          </Text>
        ) : null}
      </>
    );
  } else {
    const kosong = daftarHari.length === 0;
    konten = (
      <>
        <StripHari
          hari={hariStrip}
          terpilih={hariAktif}
          hariIni={hariIni}
          titik={titik}
          onPilih={(ymd) => {
            setHariTerpilih(ymd);
            if (ymd !== hariIni) {
              setTab('minggu-ini');
            }
          }}
        />
        {sorotan ? <KartuSorotan item={sorotan} sekarang={sekarang} onBuka={() => bukaDetail(sorotan.id, sorotan.occurrence_date)} /> : null}
        {kosong ? (
          filterAktif(filter) ? (
            <EmptyState icon="filter-x" title="Tidak ada rapat yang cocok" description="Ubah atau atur ulang filter." actionLabel="Atur ulang filter" onAction={() => setFilter(FILTER_AWAL)} />
          ) : (
            <EmptyState
              icon="calendar-check"
              title={hariAktif === hariIni ? 'Tidak ada rapat hari ini' : `Tidak ada rapat ${judulHari(hariAktif)}`}
              description={'Tidak ada rapat untuk Anda hari ini. Lihat "Akan datang" atau jadwalkan rapat baru.'}
              actionLabel="Lihat akan datang"
              onAction={() => setTab('akan-datang')}
            />
          )
        ) : (
          <>
            <View style={s.kepalaHari}>
              <Text variant="h3" style={{ flex: 1 }}>
                {judulHari(hariAktif)}
              </Text>
              <Text variant="meta">{daftarHari.length} rapat</Text>
            </View>
            {isiDaftar(daftarHari)}
          </>
        )}
        <Text variant="meta" align="center">
          Tarik ke bawah untuk menyegarkan
        </Text>
      </>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen header={header} refreshing={m.menyegarkan} onRefresh={() => void m.muat()} contentStyle={{ paddingBottom: insets.bottom + 110 }}>
        {m.dariCache !== null ? (
          <Banner tone="neutral" icon="cloud-off" message={`Tanpa koneksi. Menampilkan agenda terakhir (${jam(new Date(m.dariCache))}). Gabung video dan jawaban kehadiran butuh jaringan.`} />
        ) : null}
        <SegmentedTabs<Tab>
          value={tab}
          onChange={(t) => {
            setTab(t);
            if (t === 'hari-ini') {
              setHariTerpilih(hariIni);
            }
          }}
          options={[
            { value: 'hari-ini', label: 'Hari ini' },
            { value: 'minggu-ini', label: 'Minggu ini' },
            { value: 'akan-datang', label: 'Akan datang' },
          ]}
        />
        {konten}
      </Screen>
      <Fab extended label="Jadwalkan" icon="plus" onPress={() => router.push('/rapat/baru' as never)} style={{ position: 'absolute', right: 16, bottom: insets.bottom + 16 }} />
      <FilterAgenda visible={lembarFilter} onClose={() => setLembarFilter(false)} nilai={filter} onTerapkan={setFilter} items={semua.filter((i) => tab !== 'hari-ini' || i.occurrence_date === hariIni)} viewerId={viewerId} />
    </View>
  );
}

const s = StyleSheet.create({
  sorotan: { borderRadius: radius.card, padding: 20, gap: 10, overflow: 'hidden' },
  overline: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)' },
  tombolPutih: { minHeight: 52, borderRadius: radius.control, backgroundColor: PUTIH, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14 },
  tombolKaca: { minHeight: 52, borderRadius: radius.control, backgroundColor: 'rgba(255,255,255,0.2)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  kepalaHari: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
