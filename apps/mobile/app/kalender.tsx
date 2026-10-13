/**
 * Kalender (mockup 08 › 04–05): Minggu (strip 7 hari + agenda hari) dan
 * Bulan (kisi + titik per lapisan + agenda hari terpilih), lapisan Rapat ·
 * Tenggat tugas · Cuti & izin · Libur (disaring di klien), banner Google
 * Calendar ditahan. Keadaan: memuat, galat, offline (data tersimpan), 404.
 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { kalenderBulan } from '@/api/endpoints';
import type { CalendarEntry, CalendarLayer, CalendarMonth } from '@/api/types';
import { useMuat } from '@/features/rapat/useMuat';
import { PUTIH, hariIso, judulHari, keYmd, namaHariSingkat, namaBulan, rentangMinggu, seninDari, tambahHari, urai } from '@/features/rapat/util';
import { jam, ymdHariIni } from '@/lib/format';
import { radius, useTheme, type Colors } from '@/theme';
import { Banner, BottomSheet, Card, EmptyState, ErrorState, Gradient, Icon, IconButton, Loading, Pressable, Screen, SegmentedTabs, SubAppBar, Switch, Tag, Text, tanggal, useSnackbar, type Tone } from '@/ui';

type Mode = 'minggu' | 'bulan';

const LAPISAN: { kode: CalendarLayer; label: string; legenda: string; desk: string }[] = [
  { kode: 'meetings', label: 'Rapat', legenda: 'Rapat', desk: 'Rapat yang Anda ikuti' },
  { kode: 'tasks', label: 'Tenggat tugas', legenda: 'Tenggat', desk: 'Tugas terbuka milik Anda' },
  { kode: 'leave', label: 'Cuti & izin', legenda: 'Cuti/izin', desk: 'Disetujui; Kepala Divisi juga melihat divisinya' },
  { kode: 'holidays', label: 'Libur', legenda: 'Libur', desk: 'Libur nasional & cuti bersama' },
];

function warnaLapisan(colors: Colors, kode: CalendarLayer): string {
  switch (kode) {
    case 'meetings':
      return colors.fill.teal;
    case 'tasks':
      return colors.fill.warning;
    case 'leave':
      return colors.accentBlue;
    default:
      return colors.fill.danger;
  }
}

function tagEntri(e: CalendarEntry): { label: string; tone: Tone } {
  switch (e.layer) {
    case 'meetings':
      return { label: 'Rapat', tone: 'primary' };
    case 'tasks':
      return e.overdue ? { label: 'Terlambat', tone: 'danger' } : { label: 'Tenggat', tone: 'warning' };
    case 'leave':
      return { label: 'Cuti disetujui', tone: 'info' };
    default:
      return { label: 'Libur', tone: 'danger' };
  }
}

/** Entri berlaku pada tanggal (cuti multi-hari memakai `end_date`). */
function berlaku(e: CalendarEntry, ymd: string): boolean {
  return e.end_date ? e.date <= ymd && ymd <= e.end_date : e.date === ymd;
}

function aksiEntri(e: CalendarEntry): (() => void) | undefined {
  if (e.layer === 'meetings') {
    const [rapatId, tgl] = e.id.replace(/^meeting-/, '').split(':');
    if (!rapatId) {
      return undefined;
    }
    return () => router.push({ pathname: '/rapat/[id]', params: tgl ? { id: rapatId, tanggal: tgl } : { id: rapatId } } as never);
  }
  if (e.layer === 'tasks') {
    const tugasId = e.id.replace(/^task-/, '');
    return tugasId ? () => router.push(`/tugas/${tugasId}` as never) : undefined;
  }
  return undefined;
}

function DaftarEntri({ entri }: { entri: CalendarEntry[] }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <Card variant="flat" style={{ padding: 0, overflow: 'hidden' }}>
      {entri.map((e, i) => {
        const tag = tagEntri(e);
        const aksi = aksiEntri(e);
        const isi = (
          <>
            <View style={[s.garis, { backgroundColor: e.overdue ? colors.danger : warnaLapisan(colors, e.layer) }]} />
            <View style={{ flex: 1, gap: 6 }}>
              <Text variant="title" numberOfLines={2}>
                {e.title}
              </Text>
              <View style={s.bungkus}>
                <Tag tone={tag.tone}>{tag.label}</Tag>
                {e.meta ? (
                  <Text variant="meta" numberOfLines={1} style={{ flexShrink: 1 }}>
                    {e.meta}
                  </Text>
                ) : null}
              </View>
            </View>
            {aksi ? <Icon name="chevron-right" size={20} color={colors.muted} /> : null}
          </>
        );
        const gaya = [s.baris, i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider } : null];
        return aksi ? (
          <Pressable key={`${e.id}-${i}`} onPress={aksi} scaleTo={1} accessibilityRole="button" accessibilityLabel={`${tag.label}: ${e.title}`} style={gaya}>
            {isi}
          </Pressable>
        ) : (
          <View key={`${e.id}-${i}`} style={gaya} accessible accessibilityLabel={`${tag.label}: ${e.title}`}>
            {isi}
          </View>
        );
      })}
    </Card>
  );
}

