/**
 * Detail hari (milik sendiri; TANPA selfie): jam masuk/pulang dengan lokasi dan
 * akurasi, durasi, metode, penanda tinjauan, catatan, rencana kerja, keadaan
 * khusus (perlu koreksi, dikoreksi, dari pengajuan, alpha) dan pintu koreksi.
 * Mockup: docs/mockups/android/screens/03-absensi/14-detail-hari.html, 16.
 */
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { detailHari, type DetailHari, type LogHari } from '@/api/absensi';
import { ApiError } from '@/api/client';
import { durasiSingkat } from '@/features/absensi/HasilSukses';
import { RencanaBacaSaja } from '@/features/absensi/KeadaanKartu';
import { bukaKoreksiHari, bukaPengajuanTerkait } from '@/features/absensi/koreksi';
import { META, kategoriHari } from '@/features/absensi/statusMeta';
import { hariTanggal, hariTanggalPendek } from '@/features/absensi/tanggal';
import { jam } from '@/lib/format';
import { useTheme } from '@/theme';
import { Badge, Banner, Button, Card, ErrorState, Icon, IconTile, ListRow, Screen, Skeleton, SubAppBar, Text, errorKindFromStatus } from '@/ui';

function satu(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

function Rincian({ label, nilai }: { label: string; nilai: string }): React.JSX.Element {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 16, minHeight: 40, alignItems: 'center' }}>
      <Text variant="body" tone="muted" style={{ fontSize: 16 }}>
        {label}
      </Text>
      <Text variant="body" weight={600} style={{ fontSize: 16, flexShrink: 1, textAlign: 'right' }}>
        {nilai}
      </Text>
    </View>
  );
}

function BarisLog({ tipe, log, kosongTeks }: { tipe: 'masuk' | 'pulang'; log: LogHari | null; kosongTeks: string }): React.JSX.Element {
  const { colors } = useTheme();
  const subs: string[] = [];
  if (log) {
    if (log.locationName) subs.push(log.locationName);
    if (log.distanceM !== null) subs.push(`${Math.round(log.distanceM)} m`);
    if (log.accuracyM !== null) subs.push(`akurasi ±${Math.round(log.accuracyM)} m`);
    if (subs.length === 0) subs.push(log.methodLabel);
    if (log.isCorrection) subs.push('koreksi HR');
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
      <IconTile icon={tipe === 'masuk' ? 'log-in' : 'log-out'} tone={log ? (tipe === 'masuk' ? 'teal' : 'neutral') : 'neutral'} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="title" weight={700}>
          {tipe === 'masuk' ? 'Masuk' : 'Pulang'}
        </Text>
        <Text variant="meta" style={{ fontSize: 14, lineHeight: 20, color: colors.muted }}>
          {log ? subs.join(' · ') : kosongTeks}
        </Text>
      </View>
      <Text variant="mono" style={{ fontSize: 22 }}>
        {log ? jam(log.occurredAt) : '—'}
      </Text>
    </View>
  );
}

