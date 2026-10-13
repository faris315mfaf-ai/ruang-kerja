/** Kartu untuk keadaan hari di luar form check-in: sedang bekerja, selesai, hari tanpa absen. */
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { KeadaanAbsen } from '@/api/absensi';
import type { TodayAttendance } from '@/api/types';
import { bukaSegera } from '@/features/settings/ComingSoon';
import { durasiMenit, jam, tanggalDariYMD } from '@/lib/format';
import { useTheme } from '@/theme';
import { Badge, Banner, Button, Card, Divider, Icon, IconTile, ListRow, Pressable, Text } from '@/ui';

import { menitAntara } from './waktu';

/** Rencana kerja baca-saja (poin bernomor). */
export function RencanaBacaSaja({ poin, judul }: { poin: string[]; judul: string }): React.JSX.Element | null {
  const { colors } = useTheme();
  if (poin.length === 0) {
    return null;
  }
  return (
    <View style={{ gap: 10 }}>
      <View style={s.baris}>
        <Text variant="title" weight={700} style={{ flex: 1 }}>
          {judul}
        </Text>
        <Text variant="meta">{poin.length} poin</Text>
      </View>
      {poin.map((t, i) => (
        <View key={`${i}-${t}`} style={[s.baris, { alignItems: 'flex-start' }]}>
          <View style={[s.nomor, { backgroundColor: colors.linkSoft }]}>
            <Text variant="meta" weight={700} tone="link">
              {i + 1}
            </Text>
          </View>
          <Text variant="body" style={{ flex: 1, fontSize: 16, lineHeight: 22 }}>
            {t}
          </Text>
        </View>
      ))}
    </View>
  );
}

function BarisRingkas({ label, nilai }: { label: string; nilai: string }): React.JSX.Element {
  return (
    <View style={[s.baris, { justifyContent: 'space-between', minHeight: 36 }]}>
      <Text variant="body" tone="muted" style={{ fontSize: 16 }}>
        {label}
      </Text>
      <Text variant="body" weight={600} style={{ fontSize: 16, flexShrink: 1, textAlign: 'right' }}>
        {nilai}
      </Text>
    </View>
  );
}

