/**
 * Kalender — list entri dikelompokkan per tanggal (tanpa grid) dari
 * GET /kalender: rapat, tenggat tugas, cuti/izin/dinas disetujui, dan
 * libur perusahaan. Ikon per jenis; rapat → detail rapat, tugas → detail
 * tugas. Navigasi bulan sebelumnya/berikutnya; flag meetings mati (404)
 * → layar kosong ramah.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { kalenderBulan } from '@/api/endpoints';
import type { CalendarEntry, CalendarMonth } from '@/api/types';
import { Badge, Card, EmptyState, ErrorState, Loading, Meta, Screen } from '@/components/ui';
import { tanggalDariYMD, tanggalPanjang, ymdHariIni } from '@/lib/format';
import { radius, useTheme } from '@/lib/theme';

const IKON_JENIS: Record<CalendarEntry['layer'], keyof typeof Ionicons.glyphMap> = {
  meetings: 'videocam-outline',
  tasks: 'checkbox-outline',
  leave: 'airplane-outline',
  holidays: 'flag-outline',
};

const LABEL_JENIS: Record<CalendarEntry['layer'], string> = {
  meetings: 'Rapat',
  tasks: 'Tugas',
  leave: 'Cuti/izin',
  holidays: 'Libur',
};

/** "YYYY-MM" bulan berjalan (Jakarta). */
function bulanHariIni(): string {
  return ymdHariIni().slice(0, 7);
}

/** Geser bulan YYYY-MM sebanyak n langkah. */
function geserBulan(bulan: string, langkah: number): string {
  const [tahunk, bulank] = bulan.split('-').map(Number);
  const total = (tahunk ?? 2026) * 12 + ((bulank ?? 1) - 1) + langkah;
  const tahun = Math.floor(total / 12);
  const nomor = ((total % 12) + 12) % 12;
  return `${tahun}-${String(nomor + 1).padStart(2, '0')}`;
}

function BarisEntri({ entri, onTekan }: { entri: CalendarEntry; onTekan?: () => void }): React.JSX.Element {
  const { colors } = useTheme();
  const isi = (
    <>
      <View style={[gaya.ikon, { backgroundColor: entri.overdue ? colors.dangerSoft : colors.surface2 }]}>
        <Ionicons
          name={IKON_JENIS[entri.layer]}
          size={18}
          color={entri.overdue ? colors.danger : colors.subtle}
        />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[gaya.judul, { color: colors.text }]} numberOfLines={2}>
          {entri.title}
        </Text>
        <View style={gaya.meta}>
          <Meta>{LABEL_JENIS[entri.layer]}</Meta>
          {entri.meta ? <Meta>· {entri.meta}</Meta> : null}
        </View>
      </View>
      {onTekan ? <Ionicons name="chevron-forward" size={18} color={colors.subtle} /> : null}
    </>
  );

  return (
    <Pressable
      onPress={onTekan}
      disabled={onTekan === undefined}
      accessibilityRole={onTekan ? 'button' : undefined}
      accessibilityLabel={onTekan ? `${LABEL_JENIS[entri.layer]}: ${entri.title}` : undefined}
      style={({ pressed }) => [gaya.baris, pressed && onTekan && { opacity: 0.75 }]}
    >
      {isi}
    </Pressable>
  );
}

