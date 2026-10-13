/**
 * Layar hasil berhasil (hero gradien layar penuh): masuk tepat waktu, terlambat,
 * WFH, QR, ditandai, pulang, pulang cepat. Terlambat selalu menjelaskan
 * "dihitung dari batas toleransi".
 * Mockup: docs/mockups/android/screens/03-absensi/10-hasil-sukses.html.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { jam } from '@/lib/format';
import { radius, useTheme } from '@/theme';
import { Gradient, Icon, Pressable, Text, type AnyIconName } from '@/ui';

import type { HasilAbsen } from './store';
import { bukaKoreksiHari } from './koreksi';

type Sukses = Extract<HasilAbsen, { jenis: 'sukses' }>;

/** "8 j 11 m" */
export function durasiSingkat(menit: number | null | undefined): string {
  if (menit === null || menit === undefined) {
    return '—';
  }
  const j = Math.floor(menit / 60);
  const m = Math.round(menit % 60);
  return j > 0 ? `${j} j ${m} m` : `${m} m`;
}

type Warna = 'normal' | 'warn' | 'warm';

interface Varian {
  warna: Warna;
  ikon: AnyIconName;
  judul: string;
  pil: string;
  baris: [string, string][];
  catatan?: string;
  tip?: string;
  laporan: boolean;
  koreksi: boolean;
}

function susunVarian(h: Sukses): Varian {
  const r = h.hasil;
  const masuk = h.arah === 'masuk';
  const lokasi = r.location?.name ?? r.methodLabel;
  const jarak = r.location && r.location.distanceM !== null ? `${Math.round(r.location.distanceM)} m · ${r.location.inside ? 'dalam radius' : 'luar radius'}` : null;
  const shift = r.shift ? `${r.shift.name} ${r.shift.hours}` : null;
  const wfh = r.method === 'wfh';
  const qr = r.method === 'qr';
  const sebelum = r.minutesBeforeStart !== null && r.minutesBeforeStart > 0 ? `${r.minutesBeforeStart} menit sebelum jam masuk` : null;

  if (masuk) {
    const telat = r.lateMinutes > 0;
    const batas = h.batasTerlambat ? jam(h.batasTerlambat) : null;
    const toleransi = h.batasTerlambat && h.jadwalMulai ? Math.round((Date.parse(h.batasTerlambat) - Date.parse(h.jadwalMulai)) / 60_000) : null;
    const baris: [string, string][] = [['Lokasi', wfh ? 'WFH/lapangan' : qr && r.location ? `Kiosk · ${r.location.name}` : lokasi]];
    if (!wfh && jarak) baris.push(['Jarak', jarak]);
    baris.push(['Metode', r.methodLabel]);
    if (wfh && h.catatan.trim() !== '') baris.push(['Catatan', h.catatan.trim()]);
    if (telat && batas) baris.push(['Batas terlambat', `${batas}${toleransi ? ` (toleransi ${toleransi} menit)` : ''}`]);
    else if (shift) baris.push(['Shift', shift]);
    return {
      warna: telat ? 'warn' : 'normal',
      ikon: telat ? 'clock' : wfh ? 'house' : qr ? 'qr-code' : 'check',
      judul: 'Check-in berhasil',
      pil: telat ? `Terlambat ${r.lateMinutes} menit` : `${wfh ? 'WFH' : 'Tepat waktu'}${sebelum ? ` · ${sebelum}` : ''}`,
      baris,
      catatan: telat
        ? 'Keterlambatan dihitung dari batas toleransi, bukan jam masuk. Ada alasan? Ajukan koreksi dari Riwayat.'
        : r.isSuspicious
          ? 'Absensi tetap tercatat. Sinyal lokasi atau perangkat tidak biasa, jadi HR mungkin meninjaunya.'
          : undefined,
      tip: h.jumlahRencana > 0 ? `${h.jumlahRencana} poin rencana kerja menjadi tugas pribadi hari ini. Pesan sudah masuk antrean ke grup manajemen.` : undefined,
      laporan: false,
      koreksi: false,
    };
  }

  const cepat = r.earlyLeaveMinutes > 0;
  const baris: [string, string][] = [];
  baris.push(['Masuk', '—']); // diganti di komponen bila data masuk tersedia
  baris.push(['Pulang', `${jam(r.occurredAt)}${r.location ? ` · ${r.location.name}` : ''}`]);
  baris.push(['Durasi kerja', durasiSingkat(r.workMinutes)]);
  baris.push(cepat ? ['Jadwal pulang', h.jamPulangTerjadwal ? jam(h.jamPulangTerjadwal) : '—'] : ['Metode', r.methodLabel]);
  return {
    warna: cepat ? 'warn' : 'warm',
    ikon: cepat ? 'log-out' : 'check',
    judul: 'Check-out berhasil',
    pil: cepat ? `Pulang cepat ${r.earlyLeaveMinutes} menit` : `Sampai jumpa · Durasi kerja ${durasiSingkat(r.workMinutes)}`,
    baris,
    catatan: r.isSuspicious ? 'Absensi tetap tercatat. Sinyal lokasi atau perangkat tidak biasa, jadi HR mungkin meninjaunya.' : undefined,
    tip: h.jumlahLaporan > 0 ? `${h.jumlahLaporan} poin laporan kerja tersimpan dan ikut terkirim ke grup manajemen bersama foto.` : undefined,
    laporan: !cepat,
    koreksi: cepat,
  };
}

