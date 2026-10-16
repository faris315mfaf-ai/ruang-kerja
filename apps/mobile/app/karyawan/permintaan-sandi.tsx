/**
 * Permintaan reset kata sandi (mockup 11 › 04, HR & Super Admin): kartu per
 * permintaan menunggu, Setujui satu ketukan, Tolak lewat sheet beralasan,
 * konflik "sudah diputus/kedaluwarsa" lewat snackbar lalu muat ulang.
 * `GET /admin/permintaan-sandi` (docs/sesi/ponsel-b5b-hr.md §2).
 */
import { router } from 'expo-router';
import { useCallback } from 'react';

import { daftarPermintaanReset, type DaftarPermintaanReset } from '@/api/hr';
import { KartuPermintaanReset, useKeputusanReset } from '@/features/hr/ResetSandi';
import { lupakanSimpanan, useMuat } from '@/features/hr/useMuat';
import { jam } from '@/lib/format';
import { Banner, EmptyState, ErrorState, Loading, LockedState, Screen, SubAppBar, Text, errorKindFromStatus } from '@/ui';

export default function PermintaanSandiLayar(): React.JSX.Element {
  const m = useMuat<DaftarPermintaanReset>('permintaan-sandi', daftarPermintaanReset);
  const offline = m.offlineSejak !== null;
  const { muatUlang, setData } = m;

  const berubah = useCallback(
    (id: string) => {
      setData((lama) => (lama ? { requests: lama.requests.filter((r) => r.id !== id), total: Math.max(0, lama.total - 1) } : lama));
      lupakanSimpanan('karyawan');
      void muatUlang('diam');
    },
    [muatUlang, setData],
  );
  const keputusan = useKeputusanReset({ offline, onBerubah: berubah });

  if (m.galat && (m.galat.status === 403 || m.galat.status === 404)) {
    return (
      <Screen header={<SubAppBar title="Permintaan reset sandi" />} contentStyle={{ paddingTop: 24 }}>
        <LockedState title="Halaman tidak ditemukan" reason="Permintaan reset kata sandi hanya diputus oleh HR dan Super Admin." actionLabel="Kembali" onAction={() => router.back()} />
      </Screen>
    );
  }

  const d = m.data;
  return (
    <Screen header={<SubAppBar title="Permintaan reset sandi" />} refreshing={m.menyegarkan} onRefresh={() => void m.muatUlang('tarik')}>
      {offline ? <Banner tone="neutral" icon="cloud-off" message="Anda offline. Setujui dan Tolak butuh koneksi." /> : null}
      {d && d.requests.length > 0 ? (
        <>
          <Text variant="meta" style={{ fontSize: 14 }} accessibilityLiveRegion="polite">
            {`${d.total} menunggu${m.diperbarui ? ` · diperbarui ${jam(new Date(m.diperbarui))}` : ''}`}
          </Text>
          <Banner
            tone="info"
            icon="phone-call"
            message="Pastikan permintaan benar dari karyawan tersebut (mis. lewat telepon) sebelum menyetujui. Karyawan menunggu di layarnya dan langsung membuat kata sandi baru setelah disetujui."
          />
        </>
      ) : null}
      {m.memuat && !d ? (
        <Loading rows={3} label="Memuat permintaan…" />
      ) : m.galat && !d ? (
        <ErrorState message={m.galat.pesan} kind={errorKindFromStatus(m.galat.status)} onRetry={() => void m.muatUlang()} />
      ) : d ? (
        d.requests.length === 0 ? (
          <>
            <EmptyState icon="key-round" title="Tidak ada permintaan menunggu" description="Permintaan “Lupa kata sandi” dari karyawan muncul di sini. Anda juga mendapat notifikasi Perlu tindakan." />
            <Text variant="meta" style={{ fontSize: 14 }}>
              Permintaan kedaluwarsa otomatis setelah 24 jam; satu permintaan aktif per karyawan.
            </Text>
          </>
        ) : (
          d.requests.map((r) => (
            <KartuPermintaanReset key={r.id} item={r} offline={offline} sibuk={keputusan.sibukId === r.id} onSetujui={() => keputusan.setujui(r)} onTolak={() => keputusan.tolak(r)} />
          ))
        )
      ) : null}
      {keputusan.sheet}
    </Screen>
  );
}
