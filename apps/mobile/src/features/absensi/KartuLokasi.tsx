/**
 * Kartu lokasi: peta riil (ubin OpenStreetMap lewat proxy server, geofence
 * kantor, posisi pengguna; lihat PetaRiil) + baris status GPS: jarak ke titik
 * kantor, akurasi, tombol perbarui.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { OfficeLocation } from '@/api/types';
import { jarakMeter } from '@/lib/format';
import { useTheme } from '@/theme';
import { Badge, Card, IconButton, IconTile, Skeleton, Text, type Tone } from '@/ui';

import { PetaRiil } from './PetaRiil';
import { AKURASI_PERINGATAN_M, AKURASI_TANDAI_M, type StatusGps } from './useLokasiAbsen';

export interface KartuLokasiProps {
  status: StatusGps;
  kantor: OfficeLocation | null;
  jarakM: number | null;
  dalam: boolean;
  /** Mode kerja jarak jauh (WFH/lapangan): radius kantor tidak berlaku. */
  jarakJauh: boolean;
  onRefresh: () => void;
}

export function KartuLokasi({ status, kantor, jarakM, dalam, jarakJauh, onRefresh }: KartuLokasiProps): React.JSX.Element {
  const { colors } = useTheme();
  const titik = status.keadaan === 'siap' ? status.titik : status.keadaan === 'galat' ? status.titik : null;
  const akurasi = titik?.accuracy ?? null;
  const [kunciCoba, setKunciCoba] = useState(0);

  let chipTone: Tone = 'neutral';
  let chipTeks = 'Mencari lokasi…';
  if (status.keadaan === 'siap' && akurasi !== null) {
    chipTone = akurasi <= AKURASI_PERINGATAN_M ? 'success' : akurasi <= AKURASI_TANDAI_M ? 'warning' : 'danger';
    chipTeks = akurasi <= AKURASI_PERINGATAN_M ? `GPS akurat · ${Math.round(akurasi)} m` : akurasi <= AKURASI_TANDAI_M ? `Akurasi ±${Math.round(akurasi)} m` : `Akurasi kasar · ±${Math.round(akurasi)} m`;
  } else if (status.keadaan === 'siap') {
    chipTeks = 'GPS terkunci';
    chipTone = 'success';
  } else if (status.keadaan === 'galat') {
    chipTone = status.jenis === 'perkiraan' ? 'warning' : 'danger';
    chipTeks = status.jenis === 'perkiraan' ? `Perkiraan · ±${jarakMeter(akurasi)}` : 'Lokasi tidak terbaca';
  } else if (status.keadaan === 'idle') {
    chipTeks = 'Lokasi belum dibaca';
  }

  let judul = kantor?.name ?? 'Lokasi kantor';
  let subjudul = 'Membaca lokasi GPS…';
  let nada: 'ok' | 'warn' | 'bad' | 'neutral' = 'neutral';
  if (status.keadaan === 'siap' && jarakM !== null && kantor) {
    if (jarakJauh && !dalam) {
      judul = 'Di luar kantor';
      subjudul = `${jarakMeter(jarakM)} dari ${kantor.name} · WFH/lapangan`;
      nada = 'ok';
    } else {
      subjudul = `${jarakMeter(jarakM)} dari titik · ${dalam ? `dalam radius ${jarakMeter(kantor.radiusM)}` : `di luar radius ${jarakMeter(kantor.radiusM)}`}`;
      nada = dalam ? 'ok' : 'bad';
    }
  } else if (status.keadaan === 'galat') {
    subjudul = status.jenis === 'waktu' ? 'Lokasi tidak terbaca' : status.jenis === 'perkiraan' ? 'Butuh lokasi tepat' : 'Butuh lokasi';
    nada = 'warn';
  } else if (status.keadaan === 'idle') {
    subjudul = 'Belum dibaca';
  }

  return (
    <Card variant="flat">
      <View>
        <PetaRiil kantor={kantor} titik={titik} kunciCoba={kunciCoba} />
        <View style={s.chipPos}>
          <Badge tone={chipTone}>{chipTeks}</Badge>
        </View>
      </View>
      <View style={s.bawah}>
        <IconTile icon="map-pin" tone={nada} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title" numberOfLines={1}>
            {judul}
          </Text>
          {status.keadaan === 'memuat' ? <Skeleton width="80%" height={14} radiusPx={7} /> : (
            <Text variant="meta" style={{ fontSize: 14, lineHeight: 20, color: nada === 'ok' ? colors.success : nada === 'bad' ? colors.danger : colors.muted }}>
              {subjudul}
            </Text>
          )}
        </View>
        {akurasi !== null && status.keadaan === 'siap' ? (
          <Text variant="meta" style={{ marginRight: 2 }}>
            Akurasi ±{Math.round(akurasi)} m
          </Text>
        ) : null}
        <IconButton icon="refresh-cw" label="Perbarui lokasi" variant="outline" size={44} onPress={() => { setKunciCoba((n) => n + 1); onRefresh(); }} disabled={status.keadaan === 'memuat'} />
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  chipPos: { position: 'absolute', top: 10, left: 10 },
  bawah: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
});