export default function LayarDetailHari(): React.JSX.Element {
  const { colors } = useTheme();
  const tanggal = satu(useLocalSearchParams().tanggal);
  const [data, setData] = useState<DetailHari | null>(null);
  const [galat, setGalat] = useState<ApiError | null>(null);

  const muat = useCallback(async (): Promise<void> => {
    setGalat(null);
    try {
      setData(await detailHari(tanggal));
    } catch (err) {
      setGalat(err instanceof ApiError ? err : new ApiError({ status: -1, message: 'Detail hari tidak dapat dimuat.' }));
    }
  }, [tanggal]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- memuat saat layar dibuka
    void muat();
  }, [muat]);

  const hari = data?.day ?? null;
  const k = hari ? kategoriHari(hari) : null;
  const meta = k ? META[k] : null;
  const masuk = data?.logs.find((l) => l.type === 'check_in') ?? null;
  const pulang = [...(data?.logs ?? [])].reverse().find((l) => l.type === 'check_out') ?? null;
  const semuaPenanda = [...new Map((data?.logs ?? []).flatMap((l) => l.flags).map((f) => [f.code, f.label])).values()];
  const wfh = hari?.kind === 'wfh';
  const perluKoreksi = hari?.kind === 'needs_correction';
  const dariPengajuan = hari?.request && !hari.checkInAt;
  const alpha = hari?.kind === 'absent';
  const koreksi = hari?.correction ?? null;
  const batasHari = data?.correction.maxBackdateDays ?? null;

  let label = hari?.statusLabel ?? meta?.label ?? '';
  if (hari?.isCorrected) label = 'Dikoreksi';
  else if (hari && hari.lateMinutes > 0) label = `Terlambat ${hari.lateMinutes} m`;
  else if (alpha) label = 'Alpha';
  else if (perluKoreksi) label = 'Perlu koreksi';
  else if (dariPengajuan && hari?.request) label = hari.request.categoryLabel;

  return (
    <Screen header={<SubAppBar title="Detail hari" />} onRefresh={() => void muat()}>
      {galat && !data ? (
        <ErrorState kind={errorKindFromStatus(galat.status)} title="Detail hari tidak dapat dimuat" message={galat.status === 0 ? 'Periksa koneksi internet Anda lalu coba lagi.' : galat.message} onRetry={() => void muat()} />
      ) : !data || !hari ? (
        <>
          <Skeleton width="60%" height={30} />
          <Skeleton height={150} radiusPx={24} />
          <Skeleton height={170} radiusPx={24} />
        </>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="h2" accessibilityRole="header">
                {hariTanggal(data.date)}
              </Text>
              <Text variant="meta" style={{ fontSize: 14, lineHeight: 20 }}>
                {hari.shiftName
                  ? `Shift ${hari.shiftName}${hari.scheduledStart && hari.lateMinutes >= 0 && hari.kind !== 'off' ? '' : ''}`
                  : hari.kind === 'holiday'
                    ? `Libur${hari.holidayName ? ` — ${hari.holidayName}` : ''}`
                    : 'Tidak ada jadwal kerja'}
                {wfh ? ' · mode kerja hybrid' : ''}
              </Text>
            </View>
            {label ? <Badge tone={perluKoreksi ? 'warning' : (meta?.tone ?? 'neutral')}>{label}</Badge> : null}
          </View>

          {perluKoreksi ? (
            <Banner
              tone="warn"
              title="Lupa check-out"
              message={`Check-in tercatat ${jam(hari.checkInAt)} tetapi tidak ada check-out. Hari ini belum dihitung lengkap sampai dikoreksi.`}
            />
          ) : null}
          {hari.isCorrected ? <Banner tone="info" icon="pencil" title="Dikoreksi" message="Jam absen hari ini dikoreksi oleh HR atas pengajuan koreksi." /> : null}
          {alpha && koreksi && !koreksi.canCorrect && !koreksi.pendingRequest ? (
            <Banner
              tone="bad"
              title="Alpha"
              message={`Tidak ada check-in pada hari kerja ini. Bila Anda sebenarnya masuk, ajukan koreksi — maksimal ${batasHari ?? 7} hari ke belakang sudah lewat, hubungi HR.`}
            />
          ) : null}

          {dariPengajuan && hari.request ? (
            <Card style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <Icon name="file-check" size={22} color={colors.info} />
                <Text variant="title" weight={700} style={{ flex: 1 }}>
                  Tercatat dari pengajuan
                </Text>
              </View>
              <Text variant="body" tone="muted" style={{ fontSize: 15, lineHeight: 22, marginBottom: 6 }}>
                Tidak ada check-in. Hari ini tercatat {hari.request.categoryLabel} dari pengajuan yang disetujui.
              </Text>
              <Rincian label="Pengajuan" nilai={hari.request.number ?? '—'} />
              <Rincian label="Status" nilai={`${hari.request.statusLabel}${hari.request.portion === 'half_day' ? ' · setengah hari' : ''}`} />
              <Button title="Lihat pengajuan" variant="tonal" icon="file-text" onPress={() => bukaPengajuanTerkait()} />
            </Card>
          ) : (
            <>
              <Card variant="flat">
                <BarisLog tipe="masuk" log={masuk} kosongTeks="Tidak tercatat" />
                <View style={{ height: 1, backgroundColor: colors.divider }} />
                <BarisLog tipe="pulang" log={pulang} kosongTeks={hari.checkInAt ? 'Tidak tercatat' : 'Tidak tercatat'} />
              </Card>
              {hari.checkInAt ? (
                <Card style={{ gap: 0 }}>
                  <Rincian label="Durasi kerja" nilai={hari.checkOutAt ? durasiSingkat(hari.workMinutes) : '—'} />
                  {masuk ? <Rincian label="Metode" nilai={`${masuk.methodLabel}${wfh ? ' · WFH' : ''}`} /> : null}
                  {hari.lateMinutes > 0 ? <Rincian label="Terlambat" nilai={`${hari.lateMinutes} menit dari batas toleransi`} /> : null}
                  {hari.earlyLeaveMinutes > 0 ? <Rincian label="Pulang cepat" nilai={`${hari.earlyLeaveMinutes} menit`} /> : null}
                  <Rincian label="Penanda tinjauan" nilai={semuaPenanda.length > 0 ? semuaPenanda.join(', ') : 'Tidak ada'} />
                  {hari.note ? <Rincian label="Catatan lokasi" nilai={hari.note} /> : null}
                </Card>
              ) : null}
            </>
          )}

          {hari.workPlan.length > 0 ? (
            <Card>
              <RencanaBacaSaja poin={hari.workPlan} judul="Rencana kerja" />
            </Card>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: colors.surface2, borderRadius: 20, padding: 14 }}>
            <Icon name="eye-off" size={20} color={colors.muted} />
            <Text variant="meta" style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>
              {data.privacyNote}
            </Text>
          </View>

          {koreksi?.pendingRequest ? (
            <Card variant="flat">
              <ListRow
                icon="clipboard-pen-line"
                iconTone="blue"
                title="Lihat pengajuan koreksi"
                subtitle={`${koreksi.pendingRequest.number ?? 'Koreksi'} · ${koreksi.pendingRequest.statusLabel}`}
                onPress={() => bukaPengajuanTerkait('Pengajuan koreksi')}
              />
            </Card>
          ) : koreksi?.canCorrect ? (
            <View style={{ gap: 6 }}>
              <Button
                title={perluKoreksi || alpha ? 'Ajukan koreksi absensi' : 'Ajukan koreksi untuk hari ini'}
                variant={perluKoreksi || alpha ? 'primary' : 'outline'}
                icon="clipboard-pen-line"
                size="lg"
                onPress={() => bukaKoreksiHari(data.date, koreksi)}
              />
              <Text variant="meta" align="center" style={{ fontSize: 14 }}>
                {batasHari !== null ? `Maksimal ${batasHari} hari ke belakang` : 'Tanpa batas hari'}
                {koreksi.deadline ? ` · sampai ${hariTanggalPendek(koreksi.deadline)}` : ''} · diputuskan atasan langsung lalu HR
              </Text>
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}