/** 04-1: sedang bekerja, sebelum jendela check-out (tab tengah masih Workspace). */
export function KartuSedangBekerja({
  state,
  data,
  sekarang,
  jamAbsenKembali,
  onPulangAwal,
}: {
  state: KeadaanAbsen;
  data: TodayAttendance;
  sekarang: Date;
  jamAbsenKembali: string | null;
  onPulangAwal: () => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  const day = data.today.day;
  const telat = state.punctuality === 'late' && state.lateMinutes > 0;
  return (
    <>
      <Card style={{ gap: 12 }}>
        <View style={[s.baris, { justifyContent: 'space-between' }]}>
          <Text variant="meta" style={{ fontSize: 14 }}>
            Sedang bekerja
          </Text>
          <Badge tone={telat ? 'warning' : 'success'}>{telat ? `Terlambat ${state.lateMinutes} m` : 'Tepat waktu'}</Badge>
        </View>
        <Text variant="mono" style={{ fontSize: 44, lineHeight: 52, color: colors.text, letterSpacing: -1 }}>
          {jam(sekarang)}
        </Text>
        <Divider />
        <BarisRingkas label="Masuk" nilai={`${jam(state.checkedInAt)}${state.locationName ? ` · ${state.locationName}` : ''}`} />
        <BarisRingkas label="Durasi berjalan" nilai={durasiMenit(Math.max(0, menitAntara(state.checkedInAt, sekarang)))} />
        {state.scheduledEnd ? <Text variant="meta">Pulang terjadwal {jam(state.scheduledEnd)}</Text> : null}
      </Card>
      <Card>
        <RencanaBacaSaja poin={day?.workPlan ?? []} judul="Rencana kerja pagi tadi" />
        {(day?.workPlan?.length ?? 0) > 0 ? <Divider /> : null}
        {jamAbsenKembali ? (
          <Banner tone="info" message={`Tombol Absen di tab tengah kembali pukul ${jamAbsenKembali}, satu jam sebelum jam pulang. Sampai saat itu Anda masuk dari kartu ini atau Beranda.`} />
        ) : null}
        <Button title="Check-out lebih awal" variant="outline" icon="log-out" onPress={onPulangAwal} />
      </Card>
      {(day?.workPlan?.length ?? 0) > 0 ? (
        <Card variant="flat">
          <ListRow icon="list-checks" iconTone="teal" title="Tugas hari ini" subtitle={`${day?.workPlan?.length ?? 0} poin rencana jadi tugas pribadi`} onPress={() => router.navigate('/tugas')} />
        </Card>
      ) : null}
    </>
  );
}

/** 04-4: absensi hari ini selesai + ajakan laporan harian (Bagian 4). */
export function KartuSelesai({ data, state }: { data: TodayAttendance; state: KeadaanAbsen }): React.JSX.Element {
  const { colors } = useTheme();
  const day = data.today.day;
  const d = data.today.schedule;
  const durasi = day?.workMinutes ?? null;
  return (
    <>
      <Card style={{ gap: 4 }}>
        <View style={[s.baris, { justifyContent: 'space-between', marginBottom: 6 }]}>
          <Text variant="title" weight={700}>
            Hari ini
          </Text>
          <Badge tone="success">Selesai</Badge>
        </View>
        <BarisRingkas label="Masuk" nilai={`${jam(state.checkedInAt)}${day?.checkIn?.locationName ? ` · ${day.checkIn.locationName}` : ''}`} />
        <BarisRingkas label="Pulang" nilai={`${jam(state.checkedOutAt)}${day?.checkOut?.locationName ? ` · ${day.checkOut.locationName}` : ''}`} />
        <BarisRingkas label="Durasi kerja" nilai={durasi !== null ? durasiMenit(durasi) : '—'} />
        {d.shiftName ? <BarisRingkas label="Shift" nilai={`${d.shiftName}${d.hours ? ` ${d.hours}` : ''}`} /> : null}
        {day?.checkIn?.methodLabel ? <BarisRingkas label="Metode" nilai={day.checkIn.methodLabel} /> : null}
        {day && day.lateMinutes > 0 ? <BarisRingkas label="Terlambat" nilai={durasiMenit(day.lateMinutes)} /> : null}
      </Card>
      <Card>
        <RencanaBacaSaja poin={day?.workPlan ?? []} judul="Rencana kerja pagi tadi" />
      </Card>
      <Card style={{ gap: 12 }}>
        <View style={[s.baris, { gap: 12 }]}>
          <IconTile icon="clipboard-pen-line" tone="warn" />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="title" weight={700}>
              Laporan hari ini belum dikirim
            </Text>
            <Text variant="meta">Bisa dikirim sampai 23.59</Text>
          </View>
        </View>
        <Button
          title="Tulis laporan hari ini"
          variant="tonal"
          icon="pen-line"
          onPress={() => bukaSegera({ judul: 'Laporan harian', ikon: 'clipboard-pen-line', catatan: 'Untuk sementara laporan harian ditulis di RuangKerja versi desktop.', tautan: '/laporan/hari-ini' })}
        />
      </Card>
      <Pressable onPress={() => router.push('/absensi/riwayat')} accessibilityRole="link" accessibilityLabel="Lihat riwayat absensi" style={s.tautan}>
        <Icon name="history" size={18} color={colors.link} />
        <Text variant="label" weight={700} tone="link">
          Lihat riwayat absensi
        </Text>
      </Pressable>
    </>
  );
}

/** 03-4 / 03-5: hari libur, bukan hari kerja, atau hari dari pengajuan. */
export function KartuTidakTersedia({ state, data }: { state: KeadaanAbsen; data: TodayAttendance }): React.JSX.Element {
  const { colors } = useTheme();
  const jadwal = data.today.schedule;
  const dariPengajuan = state.code === 'day_has_request';
  const judul = dariPengajuan ? `Hari ini tercatat ${state.request?.statusLabel ?? 'dari pengajuan'}` : 'Absen tidak tersedia';
  const pesan = dariPengajuan
    ? 'Dari pengajuan yang disetujui. Hubungi HR bila Anda tetap masuk kerja.'
    : state.code === 'holiday'
      ? `Hari ini libur${state.holidayName ? ` — ${state.holidayName}` : ''}. Tidak perlu check-in.`
      : 'Hari ini bukan hari kerja. Tidak perlu check-in.';
  return (
    <>
      <Card style={{ gap: 12 }}>
        <View style={[s.baris, { gap: 12 }]}>
          <IconTile icon={dariPengajuan ? 'file-check' : 'calendar-off'} tone={dariPengajuan ? 'blue' : 'neutral'} size={52} />
          <Text variant="title" weight={700} style={{ flex: 1 }}>
            {judul}
          </Text>
        </View>
        <Text variant="body" tone="muted" style={{ fontSize: 15, lineHeight: 22 }}>
          {pesan}
        </Text>
        {dariPengajuan ? (
          <Button title="Lihat pengajuan" variant="tonal" icon="file-text" onPress={() => bukaSegera({ judul: 'Pengajuan saya', ikon: 'file-text', tautan: '/pengajuan' })} />
        ) : null}
      </Card>
      {dariPengajuan ? (
        <Card style={{ gap: 4 }}>
          <Text variant="title" weight={700} style={{ marginBottom: 6 }}>
            Catatan hari ini
          </Text>
          <BarisRingkas label="Status" nilai={`${state.request?.statusLabel ?? '—'}${state.request?.portion === 'half_day' ? ' · setengah hari' : ' · sehari penuh'}`} />
          <BarisRingkas label="Check-in" nilai="Tidak diperlukan" />
        </Card>
      ) : jadwal.shiftName ? (
        <Card style={{ gap: 4 }}>
          <Text variant="title" weight={700} style={{ marginBottom: 6 }}>
            Jadwal Anda
          </Text>
          <BarisRingkas label="Shift" nilai={`${jadwal.shiftName}${jadwal.hours ? ` · ${jadwal.hours}` : ''}`} />
          <BarisRingkas label="Tanggal" nilai={tanggalDariYMD(jadwal.workDate)} />
        </Card>
      ) : null}
      <Pressable onPress={() => router.push('/absensi/riwayat')} accessibilityRole="link" accessibilityLabel="Lihat riwayat absensi" style={s.tautan}>
        <Icon name="history" size={18} color={colors.link} />
        <Text variant="label" weight={700} tone="link">
          Lihat riwayat absensi
        </Text>
      </Pressable>
    </>
  );
}

const s = StyleSheet.create({
  baris: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nomor: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tautan: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48 },
});
