/**
 * Beranda — sapaan + tanggal, kartu status absensi hari ini (dengan tombol
 * menuju tab Absen), tugas hari ini bersegmen Pribadi/Tim/Semua, dan kartu
 * briefing terakhir (tersembunyi bila 204). Tarik untuk menyegarkan.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { absensiHariIni, briefingTerakhir, tugasHariIni } from '@/api/endpoints';
import type { Briefing, TodayAttendance, TodayTasks } from '@/api/types';
import { Badge, Button, Card, CardTitle, EmptyState, ErrorState, Loading, Meta, Screen, Segmented } from '@/components/ui';
import { TugasItem } from '@/components/TugasItem';
import { jam, sapaan, tanggalPanjang, tanggalPendek } from '@/lib/format';
import { radius, useTheme } from '@/lib/theme';
import { useSession } from '@/session/SessionProvider';

type Segmen = 'pribadi' | 'tim' | 'semua';

const labelAksi: Record<string, string> = {
  check_in: 'Belum absen masuk',
  check_out: 'Sudah masuk, belum absen pulang',
  done: 'Hari ini selesai',
  unavailable: 'Absen tidak tersedia',
};

function KartuAbsensi({ data }: { data: TodayAttendance }): React.JSX.Element {
  const { colors } = useTheme();
  const { today } = data;

  return (
    <Card>
      <View style={kartu.kepala}>
        <CardTitle>Absensi hari ini</CardTitle>
        <Badge tone={today.action === 'done' ? 'success' : today.action === 'unavailable' ? 'neutral' : 'primary'}>
          {labelAksi[today.action] ?? today.action}
        </Badge>
      </View>

      <View style={kartu.baris}>
        <Ionicons name="time-outline" size={18} color={colors.subtle} />
        <Meta>
          {today.schedule.isWorkday
            ? `${today.schedule.shiftName ?? 'Jadwal'} ${today.schedule.hours ?? ''}`.trim()
            : today.schedule.isHoliday
              ? `Libur${today.schedule.holidayName ? ` — ${today.schedule.holidayName}` : ''}`
              : 'Hari tidak bekerja'}
        </Meta>
      </View>

      {today.day ? (
        <View style={kartu.baris}>
          <Ionicons name="log-in-outline" size={18} color={today.day.checkInAt ? colors.success : colors.subtle} />
          <Meta>Masuk {jam(today.day.checkInAt)}</Meta>
          <Ionicons name="log-out-outline" size={18} color={today.day.checkOutAt ? colors.danger : colors.subtle} />
          <Meta>Pulang {jam(today.day.checkOutAt)}</Meta>
        </View>
      ) : null}

      {(today.action === 'check_in' || today.action === 'check_out') && (
        <Button
          title={today.action === 'check_in' ? 'Absen masuk' : 'Absen pulang'}
          onPress={() => router.push('/(tabs)/absen')}
          icon="finger-print"
          accessibilityHint="Membuka tab Absen"
        />
      )}
      {today.action === 'done' && (
        <Button title="Lihat ringkasan hari" variant="secondary" onPress={() => router.push('/(tabs)/absen')} />
      )}
    </Card>
  );
}

function KartuTugas({ data }: { data: TodayTasks | null }): React.JSX.Element {
  const [segmen, setSegmen] = useState<Segmen>('semua');
  const items = data ? data[segmen] : [];
  const counts = data?.counts;

  return (
    <Card>
      <CardTitle>Tugas hari ini</CardTitle>
      <Segmented<Segmen>
        value={segmen}
        onChange={setSegmen}
        options={[
          { value: 'pribadi', label: 'Pribadi', badge: counts?.pribadi ?? null },
          { value: 'tim', label: 'Tim', badge: counts?.tim ?? null },
          { value: 'semua', label: 'Semua', badge: counts?.semua ?? null },
        ]}
      />

      {items.length === 0 ? (
        <EmptyState
          icon="checkmark-done-outline"
          title="Tidak ada tugas"
          description={`Tugas jatuh tempo hari ini segmen ${segmen} kosong.`}
        />
      ) : (
        <View style={{ gap: 2 }}>
          {items.map((tugas) => (
            <TugasItem
              key={tugas.id}
              tugas={{
                ...tugas,
                priority: { value: 'normal', label: tugas.priority },
                due_date: data?.today ?? null,
              }}
              onPress={() => router.push(`/tugas/${tugas.id}`)}
            />
          ))}
        </View>
      )}
    </Card>
  );
}

function KartuBriefing({ briefing }: { briefing: Briefing }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <Card>
      <View style={kartu.kepala}>
        <CardTitle>Briefing terakhir</CardTitle>
        <Badge tone="info">{briefing.label}</Badge>
      </View>
      <Meta>
        {tanggalPendek(briefing.date)} · oleh {briefing.oleh}
      </Meta>
      <Text numberOfLines={6} style={[kartu.isi, { color: colors.muted }]}>
        {briefing.content}
      </Text>
    </Card>
  );
}

export default function LayarBeranda(): React.JSX.Element {
  const { colors } = useTheme();
  const { user } = useSession();

  const [absensi, setAbsensi] = useState<TodayAttendance | null>(null);
  const [tugas, setTugas] = useState<TodayTasks | null>(null);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [menyegarkan, setMenyegarkan] = useState(false);

  const muat = useCallback(async (diam = false): Promise<void> => {
    setGalat(null);
    if (!diam) {
      setMemuat(true);
    }

    const [hasilAbsensi, hasilTugas, hasilBriefing] = await Promise.allSettled([
      absensiHariIni(),
      tugasHariIni(),
      briefingTerakhir(),
    ]);

    if (hasilAbsensi.status === 'fulfilled') {
      setAbsensi(hasilAbsensi.value);
    } else {
      setAbsensi(null);
    }
    if (hasilTugas.status === 'fulfilled') {
      setTugas(hasilTugas.value);
    } else {
      setTugas(null);
    }
    // Briefing 204 → null (kartu disembunyikan); galat diabaikan.
    setBriefing(hasilBriefing.status === 'fulfilled' ? hasilBriefing.value : null);

    const gagal = [hasilAbsensi, hasilTugas].find((h) => h.status === 'rejected');
    if (gagal && gagal.status === 'rejected') {
      const err = gagal.reason;
      setGalat(
        err instanceof ApiError
          ? err.message
          : 'Tidak dapat memuat beranda. Periksa koneksi Anda.',
      );
    }

    setMemuat(false);
    setMenyegarkan(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pemuatan data saat layar dibuka
    void muat();
  }, [muat]);

  return (
    <Screen
      refreshing={menyegarkan}
      onRefresh={() => {
        setMenyegarkan(true);
        void muat(true);
      }}
    >
      <View style={beranda.sapa}>
        <View style={{ flex: 1 }}>
          <Text style={[beranda.halo, { color: colors.muted }]}>{sapaan()}</Text>
          <Text style={[beranda.nama, { color: colors.text }]}>{user?.name ?? '…'}</Text>
          <Meta>{tanggalPanjang(new Date())}</Meta>
        </View>
        <Pressable
          onPress={() => router.push('/(tabs)/lainnya')}
          accessibilityRole="button"
          accessibilityLabel="Profil dan lainnya"
          style={[beranda.avatar, { backgroundColor: colors.linkSoft }]}
        >
          <Text style={[beranda.avatarTeks, { color: colors.link }]}>{(user?.name ?? 'RK').slice(0, 1)}</Text>
        </Pressable>
      </View>

      {memuat && !absensi && !tugas ? (
        <Loading label="Memuat beranda…" />
      ) : galat && !absensi && !tugas ? (
        <ErrorState message={galat} onRetry={() => void muat()} />
      ) : (
        <>
          {absensi ? <KartuAbsensi data={absensi} /> : null}
          {galat ? (
            <Card>
              <Meta>{galat} — tarik ke bawah untuk mencoba lagi.</Meta>
            </Card>
          ) : null}
          {tugas ? <KartuTugas data={tugas} /> : null}
          {briefing ? <KartuBriefing briefing={briefing} /> : null}
        </>
      )}
    </Screen>
  );
}

const kartu = StyleSheet.create({
  kepala: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  baris: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  isi: { fontSize: 14, lineHeight: 21 },
});

const beranda = StyleSheet.create({
  sapa: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  halo: { fontSize: 14 },
  nama: { fontSize: 24, fontWeight: '800' },
  avatar: { width: 48, height: 48, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  avatarTeks: { fontSize: 20, fontWeight: '700' },
});
