/**
 * Tampilan Kalender (mockup 05 › 18): strip pekan + agenda, atau grid bulan +
 * agenda hari terpilih; banner terlambat; sheet "Tanpa tenggat".
 * GET /workspace/{ws}/kalender?bulan= (pekan hanya memfilter di klien).
 */
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ambilKalenderWorkspace, type FilterTugas, type KalenderData, type KartuWorkspace } from '@/api/workspace';
import { ymdHariIni } from '@/lib/format';
import { useTheme } from '@/theme';
import { Banner, BottomSheet, Button, Card, Gradient, IconButton, Loading, Pressable, SegmentedTabs, Text } from '@/ui';
import { NAMA_HARI_SINGKAT, parseIso } from '@/ui/tanggal';

import { BannerBacaSaja, GalatMuat, PitaOffline, TabScroll } from './bagian';
import { BarisTugas } from './ListView';
import { useResource } from './useResource';
import { awalPekan, bulanDari, geserBulanStr, hariSingkat, lolosFilter, namaBulan, rentangPekan, selBulan, tambahHari } from './util';

export function KalenderView({
  ws,
  namaWs,
  filter,
  meId,
  versi,
  boleh,
  onPindah,
  onLihatTerlambat,
}: {
  ws: string;
  namaWs: string;
  filter: FilterTugas;
  meId: string | null;
  versi: number;
  boleh: boolean;
  onPindah: (t: KartuWorkspace) => void;
  onLihatTerlambat: () => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  const hariIni = ymdHariIni();
  const [mode, setMode] = useState<'pekan' | 'bulan'>('pekan');
  const [hari, setHari] = useState(hariIni);
  const [bulan, setBulan] = useState(bulanDari(hariIni));
  const [sheetTanpa, setSheetTanpa] = useState(false);

  const kal = useResource<KalenderData>(`kalender:${ws}:${bulan}:${versi}`, () => ambilKalenderWorkspace(ws, bulan));
  const data = kal.data;

  const perHari = useMemo(() => {
    const peta = new Map<string, KartuWorkspace[]>();
    for (const t of data?.tasks ?? []) {
      if (t.due_date === null || !lolosFilter(t, filter, meId, hariIni)) {
        continue;
      }
      const l = peta.get(t.due_date) ?? [];
      l.push(t);
      peta.set(t.due_date, l);
    }
    return peta;
  }, [data, filter, meId, hariIni]);

  const senin = awalPekan(hari);
  const hariPekan = Array.from({ length: 7 }, (_, i) => tambahHari(senin, i));
  const sel = useMemo(() => selBulan(bulan), [bulan]);

  const pindahPekan = (delta: number): void => {
    const baru = tambahHari(hari, delta * 7);
    setHari(baru);
    setBulan(bulanDari(baru));
  };
  const pindahBulan = (delta: number): void => {
    const b = geserBulanStr(bulan, delta);
    setBulan(b);
    setHari(bulanDari(hariIni) === b ? hariIni : `${b}-01`);
  };
  const ke = (delta: number): void => (mode === 'pekan' ? pindahPekan(delta) : pindahBulan(delta));
  const kembaliHariIni = (): void => {
    setHari(hariIni);
    setBulan(bulanDari(hariIni));
  };

  const judul = mode === 'pekan' ? rentangPekan(senin) : namaBulan(bulan);
  const tanpa = data?.tanpa_tenggat ?? [];

  if (kal.memuat && !data) {
    return (
      <TabScroll>
        <Loading label="Memuat kalender…" rows={4} />
      </TabScroll>
    );
  }
  if (kal.galat && !data) {
    return <GalatMuat galat={kal.galat} judul="Kalender belum bisa dimuat" onCoba={() => void kal.muat()} />;
  }

  const agendaHari = (iso: string, tampilkanKosong: boolean): React.ReactNode => {
    const daftar = perHari.get(iso) ?? [];
    const label = `${hariSingkat(iso)}${iso === hariIni ? ' · Hari ini' : iso === tambahHari(hariIni, 1) ? ' · besok' : ''}`;
    if (daftar.length === 0 && !tampilkanKosong) {
      return null;
    }
    return (
      <View key={iso} style={{ gap: 8 }}>
        <Text variant="title" weight={800}>
          {label}
          {daftar.length > 0 ? <Text variant="meta">{` · ${daftar.length} tugas`}</Text> : null}
        </Text>
        {daftar.length === 0 ? (
          <Text variant="meta">Tidak ada tenggat</Text>
        ) : (
          <Card variant="flat">
            {daftar.map((t, i) => (
              <View key={t.id} style={i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider } : undefined}>
                <BarisTugas tugas={t} onPindah={boleh && t.can?.move !== false ? () => onPindah(t) : undefined} />
              </View>
            ))}
          </Card>
        )}
      </View>
    );
  };

  const adaPekan = hariPekan.some((d) => (perHari.get(d)?.length ?? 0) > 0);

  return (
    <TabScroll onRefresh={kal.muat}>
      <BannerBacaSaja info={data?.read_only} />
      {kal.offline ? <PitaOffline diperbarui={kal.diperbarui} objek="kalender" /> : null}

      <View style={s.kepala}>
        <IconButton icon="chevron-left" label={mode === 'pekan' ? 'Pekan sebelumnya' : 'Bulan sebelumnya'} variant="ghost" size={44} onPress={() => ke(-1)} />
        <Text variant="title" weight={800} style={{ flex: 1 }} align="center" accessibilityRole="header">
          {judul}
        </Text>
        <IconButton icon="chevron-right" label={mode === 'pekan' ? 'Pekan berikutnya' : 'Bulan berikutnya'} variant="ghost" size={44} onPress={() => ke(1)} />
      </View>
      <View style={s.kepala}>
        <View style={{ flex: 1 }}>
          <SegmentedTabs
            value={mode}
            onChange={setMode}
            options={[
              { value: 'pekan', label: 'Pekan' },
              { value: 'bulan', label: 'Bulan' },
            ]}
          />
        </View>
        <Button title="Hari ini" variant="tonal" size="sm" onPress={kembaliHariIni} />
      </View>

      {mode === 'pekan' ? (
        <View style={s.baris7}>
          {hariPekan.map((iso, i) => (
            <SelHari key={iso} iso={iso} label={NAMA_HARI_SINGKAT[i] ?? ''} jumlah={perHari.get(iso)?.length ?? 0} terpilih={iso === hari} hariIni={iso === hariIni} onPress={() => setHari(iso)} />
          ))}
        </View>
      ) : (
        <View style={{ gap: 6 }}>
          <View style={s.baris7}>
            {NAMA_HARI_SINGKAT.map((h) => (
              <Text key={h} variant="meta" weight={700} align="center" style={{ flex: 1 }}>
                {h}
              </Text>
            ))}
          </View>
          {Array.from({ length: sel.length / 7 }, (_, r) => (
            <View key={r} style={s.baris7}>
              {sel.slice(r * 7, r * 7 + 7).map((iso) => (
                <SelHari key={iso} iso={iso} jumlah={perHari.get(iso)?.length ?? 0} terpilih={iso === hari} hariIni={iso === hariIni} luarBulan={bulanDari(iso) !== bulan} onPress={() => setHari(iso)} />
              ))}
            </View>
          ))}
        </View>
      )}

      {data && data.terlambat > 0 ? <Banner tone="warn" icon="clock-alert" message={`${data.terlambat} tugas terlambat di workspace ini.`} actionLabel="Lihat" onAction={onLihatTerlambat} /> : null}

      {mode === 'pekan' ? (
        adaPekan ? (
          hariPekan.map((iso) => agendaHari(iso, iso === hari))
        ) : (
          <Card variant="tight">
            <Text variant="title">Tidak ada tenggat pekan ini</Text>
            <Text variant="meta">Tugas dengan tenggat muncul di sini.</Text>
          </Card>
        )
      ) : (
        agendaHari(hari, true)
      )}

      {tanpa.length > 0 ? (
        <View style={s.kepala}>
          <Text variant="body" tone="muted" style={{ flex: 1, fontSize: 15 }}>{`${tanpa.length} tugas tanpa tenggat`}</Text>
          <Button title="Lihat" variant="quiet" size="sm" onPress={() => setSheetTanpa(true)} />
        </View>
      ) : null}

      <BottomSheet visible={sheetTanpa} onClose={() => setSheetTanpa(false)} title="Tanpa tenggat" scrollable>
        <Text variant="body" tone="muted" style={{ fontSize: 15 }}>{`${tanpa.length} tugas di ${namaWs}`}</Text>
        <Card variant="flat">
          {tanpa.map((t, i) => (
            <View key={t.id} style={i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider } : undefined}>
              <BarisTugas tugas={t} tampilkanStatus statusNama={t.status?.name} />
            </View>
          ))}
        </Card>
        <Text variant="meta">Ketuk tugas untuk membukanya; atur tenggat dari detail.</Text>
      </BottomSheet>
    </TabScroll>
  );
}

