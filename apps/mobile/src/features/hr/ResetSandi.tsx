/**
 * Permintaan reset kata sandi (mockup 11 › 04): kartu dengan Tolak/Setujui,
 * sheet Tolak (alasan wajib 3–500), dan hook keputusan. Setujui satu ketukan
 * (tanpa dialog, sama dengan web); hasil lewat snackbar. Offline = tombol
 * nonaktif (karyawan menunggu di layarnya, tidak ada antrean).
 */
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { setujuiReset, tolakReset, type HasilKeputusanReset, type PermintaanReset } from '@/api/hr';
import { tanggalJam, waktuRelatif } from '@/lib/format';
import { Avatar, Banner, BottomSheet, Button, Card, Field, Input, Text, useSnackbar } from '@/ui';

const MAKS = 500;

export function KartuPermintaanReset({
  item,
  offline,
  sibuk,
  subjudul,
  onSetujui,
  onTolak,
}: {
  item: PermintaanReset;
  offline: boolean;
  sibuk: boolean;
  subjudul?: string | null;
  onSetujui: () => void;
  onTolak: () => void;
}): React.JSX.Element {
  const bisa = item.can?.decide !== false;
  const nonaktif = offline || sibuk || !bisa;
  const alasan = offline ? 'Butuh koneksi' : !bisa ? 'Anda tidak berhak memutus permintaan ini' : undefined;
  return (
    <Card style={{ gap: 12 }}>
      <View style={s.kepala} accessible accessibilityLabel={`${item.employee.name}, meminta reset kata sandi ${waktuRelatif(item.requested_at)}`}>
        <Avatar name={item.employee.name} size="md" />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title" numberOfLines={1}>
            {item.employee.name}
          </Text>
          <Text variant="meta" style={{ fontSize: 14 }} numberOfLines={1}>
            {subjudul ?? item.employee.email}
          </Text>
          <Text variant="meta" style={{ fontSize: 14 }}>
            {`Diajukan ${waktuRelatif(item.requested_at)} · berlaku sampai ${tanggalJam(item.expires_at)}`}
          </Text>
        </View>
      </View>
      {item.privileged_account ? <Banner tone="warn" icon="shield" message="Akun Direksi/HR/Super Admin: HR menyetujui, tetapi sandi akun ini hanya diatur oleh Super Admin." /> : null}
      <View style={s.aksi}>
        <Button title="Tolak" variant="outline" onPress={onTolak} disabled={nonaktif} disabledReason={alasan} style={{ flex: 1 }} accessibilityHint={`Tolak permintaan ${item.employee.name}`} />
        <Button title="Setujui" onPress={onSetujui} disabled={offline || !bisa} loading={sibuk} loadingTitle="Menyetujui…" disabledReason={alasan} style={{ flex: 1 }} accessibilityHint={`Setujui permintaan ${item.employee.name}`} />
      </View>
    </Card>
  );
}

