/**
 * Absensi tim › Hari ini (mockup 11 › 19, 21): hero hadir sekarang + pil
 * Langsung/Tertunda (polling `poll_seconds`, berhenti saat layar tidak
 * terlihat), KPI, batang per divisi (angka + teks), Perlu ditinjau (maks. 3),
 * Lupa check-out kemarin (+ Koreksi HR), daftar per orang dengan chip status,
 * sheet filter lokasi/divisi, sheet detail orang. `GET /absensi/tim/hari-ini`.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { papanHariIni, type DivisiPapan, type OrangPapan, type PapanHariIni } from '@/api/hr';
import { jam } from '@/lib/format';
import { useTheme } from '@/theme';
import { Avatar, Badge, Banner, BottomSheet, Button, Card, Chip, ChipScroller, EmptyState, ErrorState, Hero, Loading, Pressable, Screen, SearchInput, SectionHeader, Text, errorKindFromStatus, useSnackbar, type Tone } from '@/ui';

import { BarisDefinisi } from '../KaryawanParts';
import { hariPendek } from '../format';
import { useMuat } from '../useMuat';
import { SheetKoreksi, type TargetKoreksi } from './Koreksi';
import { useLihatSelfie } from './Selfie';
import { KartuTemuan, useTinjau } from './Temuan';

type Saring = 'semua' | 'on_time' | 'late' | 'not_checked_in' | 'leave';

const NADA: Record<OrangPapan['state'], Tone> = { on_time: 'success', late: 'warning', leave: 'info', not_checked_in: 'neutral' };

export function TabHariIni({ header, judulCakupan, onBukaRekap }: { header: React.ReactNode; judulCakupan: string; onBukaRekap: () => void }): React.JSX.Element {
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const [lokasi, setLokasi] = useState<string | null>(null);
  const [divisi, setDivisi] = useState<string | null>(null);
  const [cari, setCari] = useState('');
  const [saring, setSaring] = useState<Saring>('semua');
  const [bukaFilter, setBukaFilter] = useState(false);
  const [detail, setDetail] = useState<OrangPapan | null>(null);
  const [koreksi, setKoreksi] = useState<TargetKoreksi | null>(null);

  const ambil = useCallback(() => papanHariIni(lokasi), [lokasi]);
  const m = useMuat<PapanHariIni>(`papan:${lokasi ?? ''}`, ambil);
  const d = m.data;
  const offline = m.offlineSejak !== null;
  const selfie = useLihatSelfie();
  const { setData, muatUlang } = m;
  const tinjau = useTinjau(
    useCallback(
      (id: string) => setData((lama) => (lama ? { ...lama, suspicious: { total: Math.max(0, lama.suspicious.total - 1), items: lama.suspicious.items.filter((x) => x.id !== id) } } : lama)),
      [setData],
    ),
  );

  const detik = d?.poll_seconds ?? 60;
  useFocusEffect(
    useCallback(() => {
      const t = setInterval(() => {
        if (AppState.currentState === 'active') void muatUlang('diam');
      }, Math.max(15, detik) * 1000);
      return () => clearInterval(t);
    }, [detik, muatUlang]),
  );

  const orang = useMemo(() => (d ? d.board.people.filter((p) => divisi === null || p.divisionId === divisi) : []), [d, divisi]);
  const divisiTampil: DivisiPapan[] = useMemo(() => (d ? d.board.divisions.filter((v) => divisi === null || v.id === divisi) : []), [d, divisi]);
  const ringkas = useMemo(() => {
    if (!d) return null;
    if (divisi === null) return d.board.summary;
    const hadir = orang.filter((p) => p.state === 'on_time' || p.state === 'late').length;
    return { ...d.board.summary, scheduled: orang.length, present: hadir, late: orang.filter((p) => p.state === 'late').length, onLeave: orang.filter((p) => p.state === 'leave').length, notCheckedIn: orang.filter((p) => p.state === 'not_checked_in').length };
  }, [d, divisi, orang]);

  const q = cari.trim().toLowerCase();
  const hitung = (k: Saring): number => (k === 'semua' ? orang.length : orang.filter((p) => p.state === k).length);
  const daftar = orang.filter((p) => (saring === 'semua' || p.state === saring) && (q === '' || p.name.toLowerCase().includes(q)));
  const filterAktif = (lokasi ? 1 : 0) + (divisi ? 1 : 0);

  const tersimpan = (pesan: string): void => {
    setKoreksi(null);
    snackbar.show({ message: pesan, variant: 'ok' });
    void muatUlang('diam');
  };

  return (
    <Screen header={header} refreshing={m.menyegarkan} onRefresh={() => void m.muatUlang('tarik')}>
      {offline ? <Banner tone="neutral" icon="cloud-off" message={`Anda offline. Menampilkan data pukul ${jam(new Date(m.offlineSejak ?? 0))}; pembaruan otomatis tertunda.`} /> : null}
      <View style={s.barisAtas}>
        <Text variant="body" tone="muted" style={{ flex: 1 }}>
          {`${judulCakupan}${ringkas ? ` · ${ringkas.scheduled} orang` : ''}`}
        </Text>
        {d && (d.locations.length > 1 || d.divisions.length > 1) ? <Chip label={filterAktif > 0 ? `Filter · ${filterAktif}` : 'Filter'} icon="sliders-horizontal" selected={filterAktif > 0} onPress={() => setBukaFilter(true)} /> : null}
      </View>
      {m.memuat && !d ? (
        <Loading rows={6} label="Memuat absensi hari ini…" />
      ) : m.galat && !d ? (
        <ErrorState title="Absensi hari ini gagal dimuat" message={m.galat.status === 0 ? 'Periksa koneksi, lalu coba lagi. Data diperbarui otomatis tiap 60 detik.' : m.galat.pesan} kind={errorKindFromStatus(m.galat.status)} onRetry={() => void m.muatUlang()} />
      ) : d && ringkas ? (
        d.board.summary.scheduled === 0 ? (
          <EmptyState icon="calendar-off" title="Hari ini hari libur" description="Tidak ada karyawan terjadwal hari ini kecuali override khusus." actionLabel="Buka rekap" onAction={onBukaRekap} />
        ) : (
          <>
            <Hero accessibilityLabel={`Hadir sekarang ${ringkas.present} dari ${ringkas.scheduled}`}>
              <View style={s.barisAtas}>
                <Text variant="label" tone="onPrimary" style={{ flex: 1 }}>
                  Hadir sekarang
                </Text>
                <View style={[s.pil, { backgroundColor: colors.glassBorder }]} accessible accessibilityLabel={m.tertunda ? 'Pembaruan tertunda' : `Langsung, diperbarui ${m.diperbarui ? jam(new Date(m.diperbarui)) : ''}`}>
                  <View style={[s.titik, { backgroundColor: m.tertunda ? colors.fill.warning : colors.fill.teal }]} />
                  <Text variant="meta" tone="onPrimary" weight={700}>
                    {m.tertunda ? 'Tertunda' : 'Langsung'}
                  </Text>
                </View>
              </View>
              <Text variant="kpi" tone="onPrimary">{`${ringkas.present} / ${ringkas.scheduled}`}</Text>
              <Text variant="label" tone="onPrimary" weight={500}>
                {`${ringkas.scheduled > 0 ? Math.round((ringkas.present / ringkas.scheduled) * 100) : 0}% · termasuk ${ringkas.late} terlambat`}
              </Text>
            </Hero>
            <View style={s.kpi}>
              <Kpi label="Terjadwal" nilai={ringkas.scheduled} />
              <Kpi label="Cuti/izin" nilai={ringkas.onLeave} />
              <Kpi label="Belum" nilai={ringkas.notCheckedIn} />
            </View>

            {divisiTampil.length > 1 ? (
              <Card style={{ gap: 12 }}>
                <Text variant="h3" accessibilityRole="header">
                  Kehadiran per divisi
                </Text>
                {divisiTampil.map((v) => (
                  <BatangDivisi key={v.id ?? v.name} v={v} />
                ))}
                <View style={s.legenda}>
                  <Legenda warna={colors.success} label="Hadir" />
                  <Legenda warna={colors.accentBlue} label="Cuti/izin" />
                  <Legenda warna={colors.borderStrong} label="Belum" />
                </View>
              </Card>
            ) : null}

            {d.suspicious.total > 0 ? (
              <View style={{ gap: 10 }}>
                <SectionHeader title={`Perlu ditinjau · ${d.suspicious.total}`} actionLabel={`Lihat semua (${d.suspicious.total})`} onAction={() => router.push('/absensi-tim/perlu-ditinjau' as never)} />
                {d.suspicious.items.slice(0, 3).map((t) => (
                  <KartuTemuan key={t.id} t={t} offline={offline} sibuk={tinjau.sibukId === t.id} onSelfie={selfie.lihat} onTinjau={tinjau.tinjau} />
                ))}
                {!d.can.review ? (
                  <Text variant="meta" style={{ fontSize: 14 }}>
                    Atasan langsung bisa melihat selfie bawahannya; menandai ditinjau dan koreksi hanya HR.
                  </Text>
                ) : null}
              </View>
            ) : null}

            {d.missing_check_out.length > 0 ? (
              <View style={{ gap: 10 }}>
                <SectionHeader title="Lupa check-out kemarin" />
                <Card variant="flat" style={{ padding: 0, overflow: 'hidden' }}>
                  {d.missing_check_out.map((x, i) => (
                    <View key={x.dayId} style={[s.baris, i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider } : null]}>
                      <Avatar name={x.name} size="md" />
                      <View style={{ flex: 1 }}>
                        <Text variant="title" numberOfLines={1}>
                          {x.name}
                        </Text>
                        <Text variant="meta" style={{ fontSize: 14 }}>
                          {`${hariPendek(x.workDate)} · masuk ${jam(x.checkInAt)}${x.locationName ? ` · ${x.locationName}` : ''}`}
                        </Text>
                      </View>
                      {d.can.correct ? (
                        <Button
                          title="Koreksi"
                          variant="tonal"
                          size="sm"
                          onPress={() => setKoreksi({ userId: x.userId, name: x.name, workDate: x.workDate, checkInAt: x.checkInAt })}
                          disabled={offline}
                          style={{ minHeight: 48 }}
                          accessibilityHint={`Koreksi absensi ${x.name}`}
                        />
                      ) : null}
                    </View>
                  ))}
                </Card>
                {!d.can.correct ? <Banner tone="info" message="Koreksi absensi dilakukan HR. Minta HR mengoreksi, atau anggota mengajukan “Koreksi absensi” dari menu Pengajuan." /> : null}
              </View>
            ) : null}

            <SectionHeader title="Daftar per orang" />
            <SearchInput value={cari} onChangeText={setCari} placeholder="Cari nama" />
            <ChipScroller contentStyle={{ paddingHorizontal: 0 }}>
              <Chip label="Semua" count={hitung('semua')} selected={saring === 'semua'} onPress={() => setSaring('semua')} />
              <Chip label="Hadir" count={hitung('on_time')} selected={saring === 'on_time'} onPress={() => setSaring('on_time')} />
              <Chip label="Terlambat" count={hitung('late')} selected={saring === 'late'} onPress={() => setSaring('late')} />
              <Chip label="Belum check-in" count={hitung('not_checked_in')} selected={saring === 'not_checked_in'} onPress={() => setSaring('not_checked_in')} />
              <Chip label="Cuti/izin" count={hitung('leave')} selected={saring === 'leave'} onPress={() => setSaring('leave')} />
            </ChipScroller>
            {daftar.length === 0 ? (
              <EmptyState icon="users" title="Tidak ada orang dengan status ini" variant="plain" />
            ) : (
              <Card variant="flat" style={{ padding: 0, overflow: 'hidden' }}>
                {daftar.map((p, i) => (
                  <Pressable
                    key={p.id}
                    onPress={() => setDetail(p)}
                    scaleTo={1}
                    accessibilityRole="button"
                    accessibilityLabel={`${p.name}, ${p.statusLabel ?? ''}${p.checkInAt ? `, check-in ${jam(p.checkInAt)}` : ''}`}
                    style={[s.baris, i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider } : null]}
                  >
                    <Avatar name={p.name} size="md" />
                    <View style={{ flex: 1 }}>
                      <Text variant="title" numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text variant="meta" style={{ fontSize: 14 }} numberOfLines={1}>
                        {[p.divisionName, p.shiftName, p.checkInAt ? jam(p.checkInAt) : null].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <Badge tone={NADA[p.state]}>{`${p.statusLabel ?? ''}${p.state === 'late' && p.lateMinutes > 0 ? ` ${p.lateMinutes}m` : ''}`}</Badge>
                  </Pressable>
                ))}
              </Card>
            )}
          </>
        )
      ) : null}

      <BottomSheet visible={bukaFilter} onClose={() => setBukaFilter(false)} title="Filter" scrollable>
        {d && d.locations.length > 1 ? (
          <>
            <Text variant="overline">Lokasi</Text>
            <View style={s.bungkus}>
              <Chip label="Semua lokasi" selected={lokasi === null} onPress={() => setLokasi(null)} />
              {d.locations.map((l) => (
                <Chip key={l.id} label={l.name} selected={lokasi === l.id} onPress={() => setLokasi(l.id)} />
              ))}
            </View>
          </>
        ) : null}
        {d && d.divisions.length > 1 ? (
          <>
            <Text variant="overline">Divisi</Text>
            <View style={s.bungkus}>
              <Chip label="Semua" selected={divisi === null} onPress={() => setDivisi(null)} />
              {d.divisions.map((v) => (
                <Chip key={v.id} label={v.name} selected={divisi === v.id} onPress={() => setDivisi(v.id)} />
              ))}
            </View>
          </>
        ) : null}
        <View style={s.aksi}>
          <Button
            title="Atur ulang"
            variant="quiet"
            onPress={() => {
              setLokasi(null);
              setDivisi(null);
            }}
            style={{ flex: 1 }}
          />
          <Button title="Selesai" onPress={() => setBukaFilter(false)} style={{ flex: 1 }} />
        </View>
      </BottomSheet>

      <BottomSheet visible={detail !== null} onClose={() => setDetail(null)} scrollable>
        {detail ? (
          <View style={{ gap: 10 }}>
            <View style={s.baris}>
              <Avatar name={detail.name} size="lg" />
              <View style={{ flex: 1, gap: 4 }}>
                <Text variant="h3" accessibilityRole="header">
                  {detail.name}
                </Text>
                <Text variant="meta" style={{ fontSize: 14 }}>
                  {[detail.divisionName, detail.shiftName].filter(Boolean).join(' · ')}
                </Text>
                <Badge tone={NADA[detail.state]} style={{ alignSelf: 'flex-start' }}>{`${detail.statusLabel ?? ''}${detail.state === 'late' && detail.lateMinutes > 0 ? ` ${detail.lateMinutes}m` : ''}`}</Badge>
              </View>
            </View>
            <BarisDefinisi label="Check-in">{detail.checkInAt ? `${jam(detail.checkInAt)}${detail.locationName ? ` · ${detail.locationName}` : ''}` : 'Belum'}</BarisDefinisi>
            <BarisDefinisi label="Check-out">{detail.checkOutAt ? jam(detail.checkOutAt) : 'Belum'}</BarisDefinisi>
            {detail.isSuspicious ? <Banner tone="warn" message="Check-in ini ditandai mencurigakan; tinjau di “Perlu ditinjau”." /> : null}
            <View style={s.aksi}>
              <Button
                title="Rekap bulan ini"
                variant="outline"
                onPress={() => {
                  const id = detail.id;
                  setDetail(null);
                  router.push(`/absensi-tim/rekap/${id}` as never);
                }}
                style={{ flex: 1 }}
              />
              {d?.can.correct ? (
                <Button
                  title="Koreksi"
                  variant="tonal"
                  onPress={() => {
                    const p = detail;
                    setDetail(null);
                    setKoreksi({ userId: p.id, name: p.name, workDate: d.board.date, checkInAt: p.checkInAt, checkOutAt: p.checkOutAt });
                  }}
                  disabled={offline}
                  style={{ flex: 1 }}
                />
              ) : null}
            </View>
          </View>
        ) : null}
      </BottomSheet>

      <SheetKoreksi target={koreksi} offline={offline} onClose={() => setKoreksi(null)} onTersimpan={(pesan) => tersimpan(pesan)} />
      {selfie.elemen}
    </Screen>
  );
}

function Kpi({ label, nilai }: { label: string; nilai: number }): React.JSX.Element {
  return (
    <Card variant="tight" style={{ flex: 1, gap: 2 }} accessibilityLabel={`${label}: ${nilai}`}>
      <Text variant="kpi">{String(nilai)}</Text>
      <Text variant="meta" style={{ fontSize: 14 }}>
        {label}
      </Text>
    </Card>
  );
}

function Legenda({ warna, label }: { warna: string; label: string }): React.JSX.Element {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={[s.titik, { backgroundColor: warna }]} />
      <Text variant="meta" style={{ fontSize: 14 }}>
        {label}
      </Text>
    </View>
  );
}

function BatangDivisi({ v }: { v: DivisiPapan }): React.JSX.Element {
  const { colors } = useTheme();
  const total = Math.max(1, v.scheduled);
  const hadir = v.onTime + v.late;
  const teks = `${hadir}/${v.scheduled}${v.late > 0 ? ` · ${v.late} terlambat` : ''}${v.onLeave > 0 ? ` · ${v.onLeave} cuti/izin` : ''}`;
  return (
    <View style={{ gap: 6 }} accessible accessibilityLabel={`${v.name}: hadir ${teks}, belum ${v.notCheckedIn}`}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <Text variant="label" style={{ flex: 1 }} numberOfLines={1}>
          {v.name}
        </Text>
        <Text variant="meta" style={{ fontSize: 14 }}>
          {teks}
        </Text>
      </View>
      <View style={[s.trek, { backgroundColor: colors.surface2 }]}>
        <View style={{ flex: hadir / total, backgroundColor: colors.success }} />
        <View style={{ flex: v.onLeave / total, backgroundColor: colors.accentBlue }} />
        <View style={{ flex: v.notCheckedIn / total, backgroundColor: colors.borderStrong }} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  barisAtas: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pil: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  titik: { width: 10, height: 10, borderRadius: 5 },
  kpi: { flexDirection: 'row', gap: 10 },
  legenda: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  baris: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72, paddingVertical: 12, paddingHorizontal: 16 },
  trek: { height: 12, borderRadius: 6, overflow: 'hidden', flexDirection: 'row' },
  bungkus: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  aksi: { flexDirection: 'row', gap: 10, marginTop: 4 },
});
