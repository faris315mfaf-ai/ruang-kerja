/**
 * Hero absensi Beranda — 8 keadaan (spec 02, `02-beranda-hero-keadaan`):
 * belum check-in · sudah (tepat waktu / terlambat) · selesai · tercatat dari
 * pengajuan · hari libur · WFH/lapangan. Tombol hanya membuka tab Absen
 * (layar Absen dimiliki modul 03). Offline: tombol nonaktif dengan alasan.
 */
import { router } from 'expo-router';
import { View } from 'react-native';

import type { StatusAbsensiRingkas } from '@/api/beranda';
import { durasiMenit, jam, jarakMeter, ymdHariIni } from '@/lib/format';
import { radius, useTheme } from '@/theme';
import { Hero, Icon, Pressable, Text, type AnyIconName } from '@/ui';

interface Isi {
  chip: string;
  chipIcon: AnyIconName;
  kanan: string | null;
  baris1: string;
  judul: string;
  baris2: string | null;
  tombol: string;
  tombolIcon: AnyIconName;
}

function hitungIsi(s: StatusAbsensiRingkas): Isi {
  const lokasi = s.locationName ?? 'Kantor';
  const shift = s.startLabel && s.endLabel ? `Shift ${s.startLabel}–${s.endLabel}` : null;
  const jadwal = s.startLabel && s.endLabel ? `${s.startLabel}–${s.endLabel}` : null;

  if (s.action === 'unavailable' && s.statusLabel === null) {
    return {
      chip: lokasi,
      chipIcon: 'map-pin',
      kanan: shift,
      baris1: 'Absen belum tersedia',
      judul: 'Tidak ada jadwal absen',
      baris2: 'Ajukan koreksi bila Anda bekerja hari ini.',
      tombol: 'Ajukan koreksi',
      tombolIcon: 'clipboard-pen',
    };
  }

  if (s.action === 'unavailable') {
    return {
      chip: s.statusLabel ?? 'Pengajuan',
      chipIcon: 'circle-check',
      kanan: 'Disetujui',
      baris1: 'Tercatat dari pengajuan',
      judul: s.statusLabel ?? 'Pengajuan disetujui',
      baris2: 'Tidak perlu check-in hari ini',
      tombol: 'Ajukan koreksi',
      tombolIcon: 'clipboard-pen',
    };
  }

  if (s.action === 'done') {
    const menitKerja =
      s.checkInAt && s.checkOutAt ? Math.max(0, Math.round((new Date(s.checkOutAt).getTime() - new Date(s.checkInAt).getTime()) / 60_000)) : null;
    return {
      chip: lokasi,
      chipIcon: 'map-pin',
      kanan: shift,
      baris1: 'Selesai hari ini',
      judul: `${jam(s.checkInAt)} – ${jam(s.checkOutAt)}`,
      baris2: menitKerja !== null ? `${durasiMenit(menitKerja)} · ${lokasi}` : lokasi,
      tombol: 'Ajukan koreksi',
      tombolIcon: 'clipboard-pen',
    };
  }

  if (s.action === 'check_out') {
    const terlambat = s.status === 'late' || s.lateMinutes > 0;
    const jarak = s.distanceM !== null && s.distanceM !== undefined ? `${jarakMeter(s.distanceM)} dari titik lokasi` : null;
    const pulang = s.endLabel ? `pulang terjadwal ${s.endLabel}` : null;
    return {
      chip: lokasi,
      chipIcon: 'map-pin',
      kanan: shift,
      baris1: terlambat ? `Sudah check-in · terlambat ${s.lateMinutes} menit` : 'Sudah check-in · tepat waktu',
      judul: `Masuk ${jam(s.checkInAt)}`,
      baris2: [jarak, pulang].filter((x): x is string => x !== null).join(' · ') || null,
      tombol: 'Check-out',
      tombolIcon: 'log-out',
    };
  }

  // check_in
  if (s.isHoliday) {
    return {
      chip: 'Libur',
      chipIcon: 'calendar-days',
      kanan: null,
      baris1: 'Hari libur',
      judul: 'Tidak ada jadwal',
      baris2: 'Check-in tetap bisa dicatat',
      tombol: 'Check-in sekarang',
      tombolIcon: 'log-in',
    };
  }
  if (s.isRemote) {
    return {
      chip: 'WFH/lapangan',
      chipIcon: 'house',
      kanan: shift,
      baris1: 'Belum check-in hari ini',
      judul: jadwal ? `Jadwal ${jadwal}` : 'Siap mulai kerja?',
      baris2: 'WFH/lapangan · GPS dan selfie tanpa syarat radius',
      tombol: 'Check-in sekarang',
      tombolIcon: 'log-in',
    };
  }
  return {
    chip: lokasi,
    chipIcon: 'map-pin',
    kanan: shift,
    baris1: 'Belum check-in hari ini',
    judul: 'Siap mulai kerja?',
    baris2: null,
    tombol: 'Check-in sekarang',
    tombolIcon: 'log-in',
  };
}

export function HeroAbsensi({ status, offline }: { status: StatusAbsensiRingkas; offline: boolean }): React.JSX.Element {
  const { colors } = useTheme();
  const isi = hitungIsi(status);
  const mati = offline && (status.action === 'check_in' || status.action === 'check_out');
  const teksTombol = mati ? 'Check-in butuh koneksi' : isi.tombol;
  const koreksi = isi.tombol === 'Ajukan koreksi';

  return (
    <Hero>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: 'rgba(255,255,255,0.18)',
            borderRadius: radius.full,
            paddingHorizontal: 12,
            minHeight: 36,
            flexShrink: 1,
          }}
        >
          <Icon name={isi.chipIcon} size={18} color="#FFFFFF" />
          <Text variant="label" tone="onPrimary" weight={700} numberOfLines={1}>
            {isi.chip}
          </Text>
        </View>
        {isi.kanan ? (
          <Text variant="meta" style={{ color: 'rgba(255,255,255,0.9)' }} numberOfLines={1}>
            {isi.kanan}
          </Text>
        ) : null}
      </View>

      <Text variant="body" style={{ color: 'rgba(255,255,255,0.9)', marginTop: 6 }}>
        {isi.baris1}
      </Text>
      <Text variant="h1" tone="onPrimary" weight={800} accessibilityRole="header">
        {isi.judul}
      </Text>
      {isi.baris2 ? (
        <Text variant="body" style={{ color: 'rgba(255,255,255,0.9)', fontSize: 15, lineHeight: 22 }}>
          {isi.baris2}
        </Text>
      ) : null}

      <Pressable
        disabled={mati}
        onPress={() => (koreksi ? router.push({ pathname: '/pengajuan/baru', params: { jenis: 'KOR', tanggal: ymdHariIni() } }) : router.push('/(tabs)/absen'))}
        accessibilityRole="button"
        accessibilityLabel={teksTombol}
        accessibilityHint={mati ? 'Check-in membutuhkan koneksi internet' : koreksi ? 'Membuka formulir pengajuan koreksi' : 'Membuka tab Absen'}
        accessibilityState={{ disabled: mati }}
        style={{
          marginTop: 10,
          minHeight: 52,
          borderRadius: radius.control,
          backgroundColor: mati ? 'rgba(255,255,255,0.35)' : '#FFFFFF',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        <Icon name={isi.tombolIcon} size={22} color={mati ? '#FFFFFF' : colors.brand[600]} />
        <Text variant="title" weight={700} style={{ color: mati ? '#FFFFFF' : colors.brand[600] }}>
          {teksTombol}
        </Text>
      </Pressable>
    </Hero>
  );
}
