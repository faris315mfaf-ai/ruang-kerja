/**
 * Layar Tugas — daftar "Saya"/"Semua" dengan halaman sederhana ("Muat lagi"),
 * item menuju detail. Tugas hasil absen diberi penanda "dari absen".
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { daftarTugas } from '@/api/endpoints';
import type { TaskListItem } from '@/api/types';
import { Button, Card, EmptyState, ErrorState, Loading, Meta, Screen, Segmented } from '@/components/ui';
import { TugasItem } from '@/components/TugasItem';
import { useTheme } from '@/lib/theme';

type Lingkup = 'saya' | 'semua';

export default function LayarTugas(): React.JSX.Element {
  const { colors } = useTheme();
  const [lingkup, setLingkup] = useState<Lingkup>('saya');
  const [tugas, setTugas] = useState<TaskListItem[]>([]);
  const [halaman, setHalaman] = useState(1);
  const [halamanAkhir, setHalamanAkhir] = useState(1);
  const [total, setTotal] = useState(0);
  const [memuat, setMemuat] = useState(true);
  const [memuatLagi, setMemuatLagi] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  // Request id: a slower response for an earlier scope must not override a newer one.
  const permintaan = useRef(0);

  const muat = useCallback(
    async (lingkupBaru: Lingkup, halamanBaru: number, tambah: boolean): Promise<void> => {
      const idMuat = ++permintaan.current;
      if (tambah) {
        setMemuatLagi(true);
      } else {
        setMemuat(true);
      }
      setGalat(null);
      try {
        const hasil = await daftarTugas(halamanBaru, lingkupBaru === 'saya');
        if (idMuat !== permintaan.current) {
          return;
        }
        setHalaman(halamanBaru); // only advance the page once it actually loaded
        setHalamanAkhir(hasil.meta.last_page);
        setTotal(hasil.meta.total);
        setTugas((lama) => {
          if (!tambah) {
            return hasil.tasks;
          }
          const sudah = new Set(lama.map((satu) => satu.id));
          return [...lama, ...hasil.tasks.filter((satu) => !sudah.has(satu.id))];
        });
      } catch (err) {
        if (idMuat !== permintaan.current) {
          return;
        }
        setGalat(err instanceof ApiError ? err.message : 'Tidak dapat memuat tugas.');
        if (!tambah) {
          setTugas([]);
        }
      } finally {
        if (idMuat === permintaan.current) {
          setMemuat(false);
          setMemuatLagi(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pemuatan data saat lingkup berubah
    void muat(lingkup, 1, false);
  }, [lingkup, muat]);

  const masihAda = halaman < halamanAkhir;

  return (
    <Screen>
      <View style={gaya.kepala}>
        <Text style={[gaya.judul, { color: colors.text }]}>Tugas</Text>
        <Pressable
          onPress={() => router.push('/tugas/baru')}
          accessibilityRole="button"
          accessibilityLabel="Buat tugas baru"
          accessibilityHint="Membuka form tugas baru"
          style={({ pressed }) => [gaya.tombolBaru, { borderColor: colors.primary, opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="add" size={20} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>Tugas</Text>
        </Pressable>
      </View>
      <Segmented<Lingkup>
        value={lingkup}
        onChange={(nilai) => {
          setLingkup(nilai);
        }}
        options={[
          { value: 'saya', label: 'Saya' },
          { value: 'semua', label: 'Semua' },
        ]}
      />
      <Meta>{total} tugas terlihat</Meta>

      {memuat ? (
        <Loading label="Memuat tugas…" />
      ) : galat && tugas.length === 0 ? (
        <ErrorState message={galat} onRetry={() => void muat(lingkup, 1, false)} />
      ) : tugas.length === 0 ? (
        <EmptyState
          icon="checkbox-outline"
          title={lingkup === 'saya' ? 'Belum ada tugas untuk Anda' : 'Belum ada tugas'}
          description="Ketuk tombol + Tugas di atas untuk membuat tugas baru."
        />
      ) : (
        <>
          {galat ? <Meta>{galat}</Meta> : null}
          <Card style={{ paddingVertical: 4, paddingHorizontal: 12 }}>
            {tugas.map((tugasSatu, indeks) => (
              <View key={tugasSatu.id}>
                {indeks > 0 ? (
                  <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 42 }} />
                ) : null}
                <TugasItem
                  tugas={tugasSatu}
                  onPress={() => router.push(`/tugas/${tugasSatu.id}`)}
                />
              </View>
            ))}
          </Card>

          {masihAda ? (
            <Button
              title={memuatLagi ? 'Memuat…' : 'Muat lagi'}
              variant="secondary"
              icon="chevron-down"
              disabled={memuatLagi}
              loading={memuatLagi}
              onPress={() => {
                void muat(lingkup, halaman + 1, true);
              }}
            />
          ) : (
            <View style={gaya.tamat}>
              <Ionicons name="checkmark-done-outline" size={16} color={colors.subtle} />
              <Meta>Sudah menampilkan semua tugas</Meta>
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

const gaya = StyleSheet.create({
  kepala: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 2 },
  judul: { fontSize: 26, fontWeight: '800' },
  tombolBaru: {
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
  },
  tamat: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
});
