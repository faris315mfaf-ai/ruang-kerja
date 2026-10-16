/**
 * Layar setelan widget Tugas hari ini (mockup 02-widget-tugas-rapat, layar 4): segmen
 * Pribadi/Tim/Semua, "Tampilkan tugas selesai", "Latar transparan". Dibuka Android sebagai
 * activity konfigurasi saat widget ditambahkan dan dari tekan-lama › Setelan widget
 * (`registerWidgetConfigurationScreen`, di `daftar.ts`).
 *
 * Berjalan di activity terpisah (RNWidgetConfigurationActivity) di runtime JS yang sama
 * dengan aplikasi, TANPA akar aplikasi (`app/_layout.tsx`): provider tema/UI dipasang di
 * sini, sesi tidak ada — data diambil lewat `data.ts` (token tersimpan, mode senyap).
 */
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { WidgetConfigurationScreenProps } from 'react-native-android-widget';

import { ThemeProvider, useAppFonts, useTheme } from '@/theme';
import { Banner, Button, Card, Divider, IconButton, Radio, Switch, Text, UIProvider } from '@/ui';

import { muatTugas } from './data';
import { LABEL_SEGMEN, SETELAN_BAWAAN, keadaanTugas, type BarisTugas, type MasukanTugas, type Segmen, type SetelanTugas } from './keadaan';
import { bacaSetelan, simpanSetelan } from './setelan';
import { susunWidget } from './susun';

const PILIHAN_SEGMEN: { nilai: Segmen; deskripsi: string }[] = [
  { nilai: 'pribadi', deskripsi: 'Tugas di workspace pribadi yang jatuh tempo hari ini' },
  { nilai: 'tim', deskripsi: 'Tugas tim, divisi, dan proyek yang ditugaskan kepada Anda' },
  { nilai: 'semua', deskripsi: 'Pribadi dan tim sekaligus' },
];