function SelHari({
  iso,
  label,
  jumlah,
  terpilih,
  hariIni,
  luarBulan = false,
  onPress,
}: {
  iso: string;
  label?: string;
  jumlah: number;
  terpilih: boolean;
  hariIni: boolean;
  luarBulan?: boolean;
  onPress: () => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  const tgl = parseIso(iso)?.d ?? 0;
  return (
    <Pressable
      onPress={onPress}
      scaleTo={0.96}
      accessibilityRole="button"
      accessibilityLabel={`${hariSingkat(iso)}${hariIni ? ', hari ini' : ''}, ${jumlah} tugas`}
      accessibilityState={{ selected: terpilih }}
      style={[s.sel, { borderColor: hariIni && !terpilih ? colors.primary : 'transparent' }]}
    >
      {terpilih ? <Gradient name="aksi" style={[StyleSheet.absoluteFill, { borderRadius: 14 }]} /> : null}
      {label ? (
        <Text variant="meta" style={{ color: terpilih ? '#FFFFFF' : colors.muted }}>
          {label}
        </Text>
      ) : null}
      <Text variant="title" weight={700} style={{ color: terpilih ? '#FFFFFF' : luarBulan ? colors.subtle : colors.text }}>
        {tgl}
      </Text>
      <View style={[s.titik, { backgroundColor: jumlah > 0 ? (terpilih ? '#FFFFFF' : colors.primary) : 'transparent' }]} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  kepala: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  baris7: { flexDirection: 'row', gap: 4 },
  sel: { flex: 1, minHeight: 56, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', paddingVertical: 4 },
  titik: { width: 6, height: 6, borderRadius: 3, marginTop: 2 },
});