function Titik({ warna }: { warna: string[] }): React.JSX.Element {
  return (
    <View style={s.titikBaris}>
      {warna.slice(0, 3).map((w, i) => (
        <View key={`${w}-${i}`} style={[s.titik, { backgroundColor: w }]} />
      ))}
    </View>
  );
}

export default function LayarKalender(): React.JSX.Element {
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const hariIni = ymdHariIni();
  const [mode, setMode] = useState<Mode>('minggu');
  const [terpilih, setTerpilih] = useState(hariIni);
  const [bulanTampil, setBulanTampil] = useState(() => hariIni.slice(0, 7));
  const [aktif, setAktif] = useState<Set<CalendarLayer>>(() => new Set(['meetings', 'tasks', 'leave', 'holidays']));
  const [lembar, setLembar] = useState(false);

  const senin = seninDari(terpilih);
  const bulan = mode === 'minggu' ? tambahHari(senin, 3).slice(0, 7) : bulanTampil;
  const m = useMuat<CalendarMonth>(`kalender:${bulan}`, () => kalenderBulan(bulan));
  const entri = useMemo(() => m.data?.entries ?? [], [m.data]);
  const tampak = useMemo(() => entri.filter((e) => aktif.has(e.layer)), [entri, aktif]);

  const jumlah = useMemo(() => {
    const c: Record<CalendarLayer, number> = { meetings: 0, tasks: 0, leave: 0, holidays: 0 };
    for (const e of entri) {
      c[e.layer] += 1;
    }
    return c;
  }, [entri]);
  const libur = useMemo(() => new Set(entri.filter((e) => e.layer === 'holidays').map((e) => e.date)), [entri]);

  function warnaHari(ymd: string): string[] {
    const w: string[] = [];
    for (const l of LAPISAN) {
      if (aktif.has(l.kode) && tampak.some((e) => e.layer === l.kode && berlaku(e, ymd))) {
        w.push(l.kode === 'tasks' && tampak.some((e) => e.layer === 'tasks' && e.overdue && berlaku(e, ymd)) ? colors.danger : warnaLapisan(colors, l.kode));
      }
    }
    return w;
  }

  function ubahLapisan(kode: CalendarLayer): void {
    const baru = new Set(aktif);
    if (baru.has(kode)) {
      if (baru.size === 1) {
        snackbar.show({ message: 'Sedikitnya satu lapisan harus aktif.', variant: 'warn' });
        return;
      }
      baru.delete(kode);
    } else {
      baru.add(kode);
    }
    setAktif(baru);
  }

  const entriHari = tampak.filter((e) => berlaku(e, terpilih)).sort((a, b) => (a.meta ?? '').localeCompare(b.meta ?? ''));
  const header = (
    <SubAppBar
      title="Kalender"
      actions={[
        { icon: 'layers', label: 'Lapisan kalender', onPress: () => setLembar(true) },
        { icon: 'bell', label: 'Inbox', onPress: () => router.push('/inbox') },
      ]}
    />
  );

  if (m.status === 'mati') {
    return (
      <Screen header={<SubAppBar title="Kalender" />}>
        <EmptyState icon="calendar-off" title="Kalender belum diaktifkan" description="Fitur rapat & kalender sedang tidak tersedia di server. Gunakan RuangKerja web atau hubungi admin." actionLabel="Kembali" onAction={() => router.back()} />
      </Screen>
    );
  }

  const ubinHari = (ymd: string, kecil: boolean): React.JSX.Element => {
    const pilih = ymd === terpilih;
    const ini = ymd === hariIni;
    const { m: bln, d } = urai(ymd);
    const luar = mode === 'bulan' && keYmd(urai(ymd).y, bln, 1).slice(0, 7) !== bulanTampil;
    const pekan = hariIso(ymd) >= 6;
    const merah = !luar && (pekan || libur.has(ymd));
    return (
      <Pressable
        key={ymd}
        onPress={() => setTerpilih(ymd)}
        scaleTo={0.96}
        accessibilityRole="button"
        accessibilityState={{ selected: pilih }}
        accessibilityLabel={`${judulHari(ymd)}${ini ? ', hari ini' : ''}`}
        style={[kecil ? s.selBulan : s.ubinMinggu, !kecil ? { backgroundColor: pilih ? 'transparent' : colors.surface, borderColor: colors.border, borderWidth: 1 } : null, ini && !pilih ? { borderColor: colors.primary, borderWidth: 2 } : null, { overflow: 'hidden' }]}
      >
        {pilih ? <Gradient name="aksi" style={StyleSheet.absoluteFill} /> : null}
        {!kecil ? (
          <Text variant="meta" weight={600} style={{ color: pilih ? PUTIH : colors.muted }}>
            {namaHariSingkat(ymd)}
          </Text>
        ) : null}
        <Text variant={kecil ? 'title' : 'h3'} weight={pilih || ini ? 700 : 600} style={{ color: pilih ? PUTIH : luar ? colors.subtle : merah ? colors.danger : colors.text }}>
          {String(d)}
        </Text>
        <Titik warna={pilih ? warnaHari(ymd).map(() => PUTIH) : warnaHari(ymd)} />
      </Pressable>
    );
  };

  let isi: React.ReactNode;
  if (m.status === 'memuat' && !m.data) {
    isi = <Loading label="Memuat kalender…" />;
  } else if ((m.status === 'galat' || m.status === 'offline' || m.status === 'terlarang') && !m.data) {
    isi = <ErrorState kind={m.status === 'offline' ? 'offline' : 'umum'} title="Kalender tidak dapat dimuat" message={m.status === 'offline' ? 'Tanpa koneksi. Bulan ini belum tersimpan di perangkat.' : (m.galat?.message ?? 'Coba lagi beberapa saat.')} onRetry={() => void m.muat()} />;
  } else if (mode === 'minggu') {
    const hari = [0, 1, 2, 3, 4, 5, 6].map((n) => tambahHari(senin, n));
    isi = (
      <>
        <View style={s.navigasi}>
          <IconButton icon="chevron-left" label="Minggu sebelumnya" onPress={() => setTerpilih(tambahHari(terpilih, -7))} />
          <Text variant="title" weight={600} align="center" style={{ flex: 1 }}>
            {rentangMinggu(senin)}
          </Text>
          <IconButton icon="chevron-right" label="Minggu berikutnya" onPress={() => setTerpilih(tambahHari(terpilih, 7))} />
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>{hari.map((h) => ubinHari(h, false))}</View>
      </>
    );
  } else {
    const { y, m: bln } = urai(`${bulanTampil}-01`);
    const kolom = tanggal.kolomAwalBulan(y, bln);
    const awal = tambahHari(keYmd(y, bln, 1), -kolom);
    const jmlSel = Math.ceil((kolom + tanggal.jumlahHari(y, bln)) / 7) * 7;
    const sel = Array.from({ length: jmlSel }, (_, i) => tambahHari(awal, i));
    isi = (
      <>
        <View style={s.navigasi}>
          <IconButton
            icon="chevron-left"
            label="Bulan sebelumnya"
            onPress={() => {
              const g = tanggal.geserBulan({ y, m: bln }, -1);
              setBulanTampil(keYmd(g.y, g.m, 1).slice(0, 7));
              setTerpilih(keYmd(g.y, g.m, 1));
            }}
          />
          <Text variant="title" weight={600} align="center" style={{ flex: 1 }}>
            {namaBulan(y, bln)}
          </Text>
          <IconButton
            icon="chevron-right"
            label="Bulan berikutnya"
            onPress={() => {
              const g = tanggal.geserBulan({ y, m: bln }, 1);
              setBulanTampil(keYmd(g.y, g.m, 1).slice(0, 7));
              setTerpilih(keYmd(g.y, g.m, 1));
            }}
          />
        </View>
        <Card style={{ padding: 12, gap: 4 }}>
          <View style={s.kisi}>
            {tanggal.NAMA_HARI_SINGKAT.map((n) => (
              <Text key={n} variant="meta" weight={600} align="center" style={{ width: `${100 / 7}%` }}>
                {n}
              </Text>
            ))}
          </View>
          {m.status === 'memuat' && m.data && m.data.month !== bln ? (
            <Loading label="Memuat bulan…" rows={3} />
          ) : (
            <View style={s.kisi}>{sel.map((h) => <View key={h} style={{ width: `${100 / 7}%`, alignItems: 'center' }}>{ubinHari(h, true)}</View>)}</View>
          )}
        </Card>
        <View style={s.legenda}>
          {LAPISAN.map((l) => (
            <View key={l.kode} style={s.legendaButir}>
              <View style={[s.titik, { width: 10, height: 10, borderRadius: 5, backgroundColor: warnaLapisan(colors, l.kode) }]} />
              <Text variant="meta">{l.legenda}</Text>
            </View>
          ))}
        </View>
      </>
    );
  }

  const siap = m.data !== null;
  return (
    <Screen header={header} refreshing={m.menyegarkan} onRefresh={() => void m.muat()}>
      {m.dariCache !== null ? (
        <Banner tone="neutral" icon="cloud-off" message={`Tanpa koneksi. Menampilkan ${namaBulan(urai(`${bulan}-01`).y, urai(`${bulan}-01`).m)} dari data tersimpan (${jam(new Date(m.dariCache))}). Bulan lain butuh jaringan.`} />
      ) : null}
      {mode === 'minggu' ? <Banner tone="info" icon="calendar-sync" message="Sinkron Google Calendar ditahan. Kalender ini hanya memuat data RuangKerja." /> : null}
      <SegmentedTabs<Mode>
        value={mode}
        onChange={(v) => {
          setMode(v);
          if (v === 'bulan') {
            setBulanTampil(terpilih.slice(0, 7));
          }
        }}
        options={[
          { value: 'minggu', label: 'Minggu' },
          { value: 'bulan', label: 'Bulan' },
        ]}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {LAPISAN.map((l) => {
          const on = aktif.has(l.kode);
          return (
            <Pressable
              key={l.kode}
              onPress={() => ubahLapisan(l.kode)}
              accessibilityRole="switch"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${l.label}, ${jumlah[l.kode]}`}
              style={[s.chipLapisan, { backgroundColor: colors.surface, borderColor: colors.border, opacity: on ? 1 : 0.5 }]}
            >
              <View style={[s.titik, { width: 10, height: 10, borderRadius: 5, backgroundColor: warnaLapisan(colors, l.kode) }]} />
              <Text variant="label">{l.label}</Text>
              <Text variant="label" tone="muted">
                {String(jumlah[l.kode])}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {isi}
      {siap ? (
        <>
          <View style={s.kepalaHari}>
            <Text variant="h3" style={{ flex: 1 }}>
              {terpilih === hariIni ? `Hari ini · ${judulHari(terpilih)}` : judulHari(terpilih)}
            </Text>
            {terpilih !== hariIni ? (
              <Pressable
                onPress={() => {
                  setTerpilih(hariIni);
                  setBulanTampil(hariIni.slice(0, 7));
                }}
                accessibilityRole="button"
                accessibilityLabel="Ke hari ini"
                hitSlop={10}
              >
                <Text variant="label" tone="link">
                  Hari ini
                </Text>
              </Pressable>
            ) : (
              <Text variant="meta">{entriHari.length} entri</Text>
            )}
          </View>
          {entriHari.length > 0 ? (
            <DaftarEntri entri={entriHari} />
          ) : (
            <EmptyState icon="calendar-check" title={libur.has(terpilih) ? 'Hari libur' : 'Tidak ada agenda'} description={libur.has(terpilih) ? (entri.find((e) => e.layer === 'holidays' && e.date === terpilih)?.title ?? 'Libur') : 'Tidak ada rapat, tenggat, atau cuti pada hari ini.'} />
          )}
        </>
      ) : null}
      <BottomSheet visible={lembar} onClose={() => setLembar(false)} title="Lapisan kalender">
        {LAPISAN.map((l) => (
          <View key={l.kode} style={s.barisLapisan}>
            <View style={[s.titik, { width: 12, height: 12, borderRadius: 6, backgroundColor: warnaLapisan(colors, l.kode) }]} />
            <View style={{ flex: 1 }}>
              <Text variant="label">{l.label}</Text>
              <Text variant="meta">{l.desk}</Text>
            </View>
            <Switch value={aktif.has(l.kode)} onValueChange={() => ubahLapisan(l.kode)} label={l.label} />
          </View>
        ))}
        <Text variant="meta">Sedikitnya satu lapisan harus aktif.</Text>
      </BottomSheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  garis: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  baris: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, minHeight: 64 },
  bungkus: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  navigasi: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ubinMinggu: { flex: 1, minHeight: 64, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 6 },
  selBulan: { width: 44, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: 2 },
  titikBaris: { flexDirection: 'row', gap: 3, height: 6 },
  titik: { width: 6, height: 6, borderRadius: 3 },
  kisi: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 6 },
  legenda: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  legendaButir: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipLapisan: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1 },
  kepalaHari: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barisLapisan: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60 },
});
