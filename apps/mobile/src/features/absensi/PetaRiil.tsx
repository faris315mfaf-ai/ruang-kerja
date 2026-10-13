/**
 * Peta riil di kartu lokasi Absen (permintaan pemilik 14 Okt 2026): ubin
 * OpenStreetMap lewat proxy server (`GET /api/v1/peta/{z}/{x}/{y}`, Bearer),
 * lingkaran geofence kantor, penanda kantor, titik posisi pengguna + cincin
 * akurasi, dan atribusi OSM. Statis — tidak bisa digeser/diketuk.
 *
 * Lapisan paling bawah tetap sketsa (latar + grid) sehingga ubin yang belum
 * termuat / gagal (offline, proxy 204) tidak pernah merusak layar: yang
 * tampak hanya peta bergaris skala seperti sketsa lama. Titik GPS yang
 * menggerakkan peta ditahan sampai bergeser > 15 m agar tidak ada
 * gambar-ulang tiap detik.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';

import { API_URL, APP_VERSION, tokenSaatIni } from '@/api/client';
import type { OfficeLocation } from '@/api/types';
import { jarakMeter } from '@/lib/format';
import { radius, useTheme } from '@/theme';
import { Text } from '@/ui';

import { jarakM, perluPerbarui, susunPeta, type TitikPeta, type UbinRencana } from './petaMath';
import type { TitikGps } from './useLokasiAbsen';

export const TINGGI_PETA = 168;
const GRID_DP = 28;
const KOSONG: ReadonlySet<string> = new Set();

/** Titik yang dipakai menggambar: berubah hanya bila bergeser berarti. */
function useTitikStabil(titik: TitikGps | null): TitikPeta | null {
  const [stabil, setStabil] = useState<TitikPeta | null>(null);
  const terakhir = useRef<TitikPeta | null>(null);

  useEffect(() => {
    const baru: TitikPeta | null = titik ? { latitude: titik.latitude, longitude: titik.longitude, accuracy: titik.accuracy } : null;
    if (perluPerbarui(terakhir.current, baru)) {
      terakhir.current = baru;
      setStabil(baru);
    }
  }, [titik]);

  return stabil;
}

interface UbinProps {
  ubin: UbinRencana;
  headers: Record<string, string>;
  onMuat: () => void;
  onGagal: (key: string) => void;
}

const UbinPeta = memo(function UbinPeta({ ubin, headers, onMuat, onGagal }: UbinProps): React.JSX.Element {
  const source = useMemo(() => ({ uri: `${API_URL}/peta/${ubin.z}/${ubin.x}/${ubin.y}`, headers }), [ubin.z, ubin.x, ubin.y, headers]);
  return (
    <Image
      source={source}
      accessible={false}
      fadeDuration={220}
      resizeMode="stretch"
      onLoad={onMuat}
      onError={() => onGagal(ubin.key)}
      style={{ position: 'absolute', left: ubin.left, top: ubin.top, width: ubin.size, height: ubin.size }}
    />
  );
});

export interface PetaRiilProps {
  kantor: OfficeLocation | null;
  titik: TitikGps | null;
  /** Naik tiap kali pengguna menekan "Perbarui": ubin yang gagal dicoba lagi. */
  kunciCoba?: number;
}

