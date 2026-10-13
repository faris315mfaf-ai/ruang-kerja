/**
 * Riwayat absensi: kalender bulan (status ikon + teks), 4 angka, kartu hari
 * terpilih, "Catatan bulan ini". Hanya data milik sendiri, tanpa selfie.
 * Mockup: docs/mockups/android/screens/03-absensi/13-riwayat-bulan.html, 14 (sheet).
 */
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { riwayatBulan, type RiwayatBulan, type SelHari } from '@/api/absensi';
import { ApiError } from '@/api/client';
import { KalenderBulan } from '@/features/absensi/KalenderBulan';
import { bukaKoreksiHari } from '@/features/absensi/koreksi';
import { META, kategoriHari, perluCatatan } from '@/features/absensi/statusMeta';
import { geserBulan, hariSingkat, hariTanggalPendek, tanggalSingkat } from '@/features/absensi/tanggal';
import { durasiSingkat } from '@/features/absensi/HasilSukses';
import { jam } from '@/lib/format';
import { useTheme } from '@/theme';
import { Badge, Banner, Button, Card, EmptyState, ErrorState, IconButton, IconTile, Pressable, Screen, Skeleton, SubAppBar, Text, errorKindFromStatus } from '@/ui';

const cache = new Map<string, { data: RiwayatBulan; at: number }>();

function KpiKecil({ nilai, label, warna }: { nilai: number; label: string; warna: string }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel={`${label}: ${nilai}`} style={{ flex: 1, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 20, paddingVertical: 12, alignItems: 'center', gap: 2 }}>
      <Text variant="kpi" style={{ color: warna }}>
        {nilai.toLocaleString('id-ID')}
      </Text>
      <Text variant="meta" style={{ fontSize: 13 }}>
        {label}
      </Text>
    </View>
  );
}

function KartuHari({ h, today }: { h: SelHari; today: string }): React.JSX.Element {
  const { colors } = useTheme();
  const k = kategoriHari(h);
  const meta = META[k];
  const ada = h.checkInAt !== null;
  const telat = h.lateMinutes > 0;
  const lokasi = h.locationLabel ?? h.checkIn?.locationName ?? '—';
  const metode = h.checkIn?.methodLabel;

  let label = h.statusLabel ?? meta.label;
  if (h.isCorrected) label = 'Dikoreksi';
  else if (telat) label = `Terlambat ${h.lateMinutes} m`;

  let kosong: string | null = null;
  if (!ada && !h.checkOutAt) {
    kosong =
      h.kind === 'holiday' ? `Libur${h.holidayName ? ` — ${h.holidayName}` : ''}.` :
      h.kind === 'off' ? 'Bukan hari kerja.' :
      h.kind === 'upcoming' ? 'Belum berlangsung.' :
      h.request ? `Tercatat dari pengajuan yang disetujui (${h.request.categoryLabel}${h.request.number ? ` · ${h.request.number}` : ''}).` :
      h.kind === 'absent' ? 'Tidak ada check-in pada hari kerja ini.' :
      h.date === today ? 'Belum ada check-in hari ini.' : 'Tidak ada catatan check-in.';
  }

  return (
    <Card variant="flat">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: 16, paddingBottom: 12 }}>
        <Text variant="title" weight={700} style={{ flex: 1 }}>
          {hariTanggalPendek(h.date)}
        </Text>
        {h.kind !== 'off' && h.kind !== 'upcoming' ? <Badge tone={meta.tone}>{label}</Badge> : null}
      </View>
      {kosong ? (
        <Text variant="body" tone="muted" style={{ paddingHorizontal: 16, paddingBottom: 16, fontSize: 15, lineHeight: 22 }}>
          {kosong}
        </Text>
      ) : (
        <>
          <Baris icon="log-in" tone={telat ? 'warn' : 'ok'} judul={`Masuk · ${telat ? `terlambat ${h.lateMinutes} m` : 'tepat waktu'}`} sub={`${lokasi}${metode ? ` · ${metode}` : ''}`} waktu={jam(h.checkInAt)} />
          <Baris
            icon="log-out"
            tone="neutral"
            judul={h.checkOutAt ? `Pulang · durasi ${durasiSingkat(h.workMinutes)}` : 'Pulang'}
            sub={h.checkOutAt ? `${h.checkOut?.locationName ?? lokasi}${h.checkOut?.methodLabel ? ` · ${h.checkOut.methodLabel}` : ''}` : 'Belum check-out'}
            waktu={h.checkOutAt ? jam(h.checkOutAt) : '—'}
          />
        </>
      )}
      <View style={{ height: 1, backgroundColor: colors.divider }} />
      <Pressable onPress={() => router.push({ pathname: '/absensi/hari/[tanggal]', params: { tanggal: h.date } })} accessibilityRole="link" accessibilityLabel={`Lihat detail lengkap ${hariTanggalPendek(h.date)}`} style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
        <Text variant="label" weight={700} tone="link">
          Lihat detail lengkap
        </Text>
      </Pressable>
    </Card>
  );
}

