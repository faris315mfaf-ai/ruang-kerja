/**
 * Saldo cuti HR — baca saja (mockup 11 › 24, keputusan D20): jenis & tahun,
 * cari, daftar per karyawan (jatah, bawaan, terpakai, menunggu, sisa;
 * Prorata / Belum berhak), sheet detail + riwayat penyesuaian. Ubah jatah,
 * penyesuaian, buat saldo, impor = desktop. `GET /admin/saldo-cuti`.
 */
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { daftarSaldo, riwayatSaldo, type BarisSaldo, type DaftarSaldo, type RiwayatSaldo } from '@/api/hr';
import { angka, deltaHari } from '@/features/hr/format';
import { useMuat } from '@/features/hr/useMuat';
import { useTautanDesktop } from '@/features/hr/useTautanDesktop';
import { jam, tanggalDariYMD, tanggalPendek } from '@/lib/format';
import { useTheme } from '@/theme';
import { Avatar, Badge, Banner, BottomSheet, Card, Chip, ChipScroller, DesktopOnlyBanner, EmptyState, ErrorState, KpiCard, Loading, LockedState, Pressable, Screen, SearchInput, SkeletonRow, SubAppBar, Tag, Text, errorKindFromStatus } from '@/ui';

function rincian(b: BarisSaldo): string {
  if (!b.eligible) return b.joined_at ? `Masuk ${tanggalDariYMD(b.joined_at)}` : 'Belum memenuhi masa kerja';
  const x = b.balance;
  if (!x) return 'Saldo tahun ini belum dibuat';
  const bagian = [`Jatah ${angka(x.entitled)}`];
  if (x.carried_over + x.opening > 0) bagian.push(`bawaan ${angka(x.carried_over + x.opening)}`);
  if (x.adjustments !== 0) bagian.push(`penyesuaian ${x.adjustments > 0 ? '+' : '−'}${angka(Math.abs(x.adjustments))}`);
  bagian.push(`terpakai ${angka(x.used)}`);
  if (x.pending > 0) bagian.push(`menunggu ${angka(x.pending)}`);
  return bagian.join(' · ');
}

export default function SaldoCutiLayar(): React.JSX.Element {
  const { colors } = useTheme();
  const tautan = useTautanDesktop();
  const [jenis, setJenis] = useState<string | null>(null);
  const [tahun, setTahun] = useState<number | null>(null);
  const [cari, setCari] = useState('');
  const [q, setQ] = useState('');
  const [buka, setBuka] = useState<BarisSaldo | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQ(cari.trim()), 350);
    return () => clearTimeout(t);
  }, [cari]);

  const ambil = useCallback(() => daftarSaldo({ jenis, tahun, cari: q || null }), [jenis, tahun, q]);
  const m = useMuat<DaftarSaldo>(`saldo:${jenis ?? ''}:${tahun ?? ''}:${q}`, ambil);
  const d = m.data;

  if (m.galat && (m.galat.status === 403 || m.galat.status === 404)) {
    return (
      <Screen header={<SubAppBar title="Saldo cuti" />} contentStyle={{ paddingTop: 24 }}>
        <LockedState title="Halaman tidak ditemukan" reason="Saldo cuti semua karyawan hanya untuk HR dan Super Admin." actionLabel="Kembali" onAction={() => router.back()} />
      </Screen>
    );
  }

  const belumDibuat = d !== null && d.rows.length > 0 && d.rows.every((r) => r.balance === null);

  return (
    <Screen header={<SubAppBar title="Saldo cuti" />} refreshing={m.menyegarkan} onRefresh={() => void m.muatUlang('tarik')}>
      {m.offlineSejak !== null ? <Banner tone="neutral" icon="cloud-off" message={`Anda offline. Menampilkan data tersimpan pukul ${jam(new Date(m.offlineSejak))}.`} /> : null}
      {d?.type ? (
        <Text variant="h3" accessibilityRole="header">
          {`${d.type.name} ${d.year}`}
        </Text>
      ) : null}
      {d && d.types.length > 1 ? (
        <ChipScroller contentStyle={{ paddingHorizontal: 0 }}>
          {d.types.map((t) => (
            <Chip key={t.id} label={t.name} selected={d.type?.id === t.id} onPress={() => setJenis(t.id)} />
          ))}
        </ChipScroller>
      ) : null}
      {d && d.years.length > 1 ? (
        <ChipScroller contentStyle={{ paddingHorizontal: 0 }}>
          {d.years.map((y) => (
            <Chip key={y} label={String(y)} variant="tonal" selected={d.year === y} onPress={() => setTahun(y)} />
          ))}
        </ChipScroller>
      ) : null}
      <Text variant="meta" style={{ fontSize: 14 }}>
        Hanya HR dan Super Admin yang melihat saldo semua karyawan. Staf tidak melihat saldo cuti tahunan.
      </Text>
      {d ? <SearchInput value={cari} onChangeText={setCari} placeholder="Cari nama karyawan" /> : null}
      {m.memuat && !d ? (
        <Loading rows={6} label="Memuat saldo cuti…" />
      ) : m.galat && !d ? (
        <ErrorState message={m.galat.pesan} kind={errorKindFromStatus(m.galat.status)} onRetry={() => void m.muatUlang()} />
      ) : d ? (
        d.types.length === 0 ? (
          <EmptyState icon="calendar-days" title="Belum ada jenis cuti berkuota" description="Jenis cuti dengan kuota tahunan diatur HR di desktop." />
        ) : belumDibuat ? (
          <EmptyState icon="calendar-plus" title={`Saldo ${d.year} belum dibuat`} description="Saldo dibuat otomatis tiap 1 Januari atau saat pertama dipakai. Buat saldo tahun ini di desktop." />
        ) : d.rows.length === 0 ? (
          <EmptyState icon="search-x" title="Tidak ada karyawan yang cocok" actionLabel={q ? 'Hapus pencarian' : undefined} onAction={q ? () => setCari('') : undefined} />
        ) : (
          <Card variant="flat" style={{ padding: 0, overflow: 'hidden' }}>
            {d.rows.map((b, i) => {
              const sisa = b.balance?.available ?? null;
              const isi = (
                <>
                  <Avatar name={b.user.name} size="md" />
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text variant="title" numberOfLines={1}>
                        {b.user.name}
                      </Text>
                      {b.prorated && b.eligible ? <Tag tone="info">Prorata</Tag> : null}
                    </View>
                    <Text variant="meta" style={{ fontSize: 14 }}>
                      {rincian(b)}
                    </Text>
                  </View>
                  {!b.eligible ? (
                    <Badge tone="neutral">Belum berhak</Badge>
                  ) : sisa !== null ? (
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text variant="h3">{angka(sisa)}</Text>
                      <Text variant="meta" style={{ fontSize: 13 }}>
                        sisa hari
                      </Text>
                    </View>
                  ) : (
                    <Badge tone="neutral">Belum dibuat</Badge>
                  )}
                </>
              );
              const gaya = [s.baris, i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider } : null];
              return b.balance ? (
                <Pressable key={b.user.id} onPress={() => setBuka(b)} scaleTo={1} accessibilityRole="button" accessibilityLabel={`${b.user.name}, ${rincian(b)}, sisa ${angka(sisa)} hari. Buka detail`} style={gaya}>
                  {isi}
                </Pressable>
              ) : (
                <View key={b.user.id} style={gaya} accessible accessibilityLabel={`${b.user.name}, ${rincian(b)}`}>
                  {isi}
                </View>
              );
            })}
          </Card>
        )
      ) : null}
      {d ? (
        <DesktopOnlyBanner
          message="Mengubah jatah, penyesuaian saldo, buat saldo tahun baru, dan impor tersedia di desktop."
          onSendLink={tautan.mengirim ? undefined : () => tautan.kirim(d.web_path, 'Admin › Saldo cuti')}
        />
      ) : null}
      <SheetSaldo baris={buka} onClose={() => setBuka(null)} />
    </Screen>
  );
}

