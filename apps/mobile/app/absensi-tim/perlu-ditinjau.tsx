/**
 * Perlu ditinjau (mockup 11 › 20): semua log ditandai mencurigakan yang belum
 * ditinjau, 20 per halaman, Lihat selfie (dialog + audit) / Tandai ditinjau.
 * `GET /absensi/tim/perlu-ditinjau`.
 */
import { router } from 'expo-router';
import { useCallback, useState } from 'react';

import { perluDitinjau, type DaftarTemuan } from '@/api/hr';
import { useLihatSelfie } from '@/features/hr/absensi/Selfie';
import { KartuTemuan, useTinjau } from '@/features/hr/absensi/Temuan';
import { keGalat, useMuat } from '@/features/hr/useMuat';
import { jam } from '@/lib/format';
import { Banner, Button, EmptyState, ErrorState, Loading, LockedState, Screen, SubAppBar, Text, errorKindFromStatus } from '@/ui';

const DIPERIKSA = 'Diperiksa: akurasi GPS, perangkat & IP baru, jam perangkat, lompatan lokasi, selfie gelap, QR tanpa lokasi.';

export default function PerluDitinjauLayar(): React.JSX.Element {
  const m = useMuat<DaftarTemuan>('perlu-ditinjau', () => perluDitinjau(1));
  const selfie = useLihatSelfie();
  const [memuatLagi, setMemuatLagi] = useState(false);
  const [galatLagi, setGalatLagi] = useState<string | null>(null);
  const { setData } = m;
  const tinjau = useTinjau(
    useCallback((id: string) => setData((lama) => (lama ? { items: lama.items.filter((x) => x.id !== id), meta: { ...lama.meta, total: Math.max(0, lama.meta.total - 1) } } : lama)), [setData]),
  );
  const d = m.data;
  const offline = m.offlineSejak !== null;

  async function lagi(): Promise<void> {
    if (!d || memuatLagi) return;
    setMemuatLagi(true);
    setGalatLagi(null);
    try {
      const b = await perluDitinjau(d.meta.current_page + 1);
      setData((lama) => (lama ? { items: [...lama.items, ...b.items.filter((x) => !lama.items.some((y) => y.id === x.id))], meta: b.meta } : lama));
    } catch (err) {
      setGalatLagi(keGalat(err).pesan);
    } finally {
      setMemuatLagi(false);
    }
  }

  if (m.galat && (m.galat.status === 403 || m.galat.status === 404)) {
    return (
      <Screen header={<SubAppBar title="Perlu ditinjau" />} contentStyle={{ paddingTop: 24 }}>
        <LockedState title="Halaman tidak ditemukan" reason="Tinjauan absensi hanya untuk HR, Direksi, Kepala Divisi, dan atasan langsung." actionLabel="Kembali" onAction={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen header={<SubAppBar title="Perlu ditinjau" />} refreshing={m.menyegarkan} onRefresh={() => void m.muatUlang('tarik')}>
      {offline ? <Banner tone="neutral" icon="cloud-off" message={`Anda offline. Menampilkan data pukul ${jam(new Date(m.offlineSejak ?? 0))}; selfie dan tandai butuh koneksi.`} /> : null}
      {m.memuat && !d ? (
        <Loading rows={4} label="Memuat temuan…" />
      ) : m.galat && !d ? (
        <ErrorState message={m.galat.pesan} kind={errorKindFromStatus(m.galat.status)} onRetry={() => void m.muatUlang()} />
      ) : d ? (
        d.items.length === 0 ? (
          <>
            <Text variant="body" tone="muted">{`Tidak ada temuan. ${DIPERIKSA}`}</Text>
            <EmptyState icon="shield-check" title="Semua check-in wajar" description="Temuan baru muncul di sini saat ada check-in yang ditandai." />
          </>
        ) : (
          <>
            <Text variant="body" tone="muted">{`${d.meta.total} log ditandai · ${DIPERIKSA}`}</Text>
            {d.items.map((t) => (
              <KartuTemuan key={t.id} t={t} offline={offline} sibuk={tinjau.sibukId === t.id} onSelfie={selfie.lihat} onTinjau={tinjau.tinjau} />
            ))}
            {galatLagi ? <Banner tone="bad" message={galatLagi} /> : null}
            {d.meta.current_page < d.meta.last_page ? <Button title="Muat lagi" variant="outline" onPress={() => void lagi()} loading={memuatLagi} loadingTitle="Memuat…" disabled={offline} /> : null}
            <Text variant="meta" style={{ fontSize: 14 }}>
              Menandai ditinjau tidak bisa diurungkan. Selfie hanya untuk HR dan atasan langsung; setiap akses dicatat di audit log.
            </Text>
          </>
        )
      ) : null}
      {selfie.elemen}
    </Screen>
  );
}
