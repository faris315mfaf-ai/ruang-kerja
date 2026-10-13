/**
 * Pengajuan saya (mockup 04-pengajuan-persetujuan/01, 27): banner revisi,
 * kartu saldo (non-staf saja — server tidak mengirim saldo ke staf), chip
 * status berhitungan, filter tahun, daftar kartu, FAB "Ajukan"; memuat,
 * kosong, galat, dan offline (tembolok terakhir + FAB nonaktif).
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { daftarPengajuanSaya, type FilterStatus, type HalamanPengajuan, type ItemPengajuan, type KartuSaldo } from '@/api/pengajuan';
import { KartuPengajuan } from '@/features/pengajuan/KartuPengajuan';
import { angkaHari, jamKantor } from '@/features/pengajuan/format';
import { bacaTembolok, tulisTembolok, versiDaftarSekarang } from '@/features/pengajuan/simpanan';
import { useSession } from '@/session/SessionProvider';
import { radius, useTheme } from '@/theme';
import {
  Banner,
  BottomSheet,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Fab,
  Gradient,
  Icon,
  ListRow,
  Screen,
  Skeleton,
  SubAppBar,
  Text,
  errorKindFromStatus,
} from '@/ui';

const CHIP: { value: FilterStatus; label: string }[] = [
  { value: 'semua', label: 'Semua' },
  { value: 'menunggu', label: 'Menunggu' },
  { value: 'disetujui', label: 'Disetujui' },
  { value: 'ditolak', label: 'Ditolak' },
  { value: 'revisi', label: 'Perlu revisi' },
  { value: 'draf', label: 'Draf' },
  { value: 'dibatalkan', label: 'Dibatalkan' },
];

function KartuSaldoUtama({ kartu }: { kartu: KartuSaldo }): React.JSX.Element {
  const { colors, shadows } = useTheme();
  const b = kartu.balance;
  const jatah = b ? b.total : 0;
  const sisa = b ? b.remaining : 0;
  const persen = jatah > 0 ? Math.min(1, Math.max(0, (jatah - sisa) / jatah)) : 0;
  return (
    <View style={[s.saldo, { boxShadow: shadows.glow }]} accessible accessibilityLabel={`${kartu.type.name} ${kartu.year}: ${angkaHari(sisa)} hari tersisa`}>
      <Gradient name="aksi" style={[StyleSheet.absoluteFill, { borderRadius: radius.card }]} />
      <View style={s.saldoAtas}>
        <Text variant="label" weight={500} style={{ color: colors.primaryFg }}>
          {kartu.type.name}
        </Text>
        <Text variant="meta" style={{ color: colors.primaryFg, opacity: 0.85 }}>
          {kartu.year}
        </Text>
      </View>
      <Text style={{ color: colors.primaryFg }}>
        <Text variant="display" weight={800} style={{ color: colors.primaryFg }}>
          {angkaHari(sisa)}
        </Text>
        <Text variant="body" style={{ color: colors.primaryFg }}>
          {' '}
          hari tersisa
        </Text>
      </Text>
      <View style={[s.trek, { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
        <View style={[s.isiTrek, { width: `${Math.round(persen * 100)}%`, backgroundColor: colors.primaryFg }]} />
      </View>
      {b ? (
        <Text variant="meta" style={{ color: colors.primaryFg, opacity: 0.9 }}>
          Terpakai {angkaHari(b.used)} · Tertahan {angkaHari(b.pending)} · Jatah {angkaHari(b.total)} hari
        </Text>
      ) : null}
    </View>
  );
}

function KartuSaldoKecil({ kartu }: { kartu: KartuSaldo }): React.JSX.Element {
  const judul = kartu.kind === 'ineligible' ? 'Belum berhak' : kartu.balance ? `${angkaHari(kartu.balance.remaining)} hari` : 'Tidak memotong cuti';
  const sub =
    kartu.type.category === 'sick' && kartu.type.requires_attachment_after_days
      ? `Surat dokter wajib bila lebih dari ${kartu.type.requires_attachment_after_days} hari`
      : kartu.type.category === 'permit'
        ? 'Per jam atau per hari'
        : (kartu.type.description ?? '');
  return (
    <Card variant="tight" style={s.kecil}>
      <Text variant="meta">{kartu.type.name}</Text>
      <Text variant="title" weight={800} numberOfLines={1}>
        {judul}
      </Text>
      {sub ? (
        <Text variant="meta" numberOfLines={2}>
          {sub}
        </Text>
      ) : null}
    </Card>
  );
}

export default function LayarPengajuanSaya(): React.JSX.Element {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const userId = user?.id ?? 'anon';
  const tahunIni = new Date().getFullYear();

  const [status, setStatus] = useState<FilterStatus>('semua');
  const [tahun, setTahun] = useState<number | null>(null);
  const [data, setData] = useState<HalamanPengajuan | null>(null);
  const [daftar, setDaftar] = useState<ItemPengajuan[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [menyegarkan, setMenyegarkan] = useState(false);
  const [memuatLagi, setMemuatLagi] = useState(false);
  const [galat, setGalat] = useState<ApiError | null>(null);
  const [luring, setLuring] = useState<string | null>(null);
  const [sheetTahun, setSheetTahun] = useState(false);
  const versi = useRef(-1);

  const muat = useCallback(
    async (opsi: { status: FilterStatus; tahun: number | null; segarkan?: boolean }): Promise<void> => {
      if (opsi.segarkan) {
        setMenyegarkan(true);
      } else {
        setMemuat(true);
      }
      setGalat(null);
      try {
        const hasil = await daftarPengajuanSaya({ status: opsi.status, tahun: opsi.tahun, page: 1 });
        setData(hasil);
        setDaftar(hasil.requests);
        setLuring(null);
        if (opsi.status === 'semua' && opsi.tahun === null) {
          tulisTembolok(userId, hasil);
        }
      } catch (err) {
        const e = err instanceof ApiError ? err : new ApiError({ status: 500, message: 'Pengajuan tidak dapat dimuat.' });
        if (e.status === 0) {
          const t = bacaTembolok(userId);
          if (t) {
            setData(t.halaman);
            setDaftar(t.halaman.requests);
            setLuring(jamKantor(t.savedAt));
            setStatus('semua');
            setTahun(null);
            return;
          }
        }
        setGalat(e);
      } finally {
        setMemuat(false);
        setMenyegarkan(false);
      }
    },
    [userId],
  );

  // Muat saat layar fokus pertama kali & setiap kembali setelah ada perubahan (kirim/batal/hapus).
  useFocusEffect(
    useCallback(() => {
      const v = versiDaftarSekarang();
      if (versi.current !== v) {
        versi.current = v;
        void muat({ status, tahun, segarkan: versi.current > 0 && data !== null });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps -- hanya saat fokus
    }, [muat]),
  );

  const pilihStatus = (v: FilterStatus): void => {
    if (luring) {
      return;
    }
    setStatus(v);
    void muat({ status: v, tahun });
  };

  const pilihTahun = (v: number | null): void => {
    setSheetTahun(false);
    setTahun(v);
    void muat({ status, tahun: v });
  };

  const muatBerikut = async (): Promise<void> => {
    if (!data || memuatLagi || data.meta.current_page >= data.meta.last_page) {
      return;
    }
    setMemuatLagi(true);
    try {
      const hasil = await daftarPengajuanSaya({ status, tahun, page: data.meta.current_page + 1 });
      setData(hasil);
      setDaftar((lama) => [...lama, ...hasil.requests.filter((r) => !lama.some((x) => x.id === r.id))]);
    } catch {
      // tombol tetap ada untuk mencoba lagi
    } finally {
      setMemuatLagi(false);
    }
  };

  const saldo = data?.balances ?? [];
  const saldoUtama = saldo.find((k) => k.kind === 'balance' && !k.type.locked) ?? saldo.find((k) => k.kind === 'balance') ?? null;
  const cutiDikunci = saldo.find((k) => k.type.category === 'leave' && k.type.locked);
  const saldoLain = saldo.filter((k) => k !== saldoUtama && k.type.category !== 'leave');
  const revisi = data?.counts.revisi ?? 0;
  const ajukan = (): void => router.push('/pengajuan/baru');

  const isiDaftar = (): React.ReactNode => {
    if (memuat && !data) {
      return [0, 1, 2].map((i) => (
        <Card key={i} style={{ gap: 10 }}>
          <Skeleton width="45%" height={14} />
          <Skeleton width="80%" height={22} />
          <Skeleton width="60%" height={14} />
        </Card>
      ));
    }
    if (galat && !data) {
      return (
        <ErrorState
          kind={errorKindFromStatus(galat.status)}
          title="Pengajuan tidak termuat"
          message={galat.status === 0 ? 'Periksa koneksi internet Anda lalu coba lagi.' : galat.status >= 500 ? 'Terjadi kesalahan di server. Coba lagi beberapa saat lagi.' : galat.message}
          onRetry={() => void muat({ status, tahun })}
        />
      );
    }
    if (daftar.length === 0) {
      return status === 'semua' && tahun === null ? (
        <EmptyState
          icon="file-text"
          title="Belum ada pengajuan"
          description="Ketuk Ajukan untuk mengajukan izin, sakit, koreksi, dinas luar, atau barang."
          actionLabel="Ajukan sekarang"
          onAction={ajukan}
        />
      ) : (
        <EmptyState icon="filter" title="Tidak ada pengajuan" description="Tidak ada pengajuan dengan filter ini." actionLabel="Tampilkan semua" onAction={() => pilihTahun(null)} variant="plain" />
      );
    }
    return (
      <>
        {daftar.map((item) => (
          <KartuPengajuan key={item.id} item={item} onPress={() => router.push(`/pengajuan/${item.id}`)} />
        ))}
        {data && data.meta.current_page < data.meta.last_page ? (
          <Button title="Muat lebih banyak" variant="outline" loading={memuatLagi} disabled={!!luring} onPress={() => void muatBerikut()} />
        ) : daftar.length > 0 ? (
          <Text variant="meta" align="center">
            Ketuk kartu untuk melihat alur dan catatan penyetuju.
          </Text>
        ) : null}
      </>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen
        header={<SubAppBar title="Pengajuan saya" actions={[{ icon: 'plus', label: 'Ajukan', onPress: ajukan, disabled: !!luring }]} />}
        refreshing={menyegarkan}
        onRefresh={() => void muat({ status, tahun, segarkan: true })}
        contentStyle={{ paddingBottom: insets.bottom + 110 }}
      >
        {luring ? <Banner tone="warn" icon="wifi-off" title={`Offline. Menampilkan data terakhir (${luring}).`} message="Ajukan baru butuh koneksi." /> : null}
        {revisi > 0 && status !== 'revisi' ? (
          <Banner
            tone="info"
            icon="undo-2"
            title={`${revisi} pengajuan perlu revisi.`}
            message="Penyetuju meminta Anda memperbaiki isian lalu mengirim ulang."
            actionLabel="Lihat"
            onAction={() => pilihStatus('revisi')}
          />
        ) : null}

        {saldoUtama ? <KartuSaldoUtama kartu={saldoUtama} /> : null}
        {cutiDikunci ? (
          <View style={[s.kunci, { borderColor: colors.borderStrong }]}>
            <Icon name="lock" size={18} color={colors.muted} />
            <Text variant="label" weight={500} tone="muted" style={{ flex: 1 }}>
              <Text variant="label">Pengajuan cuti dikunci. </Text>
              {cutiDikunci.type.locked_reason ?? ''}
            </Text>
          </View>
        ) : null}
        {saldoLain.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }} style={{ marginHorizontal: -16 }}>
            <View style={{ width: 6 }} />
            {saldoLain.map((k) => (
              <KartuSaldoKecil key={k.type.id} kartu={k} />
            ))}
            <View style={{ width: 6 }} />
          </ScrollView>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chip} style={{ marginHorizontal: -16 }}>
          {CHIP.filter((c) => c.value === 'semua' || c.value === status || (data?.counts[c.value] ?? 0) > 0 || ['menunggu', 'disetujui', 'ditolak'].includes(c.value)).map((c) => (
            <Chip key={c.value} label={c.label} count={data ? data.counts[c.value] : undefined} selected={status === c.value} onPress={() => pilihStatus(c.value)} disabled={!!luring} />
          ))}
          <Chip label={tahun === null ? 'Semua tahun' : String(tahun)} icon="calendar" onPress={() => setSheetTahun(true)} selected={tahun !== null} disabled={!!luring} />
        </ScrollView>

        {isiDaftar()}
      </Screen>

      <View style={[s.fab, { bottom: insets.bottom + 20, opacity: luring ? 0.45 : 1 }]} pointerEvents={luring ? 'none' : 'auto'}>
        <Fab icon="plus" label="Ajukan" extended onPress={ajukan} />
      </View>

      <BottomSheet visible={sheetTahun} onClose={() => setSheetTahun(false)} title="Tahun pengajuan">
        <ListRow title="Semua tahun" trailing={tahun === null ? <Icon name="check" size={20} color={colors.primary} /> : undefined} onPress={() => pilihTahun(null)} divider />
        {[tahunIni, tahunIni - 1, tahunIni - 2].map((t) => (
          <ListRow key={t} title={String(t)} trailing={tahun === t ? <Icon name="check" size={20} color={colors.primary} /> : undefined} onPress={() => pilihTahun(t)} divider />
        ))}
      </BottomSheet>
    </View>
  );
}

const s = StyleSheet.create({
  saldo: { borderRadius: radius.card, padding: 20, gap: 6, overflow: 'hidden' },
  saldoAtas: { flexDirection: 'row', justifyContent: 'space-between' },
  trek: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 8 },
  isiTrek: { height: 6, borderRadius: 3 },
  kecil: { width: 200, gap: 2 },
  kunci: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed' },
  chip: { gap: 8, paddingHorizontal: 16 },
  fab: { position: 'absolute', right: 16 },
});
