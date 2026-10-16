/**
 * Hasil absen yang disimpan di HP (offline): selesai secara lokal, dikirim otomatis saat
 * online. Memakai jam perangkat saat tombol ditekan; server menandainya "Absen offline" untuk
 * ditinjau HR. Varian offline dari `HasilSukses` (docs/sesi/ponsel-b7-offline.md).
 */
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { jarakMeter, jam } from '@/lib/format';
import { radius, useTheme } from '@/theme';
import { Gradient, Icon, Pressable, Text } from '@/ui';

import type { HasilAbsen } from './store';

type Antre = Extract<HasilAbsen, { jenis: 'antre' }>;

export function HasilAntre({ h, onSelesai }: { h: Antre; onSelesai: () => void }): React.JSX.Element {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const masuk = h.arah === 'masuk';
  const baris: [string, string][] = [
    ['Absen', masuk ? 'Masuk' : 'Pulang'],
    ['Jam (jam HP)', jam(h.waktu)],
    ['Metode', h.metode === 'qr' ? 'Pindai QR kiosk' : h.metode === 'wfh' ? 'WFH/lapangan' : 'GPS + selfie'],
  ];
  if (h.lokasi && h.jarakM !== null) {
    baris.push(['Lokasi', `${h.lokasi} · ${jarakMeter(h.jarakM)}${h.dalam === null ? '' : h.dalam ? ' · dalam radius' : ' · luar radius'}`]);
  } else if (h.metode === 'gps') {
    baris.push(['Lokasi', 'Data kantor belum tersimpan di HP; server menilai saat sinkron']);
  }
  const poin = masuk ? h.jumlahRencana : h.jumlahLaporan;
  if (poin > 0) {
    baris.push([masuk ? 'Rencana kerja' : 'Laporan kerja', `${poin} poin tersimpan`]);
  }

  return (
    <View style={s.akar}>
      <StatusBar style="light" />
      <Gradient name="indigo" style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, s.cahaya]} />
      <ScrollView contentContainerStyle={[s.isi, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        <View style={s.lingkar2}>
          <View style={s.lingkar}>
            <Icon name="cloud-upload" size={48} color={colors.primary} strokeWidth={2.4} />
          </View>
        </View>
        <Text variant="display" align="center" style={{ color: '#FFFFFF', fontSize: 30, lineHeight: 38 }} accessibilityRole="header">
          {masuk ? 'Absen masuk tersimpan' : 'Absen pulang tersimpan'}
        </Text>
        <Text variant="mono" align="center" style={{ color: '#FFFFFF', fontSize: 56, lineHeight: 64, letterSpacing: -1 }} accessibilityLabel={`Pukul ${jam(h.waktu)}`}>
          {jam(h.waktu)}
        </Text>
        <View style={s.pil} accessible accessibilityLabel="Tersimpan di HP, akan dikirim otomatis saat online">
          <Text variant="title" weight={700} align="center" style={{ color: '#FFFFFF' }}>
            Tersimpan di HP · akan dikirim otomatis saat online
          </Text>
        </View>

        <View style={s.panel}>
          {baris.map(([k, nilai], i) => (
            <View key={k} style={[s.barisPanel, i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.3)' } : null]}>
              <Text variant="body" style={{ color: 'rgba(255,255,255,0.85)' }}>
                {k}
              </Text>
              <Text variant="body" weight={700} style={{ color: '#FFFFFF', flexShrink: 1, textAlign: 'right' }}>
                {nilai}
              </Text>
            </View>
          ))}
        </View>

        <View style={[s.panel, s.catatan]}>
          <Icon name="info" size={20} color="#FFFFFF" />
          <Text variant="label" weight={500} style={{ color: '#FFFFFF', flex: 1, lineHeight: 21 }}>
            Jam yang dicatat adalah jam HP saat Anda menekan absen. Setelah terkirim, absen ini ditandai &quot;Absen offline&quot; untuk ditinjau HR. Batas pengiriman 72 jam.
          </Text>
        </View>

        <Pressable onPress={onSelesai} accessibilityRole="button" accessibilityLabel="Selesai" style={s.selesai}>
          <Text variant="title" weight={700} style={{ color: colors.primary }}>
            Selesai
          </Text>
        </Pressable>
        <View style={s.tautan}>
          <Pressable onPress={() => router.replace('/sinkron' as never)} accessibilityRole="link" accessibilityLabel="Lihat antrean sinkron" style={s.tautanItem}>
            <Text variant="label" weight={700} style={{ color: '#FFFFFF' }}>
              Lihat antrean sinkron
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  akar: { flex: 1 },
  cahaya: {
    experimental_backgroundImage: [
      {
        type: 'radial-gradient',
        shape: 'ellipse',
        size: { x: 320, y: 260 },
        position: { top: 0, right: 0 },
        colorStops: [
          { color: 'rgba(255,255,255,0.26)', positions: ['0%'] },
          { color: 'rgba(255,255,255,0)', positions: ['70%'] },
        ],
      },
    ],
  },
  isi: { paddingHorizontal: 20, gap: 16, alignItems: 'stretch' },
  lingkar2: { alignSelf: 'center', width: 128, height: 128, borderRadius: 64, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  lingkar: { width: 92, height: 92, borderRadius: 46, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  pil: { alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 10, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.2)' },
  panel: { borderRadius: radius['2xl'], backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', paddingHorizontal: 18 },
  barisPanel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 52 },
  catatan: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14 },
  selesai: { minHeight: 58, borderRadius: radius['2xl'], backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  tautan: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 4 },
  tautanItem: { minHeight: 48, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
});