function Pratinjau({ masukan, setelan }: { masukan: MasukanTugas | null; setelan: SetelanTugas }): React.JSX.Element {
  const { colors } = useTheme();
  const k = useMemo(() => (masukan === null ? null : keadaanTugas({ ...masukan, setelan }, 196)), [masukan, setelan]);
  const warnaCincin = (b: BarisTugas): string => (b.cincin === 'bahaya' ? colors.danger : b.cincin === 'peringatan' ? colors.warning : b.cincin === 'primer' ? colors.primary : colors.borderStrong);
  return (
    <View
      accessibilityLabel={k === null ? 'Memuat pratinjau widget' : `Pratinjau widget. ${k.label}`}
      style={[s.pratinjau, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={s.kepala}>
        <Text variant="title" style={{ flex: 1 }} numberOfLines={1}>
          Tugas hari ini
        </Text>
        <View style={[s.chip, { backgroundColor: colors.surface2 }]}>
          <Text variant="meta" weight={700}>
            {LABEL_SEGMEN[setelan.segmen]}
          </Text>
        </View>
        {k !== null && k.selesai !== null && k.total !== null ? (
          <View style={[s.chip, { backgroundColor: colors.surface2 }]}>
            <Text variant="meta" weight={700}>{`${k.selesai}/${k.total}`}</Text>
          </View>
        ) : null}
      </View>
      {k === null ? (
        <View style={s.tengah}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : k.jenis === 'normal' ? (
        k.baris.map((b) => (
          <View key={b.id} style={s.baris}>
            <View style={[s.cincin, { borderColor: b.selesai ? colors.success : warnaCincin(b), backgroundColor: b.selesai ? colors.success : 'transparent' }]} />
            <Text variant="body" weight={600} numberOfLines={1} style={{ flex: 1, color: b.selesai ? colors.subtle : colors.text }}>
              {b.judul}
            </Text>
            <Text variant="meta" weight={600} style={{ color: b.nadaMeta === 'bahaya' ? colors.danger : b.nadaMeta === 'sukses' ? colors.success : colors.muted }}>
              {b.meta}
            </Text>
          </View>
        ))
      ) : (
        <View style={s.tengah}>
          <Text variant="title" align="center">
            {k.judul}
          </Text>
          {k.sub !== '' ? (
            <Text variant="meta" align="center">
              {k.sub}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

function IsiSetelan({ widgetInfo, renderWidget, setResult }: WidgetConfigurationScreenProps): React.JSX.Element {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [setelan, setSetelan] = useState<SetelanTugas>(SETELAN_BAWAAN);
  const [siap, setSiap] = useState(false);
  const [masukan, setMasukan] = useState<MasukanTugas | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);

  useEffect(() => {
    let batal = false;
    void (async () => {
      const awal = await bacaSetelan(widgetInfo.widgetId);
      if (!batal) {
        setSetelan(awal);
        setSiap(true);
      }
      const data = await muatTugas(awal, Date.now()).catch(() => null);
      if (!batal && data !== null) {
        setMasukan(data);
      }
    })();
    return () => {
      batal = true;
    };
  }, [widgetInfo.widgetId]);

  const simpan = async (): Promise<void> => {
    setMenyimpan(true);
    try {
      await simpanSetelan(widgetInfo.widgetId, setelan);
      // Gambar pertama untuk widget baru: peluncur tidak mengirim pembaruan sebelum konfigurasi selesai.
      renderWidget(await susunWidget('TugasHariIni', { widgetId: widgetInfo.widgetId, width: widgetInfo.width, height: widgetInfo.height }));
    } catch {
      // Gagal menyimpan/menggambar: widget tetap dipasang dan menyusun dirinya pada pembaruan berikutnya.
    } finally {
      setResult('ok');
    }
  };

  return (
    <View style={[s.akar, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={s.bar}>
        <IconButton icon="x" label="Tutup tanpa menyimpan" variant="ghost" onPress={() => setResult('cancel')} />
        <Text variant="title" accessibilityRole="header">
          Setelan widget
        </Text>
      </View>
      <ScrollView contentContainerStyle={s.isi} keyboardShouldPersistTaps="handled">
        <Pratinjau masukan={siap ? masukan : null} setelan={setelan} />

        <Card variant="flat">
          <View style={s.judulKartu}>
            <Text variant="title">Segmen</Text>
            <Text variant="meta">Yang ditampilkan di widget</Text>
          </View>
          {PILIHAN_SEGMEN.map((p, i) => (
            <View key={p.nilai}>
              <Divider />
              <Radio
                selected={setelan.segmen === p.nilai}
                onSelect={() => setSetelan((lama) => ({ ...lama, segmen: p.nilai }))}
                label={LABEL_SEGMEN[p.nilai]}
                description={p.deskripsi}
                style={s.radio}
              />
              {i === PILIHAN_SEGMEN.length - 1 ? null : null}
            </View>
          ))}
        </Card>

        <Card variant="flat">
          <View style={s.barisSakelar}>
            <View style={{ flex: 1 }}>
              <Text variant="title">Tampilkan tugas selesai</Text>
              <Text variant="meta">Ditandai selesai, di bawah tugas terbuka</Text>
            </View>
            <Switch label="Tampilkan tugas selesai" value={setelan.tampilkanSelesai} onValueChange={(v) => setSetelan((lama) => ({ ...lama, tampilkanSelesai: v }))} />
          </View>
          <Divider />
          <View style={s.barisSakelar}>
            <View style={{ flex: 1 }}>
              <Text variant="title">Latar transparan</Text>
              <Text variant="meta">Kartu tembus pandang, mengikuti wallpaper</Text>
            </View>
            <Switch label="Latar transparan" value={setelan.transparan} onValueChange={(v) => setSetelan((lama) => ({ ...lama, transparan: v }))} />
          </View>
        </Card>

        <Banner tone="info" message="Widget memuat ulang tiap 30 menit dan setelah Anda mengubah tugas di aplikasi. Hemat daya Android dapat menundanya." />
      </ScrollView>
      <View style={[s.bawah, { backgroundColor: colors.bg, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Button title="Simpan" onPress={() => void simpan()} loading={menyimpan} loadingTitle="Menyimpan…" disabled={!siap} />
      </View>
    </View>
  );
}

/** Komponen terdaftar di `registerWidgetConfigurationScreen`. */
export function LayarSetelanWidget(props: WidgetConfigurationScreenProps): React.JSX.Element {
  const fontSiap = useAppFonts();
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <UIProvider>{fontSiap ? <IsiSetelan {...props} /> : <View style={s.akar} />}</UIProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

const s = StyleSheet.create({
  akar: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, minHeight: 56 },
  isi: { padding: 16, gap: 16 },
  pratinjau: { borderRadius: 28, borderWidth: 1, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10, minHeight: 150 },
  kepala: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32, marginBottom: 2 },
  chip: { minHeight: 26, borderRadius: 13, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  baris: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 },
  cincin: { width: 22, height: 22, borderRadius: 11, borderWidth: 2 },
  tengah: { alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 96, paddingVertical: 8 },
  judulKartu: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10, gap: 2 },
  radio: { paddingHorizontal: 20, paddingVertical: 14, minHeight: 56 },
  barisSakelar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, minHeight: 64 },
  bawah: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
});