function Baris({ icon, tone, judul, sub, waktu }: { icon: 'log-in' | 'log-out'; tone: 'ok' | 'warn' | 'neutral'; judul: string; sub: string; waktu: string }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.divider }}>
      <IconTile icon={icon} tone={tone} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="title" weight={700} numberOfLines={2}>
          {judul}
        </Text>
        <Text variant="meta" style={{ fontSize: 14, lineHeight: 20 }} numberOfLines={2}>
          {sub}
        </Text>
      </View>
      <Text variant="mono" style={{ fontSize: 20 }}>
        {waktu}
      </Text>
    </View>
  );
}

function deskripsiCatatan(h: SelHari): { label: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'neutral'; teks: string } {
  const k = kategoriHari(h);
  const masuk = h.checkInAt ? `Masuk ${jam(h.checkInAt)}.` : '';
  if (h.isCorrected) return { label: 'Dikoreksi', tone: 'neutral', teks: 'Jam absen dikoreksi oleh HR atas pengajuan koreksi.' };
  if (h.kind === 'needs_correction') return { label: 'Perlu koreksi', tone: 'neutral', teks: 'Lupa check-in atau check-out. Hari ini belum dihitung lengkap sampai dikoreksi.' };
  if (k === 'terlambat') return { label: `Terlambat ${h.lateMinutes} menit`, tone: 'warning', teks: masuk };
  if (k === 'izin') return { label: h.request?.categoryLabel ?? 'Izin', tone: 'info', teks: 'Tercatat dari pengajuan yang disetujui.' };
  if (k === 'wfh') return { label: 'WFH', tone: 'primary', teks: masuk };
  if (k === 'alpha') return { label: 'Alpha', tone: 'danger', teks: 'Tidak ada check-in pada hari kerja ini.' };
  if (h.kind === 'early_leave') return { label: `Pulang cepat ${h.earlyLeaveMinutes} menit`, tone: 'warning', teks: h.checkOutAt ? `Pulang ${jam(h.checkOutAt)}.` : '' };
  return { label: 'Ditinjau', tone: 'neutral', teks: 'Absensi ditandai untuk ditinjau HR.' };
}