function SheetTolakReset({
  item,
  offline,
  onClose,
  onSelesai,
  onKonflik,
}: {
  item: PermintaanReset | null;
  offline: boolean;
  onClose: () => void;
  onSelesai: (hasil: HasilKeputusanReset) => void;
  onKonflik: (pesan: string) => void;
}): React.JSX.Element {
  const [alasan, setAlasan] = useState('');
  const [galat, setGalat] = useState<string | null>(null);
  const [galatUmum, setGalatUmum] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const terbuka = item !== null;

  useEffect(() => {
    if (terbuka) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset isian saat sheet dibuka
      setAlasan('');
      setGalat(null);
      setGalatUmum(null);
    }
  }, [terbuka]);

  async function kirim(): Promise<void> {
    if (!item || sibuk) return;
    const teks = alasan.trim();
    if (teks === '') {
      setGalat('Tulis alasan penolakan.');
      return;
    }
    if (teks.length < 3) {
      setGalat('Alasan minimal 3 karakter.');
      return;
    }
    setSibuk(true);
    setGalatUmum(null);
    try {
      onSelesai(await tolakReset(item.id, teks));
    } catch (err) {
      if (err instanceof ApiError && err.status === 422 && err.errors.request) {
        onKonflik(err.errors.request[0] ?? err.message);
      } else if (err instanceof ApiError && err.status === 422) {
        setGalat(err.errors.reason?.[0] ?? err.message);
      } else if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
        onKonflik(err.message);
      } else if (err instanceof ApiError && err.status === 0) {
        setGalatUmum('Tidak ada koneksi. Penolakan belum terkirim.');
      } else {
        setGalatUmum(err instanceof ApiError ? err.message : 'Penolakan gagal dikirim. Coba lagi.');
      }
    } finally {
      setSibuk(false);
    }
  }

  return (
    <BottomSheet visible={terbuka} onClose={onClose} title={item ? `Tolak permintaan ${item.employee.name}?` : 'Tolak permintaan'} scrollable>
      <View style={{ gap: 14 }}>
        <Text variant="body" tone="muted" style={{ marginTop: -8 }}>
          Alasan ditampilkan di layar karyawan dan tercatat di audit log.
        </Text>
        <Field label="Alasan" required error={galat} counter={`${alasan.length} / ${MAKS}`}>
          <Input
            value={alasan}
            onChangeText={(t) => {
              setAlasan(t);
              setGalat(null);
            }}
            multiline
            textAlignVertical="top"
            maxLength={MAKS}
            placeholder="Mis. tidak bisa dikonfirmasi lewat telepon"
            invalid={galat !== null}
            autoFocus
            accessibilityLabel="Alasan penolakan"
          />
        </Field>
        {galatUmum ? (
          <Text variant="meta" tone="danger" accessibilityRole="alert">
            {galatUmum}
          </Text>
        ) : null}
        <View style={s.aksi}>
          <Button title="Batal" variant="quiet" onPress={onClose} style={{ flex: 1 }} />
          <Button title="Tolak permintaan" variant="danger" onPress={() => void kirim()} loading={sibuk} loadingTitle="Mengirim…" disabled={offline} disabledReason={offline ? 'Tidak ada koneksi' : undefined} style={{ flex: 1 }} />
        </View>
      </View>
    </BottomSheet>
  );
}

/**
 * Keputusan permintaan reset. `onBerubah(id)` dipanggil setelah permintaan
 * diputus (oleh Anda atau orang lain) — layar menghapus kartunya / memuat ulang.
 */
export function useKeputusanReset({ offline, onBerubah }: { offline: boolean; onBerubah: (id: string) => void }): {
  sibukId: string | null;
  setujui: (item: PermintaanReset) => void;
  tolak: (item: PermintaanReset) => void;
  sheet: React.JSX.Element;
} {
  const snackbar = useSnackbar();
  const [sibukId, setSibukId] = useState<string | null>(null);
  const [ditolak, setDitolak] = useState<PermintaanReset | null>(null);

  const konflik = useCallback(
    (id: string, pesan: string) => {
      snackbar.show({ message: pesan, variant: 'warn' });
      onBerubah(id);
    },
    [onBerubah, snackbar],
  );

  const setujui = useCallback(
    (item: PermintaanReset) => {
      if (sibukId || offline) return;
      setSibukId(item.id);
      void (async () => {
        try {
          const hasil = await setujuiReset(item.id);
          snackbar.show({ message: hasil.message, variant: 'ok' });
          onBerubah(item.id);
        } catch (err) {
          if (err instanceof ApiError && (err.status === 422 || err.status === 404 || err.status === 403)) {
            konflik(item.id, err.errors.request?.[0] ?? err.message);
          } else if (err instanceof ApiError && err.status === 0) {
            snackbar.show({ message: 'Tidak ada koneksi. Persetujuan belum terkirim.', variant: 'offline' });
          } else {
            snackbar.show({ message: err instanceof ApiError ? err.message : 'Persetujuan gagal. Coba lagi.', variant: 'bad' });
          }
        } finally {
          setSibukId(null);
        }
      })();
    },
    [konflik, offline, onBerubah, sibukId, snackbar],
  );

  const sheet = (
    <SheetTolakReset
      item={ditolak}
      offline={offline}
      onClose={() => setDitolak(null)}
      onSelesai={(hasil) => {
        const id = ditolak?.id;
        setDitolak(null);
        snackbar.show({ message: hasil.message, variant: 'info' });
        if (id) onBerubah(id);
      }}
      onKonflik={(pesan) => {
        const id = ditolak?.id;
        setDitolak(null);
        if (id) konflik(id, pesan);
      }}
    />
  );

  return { sibukId, setujui, tolak: setDitolak, sheet };
}

const s = StyleSheet.create({
  kepala: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  aksi: { flexDirection: 'row', gap: 10 },
});
