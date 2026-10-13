/**
 * Beranda — satu `GET /beranda` (tarik untuk menyegarkan, bagian gagal
 * ditoleransi per bagian) + pemilih tampilan per peran (Saya · Kepala Divisi
 * · HR · Direksi segera). Tampilan terakhir diingat per perangkat. Dashboard
 * Kepala Divisi/HR memuat endpointnya sendiri. Spec: docs/mockups/android/
 * spec/02-beranda-dashboard.md.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { beranda, type BerandaSaya, type KunciTampilan } from '@/api/beranda';
import { BerandaSayaIsi } from '@/features/beranda/BerandaSayaIsi';
import { DasborDivisi } from '@/features/beranda/DasborDivisi';
import { DasborHr } from '@/features/beranda/DasborHr';
import { namaDepan, overlineTanggal } from '@/features/beranda/format';
import { bukaCari } from '@/features/beranda/nav';
import { PemilihTampilan } from '@/features/beranda/PemilihTampilan';
import { bacaTampilanTerakhir, simpanTampilanTerakhir } from '@/features/beranda/penyimpanan';
import { PitaGagalSegar, PitaOffline } from '@/features/beranda/Pita';
import { SpandukPengumuman } from '@/features/beranda/SpandukPengumuman';
import { TombolNotulensi } from '@/features/beranda/TombolNotulensi';
import { useMuat } from '@/features/beranda/useMuat';
import { useSession } from '@/session/SessionProvider';
import { useUnread } from '@/session/UnreadProvider';
import { AppBar, ErrorState, Screen, errorKindFromStatus } from '@/ui';

const KUNCI: readonly KunciTampilan[] = ['saya', 'divisi', 'hr', 'direksi'];

function kunciDariParam(nilai: string | string[] | undefined): KunciTampilan | null {
  const v = Array.isArray(nilai) ? nilai[0] : nilai;
  return KUNCI.find((k) => k === v) ?? null;
}

export default function LayarBeranda(): React.JSX.Element {
  const { user } = useSession();
  const { jumlah: belumBaca } = useUnread();
  const params = useLocalSearchParams<{ tampilan?: string }>();

  const ambil = useCallback(() => beranda('bulan'), []);
  const h = useMuat<BerandaSaya>(ambil);

  const [pilihan, setPilihan] = useState<KunciTampilan | null>(() => kunciDariParam(params.tampilan));
  const [tersimpan, setTersimpan] = useState<KunciTampilan | null | undefined>(undefined);
  const [menyegarkan, setMenyegarkan] = useState(false);
  const muatDasbor = useRef<(() => Promise<void>) | null>(null);
  const registrasi = useCallback((fn: (() => Promise<void>) | null) => {
    muatDasbor.current = fn;
  }, []);

  useEffect(() => {
    let batal = false;
    void bacaTampilanTerakhir().then((k) => {
      if (!batal) {
        setTersimpan(k);
      }
    });
    return () => {
      batal = true;
    };
  }, []);

  // Deep link /dashboard/{divisi|hr} saat layar sudah terpasang.
  const paramKunci = kunciDariParam(params.tampilan);
  useEffect(() => {
    if (paramKunci !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mengikuti parameter deep link
      setPilihan(paramKunci);
    }
  }, [paramKunci]);

  const data = h.data;
  const tersedia = data?.tampilan.tersedia ?? [];
  const boleh = (k: KunciTampilan | null | undefined): k is KunciTampilan => k !== null && k !== undefined && tersedia.some((t) => t.key === k && t.tersedia);
  const aktif: KunciTampilan =
    data === null || tersimpan === undefined
      ? 'saya'
      : ([pilihan, tersimpan, data.tampilan.awal].find((k) => boleh(k)) ?? 'saya');

  const pilih = (k: KunciTampilan): void => {
    setPilihan(k);
    void simpanTampilanTerakhir(k);
  };

  const catatanAktif = user?.features?.notes !== false;
  const nama = namaDepan(data?.pengguna.name ?? user?.name);

  const aksi = [
    { icon: 'search' as const, label: 'Cari', onPress: bukaCari },
    {
      icon: 'bell' as const,
      label: 'Inbox',
      onPress: () => router.push('/inbox'),
      badge: belumBaca > 0 ? belumBaca : undefined,
    },
  ];

  const pemilih = <PemilihTampilan tersedia={tersedia} aktif={aktif} onPilih={pilih} />;

  const kepalaDasbor = (info: { judul: string; subjudul?: string }): React.ReactNode => (
    <>
      <AppBar overline={overlineTanggal()} title={info.judul} subtitle={info.subjudul} actions={aksi} />
      {pemilih}
      <SpandukPengumuman spanduk={data?.pengumuman ?? null} />
      {catatanAktif ? <TombolNotulensi /> : null}
    </>
  );

  const segarkan = (): void => {
    setMenyegarkan(true);
    void Promise.all([h.muat(true), muatDasbor.current ? muatDasbor.current() : Promise.resolve()]).finally(() => setMenyegarkan(false));
  };

  return (
    <Screen refreshing={menyegarkan} onRefresh={segarkan}>
      {aktif === 'divisi' ? (
        <DasborDivisi kepala={kepalaDasbor} registrasiMuat={registrasi} />
      ) : aktif === 'hr' ? (
        <DasborHr kepala={kepalaDasbor} registrasiMuat={registrasi} />
      ) : (
        <>
          <AppBar overline={overlineTanggal()} title={`Halo, ${nama || 'RuangKerja'}`} actions={aksi} />
          {pemilih}
          {h.offline ? <PitaOffline terakhir={h.terakhir} /> : h.gagalSegar ? <PitaGagalSegar /> : null}
          {data === null && h.galat !== null && !h.memuat ? (
            <ErrorState
              kind={errorKindFromStatus(h.galat.status)}
              title="Tidak dapat memuat beranda"
              message={h.galat.status === 0 ? 'Periksa koneksi Anda lalu coba lagi.' : h.galat.message}
              onRetry={() => void h.muat()}
            />
          ) : (
            <BerandaSayaIsi h={h} catatanAktif={catatanAktif} onUlang={() => void h.muat(true)} />
          )}
        </>
      )}
    </Screen>
  );
}