function SheetSaldo({ baris, onClose }: { baris: BarisSaldo | null; onClose: () => void }): React.JSX.Element {
  const id = baris?.balance?.id ?? null;
  const ambil = useCallback(() => (id ? riwayatSaldo(id) : Promise.reject(new Error('tanpa saldo'))), [id]);
  const m = useMuat<RiwayatSaldo>(id ? `saldo-riwayat:${id}` : null, ambil);
  const x = m.data?.balance ?? baris?.balance ?? null;
  return (
    <BottomSheet visible={baris !== null} onClose={onClose} title={baris ? `Saldo ${baris.user.name}` : 'Saldo'} scrollable>
      {x ? (
        <>
          <View style={s.kpi}>
            <KpiCard label="Jatah" value={angka(x.entitled)} style={s.sel} />
            <KpiCard label="Bawaan" value={angka(x.carried_over + x.opening)} style={s.sel} />
            <KpiCard label="Terpakai" value={angka(x.used)} style={s.sel} />
            <KpiCard label="Menunggu" value={angka(x.pending)} style={s.sel} />
          </View>
          <Text variant="body">{`Sisa yang bisa dipakai: ${angka(x.available)} hari${x.adjustments !== 0 ? ` (termasuk penyesuaian ${deltaHari(x.adjustments)})` : ''}`}</Text>
        </>
      ) : null}
      <Text variant="overline">Riwayat penyesuaian</Text>
      {m.memuat && !m.data ? (
        <SkeletonRow />
      ) : m.galat && !m.data ? (
        <Text variant="meta" tone="danger">
          {m.galat.pesan}
        </Text>
      ) : m.data && m.data.items.length === 0 ? (
        <Text variant="body" tone="muted">
          Belum ada penyesuaian.
        </Text>
      ) : (
        m.data?.items.map((it) => (
          <View key={it.id} style={{ gap: 2 }} accessible>
            <Text variant="label">{`${deltaHari(it.delta_days)} · ${it.reason}`}</Text>
            <Text variant="meta" style={{ fontSize: 14 }}>
              {`${it.actor ?? 'Sistem'} · ${tanggalPendek(it.created_at)}`}
            </Text>
          </View>
        ))
      )}
      <Text variant="meta" style={{ fontSize: 14 }}>
        Saldo tidak pernah minus; jatah tidak boleh kurang dari terpakai + menunggu.
      </Text>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  baris: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72, paddingVertical: 12, paddingHorizontal: 16 },
  kpi: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sel: { flexBasis: '47%', flexGrow: 1 },
});