export function HasilSukses({ h, onSelesai }: { h: Sukses; onSelesai: () => void }): React.JSX.Element {
  const { colors, gradients } = useTheme();
  const insets = useSafeAreaInsets();
  const v = susunVarian(h);
  if (h.arah === 'pulang' && v.baris[0]) {
    v.baris[0] = ['Masuk', h.masukPada ? `${jam(h.masukPada)}${h.masukLokasi ? ` · ${h.masukLokasi}` : ''}` : '—'];
  }

  return (
    <View style={s.akar}>
      <StatusBar style="light" />
      {v.warna === 'warn' ? (
        <LinearGradient colors={[colors.warning, gradients.hangat[0]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      ) : (
        <Gradient name={v.warna === 'warm' ? 'hangat' : 'aksi'} style={StyleSheet.absoluteFill} />
      )}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, s.cahaya]} />

      <ScrollView contentContainerStyle={[s.isi, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        <View style={s.lingkar2}>
          <View style={s.lingkar}>
            <Icon name={v.ikon} size={48} color={colors.primary} strokeWidth={2.4} />
          </View>
        </View>
        <Text variant="display" align="center" style={{ color: '#FFFFFF', fontSize: 30, lineHeight: 38 }} accessibilityRole="header">
          {v.judul}
        </Text>
        <Text variant="mono" align="center" style={{ color: '#FFFFFF', fontSize: 56, lineHeight: 64, letterSpacing: -1 }} accessibilityLabel={`Pukul ${jam(h.hasil.occurredAt)}`}>
          {jam(h.hasil.occurredAt)}
        </Text>
        <View style={s.pil} accessible accessibilityLabel={v.pil}>
          <Text variant="title" weight={700} align="center" style={{ color: '#FFFFFF' }}>
            {v.pil}
          </Text>
        </View>

        <View style={s.panel}>
          {v.baris.map(([k, nilai], i) => (
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

        {v.catatan ? (
          <View style={[s.panel, s.catatan]}>
            <Icon name="info" size={20} color="#FFFFFF" />
            <Text variant="label" weight={500} style={{ color: '#FFFFFF', flex: 1, lineHeight: 21 }}>
              {v.catatan}
            </Text>
          </View>
        ) : null}
        {v.tip ? (
          <View style={[s.panel, s.catatan]}>
            <Icon name="square-check-big" size={22} color="#FFFFFF" />
            <Text variant="label" weight={500} style={{ color: '#FFFFFF', flex: 1, lineHeight: 21 }}>
              {v.tip}
            </Text>
          </View>
        ) : null}
        {v.laporan ? (
          <View style={[s.panel, { padding: 16, gap: 12 }]}>
            <Text variant="label" weight={500} style={{ color: '#FFFFFF', lineHeight: 21 }}>
              Laporan harian hari ini belum dikirim. Bisa sampai 23.59.
            </Text>
            <Pressable
              onPress={() => router.push('/laporan/hari-ini' as never)}
              accessibilityRole="button"
              accessibilityLabel="Tulis laporan hari ini"
              style={s.tombolKaca}
            >
              <Icon name="pen-line" size={18} color="#FFFFFF" />
              <Text variant="label" weight={700} style={{ color: '#FFFFFF' }}>
                Tulis laporan hari ini
              </Text>
            </Pressable>
          </View>
        ) : null}

        <Pressable onPress={onSelesai} accessibilityRole="button" accessibilityLabel="Selesai" style={s.selesai}>
          <Text variant="title" weight={700} style={{ color: colors.primary }}>
            Selesai
          </Text>
        </Pressable>
        <View style={s.tautan}>
          {v.koreksi ? (
            <Pressable
              onPress={() => bukaKoreksiHari()}
              accessibilityRole="link"
              accessibilityLabel="Ajukan koreksi"
              style={s.tautanItem}
            >
              <Text variant="label" weight={700} style={{ color: '#FFFFFF' }}>
                Ajukan koreksi
              </Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => router.replace('/absensi/riwayat')} accessibilityRole="link" accessibilityLabel="Lihat riwayat absensi" style={s.tautanItem}>
            <Text variant="label" weight={700} style={{ color: '#FFFFFF' }}>
              Lihat riwayat absensi
            </Text>
          </Pressable>
          {h.arah === 'masuk' && h.jumlahRencana > 0 ? (
            <Pressable
              onPress={() => {
                router.dismissAll();
                router.navigate('/tugas');
              }}
              accessibilityRole="link"
              accessibilityLabel="Tugas hari ini"
              style={s.tautanItem}
            >
              <Text variant="label" weight={700} style={{ color: '#FFFFFF' }}>
                Tugas hari ini
              </Text>
            </Pressable>
          ) : null}
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
  tombolKaca: { minHeight: 48, borderRadius: radius.control, backgroundColor: 'rgba(255,255,255,0.22)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  selesai: { minHeight: 58, borderRadius: radius['2xl'], backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  tautan: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 4 },
  tautanItem: { minHeight: 48, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
});
