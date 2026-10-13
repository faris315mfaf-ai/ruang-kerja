/**
 * Laporan tim (pembaca: atasan langsung, Kepala Divisi, Direksi, HR, Super
 * Admin; `GET /laporan/tim`, mockup 06 › 34-1/34-6): navigasi tanggal, sudah
 * vs belum lapor, saring status & divisi, daftar orang. Draf orang lain hanya
 * lencana (isinya tidak pernah dikirim server). Ketuk laporan → sheet detail.
 */
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { laporanTim, type LaporanTimItem } from '@/api/laporan';
import { tandaiLaporanTimDiizinkan, tandaiLaporanTimDitolak } from '@/features/laporan/akses';
import { DetailLaporanSheet } from '@/features/laporan/DetailLaporanSheet';
import { geserHari, tanggalLaporan } from '@/features/laporan/format';
import { metaLaporan } from '@/features/laporan/IsiLaporanBaca';
import { useMuatBaca } from '@/features/laporan/useMuatBaca';
import { jam } from '@/lib/format';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme';
import { Avatar, Badge, Banner, Card, Chip, ChipScroller, EmptyState, ErrorState, IconButton, Loading, LockedState, Pressable, Screen, SubAppBar, Text, errorKindFromStatus, Icon } from '@/ui';

type Saring = 'semua' | 'sudah' | 'draf' | 'belum';

interface Baris {
  id: string;
  nama: string;
  divisi: string | null;
  jenis: 'sudah' | 'draf' | 'belum';
  laporan: LaporanTimItem | null;
}

