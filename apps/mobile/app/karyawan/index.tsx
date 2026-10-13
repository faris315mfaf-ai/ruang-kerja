/**
 * Karyawan (mockup 11 › 02): cari, chip divisi, sheet Filter (status, peran,
 * urutan), "Muat lagi", kartu permintaan reset sandi (HR/SA), banner desktop
 * untuk tambah/ubah/impor. Direksi = lihat saja. Data hanya di memori.
 * `GET /admin/karyawan` (docs/sesi/ponsel-b5b-hr.md §1).
 */
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { daftarKaryawan, type BarisKaryawan, type DaftarKaryawan } from '@/api/hr';
import { BarisKaryawanItem, SheetFilterKaryawan, SheetPratinjauKaryawan, type PilihanFilter } from '@/features/hr/KaryawanParts';
import { keGalat, useMuat, type Galat } from '@/features/hr/useMuat';
import { useTautanDesktop } from '@/features/hr/useTautanDesktop';
import { jam } from '@/lib/format';
import { Banner, Button, Card, Chip, ChipScroller, CountBadge, DesktopOnlyBanner, EmptyState, ErrorState, Icon, ListRow, Loading, LockedState, Screen, SearchInput, SubAppBar, Text, errorKindFromStatus } from '@/ui';

const PER_HALAMAN = 25;

