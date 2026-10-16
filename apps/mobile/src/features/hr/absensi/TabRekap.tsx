/**
 * Absensi tim › Rekap bulanan (mockup 11 › 22): pilih bulan, KPI 2×2, banner
 * ekspor desktop (+ kirim tautan), daftar per karyawan (cari + divisi) →
 * detail karyawan per bulan. `GET /absensi/tim/rekap`.
 */
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { rekapBulanan, type RekapBulanan } from '@/api/hr';
import { jam, ymdHariIni } from '@/lib/format';
import { useTheme } from '@/theme';
import { Avatar, Badge, Banner, BottomSheet, Card, Chip, ChipScroller, DesktopOnlyBanner, EmptyState, ErrorState, Icon, IconButton, KpiCard, Loading, Pressable, Radio, Screen, SearchInput, SectionHeader, Text, errorKindFromStatus } from '@/ui';

import { angka, bulanTerakhir, labelBulan, persen } from '../format';
import { useMuat } from '../useMuat';
import { useTautanDesktop } from '../useTautanDesktop';
import { ringkasBaris } from './ringkasRekap';

export function TabRekap({ header }: { header: React.ReactNode }): React.JSX.Element {
  const { colors } = useTheme();
  const tautan = useTautanDesktop();
  const [bulan, setBulan] = useState<string | null>(null);
  const [divisi, setDivisi] = useState<string | null>(null);
  const [cari, setCari] = useState('');
  const [q, setQ] = useState('');
  const [pilihBulan, setPilihBulan] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setQ(cari.trim()), 350);
    return () => clearTimeout(t);
  }, [cari]);

  const ambil = useCallback(() => rekapBulanan({ bulan, divisi, q: q || null }), [bulan, divisi, q]);
  const m = useMuat<RekapBulanan>(`rekap:${bulan ?? 'kini'}:${divisi ?? ''}:${q}`, ambil);
  const d = m.data;
  const p = d?.period;
  const bulanKini = ymdHariIni().slice(0, 7);
  const pilihan = bulanTerakhir(bulanKini, 13);

  const hapusFilter = (): void => {
    setCari('');
    setQ('');
    setDivisi(null);
  };

  return (
    <Screen header={header} refreshing={m.menyegarkan} onRefresh={() => void m.muatUlang('tarik')}>
      {m.offlineSejak !== null ? <Banner tone="neutral" icon="cloud-off" message={`Anda offline. Menampilkan rekap tersimpan pukul ${jam(new Date(m.offlineSejak))}.`} /> : null}
      {p ? (
        <Card variant="tight" style={s.bulan}>
          <IconButton icon="chevron-left" label="Bulan sebelumnya" variant="ghost" onPress={() => setBulan(p.previous)} />
          <Pressable onPress={() => setPilihBulan(true)} scaleTo={1} accessibilityRole="button" accessibilityLabel={`${p.label}, ${p.isRunning ? 'berjalan' : 'selesai'}. Pilih bulan`} style={{ flex: 1, alignItems: 'center', minHeight: 48, justifyContent: 'center' }}>
            <Text variant="title" weight={700}>
              {p.label}
            </Text>
            <Text variant="meta" style={{ fontSize: 14 }}>
              {p.isRunning ? `Berjalan${p.countedUntil ? ` · hari ke-${Number(p.countedUntil.slice(8))}` : ''}` : 'Selesai'}
            </Text>
          </Pressable>
          <IconButton icon="chevron-right" label="Bulan berikutnya" variant="ghost" onPress={() => setBulan(p.next)} disabled={p.isRunning} />
        </Card>
      ) : null}
      {m.memuat && !d ? (
        <Loading rows={6} label="Memuat rekap…" />
      ) : m.galat && !d ? (
        <ErrorState title="Rekap gagal dimuat" message={m.galat.pesan} kind={errorKindFromStatus(m.galat.status)} onRetry={() => void m.muatUlang()} />
      ) : d ? (
        <>
          <View style={s.kpi}>
            <KpiCard label="Tingkat kehadiran" value={persen(d.report.summary.attendanceRate)} style={s.sel} />
            <KpiCard label={`Terlambat (toleransi ${d.report.summary.lateToleranceMin} m)`} value={`${d.report.summary.lateCount}×`} style={s.sel} />
            <KpiCard label={p?.isRunning ? 'Hari kerja berjalan' : 'Hari kerja'} value={String(d.report.summary.calendarWorkDays)} style={s.sel} />
            <KpiCard label="Lembur" value={`${angka(d.report.summary.overtimeHours)} j`} style={s.sel} />
          </View>
          {d.can.export ? (
            <DesktopOnlyBanner
              message="Ekspor Excel dan PDF rekap (siap payroll) hanya tersedia di desktop."
              onSendLink={tautan.mengirim ? undefined : () => tautan.kirim(d.web_path, `Absensi › Rekap › ${d.period.label}`, 'Ekspor Excel/PDF dilakukan dari komputer.')}
            />
          ) : null}
          <SectionHeader title={`Rekap per karyawan · ${d.report.summary.employees}`} />
          <SearchInput value={cari} onChangeText={setCari} placeholder="Cari nama karyawan" />
          {d.divisions.length > 1 ? (
            <ChipScroller contentStyle={{ paddingHorizontal: 0 }}>
              <Chip label="Semua divisi" selected={divisi === null} onPress={() => setDivisi(null)} />
              {d.divisions.map((v) => (
                <Chip key={v.id} label={v.name} selected={divisi === v.id} onPress={() => setDivisi(divisi === v.id ? null : v.id)} />
              ))}
            </ChipScroller>
          ) : null}
          {d.report.rows.length === 0 ? (
            <EmptyState icon="calendar-search" title="Belum ada data absensi" description="Tidak ada karyawan terjadwal atau tercatat pada bulan dan filter ini." actionLabel={divisi || q ? 'Hapus filter' : undefined} onAction={divisi || q ? hapusFilter : undefined} />
          ) : (
            <Card variant="flat" style={{ padding: 0, overflow: 'hidden' }}>
              {d.report.rows.map((r, i) => {
                const ringkas = ringkasBaris(r);
                return (
                  <Pressable
                    key={r.userId}
                    onPress={() => router.push({ pathname: '/absensi-tim/rekap/[userId]', params: { userId: r.userId, bulan: d.period.month } } as never)}
                    scaleTo={1}
                    accessibilityRole="button"
                    accessibilityLabel={`${r.name}, kehadiran ${persen(r.attendanceRate)}, ${ringkas}`}
                    style={[s.baris, i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider } : null]}
                  >
                    <Avatar name={r.name} size="md" />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="title" numberOfLines={1}>
                        {r.name}
                      </Text>
                      <Text variant="meta" style={{ fontSize: 14 }}>
                        {ringkas}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text variant="title" weight={700}>
                        {persen(r.attendanceRate)}
                      </Text>
                      {r.absentDays > 0 ? <Badge tone="danger">{`${r.absentDays} alpha`}</Badge> : null}
                    </View>
                    <Icon name="chevron-right" size={20} color={colors.muted} />
                  </Pressable>
                );
              })}
            </Card>
          )}
        </>
      ) : null}
      <BottomSheet visible={pilihBulan} onClose={() => setPilihBulan(false)} title="Pilih bulan" scrollable>
        <View accessibilityRole="radiogroup">
          {pilihan.map((b) => (
            <Radio
              key={b}
              label={`${labelBulan(b)}${b === bulanKini ? ' · berjalan' : ''}`}
              selected={(p?.month ?? bulanKini) === b}
              onSelect={() => {
                setBulan(b);
                setPilihBulan(false);
              }}
            />
          ))}
        </View>
        <Text variant="meta" style={{ fontSize: 14 }}>
          13 bulan terakhir. Bulan berjalan dihitung sampai hari ini.
        </Text>
      </BottomSheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  bulan: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 6 },
  kpi: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sel: { flexBasis: '47%', flexGrow: 1 },
  baris: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72, paddingVertical: 12, paddingHorizontal: 16 },
});