export default function LayarKalender(): React.JSX.Element {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [bulan, setBulan] = useState<string>(bulanHariIni());
  const [data, setData] = useState<CalendarMonth | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [mati, setMati] = useState(false);

  // Request id: a slower response for an earlier month must not override a newer one.
  const permintaan = useRef(0);

  const muat = useCallback(async (pilih: string): Promise<void> => {
    const idMuat = ++permintaan.current;
    setMemuat(true);
    setGalat(null);
    try {
      const hasil = await kalenderBulan(pilih);
      if (idMuat !== permintaan.current) {
        return;
      }
      setData(hasil);
      setMati(false);
    } catch (err) {
      if (idMuat !== permintaan.current) {
        return;
      }
      if (err instanceof ApiError && err.status === 404) {
        setMati(true);
        setData(null);
      } else {
        setGalat(err instanceof ApiError ? err.message : 'Tidak dapat memuat kalender.');
      }
    } finally {
      if (idMuat === permintaan.current) {
        setMemuat(false);
      }
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pemuatan data saat layar/bulan berubah
    void muat(bulan);
  }, [muat, bulan]);

  /** id entri "meeting-{ulid}:{tanggal}" / "task-{ulid}". */
  function tujuan(entri: CalendarEntry): (() => void) | undefined {
    if (entri.layer === 'meetings') {
      const kunci = entri.id.replace(/^meeting-/, '');
      const [rapatId, tanggal] = kunci.split(':');
      if (!rapatId) {
        return undefined;
      }
      return () =>
        router.push({
          pathname: '/rapat/[id]/index',
          params: { id: rapatId, tanggal: tanggal ?? entri.date, judul: entri.title },
        });
    }
    if (entri.layer === 'tasks') {
      const tugasId = entri.id.replace(/^task-/, '');
      if (!tugasId) {
        return undefined;
      }
      return () => router.push(`/tugas/${tugasId}`);
    }
    return undefined;
  }

  // Kelompokkan per tanggal, urut naik.
  const kelompok: { tanggal: string; entri: CalendarEntry[] }[] = [];
  const peta = new Map<string, CalendarEntry[]>();
  for (const entri of data?.entries ?? []) {
    const ada = peta.get(entri.date);
    if (ada) {
      ada.push(entri);
    } else {
      peta.set(entri.date, [entri]);
    }
  }
  for (const tanggal of [...peta.keys()].sort()) {
    kelompok.push({ tanggal, entri: peta.get(tanggal) ?? [] });
  }

  const hariIni = ymdHariIni();
  const namaBulan = data ? tanggalDariYMD(`${data.year}-${String(data.month).padStart(2, '0')}-01`) : '—';

  if (mati) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          style={[gaya.punggung, { paddingTop: insets.top + 10 }]}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
          <Text style={[gaya.judulAtas, { color: colors.text }]}>Kalender</Text>
        </Pressable>
        <Screen>
          <EmptyState
            icon="cloud-offline-outline"
            title="Kalender belum diaktifkan"
            description="Fitur rapat & kalender sedang tidak tersedia di server. Silakan gunakan RuangKerja web atau hubungi admin."
          />
        </Screen>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Kembali"
        style={[gaya.punggung, { paddingTop: insets.top + 10 }]}
        hitSlop={8}
      >
        <Ionicons name="arrow-back" size={24} color={colors.text} />
        <Text style={[gaya.judulAtas, { color: colors.text }]}>Kalender</Text>
      </Pressable>

      <Screen>
        <View style={gaya.pilihBulan}>
          <Pressable
            onPress={() => setBulan(geserBulan(bulan, -1))}
            accessibilityRole="button"
            accessibilityLabel="Bulan sebelumnya"
            style={gaya.tombolBulan}
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </Pressable>
          <Text style={[gaya.namaBulan, { color: colors.text }]}>{namaBulan}</Text>
          <Pressable
            onPress={() => setBulan(geserBulan(bulan, 1))}
            accessibilityRole="button"
            accessibilityLabel="Bulan berikutnya"
            style={gaya.tombolBulan}
          >
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </Pressable>
        </View>

        {memuat && !data ? (
          <Loading label="Memuat kalender…" />
        ) : galat && !data ? (
          <ErrorState
            message={galat}
            onRetry={() => {
              void muat(bulan);
            }}
          />
        ) : kelompok.length === 0 ? (
          <EmptyState
            icon="calendar-clear-outline"
            title="Tidak ada agenda"
            description="Tidak ada rapat, tenggat, cuti, atau libur pada bulan ini."
          />
        ) : (
          kelompok.map((kelompokSatu) => (
            <Card key={kelompokSatu.tanggal} style={gaya.kartu}>
              <View style={gaya.kepalaTanggal}>
                <Text style={[gaya.tanggal, { color: colors.text }]}>
                  {tanggalPanjang(`${kelompokSatu.tanggal}T04:00:00Z`)}
                </Text>
                {kelompokSatu.tanggal === hariIni ? <Badge tone="primary">Hari ini</Badge> : null}
              </View>
              <View style={{ gap: 2 }}>
                {kelompokSatu.entri.map((entri) => (
                  <BarisEntri key={entri.id} entri={entri} onTekan={tujuan(entri)} />
                ))}
              </View>
            </Card>
          ))
        )}
      </Screen>
    </View>
  );
}

const gaya = StyleSheet.create({
  punggung: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  judulAtas: { fontSize: 17, fontWeight: '700' },
  pilihBulan: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  tombolBulan: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  namaBulan: { fontSize: 17, fontWeight: '800' },
  kartu: { padding: 14, gap: 6 },
  kepalaTanggal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  tanggal: { fontSize: 14, fontWeight: '700' },
  baris: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingVertical: 4 },
  ikon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  judul: { fontSize: 14, fontWeight: '600', lineHeight: 19 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
});
