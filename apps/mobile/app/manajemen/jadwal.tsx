/**
 * Jadwal manajemen (mockup 08 › 26): rapat pimpinan baca saja untuk
 * Direksi/HR/Super Admin — tab Agenda (pengalih minggu + strip hari),
 * Notulen (filter), Tindak lanjut (Terlambat/Berjalan/Selesai). 403 → tanpa
 * akses; kosong; memuat; offline (data terakhir).
 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { jadwalManajemen, type JadwalManajemen, type Notulen, type RapatPimpinan } from '@/api/rapat';
import { BarisOrang, LencanaPlatform, StripHari } from '@/features/rapat/komponen';
import { bukaDetail, bukaNotulen } from '@/features/rapat/navigasi';
import { useMuat } from '@/features/rapat/useMuat';
import { hariSingkat, judulHari, namaDepan, rentangMinggu, seninDari, tambahHari, urai } from '@/features/rapat/util';
import { jam, ymdHariIni } from '@/lib/format';
import { useTheme } from '@/theme';
import { Badge, Banner, Card, Chip, EmptyState, ErrorState, Fab, Icon, IconButton, Loading, Pressable, Screen, SegmentedTabs, SubAppBar, Tag, Text, type Tone } from '@/ui';

type Tab = 'agenda' | 'notulen' | 'tindak';
type FilterNotulen = 'semua' | 'draf' | 'terbuka';
type FilterTindak = 'terlambat' | 'berjalan' | 'selesai';

function tanggalNotulen(n: Notulen, rapat: RapatPimpinan[]): string | null {
  const dariHref = /tanggal=(\d{4}-\d{2}-\d{2})/.exec(n.href)?.[1];
  if (dariHref) {
    return dariHref;
  }
  const cocok = rapat.filter((r) => r.id === n.meeting_id && r.minutes_status === n.status).sort((a, b) => b.occurrence_date.localeCompare(a.occurrence_date));
  return cocok[0]?.occurrence_date ?? null;
}

export default function LayarJadwalManajemen(): React.JSX.Element {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const hariIni = ymdHariIni();
  const [tab, setTab] = useState<Tab>('agenda');
  const [minggu, setMinggu] = useState(() => seninDari(hariIni));
  const [hari, setHari] = useState(hariIni);
  const [fNotulen, setFNotulen] = useState<FilterNotulen>('semua');
  const [fTindak, setFTindak] = useState<FilterTindak>('terlambat');

  const m = useMuat<JadwalManajemen>(`jadwal-manajemen:${minggu}`, () => jadwalManajemen(minggu));
  const d = m.data;

  const hariMinggu = useMemo(() => [0, 1, 2, 3, 4].map((n) => tambahHari(minggu, n)), [minggu]);
  const rapatMinggu = useMemo(() => (d?.meetings ?? []).filter((r) => r.occurrence_date >= minggu && r.occurrence_date <= tambahHari(minggu, 6)), [d, minggu]);
  const titik = useMemo(() => new Set(rapatMinggu.filter((r) => !r.canceled).map((r) => r.occurrence_date)), [rapatMinggu]);
  const hariAktif = hariMinggu.includes(hari) ? hari : (hariMinggu[0] ?? minggu);
  const rapatHari = rapatMinggu.filter((r) => r.occurrence_date === hariAktif).sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  const nama = (uid: string | null): string => (uid ? (d?.people.find((p) => p.id === uid)?.name ?? 'Karyawan') : '');
  const diundang = (r: RapatPimpinan): boolean => d !== null && (r.organizer_id === d.viewer_id || r.minute_taker_id === d.viewer_id || r.participants.some((p) => p.user_id === d.viewer_id));

  const notulen = useMemo(() => {
    const semua = (d?.minutes ?? []).map((n) => ({ n, tgl: tanggalNotulen(n, d?.meetings ?? []), rapat: (d?.meetings ?? []).find((r) => r.id === n.meeting_id) ?? null }));
    return semua
      .filter(({ n }) => (fNotulen === 'draf' ? n.status === 'draft' : fNotulen === 'terbuka' ? n.action_items.some((a) => !a.done) : true))
      .sort((a, b) => (b.tgl ?? '').localeCompare(a.tgl ?? ''));
  }, [d, fNotulen]);

  const tindak = useMemo(() => {
    const semua = (d?.minutes ?? []).flatMap((n) => n.action_items.map((a) => ({ a, n })));
    const telat = semua.filter(({ a }) => !a.done && a.due_date !== null && a.due_date < hariIni);
    const jalan = semua.filter(({ a }) => !a.done && !(a.due_date !== null && a.due_date < hariIni));
    const selesai = semua.filter(({ a }) => a.done);
    return { telat, jalan, selesai };
  }, [d, hariIni]);

  if (m.status === 'terlarang') {
    return (
      <Screen header={<SubAppBar title="Jadwal manajemen" />}>
        <EmptyState icon="lock" title="Anda tidak punya akses" description="Jadwal manajemen hanya untuk Direksi, HR, dan Super Admin. Rapat pimpinan yang Anda ikuti tetap ada di Rapat." actionLabel="Kembali ke Rapat" onAction={() => router.replace('/rapat')} />
      </Screen>
    );
  }
  if (m.status === 'mati') {
    return (
      <Screen header={<SubAppBar title="Jadwal manajemen" />}>
        <EmptyState icon="calendar-off" title="Rapat belum diaktifkan" description="Fitur rapat sedang tidak tersedia di server. Gunakan RuangKerja web atau hubungi admin." actionLabel="Kembali" onAction={() => router.back()} />
      </Screen>
    );
  }

  let isi: React.ReactNode;
  if (!d) {
    isi = m.status === 'memuat' ? <Loading label="Memuat jadwal…" /> : <ErrorState kind={m.status === 'offline' ? 'offline' : 'umum'} title="Jadwal tidak dapat dimuat" message={m.galat?.message ?? 'Coba lagi beberapa saat.'} onRetry={() => void m.muat()} />;
  } else if (tab === 'agenda') {
    isi = (
      <>
        <View style={s.navigasi}>
          <IconButton icon="chevron-left" label="Minggu sebelumnya" onPress={() => { const b = tambahHari(minggu, -7); setMinggu(b); setHari(b); }} />
          <Text variant="label" align="center" style={{ flex: 1 }}>
            {rentangMinggu(minggu)}
          </Text>
          <IconButton icon="chevron-right" label="Minggu berikutnya" onPress={() => { const b = tambahHari(minggu, 7); setMinggu(b); setHari(b); }} />
        </View>
        <StripHari hari={hariMinggu} terpilih={hariAktif} hariIni={hariIni} titik={titik} onPilih={setHari} />
        <Text variant="meta">{`Rapat pimpinan minggu ini · ${hariSingkat(minggu).replace(/,.*/, '')} ${urai(minggu).d} – ${hariSingkat(tambahHari(minggu, 4))}`}</Text>
        {rapatMinggu.length === 0 ? (
          <EmptyState icon="calendar-check" title="Tidak ada rapat pimpinan" description={'Jadwalkan rapat dan nyalakan "Rapat pimpinan" agar tampil di sini.'} actionLabel="Jadwalkan" onAction={() => router.push('/rapat/baru' as never)} />
        ) : rapatHari.length === 0 ? (
          <Text variant="meta">{`Tidak ada rapat pimpinan pada ${judulHari(hariAktif)}.`}</Text>
        ) : (
          <Card variant="flat" style={{ padding: 0, overflow: 'hidden' }}>
            {rapatHari.map((r, i) => {
              const ikut = diundang(r);
              return (
                <Pressable key={`${r.id}:${r.occurrence_date}`} onPress={() => bukaDetail(r.id, r.occurrence_date)} scaleTo={1} accessibilityRole="button" accessibilityLabel={r.title} style={[s.baris, i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider } : null]}>
                  <View style={{ width: 56, gap: 2, alignSelf: 'flex-start' }}>
                    <Text variant="title" weight={700}>
                      {jam(r.starts_at)}
                    </Text>
                    <Text variant="meta">{jam(r.ends_at)}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text variant="title" style={r.canceled ? { textDecorationLine: 'line-through', color: colors.muted } : null}>
                      {r.title}
                    </Text>
                    <View style={s.bungkus}>
                      <LencanaPlatform platform={r.platform} />
                      {r.location ? <Text variant="meta">{r.location}</Text> : null}
                    </View>
                    <View style={s.bungkus}>
                      <Badge tone="info" dot={false}>
                        Rapat pimpinan
                      </Badge>
                      {r.canceled ? <Badge tone="danger">Dibatalkan</Badge> : null}
                      {r.minutes_status === 'draft' ? <Badge tone="warning">Notulen draf</Badge> : r.minutes_status === 'final' ? <Badge tone="success">Notulen final</Badge> : r.minute_taker_id ? <Text variant="meta">{`Notulis: ${namaDepan(nama(r.minute_taker_id))}`}</Text> : null}
                      {!ikut ? <Text variant="meta">Anda tidak diundang · lihat saja</Text> : null}
                    </View>
                  </View>
                  <Icon name="chevron-right" size={20} color={colors.muted} />
                </Pressable>
              );
            })}
          </Card>
        )}
        <Text variant="meta" align="center">
          Baca saja untuk rapat yang tidak Anda ikuti.
        </Text>
      </>
    );
  } else if (tab === 'notulen') {
    isi = (
      <>
        <View style={s.bungkus}>
          <Chip label="Semua" selected={fNotulen === 'semua'} onPress={() => setFNotulen('semua')} />
          <Chip label="Draf" selected={fNotulen === 'draf'} onPress={() => setFNotulen('draf')} />
          <Chip label="Tindak lanjut terbuka" selected={fNotulen === 'terbuka'} onPress={() => setFNotulen('terbuka')} />
        </View>
        {notulen.length === 0 ? <EmptyState icon="file-text" title="Belum ada notulen" description="Notulen rapat pimpinan 4 minggu terakhir tampil di sini." /> : null}
        {notulen.map(({ n, tgl, rapat }) => {
          const terbuka = n.action_items.filter((a) => !a.done).length;
          const telat = n.action_items.filter((a) => !a.done && a.due_date !== null && a.due_date < hariIni).length;
          const ringkas = n.action_items.length === 0 ? 'Tanpa tindak lanjut' : terbuka === 0 ? 'Semua selesai' : `${n.action_items.length} butir · ${telat ? `${telat} terlambat` : `${terbuka} terbuka`}`;
          return (
            <Card key={n.id ?? `${n.meeting_id}-${tgl}`} style={{ gap: 8 }}>
              <View style={s.barisAtas}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="title">{`${rapat?.title ?? n.meeting_key}${tgl ? ` · ${urai(tgl).d} ${hariSingkat(tgl).split(' ')[2] ?? ''}` : ''}`}</Text>
                  <Text variant="meta">{n.status === 'final' ? `Final${n.finalized_at ? ` · ${jam(n.finalized_at)}` : ''}` : `Draf${n.saved_at ? ` · diperbarui ${hariSingkat(n.saved_at.slice(0, 10))} ${jam(n.saved_at)}` : ''}`}</Text>
                </View>
                <Badge tone={n.status === 'final' ? 'success' : 'warning'}>{n.status === 'final' ? 'Final' : 'Draf'}</Badge>
              </View>
              <View style={s.barisAtas}>
                <Text variant="meta" tone={telat ? 'danger' : 'muted'} style={{ flex: 1 }}>
                  {ringkas}
                </Text>
                <Pressable onPress={() => bukaNotulen(n.meeting_id, tgl)} accessibilityRole="button" accessibilityLabel="Buka notulen" hitSlop={8}>
                  <Text variant="label" tone="link">
                    Buka notulen
                  </Text>
                </Pressable>
              </View>
            </Card>
          );
        })}
      </>
    );
  } else {
    const daftar = fTindak === 'terlambat' ? tindak.telat : fTindak === 'berjalan' ? tindak.jalan : tindak.selesai;
    const nada: Record<FilterTindak, Tone> = { terlambat: 'danger', berjalan: 'info', selesai: 'success' };
    isi = (
      <>
        <View style={s.bungkus}>
          <Chip label="Terlambat" count={tindak.telat.length} selected={fTindak === 'terlambat'} onPress={() => setFTindak('terlambat')} />
          <Chip label="Berjalan" count={tindak.jalan.length} selected={fTindak === 'berjalan'} onPress={() => setFTindak('berjalan')} />
          <Chip label="Selesai" count={tindak.selesai.length} selected={fTindak === 'selesai'} onPress={() => setFTindak('selesai')} />
        </View>
        {daftar.length === 0 ? (
          <EmptyState icon="list-checks" title="Tidak ada tindak lanjut" description="Tidak ada butir pada kelompok ini." />
        ) : (
          <Card style={{ gap: 0 }}>
            {daftar.map(({ a, n }, i) => {
              const hariTelat = a.due_date && !a.done && a.due_date < hariIni ? Math.round((Date.parse(`${hariIni}T00:00:00Z`) - Date.parse(`${a.due_date}T00:00:00Z`)) / 86_400_000) : 0;
              return (
                <Pressable key={a.id} onPress={() => bukaNotulen(n.meeting_id, tanggalNotulen(n, d.meetings))} scaleTo={1} accessibilityRole="button" accessibilityLabel={a.text}>
                  <BarisOrang
                    nama={a.text}
                    sub={`${a.assignee_id ? nama(a.assignee_id) : 'PIC belum dipilih'}${hariTelat ? ` · terlambat ${hariTelat} hari` : a.due_date ? ` · ${hariSingkat(a.due_date)}` : ''}`}
                    divider={i > 0}
                    kanan={a.task_key ? <Tag tone="info">{a.task_key}</Tag> : <Badge tone={nada[fTindak]}>{fTindak === 'terlambat' ? 'Terlambat' : fTindak === 'berjalan' ? 'Berjalan' : 'Selesai'}</Badge>}
                  />
                </Pressable>
              );
            })}
          </Card>
        )}
        <Text variant="meta" align="center">
          Dari rapat pimpinan 4 minggu ke belakang sampai akhir minggu ini. Anda melihat, tidak mengubah.
        </Text>
      </>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen header={<SubAppBar title="Jadwal manajemen" />} refreshing={m.menyegarkan} onRefresh={() => void m.muat()} contentStyle={{ paddingBottom: insets.bottom + 110 }}>
        {m.dariCache !== null ? <Banner tone="neutral" icon="cloud-off" message={`Tanpa koneksi · data terakhir ${jam(new Date(m.dariCache))}.`} /> : null}
        <SegmentedTabs<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'agenda', label: 'Agenda' },
            { value: 'notulen', label: 'Notulen' },
            { value: 'tindak', label: 'Tindak lanjut' },
          ]}
        />
        {isi}
      </Screen>
      {tab === 'agenda' ? <Fab extended label="Jadwalkan" icon="plus" onPress={() => router.push('/rapat/baru' as never)} style={{ position: 'absolute', right: 16, bottom: insets.bottom + 16 }} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  navigasi: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  baris: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  barisAtas: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bungkus: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
});