export default function KaryawanLayar(): React.JSX.Element {
  const [cari, setCari] = useState('');
  const [cariAktif, setCariAktif] = useState('');
  const [divisi, setDivisi] = useState<string | null>(null);
  const [filter, setFilter] = useState<PilihanFilter>({ status: 'active', role: null, sort: 'name' });
  const [bukaFilter, setBukaFilter] = useState(false);
  const [pratinjau, setPratinjau] = useState<BarisKaryawan | null>(null);
  const [tambahan, setTambahan] = useState<BarisKaryawan[]>([]);
  const [halaman, setHalaman] = useState(1);
  const [memuatLagi, setMemuatLagi] = useState(false);
  const [galatLagi, setGalatLagi] = useState<Galat | null>(null);
  const tautan = useTautanDesktop();

  useEffect(() => {
    const t = setTimeout(() => setCariAktif(cari.trim()), 350);
    return () => clearTimeout(t);
  }, [cari]);

  const kunci = `karyawan:${cariAktif}:${divisi ?? ''}:${filter.status ?? ''}:${filter.role ?? ''}:${filter.sort}`;
  const ambil = useCallback(
    () => daftarKaryawan({ search: cariAktif || null, division: divisi, status: filter.status, role: filter.role, sort: filter.sort, per_page: PER_HALAMAN, page: 1 }),
    [cariAktif, divisi, filter],
  );
  const m = useMuat<DaftarKaryawan>(kunci, ambil);
  const d = m.data;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- halaman lanjutan direset saat filter berubah
    setTambahan([]);
    setHalaman(1);
    setGalatLagi(null);
  }, [kunci]);

  const semua = useMemo(() => (d ? [...d.employees, ...tambahan] : []), [d, tambahan]);
  const sisa = d ? Math.max(0, d.meta.total - semua.length) : 0;
  const offline = m.offlineSejak !== null;
  const filterAktif = (filter.status !== 'active' ? 1 : 0) + (filter.role ? 1 : 0) + (filter.sort !== 'name' ? 1 : 0);

  async function muatLagi(): Promise<void> {
    if (memuatLagi || !d) return;
    setMemuatLagi(true);
    setGalatLagi(null);
    try {
      const berikut = await daftarKaryawan({ search: cariAktif || null, division: divisi, status: filter.status, role: filter.role, sort: filter.sort, per_page: PER_HALAMAN, page: halaman + 1 });
      setTambahan((lama) => [...lama, ...berikut.employees.filter((e) => !lama.some((x) => x.id === e.id) && !d.employees.some((x) => x.id === e.id))]);
      setHalaman(halaman + 1);
    } catch (err) {
      setGalatLagi(keGalat(err));
    } finally {
      setMemuatLagi(false);
    }
  }

  const hapusFilter = (): void => {
    setCari('');
    setCariAktif('');
    setDivisi(null);
    setFilter({ status: 'active', role: null, sort: 'name' });
  };

  if (m.galat && (m.galat.status === 403 || m.galat.status === 404)) {
    return (
      <Screen header={<SubAppBar title="Karyawan" />} contentStyle={{ paddingTop: 24 }}>
        <LockedState
          title="Halaman tidak ditemukan"
          reason="Daftar karyawan hanya untuk HR, Direksi, dan Super Admin. Kepala Divisi memakai Struktur organisasi dan Absensi divisi."
          actionLabel="Kembali"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  const ringkas = d ? `${d.can.manage ? '' : 'Lihat saja · '}${d.counts.active} aktif · ${d.counts.inactive} nonaktif` : null;

  return (
    <Screen
      header={
        <SubAppBar
          title="Karyawan"
          actions={[{ icon: 'sliders-horizontal', label: filterAktif > 0 ? `Filter, ${filterAktif} aktif` : 'Filter', onPress: () => setBukaFilter(true), badge: filterAktif > 0 ? filterAktif : undefined }]}
        />
      }
      refreshing={m.menyegarkan}
      onRefresh={() => void m.muatUlang('tarik')}
    >
      {m.offlineSejak !== null ? <Banner tone="neutral" icon="cloud-off" message={`Anda sedang offline. Menampilkan data tersimpan pukul ${jam(new Date(m.offlineSejak))}.`} /> : null}
      {ringkas ? (
        <Text variant="body" tone="muted">
          {ringkas}
        </Text>
      ) : null}
      {d && d.password_resets_pending !== null && d.password_resets_pending > 0 ? (
        <Card variant="flat" style={{ padding: 0, overflow: 'hidden' }}>
          <ListRow
            icon="key-round"
            iconTone="warn"
            title="Permintaan reset sandi"
            subtitle={offline ? 'Setujui/Tolak butuh koneksi' : `${d.password_resets_pending} karyawan menunggu keputusan HR`}
            trailing={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <CountBadge count={d.password_resets_pending} />
                <Icon name="chevron-right" size={20} />
              </View>
            }
            onPress={() => router.push('/karyawan/permintaan-sandi' as never)}
            accessibilityLabel={`Permintaan reset sandi, ${d.password_resets_pending} menunggu`}
          />
        </Card>
      ) : null}
      {d?.can.manage ? (
        <DesktopOnlyBanner
          message="Tambah, ubah, impor karyawan, peran, dan kata sandi dikelola di desktop. Di ponsel Anda bisa mencari dan melihat profil."
          onSendLink={tautan.mengirim ? undefined : () => tautan.kirim(d.web_path, 'Admin › Karyawan')}
        />
      ) : null}
      <SearchInput value={cari} onChangeText={setCari} placeholder="Cari nama atau email" />
      {d && d.divisions.length > 0 ? (
        <ChipScroller contentStyle={{ paddingHorizontal: 0 }}>
          <Chip label="Semua divisi" count={d.counts.active} selected={divisi === null} onPress={() => setDivisi(null)} />
          {d.divisions.map((v) => (
            <Chip key={v.id} label={v.name} count={v.count} selected={divisi === v.id} onPress={() => setDivisi(divisi === v.id ? null : v.id)} />
          ))}
        </ChipScroller>
      ) : null}
      {m.memuat && !d ? (
        <Loading rows={6} label="Memuat karyawan…" />
      ) : m.galat && !d ? (
        <ErrorState title="Daftar karyawan gagal dimuat" message={m.galat.status === 0 ? 'Server tidak merespons. Periksa koneksi, lalu coba lagi.' : m.galat.pesan} kind={errorKindFromStatus(m.galat.status)} onRetry={() => void m.muatUlang()} />
      ) : d ? (
        semua.length === 0 ? (
          <EmptyState icon="search-x" title="Tidak ada karyawan yang cocok" description="Coba kata kunci lain atau pilih divisi lain." actionLabel="Hapus filter" onAction={hapusFilter} />
        ) : (
          <>
            {cariAktif ? (
              <Text variant="meta" style={{ fontSize: 14 }} accessibilityLiveRegion="polite">
                {`${d.meta.total} hasil untuk “${cariAktif}”`}
              </Text>
            ) : null}
            <Card variant="flat" style={{ padding: 0, overflow: 'hidden' }}>
              {semua.map((e, i) => (
                <BarisKaryawanItem key={e.id} e={e} pertama={i === 0} onPress={() => setPratinjau(e)} />
              ))}
            </Card>
            {galatLagi ? <Banner tone="bad" message={galatLagi.status === 0 ? 'Tidak ada koneksi. Coba lagi setelah tersambung.' : galatLagi.pesan} /> : null}
            {sisa > 0 ? <Button title={`Muat lagi (${sisa} tersisa)`} variant="outline" onPress={() => void muatLagi()} loading={memuatLagi} loadingTitle="Memuat…" disabled={offline} disabledReason={offline ? 'Butuh koneksi' : undefined} /> : null}
            {!d.can.manage ? (
              <Text variant="meta" style={{ fontSize: 14 }}>
                Anda melihat daftar tanpa aksi kelola, peran, atau reset sandi.
              </Text>
            ) : null}
          </>
        )
      ) : null}
      <SheetFilterKaryawan
        visible={bukaFilter}
        nilai={filter}
        opsi={d?.options ?? null}
        onClose={() => setBukaFilter(false)}
        onTerapkan={(v) => {
          setFilter(v);
          setBukaFilter(false);
        }}
      />
      <SheetPratinjauKaryawan e={pratinjau} onClose={() => setPratinjau(null)} />
    </Screen>
  );
}
