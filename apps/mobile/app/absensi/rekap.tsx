/**
 * Rekap bulanan pribadi: tingkat kehadiran + angka apa adanya (tanpa skor
 * gabungan, tanpa saldo cuti) dan unduh PDF ke cache lalu buka lewat intent.
 * Mockup: docs/mockups/android/screens/03-absensi/15-rekap-bulanan.html.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { GalatUnduhRekap, rekapBulan, unduhRekapPdf, type RekapBulan } from '@/api/absensi';
import { ApiError } from '@/api/client';
import { tanggalSingkat } from '@/features/absensi/tanggal';
import { radius, useTheme } from '@/theme';
import { Banner, Button, ErrorState, Hero, Icon, Screen, Skeleton, SubAppBar, Text, errorKindFromStatus, useSnackbar, type AnyIconName } from '@/ui';

function angka(n: number): string {
  return n.toLocaleString('id-ID', { maximumFractionDigits: 1 });
}

function Tile({ nilai, label, icon, warna }: { nilai: string; label: string; icon: AnyIconName; warna: string }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel={`${label}: ${nilai}`} style={[s.tile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text variant="kpi" style={{ color: warna, fontSize: 30, lineHeight: 36 }}>
        {nilai}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name={icon} size={18} color={colors.muted} />
        <Text variant="meta" style={{ fontSize: 15, flexShrink: 1 }}>
          {label}
        </Text>
      </View>
    </View>
  );
}

export default function LayarRekap(): React.JSX.Element {
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const p = useLocalSearchParams<{ bulan?: string }>();
  const bulanParam = Array.isArray(p.bulan) ? p.bulan[0] : p.bulan;
  const [data, setData] = useState<RekapBulan | null>(null);
  const [galat, setGalat] = useState<ApiError | null>(null);
  const [mengunduh, setMengunduh] = useState(false);

  const muat = useCallback(async (): Promise<void> => {
    setGalat(null);
    try {
      setData(await rekapBulan(bulanParam));
    } catch (err) {
      setGalat(err instanceof ApiError ? err : new ApiError({ status: -1, message: 'Rekap tidak dapat dimuat.' }));
    }
  }, [bulanParam]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- memuat saat layar dibuka
    void muat();
  }, [muat]);

  const unduh = async (): Promise<void> => {
    if (!data || mengunduh) return;
    setMengunduh(true);
    try {
      const berkas = await unduhRekapPdf(data.period.month);
      snackbar.show({
        message: `Rekap ${data.period.label} diunduh (PDF)`,
        variant: 'ok',
        actionLabel: 'Buka',
        duration: 8000,
        onAction: () => {
          void Linking.openURL(berkas.contentUri).catch(() =>
            snackbar.show({ message: 'Tidak ada aplikasi untuk membuka PDF. Berkas tersimpan di penyimpanan RuangKerja; pasang pembaca PDF untuk membukanya.', variant: 'warn', duration: 8000 }),
          );
        },
      });
    } catch (err) {
      snackbar.show({ message: err instanceof GalatUnduhRekap ? err.message : 'Rekap gagal diunduh. Coba lagi.', variant: 'bad', actionLabel: 'Coba lagi', onAction: () => void unduh() });
    } finally {
      setMengunduh(false);
    }
  };

  const r = data?.recap;
  const persen = r?.attendanceRate ?? null;
  const tampilPersen = persen === null ? '—' : `${Math.round(persen)}%`;

  return (
    <Screen
      header={<SubAppBar title={data ? `Rekap ${data.period.label}` : 'Rekap bulanan'} onBack={() => router.back()} actions={data ? [{ icon: 'download', label: 'Unduh rekap (PDF)', onPress: () => void unduh(), disabled: mengunduh }] : []} />}
      onRefresh={() => void muat()}
    >
      {galat && !data ? (
        <ErrorState kind={errorKindFromStatus(galat.status)} title="Rekap tidak dapat dimuat" message={galat.status === 0 ? 'Periksa koneksi internet Anda lalu coba lagi.' : galat.message} onRetry={() => void muat()} />
      ) : !data || !r ? (
        <>
          <Skeleton height={170} radiusPx={26} />
          <Skeleton height={90} radiusPx={20} />
          <Skeleton height={90} radiusPx={20} />
        </>
      ) : (
        <>
          <Hero>
            <Text variant="body" style={{ color: 'rgba(255,255,255,0.88)' }}>
              Tingkat kehadiran
            </Text>
            <Text variant="display" style={{ color: '#FFFFFF', fontSize: 52, lineHeight: 60 }} accessibilityLabel={`Tingkat kehadiran ${tampilPersen}`}>
              {tampilPersen}
            </Text>
            <Text variant="body" style={{ color: 'rgba(255,255,255,0.92)', fontSize: 16 }}>
              {angka(r.presentDays)} dari {angka(r.workDays)} hari kerja{r.shiftName ? ` · Shift ${r.shiftName.replace(/\s+\d{2}\.\d{2}.*$/, '')}` : ''}
            </Text>
            <View style={s.trek}>
              <View style={[s.isi, { width: `${Math.max(0, Math.min(100, persen ?? 0))}%` }]} />
            </View>
          </Hero>

          <View style={s.grid}>
            <Tile nilai={angka(r.workDays)} label="Hari kerja" icon="calendar-days" warna={colors.text} />
            <Tile nilai={angka(r.presentDays)} label="Hadir" icon="circle-check" warna={colors.success} />
            <Tile nilai={angka(r.lateCount)} label={`Terlambat · ${r.lateMinutes} m`} icon="clock" warna={colors.warning} />
            <Tile nilai={angka(r.earlyLeaveCount)} label="Pulang cepat" icon="log-out" warna={colors.text} />
            <Tile nilai={angka(r.absentDays)} label="Alpha" icon="circle-x" warna={colors.danger} />
            <Tile nilai={angka(r.permitDays)} label="Izin" icon="file-text" warna={colors.info} />
            <Tile nilai={angka(r.sickDays)} label="Sakit" icon="heart-pulse" warna={colors.text} />
            <Tile nilai={angka(r.wfhDays)} label="WFH" icon="house" warna={colors.link} />
            <Tile nilai={angka(r.leaveDays)} label="Cuti" icon="plane" warna={colors.text} />
            <Tile nilai={angka(r.businessTripDays)} label="Dinas luar" icon="briefcase-business" warna={colors.text} />
            {r.needsCorrectionDays > 0 ? <Tile nilai={angka(r.needsCorrectionDays)} label="Perlu koreksi" icon="pencil" warna={colors.fill.violet} /> : null}
          </View>

          <Banner
            tone="info"
            message={`Rekap hanya menghitung sampai hari ini atau tanggal akhir kerja${data.period.countedUntil ? ` (${tanggalSingkat(data.period.countedUntil)})` : ''}. Tidak ada skor gabungan — angka ditampilkan apa adanya.`}
          />
          <Button title="Unduh rekap (PDF)" variant="outline" icon="download" size="lg" loading={mengunduh} loadingTitle="Mengunduh…" onPress={() => void unduh()} />
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { width: '47.5%', flexGrow: 1, borderRadius: radius.cardTight, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14, gap: 4 },
  trek: { height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden', marginTop: 8 },
  isi: { height: 10, borderRadius: 5, backgroundColor: '#FFFFFF' },
});
