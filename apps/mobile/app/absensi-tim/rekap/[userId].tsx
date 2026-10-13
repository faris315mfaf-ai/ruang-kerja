/**
 * Rekap absensi satu karyawan per bulan (mockup 11 › 22 detail): KPI,
 * kalender bulan (komponen Absensi), hari terpilih, hari terakhir, log
 * check-in (selfie bertanda tangan + tandai ditinjau sesuai bendera), Koreksi
 * (HR), ekspor = desktop. `GET /absensi/tim/rekap/{userId}?bulan=`.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { SelHari } from '@/api/absensi';
import { rekapKaryawan, type DetailRekap, type LogRekap } from '@/api/hr';
import type { RecapDayCell } from '@/api/types';
import { KalenderBulan } from '@/features/absensi/KalenderBulan';
import { SheetKoreksi, type TargetKoreksi } from '@/features/hr/absensi/Koreksi';
import { useLihatSelfie } from '@/features/hr/absensi/Selfie';
import { jelaskanTanda, useTinjau } from '@/features/hr/absensi/Temuan';
import { angka, hariPendek, labelBulan, persen } from '@/features/hr/format';
import { useMuat } from '@/features/hr/useMuat';
import { useTautanDesktop } from '@/features/hr/useTautanDesktop';
import { durasiMenit, jam, ymdHariIni, ymdJakarta } from '@/lib/format';
import { useTheme } from '@/theme';
import { Avatar, Badge, Banner, BottomSheet, Button, Card, DesktopOnlyBanner, ErrorState, IconButton, KpiCard, Loading, LockedState, Screen, SectionHeader, SubAppBar, Text, errorKindFromStatus, useSnackbar, type Tone } from '@/ui';

function keSel(h: RecapDayCell): SelHari {
  return {
    ...h,
    status: h.kind,
    scheduledStart: null,
    scheduledEnd: null,
    checkInAt: h.checkIn?.occurredAt ?? null,
    checkOutAt: h.checkOut?.occurredAt ?? null,
    locationLabel: h.checkIn?.locationName ?? null,
    workPlan: [],
    note: null,
    flags: [],
    isCorrected: h.checkIn?.method === 'manual' || h.checkOut?.method === 'manual',
    request: null,
    correction: { canCorrect: false, deadline: null, pendingRequest: null },
  };
}

function nadaHari(kind: string): Tone {
  switch (kind) {
    case 'present':
    case 'wfh':
      return 'success';
    case 'late':
    case 'early_leave':
    case 'needs_correction':
      return 'warning';
    case 'absent':
      return 'danger';
    case 'leave':
    case 'permit':
    case 'sick':
    case 'business_trip':
      return 'info';
    default:
      return 'neutral';
  }
}

function rentangJam(h: RecapDayCell): string | null {
  if (!h.checkIn && !h.checkOut) return null;
  return `${h.checkIn ? jam(h.checkIn.occurredAt) : '—'} – ${h.checkOut ? jam(h.checkOut.occurredAt) : 'belum pulang'}`;
}

export default function RekapKaryawanLayar(): React.JSX.Element {
  const { userId, bulan: bulanAwal } = useLocalSearchParams<{ userId: string; bulan?: string }>();
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const tautan = useTautanDesktop();
  const [bulan, setBulan] = useState<string | null>(bulanAwal ?? null);
  const [dipilih, setDipilih] = useState<string | null>(null);
  const [semuaHari, setSemuaHari] = useState(false);
  const [bukaLog, setBukaLog] = useState(false);
  const [koreksi, setKoreksi] = useState<TargetKoreksi | null>(null);
  const ambil = useCallback(() => rekapKaryawan(userId, bulan), [userId, bulan]);
  const m = useMuat<DetailRekap>(userId ? `rekap-orang:${userId}:${bulan ?? 'kini'}` : null, ambil);
  const d = m.data;
  const offline = m.offlineSejak !== null;
  const selfie = useLihatSelfie();
  const { setData, muatUlang } = m;
  const tinjau = useTinjau(
    useCallback(
      (id: string) => setData((lama) => (lama ? { ...lama, detail: { ...lama.detail, logs: lama.detail.logs.map((l) => (l.id === id ? { ...l, reviewedAt: new Date().toISOString() } : l)) } } : lama)),
      [setData],
    ),
  );

  const hariIni = ymdHariIni();
  const sel = useMemo(() => (d ? d.detail.days.map(keSel) : []), [d]);
  const terakhir = useMemo(() => (d ? d.detail.days.filter((h) => h.dayId !== null).sort((a, b) => (a.date < b.date ? 1 : -1)) : []), [d]);
  const hariPilih = d && dipilih ? (d.detail.days.find((h) => h.date === dipilih) ?? null) : null;

  if (m.galat && (m.galat.status === 403 || m.galat.status === 404)) {
    return (
      <Screen header={<SubAppBar title="Rekap absensi" />} contentStyle={{ paddingTop: 24 }}>
        <LockedState title="Halaman tidak ditemukan" reason="Karyawan ini tidak ada atau di luar cakupan absensi Anda." actionLabel="Kembali" onAction={() => router.back()} />
      </Screen>
    );
  }

  const r = d?.detail;
  const p = d?.period;
  const izin = r ? r.leaveDays + r.permitDays + r.sickDays : 0;

  return (
    <Screen
      header={<SubAppBar title={r && p ? `${r.name} · ${labelBulan(p.month)}` : 'Rekap absensi'} />}
      refreshing={m.menyegarkan}
      onRefresh={() => void m.muatUlang('tarik')}
    >
      {offline ? <Banner tone="neutral" icon="cloud-off" message={`Anda offline. Menampilkan data pukul ${jam(new Date(m.offlineSejak ?? 0))}.`} /> : null}
      {m.memuat && !d ? (
        <Loading rows={6} label="Memuat rekap karyawan…" />
      ) : m.galat && !d ? (
        <ErrorState message={m.galat.pesan} kind={errorKindFromStatus(m.galat.status)} onRetry={() => void m.muatUlang()} />
      ) : d && r && p ? (
        <>
          <Card style={{ gap: 12 }}>
            <View style={s.kepala}>
              <Avatar name={r.name} size="lg" />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="h3" accessibilityRole="header">
                  {r.name}
                </Text>
                <Text variant="meta" style={{ fontSize: 14 }}>
                  {[r.positionName, r.divisionName, r.shiftName].filter(Boolean).join(' · ') || '—'}
                </Text>
              </View>
            </View>
            <View style={s.bulan}>
              <IconButton icon="chevron-left" label="Bulan sebelumnya" variant="ghost" onPress={() => { setBulan(p.previous); setDipilih(null); }} />
              <View style={{ flex: 1, alignItems: 'center' }} accessibilityLiveRegion="polite">
                <Text variant="title" weight={700}>
                  {p.label}
                </Text>
                <Text variant="meta" style={{ fontSize: 14 }}>
                  {p.isRunning ? 'Berjalan' : 'Selesai'}
                </Text>
              </View>
              <IconButton icon="chevron-right" label="Bulan berikutnya" variant="ghost" onPress={() => { setBulan(p.next); setDipilih(null); }} disabled={p.isRunning} />
            </View>
          </Card>
          <View style={s.kpi}>
            <KpiCard label="Kehadiran" value={persen(r.attendanceRate)} style={s.sel} />
            <KpiCard label="Terlambat" value={`${r.lateCount}×${r.lateMinutes > 0 ? ` · ${r.lateMinutes} m` : ''}`} style={s.sel} />
            <KpiCard label="Alpha" value={String(r.absentDays)} style={s.sel} />
            <KpiCard label="Cuti/izin/sakit" value={angka(izin)} style={s.sel} />
          </View>
          <Text variant="meta" style={{ fontSize: 14 }}>
            {`Hadir ${r.presentDays}/${r.workDays} hari kerja${r.averageCheckIn ? ` · rata-rata masuk ${r.averageCheckIn}` : ''}${r.overtimeHours > 0 ? ` · lembur ${angka(r.overtimeHours)} j` : ''}${r.wfhDays > 0 ? ` · WFH ${r.wfhDays}` : ''}`}
          </Text>

          <Card style={{ gap: 10 }}>
            <Text variant="h3" accessibilityRole="header">{`Kalender ${p.label}`}</Text>
            <KalenderBulan hari={sel} dipilih={dipilih} onPilih={(t) => setDipilih(dipilih === t ? null : t)} hariIni={hariIni} />
          </Card>
          {hariPilih ? <KartuHari h={hariPilih} judul={`Terpilih · ${hariPendek(hariPilih.date)}`} /> : null}

          <SectionHeader title="Hari ini & terakhir" />
          {terakhir.length === 0 ? (
            <Text variant="body" tone="muted">
              Belum ada catatan absensi bulan ini.
            </Text>
          ) : (
            <Card variant="flat" style={{ padding: 0, overflow: 'hidden' }}>
              {(semuaHari ? terakhir : terakhir.slice(0, 5)).map((h, i) => (
                <View key={h.date} style={[s.baris, i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider } : null]} accessible>
                  <View style={{ width: 56 }}>
                    <Text variant="label">{hariPendek(h.date).split(',')[0]}</Text>
                    <Text variant="title" weight={700}>
                      {String(Number(h.date.slice(8)))}
                    </Text>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="body">{rentangJam(h) ?? h.statusLabel ?? '—'}</Text>
                    <Text variant="meta" style={{ fontSize: 14 }}>
                      {[h.checkIn?.methodLabel, h.checkIn?.locationName, h.lateMinutes > 0 ? `terlambat ${h.lateMinutes} m` : null, h.workMinutes > 0 ? `kerja ${durasiMenit(h.workMinutes)}` : null].filter(Boolean).join(' · ') || ' '}
                    </Text>
                  </View>
                  <Badge tone={nadaHari(h.kind)}>{h.statusLabel ?? h.kind}</Badge>
                </View>
              ))}
            </Card>
          )}
          {terakhir.length > 5 ? <Button title={semuaHari ? 'Tampilkan lebih sedikit' : 'Lihat semua hari'} variant="quiet" onPress={() => setSemuaHari(!semuaHari)} /> : null}

          <SectionHeader title={d.can.correct ? 'Aksi HR' : 'Log'} />
          <View style={s.aksi}>
            <Button title={`Log check-in (${r.logs.length})`} variant="outline" icon="history" onPress={() => setBukaLog(true)} style={{ flex: 1 }} />
            {d.can.correct ? (
              <Button
                title="Koreksi"
                variant="tonal"
                icon="pencil"
                onPress={() => {
                  const h = hariPilih ?? d.detail.days.find((x) => x.date === (p.countedUntil ?? hariIni)) ?? null;
                  setKoreksi({ userId: r.userId, name: r.name, workDate: h?.date ?? p.countedUntil ?? hariIni, checkInAt: h?.checkIn?.occurredAt, checkOutAt: h?.checkOut?.occurredAt });
                }}
                disabled={offline}
                disabledReason={offline ? 'Butuh koneksi' : undefined}
                style={{ flex: 1 }}
              />
            ) : null}
          </View>
          {d.can.export ? (
            <DesktopOnlyBanner message="Ekspor Excel dan PDF rekap tersedia di desktop." onSendLink={tautan.mengirim ? undefined : () => tautan.kirim('/absensi/rekap', `Absensi › Rekap › ${p.label}`)} />
          ) : null}
        </>
      ) : null}

      <BottomSheet visible={bukaLog} onClose={() => setBukaLog(false)} title="Log check-in" scrollable>
        {r && r.logs.length === 0 ? (
          <Text variant="body" tone="muted">
            Belum ada log bulan ini.
          </Text>
        ) : (
          r?.logs.map((l) => (
            <BarisLog
              key={l.id}
              l={l}
              offline={offline}
              sibuk={tinjau.sibukId === l.id}
              onSelfie={() => {
                setBukaLog(false);
                selfie.lihat({ logId: l.id, name: r.name, typeLabel: l.typeLabel, occurredAt: l.occurredAt });
              }}
              onTinjau={() => tinjau.tinjau({ ...l, userId: r.userId, name: r.name, initials: r.initials, divisionName: r.divisionName, clientTime: null, radiusM: null, type: l.type })}
            />
          ))
        )}
      </BottomSheet>

      <SheetKoreksi
        target={koreksi}
        offline={offline}
        onClose={() => setKoreksi(null)}
        onTersimpan={(pesan) => {
          setKoreksi(null);
          snackbar.show({ message: pesan, variant: 'ok' });
          void muatUlang('diam');
        }}
      />
      {selfie.elemen}
    </Screen>
  );
}

function KartuHari({ h, judul }: { h: RecapDayCell; judul: string }): React.JSX.Element {
  return (
    <Card variant="tight" style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text variant="label" style={{ flex: 1 }}>
          {judul}
        </Text>
        <Badge tone={nadaHari(h.kind)}>{h.statusLabel ?? (h.holidayName ? `Libur · ${h.holidayName}` : h.isWorkday ? 'Belum ada catatan' : 'Tidak terjadwal')}</Badge>
      </View>
      {rentangJam(h) ? <Text variant="body">{rentangJam(h)}</Text> : null}
      <Text variant="meta" style={{ fontSize: 14 }}>
        {[h.shiftName, h.checkIn?.methodLabel, h.checkIn?.locationName, h.isSuspicious ? 'ditandai mencurigakan' : null].filter(Boolean).join(' · ') || ' '}
      </Text>
    </Card>
  );
}

function BarisLog({ l, offline, sibuk, onSelfie, onTinjau }: { l: LogRekap; offline: boolean; sibuk: boolean; onSelfie: () => void; onTinjau: () => void }): React.JSX.Element {
  const { colors } = useTheme();
  const belumTinjau = l.isSuspicious && l.reviewedAt === null;
  return (
    <View style={[s.log, { borderColor: colors.border }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text variant="label" style={{ flex: 1 }}>{`${l.typeLabel} · ${hariPendek(ymdJakarta(l.occurredAt))} ${jam(l.occurredAt)}`}</Text>
        {l.isCorrection ? <Badge tone="neutral">Manual</Badge> : belumTinjau ? <Badge tone="warning">Perlu ditinjau</Badge> : l.isSuspicious ? <Badge tone="success">Ditinjau</Badge> : null}
      </View>
      <Text variant="meta" style={{ fontSize: 14 }}>
        {[l.methodLabel, l.locationName, l.accuracyM !== null ? `akurasi ${Math.round(l.accuracyM)} m` : null, l.note].filter(Boolean).join(' · ')}
      </Text>
      {l.flags.map((f) => (
        <Text key={f.value} variant="meta" tone="warning" style={{ fontSize: 14 }}>
          {`${f.label}: ${jelaskanTanda(f, { accuracyM: l.accuracyM, clientTime: null, occurredAt: l.occurredAt, distanceM: l.distanceM, radiusM: null })}`}
        </Text>
      ))}
      {(l.canViewSelfie && l.hasSelfie) || (belumTinjau && l.canReview) ? (
        <View style={s.aksi}>
          {l.canViewSelfie && l.hasSelfie ? <Button title="Lihat selfie" variant="outline" icon="eye" onPress={onSelfie} disabled={offline} style={{ flex: 1 }} /> : null}
          {belumTinjau && l.canReview ? <Button title="Tandai ditinjau" variant="tonal" icon="check" onPress={onTinjau} loading={sibuk} disabled={offline} style={{ flex: 1 }} /> : null}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  kepala: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  bulan: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kpi: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sel: { flexBasis: '47%', flexGrow: 1 },
  baris: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 10, paddingHorizontal: 16 },
  aksi: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  log: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 6 },
});
