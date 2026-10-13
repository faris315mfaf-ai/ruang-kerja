/**
 * Kartu lokasi: sketsa SVG geofence (tanpa ubin peta — ringan di 4G, CSP web
 * juga tidak mengizinkan ubin pihak ketiga) + baris status GPS: jarak ke titik
 * kantor, akurasi, tombol perbarui.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';

import type { OfficeLocation } from '@/api/types';
import { jarakMeter } from '@/lib/format';
import { radius, useTheme } from '@/theme';
import { Badge, Card, IconButton, IconTile, Skeleton, Text, type Tone } from '@/ui';

import { AKURASI_PERINGATAN_M, AKURASI_TANDAI_M, type StatusGps, type TitikGps } from './useLokasiAbsen';

const TINGGI = 168;
const R_PX = 54;

function vektorMeter(titik: TitikGps, kantor: OfficeLocation): { dx: number; dy: number } {
  const dx = (titik.longitude - kantor.longitude) * Math.cos((kantor.latitude * Math.PI) / 180) * 111_320;
  const dy = (titik.latitude - kantor.latitude) * 110_540;
  return { dx, dy };
}

export function Sketsa({ kantor, titik }: { kantor: OfficeLocation | null; titik: TitikGps | null }): React.JSX.Element {
  const { colors } = useTheme();
  const [lebar, setLebar] = useState(0);
  const cx = lebar / 2;
  const cy = TINGGI / 2 + 6;
  const skala = kantor ? R_PX / Math.max(kantor.radiusM, 1) : 1;

  let ux = cx;
  let uy = cy;
  let halo = 0;
  if (kantor && titik) {
    const { dx, dy } = vektorMeter(titik, kantor);
    let px = dx * skala;
    let py = -dy * skala;
    const mag = Math.hypot(px, py);
    const batas = Math.min(lebar / 2 - 14, TINGGI / 2 - 14);
    if (mag > batas) {
      px = (px / mag) * batas;
      py = (py / mag) * batas;
    }
    ux = cx + px;
    uy = cy + py;
    halo = Math.min(26, Math.max(10, (titik.accuracy ?? 20) * skala));
  }

  const garis: number[] = [];
  for (let g = 0; g <= lebar; g += 28) garis.push(g);
  const garisH: number[] = [];
  for (let g = 0; g <= TINGGI; g += 28) garisH.push(g);

  return (
    <View
      onLayout={(e) => setLebar(e.nativeEvent.layout.width)}
      style={[s.peta, { backgroundColor: colors.linkSoft }]}
      accessible
      accessibilityLabel={kantor && titik ? `Sketsa peta: posisi Anda ${jarakMeter(vektorJarak(titik, kantor))} dari ${kantor.name}` : 'Sketsa peta lokasi kantor'}
    >
      {lebar > 0 ? (
        <Svg width={lebar} height={TINGGI}>
          <Rect x={0} y={0} width={lebar} height={TINGGI} fill={colors.linkSoft} />
          {garis.map((g) => (
            <Line key={`v${g}`} x1={g} y1={0} x2={g} y2={TINGGI} stroke={colors.border} strokeWidth={1} opacity={0.7} />
          ))}
          {garisH.map((g) => (
            <Line key={`h${g}`} x1={0} y1={g} x2={lebar} y2={g} stroke={colors.border} strokeWidth={1} opacity={0.7} />
          ))}
          {kantor ? (
            <>
              <Circle cx={cx} cy={cy} r={R_PX} fill={colors.fill.teal} fillOpacity={0.16} stroke={colors.primary} strokeWidth={1.6} strokeDasharray="5 4" />
              <Rect x={cx - 9} y={cy - 9} width={18} height={18} rx={6} fill={colors.primary} stroke={colors.surface} strokeWidth={2} />
            </>
          ) : null}
          {titik ? (
            <>
              <Circle cx={ux} cy={uy} r={halo} fill={colors.accentBlue} fillOpacity={0.18} />
              <Circle cx={ux} cy={uy} r={7} fill={colors.accentBlueStrong} stroke={colors.surface} strokeWidth={2.5} />
            </>
          ) : null}
        </Svg>
      ) : null}
      {kantor ? (
        <View style={[s.namaKantor, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text variant="meta" weight={700} style={{ color: colors.text }} numberOfLines={1}>
            {kantor.name}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function vektorJarak(titik: TitikGps, kantor: OfficeLocation): number {
  const { dx, dy } = vektorMeter(titik, kantor);
  return Math.hypot(dx, dy);
}

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
        <Sketsa kantor={kantor} titik={titik} />
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
        <IconButton icon="refresh-cw" label="Perbarui lokasi" variant="outline" size={44} onPress={onRefresh} disabled={status.keadaan === 'memuat'} />
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  peta: { height: TINGGI, overflow: 'hidden' },
  namaKantor: { position: 'absolute', top: 8, alignSelf: 'center', paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth },
  chipPos: { position: 'absolute', top: 10, left: 10 },
  bawah: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
});