export default function LayarRiwayat(): React.JSX.Element {
  const { colors } = useTheme();
  const [bulan, setBulan] = useState<string | undefined>(undefined);
  const [data, setData] = useState<RiwayatBulan | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<ApiError | null>(null);
  const [offlineAt, setOfflineAt] = useState<number | null>(null);
  const [dipilih, setDipilih] = useState<string | null>(null);
  const [menyegarkan, setMenyegarkan] = useState(false);
  const urutan = useRef(0);

  const muat = useCallback(async (b: string | undefined, diam = false): Promise<void> => {
    const id = ++urutan.current;
    if (!diam) setMemuat(true);
    setGalat(null);
    setOfflineAt(null);
    try {
      const hasil = await riwayatBulan(b);
      if (id !== urutan.current) return;
      cache.set(hasil.period.month, { data: hasil, at: Date.now() });
      setData(hasil);
    } catch (err) {
      if (id !== urutan.current) return;
      const ae = err instanceof ApiError ? err : new ApiError({ status: -1, message: 'Terjadi kendala saat mengambil data bulan ini.' });
      const simpan = b ? cache.get(b) : [...cache.values()].sort((x, y) => y.at - x.at)[0];
      if (ae.status === 0 && simpan) {
        setData(simpan.data);
        setOfflineAt(simpan.at);
      } else {
        setGalat(ae);
      }
    } finally {
      if (id === urutan.current) {
        setMemuat(false);
        setMenyegarkan(false);
      }
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- memuat saat layar dibuka
    void muat(undefined);
  }, [muat]);

  const pindah = (arah: -1 | 1): void => {
    const sumber = data?.period.month ?? bulan;
    if (!sumber) return;
    const baru = geserBulan(sumber, arah);
    setBulan(baru);
    setDipilih(null);
    setData(null);
    void muat(baru);
  };

  const hari = data?.recap.days ?? [];
  const hariIni = data?.today ?? '';
  const efektif =
    dipilih && hari.some((d) => d.date === dipilih)
      ? dipilih
      : hari.some((d) => d.date === hariIni)
        ? hariIni
        : ([...hari].reverse().find((d) => d.kind !== 'off' && d.kind !== 'upcoming' && d.kind !== 'holiday')?.date ?? null);
  const terpilih = hari.find((d) => d.date === efektif) ?? null;
  const belumBerlangsung = data !== null && !data.period.isRunning && hari.every((d) => d.kind === 'upcoming' || d.kind === 'off' || d.kind === 'holiday');
  const catatan = hari.filter(perluCatatan);
  const sudahMaksimal = data !== null && data.today !== '' && data.period.next > geserBulan(data.today.slice(0, 7), 1);

  return (
    <Screen
      header={<SubAppBar title="Riwayat absensi" actions={data ? [{ icon: 'chart-column', label: 'Rekap bulan', onPress: () => router.push({ pathname: '/absensi/rekap', params: { bulan: data.period.month } }) }] : []} />}
      refreshing={menyegarkan}
      onRefresh={() => {
        setMenyegarkan(true);
        void muat(data?.period.month ?? bulan, true);
      }}
    >
      {offlineAt !== null ? <Banner tone="warn" icon="wifi-off" message={`Anda sedang offline. Menampilkan data tersimpan terakhir pukul ${jam(new Date(offlineAt))}. Hari ini bisa belum lengkap.`} /> : null}

      {memuat && !data ? (
        <>
          <Skeleton height={56} radiusPx={16} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Skeleton height={70} radiusPx={20} style={{ flex: 1 }} />
            <Skeleton height={70} radiusPx={20} style={{ flex: 1 }} />
            <Skeleton height={70} radiusPx={20} style={{ flex: 1 }} />
            <Skeleton height={70} radiusPx={20} style={{ flex: 1 }} />
          </View>
          <Skeleton height={330} radiusPx={24} />
        </>
      ) : galat && !data ? (
        <ErrorState kind={errorKindFromStatus(galat.status)} title="Riwayat tidak dapat dimuat" message={galat.status === 0 ? 'Periksa koneksi internet Anda lalu coba lagi.' : 'Terjadi kendala saat mengambil data bulan ini.'} onRetry={() => void muat(bulan)} />
      ) : data ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <IconButton icon="chevron-left" label="Bulan sebelumnya" variant="outline" onPress={() => pindah(-1)} />
            <View style={{ flex: 1, alignItems: 'center' }} accessibilityRole="header">
              <Text variant="h3">{data.period.label}</Text>
              <Text variant="meta" style={{ fontSize: 14 }} align="center">
                {data.period.isRunning && data.period.countedUntil
                  ? `${data.recap.workDays} hari kerja · dihitung sampai ${tanggalSingkat(data.period.countedUntil)}`
                  : belumBerlangsung
                    ? 'Belum berlangsung'
                    : `${data.recap.workDays} hari kerja${data.recap.shiftName ? ` · Shift ${data.recap.shiftName}` : ''}`}
              </Text>
            </View>
            <IconButton icon="chevron-right" label="Bulan berikutnya" variant="outline" onPress={() => pindah(1)} disabled={sudahMaksimal} />
          </View>

          {belumBerlangsung ? (
            <>
              <Card style={{ padding: 12 }}>
                <KalenderBulan hari={hari} dipilih={null} onPilih={() => undefined} hariIni={hariIni} />
              </Card>
              <EmptyState icon="calendar-days" title="Belum ada riwayat" description="Riwayat bulan ini muncul setelah Anda check-in." />
            </>
          ) : (
            <>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <KpiKecil nilai={data.recap.presentDays} label="Hadir" warna={colors.success} />
                <KpiKecil nilai={data.recap.lateCount} label="Telat" warna={colors.warning} />
                <KpiKecil nilai={data.recap.wfhDays} label="WFH" warna={colors.link} />
                <KpiKecil nilai={data.recap.permitDays + data.recap.leaveDays} label="Izin" warna={colors.info} />
              </View>
              <Card style={{ padding: 12 }}>
                <KalenderBulan hari={hari} dipilih={efektif} onPilih={setDipilih} hariIni={hariIni} />
              </Card>
              {terpilih ? <KartuHari h={terpilih} today={hariIni} /> : null}
              {terpilih ? (
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                  <Button
                    title="Ajukan koreksi"
                    variant="outline"
                    icon="clipboard-pen-line"
                    disabled={!terpilih.correction.canCorrect}
                    disabledReason={terpilih.correction.pendingRequest ? 'Sudah ada pengajuan koreksi untuk tanggal ini' : 'Tanggal ini di luar batas pengajuan koreksi'}
                    onPress={() => bukaKoreksiHari(terpilih.date, terpilih.correction)}
                    style={{ flex: 1 }}
                  />
                  <Button title="Rekap bulan" variant="quiet" icon="chart-column" onPress={() => router.push({ pathname: '/absensi/rekap', params: { bulan: data.period.month } })} />
                </View>
              ) : null}
              {catatan.length > 0 ? (
                <Card style={{ gap: 0 }}>
                  <Text variant="title" weight={700} style={{ paddingBottom: 8 }}>
                    Catatan bulan ini
                  </Text>
                  {catatan.map((h, i) => {
                    const c = deskripsiCatatan(h);
                    return (
                      <Pressable
                        key={h.date}
                        onPress={() => setDipilih(h.date)}
                        accessibilityRole="button"
                        accessibilityLabel={`${hariTanggalPendek(h.date)}, ${c.label}. ${c.teks}`}
                        style={{ flexDirection: 'row', gap: 12, paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.divider }}
                      >
                        <View style={{ width: 46, height: 52, borderRadius: 12, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
                          <Text variant="title" weight={800}>
                            {Number(h.date.slice(8))}
                          </Text>
                          <Text variant="meta" style={{ fontSize: 12 }}>
                            {hariSingkat(h.date)}
                          </Text>
                        </View>
                        <View style={{ flex: 1, gap: 4, alignItems: 'flex-start' }}>
                          <Badge tone={c.tone}>{c.label}</Badge>
                          {c.teks ? (
                            <Text variant="body" style={{ fontSize: 16, lineHeight: 22 }}>
                              {c.teks}
                            </Text>
                          ) : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </Card>
              ) : null}
            </>
          )}
        </>
      ) : null}
    </Screen>
  );
}