export default function LaporanTimLayar(): React.JSX.Element {
  const { colors } = useTheme();
  const { user } = useSession();
  const [tanggal, setTanggal] = useState<string | undefined>(undefined);
  const [saring, setSaring] = useState<Saring>('semua');
  const [divisi, setDivisi] = useState<string | null>(null);
  const [buka, setBuka] = useState<LaporanTimItem | null>(null);
  const ambil = useCallback(() => laporanTim(tanggal), [tanggal]);
  const m = useMuatBaca(`tim:${user?.id ?? ''}:${tanggal ?? 'hari-ini'}`, ambil);
  const d = m.data;

  useEffect(() => {
    if (!user) return;
    if (m.galat?.status === 403) tandaiLaporanTimDitolak(user.id);
    else if (d) tandaiLaporanTimDiizinkan(user.id);
  }, [m.galat, d, user]);

  const baris: Baris[] = useMemo(() => {
    if (!d) return [];
    const hasil: Baris[] = d.reports.map((r) => ({ id: r.user.id, nama: r.user.name, divisi: r.user.division, jenis: 'sudah', laporan: r }));
    for (const o of d.missing) {
      hasil.push({ id: o.id, nama: o.name, divisi: o.division, jenis: o.draft ? 'draf' : 'belum', laporan: null });
    }
    return hasil;
  }, [d]);

  const diDivisi = baris.filter((b) => divisi === null || (b.divisi ?? 'Tanpa divisi') === divisi);
  const hitung = { semua: diDivisi.length, sudah: diDivisi.filter((b) => b.jenis === 'sudah').length, draf: diDivisi.filter((b) => b.jenis === 'draf').length, belum: diDivisi.filter((b) => b.jenis === 'belum').length };
  const tampil = diDivisi.filter((b) => saring === 'semua' || b.jenis === saring);

  if (m.galat?.status === 403) {
    return (
      <Screen header={<SubAppBar title="Laporan tim" />} contentStyle={{ paddingTop: 24 }}>
        <LockedState title="Tidak ada laporan tim" reason="Laporan tim hanya untuk atasan langsung, Kepala Divisi, Direksi, dan HR." actionLabel="Kembali" onAction={() => router.back()} />
      </Screen>
    );
  }

  const hariIni = d?.is_today ?? tanggal === undefined;
  const belumLapor = d ? d.missing.length : 0;

  return (
    <Screen header={<SubAppBar title={hariIni ? 'Laporan tim hari ini' : 'Laporan tim'} />} refreshing={m.menyegarkan} onRefresh={() => void m.muatUlang(true)}>
      {m.offlineSejak !== null ? <Banner tone="neutral" icon="cloud-off" message={`Anda sedang offline · menampilkan data tersimpan pukul ${jam(new Date(m.offlineSejak))}`} /> : null}
      {d || tanggal ? (
        <Card style={s.tanggal} variant="tight">
          <IconButton icon="chevron-left" label="Hari sebelumnya" variant="ghost" size={44} onPress={() => d && setTanggal(geserHari(d.date, -1))} disabled={!d} />
          <View style={{ flex: 1, alignItems: 'center' }} accessibilityLiveRegion="polite">
            <Text variant="title" weight={700}>
              {hariIni ? 'Hari ini' : d ? tanggalLaporan(d.date).split(',')[0] : 'Memuat…'}
            </Text>
            {d ? (
              <Text variant="meta" style={{ fontSize: 14 }}>
                {tanggalLaporan(d.date)}
              </Text>
            ) : null}
          </View>
          <IconButton icon="chevron-right" label="Hari berikutnya" variant="ghost" size={44} onPress={() => d && setTanggal(geserHari(d.date, 1))} disabled={!d || hariIni} />
        </Card>
      ) : null}
      {m.memuat && !d ? (
        <Loading rows={5} label="Memuat laporan tim…" />
      ) : m.galat && !d ? (
        <ErrorState message={m.galat.pesan} kind={errorKindFromStatus(m.galat.status)} onRetry={() => void m.muatUlang()} />
      ) : d ? (
        <>
          <View style={s.kpi}>
            <Card style={{ flex: 1, gap: 4 }} variant="tight">
              <Text variant="meta" style={{ fontSize: 15 }}>
                Sudah lapor
              </Text>
              <Text variant="kpi" tone="success">
                {String(d.totals.reported)}
              </Text>
            </Card>
            <Card style={{ flex: 1, gap: 4 }} variant="tight">
              <Text variant="meta" style={{ fontSize: 15 }}>
                Belum lapor
              </Text>
              <Text variant="kpi" tone={belumLapor > 0 ? 'danger' : 'text'}>
                {String(belumLapor)}
              </Text>
            </Card>
          </View>
          <ChipScroller contentStyle={{ paddingHorizontal: 0 }}>
            <Chip label="Semua" count={hitung.semua} selected={saring === 'semua'} onPress={() => setSaring('semua')} />
            <Chip label="Sudah" count={hitung.sudah} selected={saring === 'sudah'} onPress={() => setSaring('sudah')} />
            <Chip label="Draf" count={hitung.draf} selected={saring === 'draf'} onPress={() => setSaring('draf')} />
            <Chip label="Belum" count={hitung.belum} selected={saring === 'belum'} onPress={() => setSaring('belum')} />
          </ChipScroller>
          {d.divisions.length > 1 ? (
            <ChipScroller contentStyle={{ paddingHorizontal: 0 }}>
              <Chip label="Semua divisi" variant="tonal" selected={divisi === null} onPress={() => setDivisi(null)} />
              {d.divisions.map((v) => (
                <Chip key={v.id ?? v.name} label={v.name} count={v.people} variant="tonal" selected={divisi === v.name} onPress={() => setDivisi(divisi === v.name ? null : v.name)} />
              ))}
            </ChipScroller>
          ) : null}
          {d.totals.people === 0 ? (
            <EmptyState icon="users" title="Belum ada laporan untuk dibaca" description="Tidak ada anggota yang laporannya Anda baca pada tanggal ini." />
          ) : tampil.length === 0 ? (
            <EmptyState icon="users" title="Tidak ada orang dengan status ini" variant="plain" />
          ) : (
            <Card variant="flat" style={{ padding: 0, overflow: 'hidden' }}>
              {tampil.map((b, i) => {
                const r = b.laporan;
                const sub = r ? metaLaporan(r.items_count, r.hours, r.submitted_at ? jam(r.submitted_at) : null, r.blockers !== null && r.blockers !== '') : b.jenis === 'draf' ? 'Draf belum dikirim' : 'Belum ada laporan';
                const lencana = b.jenis === 'sudah' ? <Badge tone="success">Sudah lapor</Badge> : b.jenis === 'draf' ? <Badge tone="warning">Draf</Badge> : <Badge tone="danger">Belum lapor</Badge>;
                const isi = (
                  <>
                    <Avatar name={b.nama} size="md" />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="title" numberOfLines={1}>
                        {b.nama}
                      </Text>
                      <Text variant="meta" style={{ fontSize: 14 }} numberOfLines={2}>
                        {sub}
                      </Text>
                    </View>
                    {lencana}
                    {r ? <Icon name="chevron-right" size={20} color={colors.muted} /> : null}
                  </>
                );
                const gaya = [s.baris, i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider } : null];
                return r ? (
                  <Pressable key={`${b.id}-${r.id}`} onPress={() => setBuka(r)} scaleTo={1} accessibilityRole="button" accessibilityLabel={`${b.nama}, sudah lapor, ${sub}`} style={gaya}>
                    {isi}
                  </Pressable>
                ) : (
                  <View key={b.id} style={gaya} accessible accessibilityLabel={`${b.nama}, ${sub}`}>
                    {isi}
                  </View>
                );
              })}
            </Card>
          )}
          <Text variant="meta" style={{ fontSize: 14 }}>
            Ditampilkan: bawahan langsung (atasan) atau seluruh divisi (Kepala Divisi).
          </Text>
        </>
      ) : null}
      <DetailLaporanSheet laporan={buka} onClose={() => setBuka(null)} />
    </Screen>
  );
}

const s = StyleSheet.create({
  tanggal: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 8 },
  kpi: { flexDirection: 'row', gap: 12 },
  baris: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72, paddingVertical: 12, paddingHorizontal: 16 },
});