export function PetaRiil({ kantor, titik, kunciCoba = 0 }: PetaRiilProps): React.JSX.Element {
  const { colors, dark } = useTheme();
  const [lebar, setLebar] = useState(0);
  const titikStabil = useTitikStabil(titik);
  // Ubin gagal berlaku untuk satu `kunciCoba`; menekan "Perbarui" menaikkannya sehingga semua dicoba lagi.
  const [gagalState, setGagalState] = useState<{ coba: number; keys: ReadonlySet<string> }>({ coba: 0, keys: new Set() });
  const gagal = gagalState.coba === kunciCoba ? gagalState.keys : KOSONG;
  const [adaUbin, setAdaUbin] = useState(false);

  const idKantor = kantor?.id ?? null;
  const lat = kantor?.latitude;
  const lon = kantor?.longitude;
  const radiusM = kantor?.radiusM;
  const rencana = useMemo(
    () =>
      susunPeta({
        kantor: lat !== undefined && lon !== undefined && radiusM !== undefined ? { latitude: lat, longitude: lon, radiusM } : null,
        titik: titikStabil,
        lebar,
        tinggi: TINGGI_PETA,
      }),
    // idKantor memastikan hitung ulang saat kantor berganti walau koordinat sama.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [idKantor, lat, lon, radiusM, titikStabil, lebar],
  );

  const token = tokenSaatIni();
  const headers = useMemo<Record<string, string>>(
    () => ({ Accept: 'image/png', 'X-App-Version': APP_VERSION, ...(token ? { Authorization: `Bearer ${token}` } : {}) }),
    [token],
  );

  const muat = useCallback(() => setAdaUbin(true), []);
  const tandaiGagal = useCallback(
    (key: string) =>
      setGagalState((lama) => {
        const keys = lama.coba === kunciCoba ? lama.keys : KOSONG;
        return keys.has(key) ? lama : { coba: kunciCoba, keys: new Set(keys).add(key) };
      }),
    [kunciCoba],
  );

  const jarak = kantor && titikStabil ? jarakM(titikStabil, kantor) : null;
  const label =
    kantor && jarak !== null ? `Peta: Anda ${jarakMeter(jarak)} dari ${kantor.name}` : kantor ? `Peta lokasi ${kantor.name}` : titikStabil ? 'Peta: posisi Anda saat ini' : 'Peta lokasi kantor';

  const garisV: number[] = [];
  for (let g = 0; g <= lebar; g += GRID_DP) garisV.push(g);
  const garisH: number[] = [];
  for (let g = 0; g <= TINGGI_PETA; g += GRID_DP) garisH.push(g);

  return (
    <View
      onLayout={(e) => setLebar(Math.round(e.nativeEvent.layout.width))}
      style={[s.peta, { backgroundColor: colors.linkSoft }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      <View style={StyleSheet.absoluteFill} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden pointerEvents="none">
        {lebar > 0 ? (
          <Svg width={lebar} height={TINGGI_PETA} style={StyleSheet.absoluteFill}>
            <Rect x={0} y={0} width={lebar} height={TINGGI_PETA} fill={colors.linkSoft} />
            {garisV.map((g) => (
              <Line key={`v${g}`} x1={g} y1={0} x2={g} y2={TINGGI_PETA} stroke={colors.border} strokeWidth={1} opacity={0.7} />
            ))}
            {garisH.map((g) => (
              <Line key={`h${g}`} x1={0} y1={g} x2={lebar} y2={g} stroke={colors.border} strokeWidth={1} opacity={0.7} />
            ))}
          </Svg>
        ) : null}

        {rencana && token
          ? rencana.ubin.map((u) =>
              gagal.has(u.key) ? null : <UbinPeta key={`${u.key}#${kunciCoba}`} ubin={u} headers={headers} onMuat={muat} onGagal={tandaiGagal} />,
            )
          : null}

        {/* Ubin tetap terang di mode malam; redupkan sedikit dengan token scrim. */}
        {dark && adaUbin ? <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim, opacity: 0.5 }]} /> : null}

        {rencana ? (
          <Svg width={lebar} height={TINGGI_PETA} style={StyleSheet.absoluteFill}>
            {rencana.kantor ? (
              <>
                <Circle
                  cx={rencana.kantor.x}
                  cy={rencana.kantor.y}
                  r={rencana.kantor.r}
                  fill={colors.fill.teal}
                  fillOpacity={0.18}
                  stroke={colors.primary}
                  strokeWidth={2}
                  strokeDasharray="6 4"
                />
                <Rect x={rencana.kantor.x - 9} y={rencana.kantor.y - 9} width={18} height={18} rx={6} fill={colors.primary} stroke={colors.surface} strokeWidth={2} />
              </>
            ) : null}
            {rencana.pengguna ? (
              <>
                <Circle cx={rencana.pengguna.x} cy={rencana.pengguna.y} r={rencana.pengguna.halo} fill={colors.accentBlue} fillOpacity={0.2} stroke={colors.accentBlue} strokeOpacity={0.35} strokeWidth={1} />
                <Circle cx={rencana.pengguna.x} cy={rencana.pengguna.y} r={7} fill={colors.accentBlueStrong} stroke={colors.surface} strokeWidth={2.5} />
              </>
            ) : null}
          </Svg>
        ) : null}
      </View>

      {kantor ? (
        <View style={[s.namaKantor, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text variant="meta" weight={700} style={{ color: colors.text }} numberOfLines={1}>
            {kantor.name}
          </Text>
        </View>
      ) : null}

      {adaUbin ? (
        <View style={[s.atribusi, { backgroundColor: colors.surface }]} pointerEvents="none" importantForAccessibility="no-hide-descendants">
          <Text variant="meta" style={{ fontSize: 10, lineHeight: 13, color: colors.muted }}>
            © OpenStreetMap contributors
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  peta: { height: TINGGI_PETA, overflow: 'hidden' },
  namaKantor: { position: 'absolute', bottom: 8, left: 10, maxWidth: '60%', paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth },
  atribusi: { position: 'absolute', right: 0, bottom: 0, paddingHorizontal: 5, paddingVertical: 1, borderTopLeftRadius: radius.sm, opacity: 0.88 },
});
