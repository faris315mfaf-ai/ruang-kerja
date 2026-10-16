/**
 * Kartu log ditandai mencurigakan (mockup 11 › 19–20): nama, jam, lokasi,
 * chip tanda + penjelasan satu baris, aksi Lihat selfie / Tandai ditinjau
 * (sesuai bendera server). "Urungkan" tidak ada di server → snackbar tanpa aksi.
 */
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { tandaiDitinjau, type PenandaLog, type TemuanLog } from '@/api/hr';
import { jam, jarakMeter } from '@/lib/format';
import { Avatar, Badge, Button, Card, Text, useSnackbar } from '@/ui';

import type { SubjekSelfie } from './Selfie';

export function jelaskanTanda(t: PenandaLog, log: Pick<TemuanLog, 'accuracyM' | 'clientTime' | 'occurredAt' | 'distanceM' | 'radiusM'>): string {
  switch (t.value) {
    case 'low_accuracy':
      return `Akurasi GPS ${jarakMeter(log.accuracyM)}`;
    case 'clock_skew':
      return `Jam perangkat ${jam(log.clientTime)} · server ${jam(log.occurredAt)} (dipakai)`;
    case 'new_device':
      return 'Perangkat pertama kali dipakai akun ini';
    case 'new_ip':
      return 'Alamat IP baru untuk akun ini';
    case 'impossible_travel':
      return 'Lokasi berpindah terlalu jauh sejak absen sebelumnya';
    case 'dark_selfie':
      return 'Selfie terlalu gelap';
    case 'qr_location_mismatch':
      return `GPS ${jarakMeter(log.distanceM)} dari lokasi kiosk${log.radiusM ? ` (batas ${jarakMeter(log.radiusM)})` : ''}`;
    case 'qr_no_location':
      return 'QR dipindai tanpa lokasi GPS';
    case 'mock_location':
      return 'Aplikasi lokasi palsu terdeteksi';
    default:
      return t.label;
  }
}

export function KartuTemuan({
  t,
  offline,
  sibuk,
  onSelfie,
  onTinjau,
}: {
  t: TemuanLog;
  offline: boolean;
  sibuk: boolean;
  onSelfie: (s: SubjekSelfie) => void;
  onTinjau: (t: TemuanLog) => void;
}): React.JSX.Element {
  const ringkas = `${t.typeLabel} ${jam(t.occurredAt)}${t.locationName ? ` · ${t.locationName}` : ` · ${t.methodLabel}`}`;
  const bolehSelfie = t.canViewSelfie && t.hasSelfie;
  return (
    <Card style={{ gap: 10 }} variant="tight">
      <View style={s.kepala} accessible accessibilityLabel={`${t.name}, ${ringkas}, ditandai: ${t.flags.map((f) => f.label).join(', ')}`}>
        <Avatar name={t.name} size="md" />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title" numberOfLines={1}>
            {t.name}
          </Text>
          <Text variant="meta" style={{ fontSize: 14 }}>
            {ringkas}
          </Text>
        </View>
      </View>
      {t.flags.map((f) => (
        <View key={f.value} style={{ gap: 4 }}>
          <Badge tone="warning" dot style={{ alignSelf: 'flex-start' }}>
            {f.label}
          </Badge>
          <Text variant="meta" style={{ fontSize: 14 }}>
            {jelaskanTanda(f, t)}
          </Text>
        </View>
      ))}
      {t.canViewSelfie && !t.hasSelfie ? (
        <Text variant="meta" style={{ fontSize: 14 }}>
          Selfie sudah dihapus sesuai masa retensi.
        </Text>
      ) : null}
      {bolehSelfie || t.canReview ? (
        <View style={s.aksi}>
          {bolehSelfie ? (
            <Button
              title="Lihat selfie"
              variant="outline"
              icon="eye"
              onPress={() => onSelfie({ logId: t.id, name: t.name, typeLabel: t.typeLabel, occurredAt: t.occurredAt })}
              disabled={offline}
              disabledReason={offline ? 'Butuh koneksi' : undefined}
              style={{ flex: 1 }}
            />
          ) : null}
          {t.canReview ? (
            <Button title="Tandai ditinjau" variant="tonal" icon="check" onPress={() => onTinjau(t)} loading={sibuk} loadingTitle="Menyimpan…" disabled={offline} disabledReason={offline ? 'Butuh koneksi' : undefined} style={{ flex: 1 }} />
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

/** Tandai log ditinjau (idempoten di server). `onSelesai(id)` menghapus kartu dari daftar. */
export function useTinjau(onSelesai: (id: string) => void): { sibukId: string | null; tinjau: (t: TemuanLog) => void } {
  const snackbar = useSnackbar();
  const [sibukId, setSibukId] = useState<string | null>(null);
  const tinjau = useCallback(
    (t: TemuanLog) => {
      if (sibukId) return;
      setSibukId(t.id);
      void (async () => {
        try {
          const hasil = await tandaiDitinjau(t.id);
          snackbar.show({ message: hasil.message, variant: 'ok' });
          onSelesai(t.id);
        } catch (err) {
          snackbar.show({
            message: err instanceof ApiError ? (err.status === 0 ? 'Tidak ada koneksi. Belum ditandai.' : err.message) : 'Gagal menandai. Coba lagi.',
            variant: err instanceof ApiError && err.status === 0 ? 'offline' : 'bad',
          });
        } finally {
          setSibukId(null);
        }
      })();
    },
    [onSelesai, sibukId, snackbar],
  );
  return { sibukId, tinjau };
}

const s = StyleSheet.create({
  kepala: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  aksi: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
});
