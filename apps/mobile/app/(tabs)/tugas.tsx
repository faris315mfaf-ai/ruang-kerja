/**
 * Layar Tugas — daftar "Saya"/"Semua" dengan halaman sederhana ("Muat lagi"),
 * item menuju detail. Tugas hasil absen diberi penanda "dari absen".
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

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

  const muat = useCallback(
    async (lingkupBaru: Lingkup, halamanBaru: number, tambah: boolean): Promise<void> => {
      if (tambah) {
        setMemuatLagi(true);
      } else {
        setMemuat(true);
      }
      setGalat(null);
      try {
        const hasil = await daftarTugas(halamanBaru, lingkupBaru === 'saya');
        setHalamanAkhir(hasil.meta.last_page);
        setTotal(hasil.meta.total);
        setTugas((lama) => (tambah ? [...lama, ...hasil.tasks] : hasil.tasks));
      } catch (err) {
        setGalat(err instanceof ApiError ? err.message : 'Tidak dapat memuat tugas.');
        if (!tambah) {
          setTugas([]);
        }
      } finally {
        setMemuat(false);
        setMemuatLagi(false);
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
      <Text style={[gaya.judul, { color: colors.text }]}>Tugas</Text>
      <Segmented<Lingkup>
        value={lingkup}
        onChange={(nilai) => {
          setLingkup(nilai);
          setHalaman(1);
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
          description="Membuat tugas baru belum didukung aplikasi — lakukan lewat RuangKerja web."
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
                const berikut = halaman + 1;
                setHalaman(berikut);
                void muat(lingkup, berikut, true);
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
  judul: { fontSize: 26, fontWeight: '800', marginBottom: 2 },
  tamat: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
});
