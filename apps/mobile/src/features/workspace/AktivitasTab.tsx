/**
 * Tab Aktivitas (mockup 05 › 19-4): feed perubahan workspace, dikelompokkan
 * per hari, paginasi "Muat aktivitas lebih lama". GET /workspace/{ws}/aktivitas.
 */
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { ambilAktivitas, type BarisAktivitas, type MetaHalaman } from '@/api/workspace';
import { jam, ymdHariIni, ymdJakarta } from '@/lib/format';
import { Avatar, Button, Card, EmptyState, Loading, Pressable, Text } from '@/ui';
import { useTheme } from '@/theme';

import { GalatMuat, PitaOffline, TabScroll } from './bagian';
import { hariSingkat, tambahHari } from './util';

export function AktivitasTab({ ws }: { ws: string }): React.JSX.Element {
  const { colors } = useTheme();
  const [baris, setBaris] = useState<BarisAktivitas[]>([]);
  const [meta, setMeta] = useState<MetaHalaman | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [memuatLagi, setMemuatLagi] = useState(false);
  const [galat, setGalat] = useState<ApiError | null>(null);
  const [offline, setOffline] = useState(false);
  const serial = useRef(0);
  const ada = useRef(false);

  const muat = useCallback(
    async (halaman: number): Promise<void> => {
      const id = ++serial.current;
      if (halaman > 1) {
        setMemuatLagi(true);
      }
      try {
        const hasil = await ambilAktivitas(ws, halaman);
        if (id !== serial.current) {
          return;
        }
        ada.current = true;
        setBaris((lama) => (halaman === 1 ? hasil.aktivitas : [...lama, ...hasil.aktivitas.filter((a) => !lama.some((x) => x.id === a.id))]));
        setMeta(hasil.meta);
        setGalat(null);
        setOffline(false);
      } catch (err) {
        if (id !== serial.current) {
          return;
        }
        const e = err instanceof ApiError ? err : new ApiError({ status: 0, message: 'Tidak dapat memuat aktivitas.' });
        if (e.status === 0 && halaman === 1 && ada.current) {
          setOffline(true);
        } else {
          setGalat(e);
        }
      } finally {
        setMemuat(false);
        setMemuatLagi(false);
      }
    },
    [ws],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pemuatan data saat tab dibuka
    void muat(1);
  }, [muat]);

  const hariIni = ymdHariIni();
  const kelompok = useMemo(() => {
    const peta = new Map<string, BarisAktivitas[]>();
    for (const b of baris) {
      const k = ymdJakarta(b.created_at);
      peta.set(k, [...(peta.get(k) ?? []), b]);
    }
    return [...peta.entries()];
  }, [baris]);

  const labelHari = (k: string): string => (k === hariIni ? 'Hari ini' : k === tambahHari(hariIni, -1) ? 'Kemarin' : hariSingkat(k));

  if (memuat && baris.length === 0) {
    return (
      <TabScroll>
        <Loading label="Memuat aktivitas…" rows={5} />
      </TabScroll>
    );
  }
  if (galat && baris.length === 0) {
    return <GalatMuat galat={galat} judul="Aktivitas belum bisa dimuat" onCoba={() => void muat(1)} />;
  }

  return (
    <TabScroll onRefresh={() => muat(1)}>
      {offline ? <PitaOffline diperbarui={null} objek="aktivitas" /> : null}
      {baris.length === 0 ? (
        <EmptyState icon="history" title="Belum ada aktivitas" description="Perubahan tugas, anggota, dan file di workspace ini akan tercatat di sini." />
      ) : (
        kelompok.map(([k, daftar]) => (
          <View key={k} style={{ gap: 8 }}>
            <Text variant="overline" tone="muted" accessibilityRole="header">
              {labelHari(k).toUpperCase()}
            </Text>
            <Card variant="flat">
              {daftar.map((a, i) => {
                const tugas = a.subject_type === 'task' && a.subject_id !== null;
                const isi = (
                  <>
                    <Avatar name={a.actor?.name ?? 'Sistem'} size="sm" />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="body" style={{ fontSize: 15, lineHeight: 22 }}>
                        <Text variant="body" weight={700} style={{ fontSize: 15, lineHeight: 22 }}>
                          {a.actor?.name ?? 'Sistem'}
                        </Text>
                        {` ${a.text}`}
                      </Text>
                      <Text variant="meta">{`${jam(a.created_at)}${a.task_key ? ` · ${a.task_key}` : ''}`}</Text>
                    </View>
                  </>
                );
                const gaya = [s.baris, i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider } : null];
                return tugas ? (
                  <Pressable key={a.id} onPress={() => router.push(`/tugas/${a.subject_id}`)} scaleTo={1} accessibilityRole="button" accessibilityLabel={`${a.actor?.name ?? 'Sistem'} ${a.text}. Buka tugas ${a.task_key ?? ''}`} style={gaya}>
                    {isi}
                  </Pressable>
                ) : (
                  <View key={a.id} style={gaya}>
                    {isi}
                  </View>
                );
              })}
            </Card>
          </View>
        ))
      )}
      {meta?.has_more ? <Button title="Muat aktivitas lebih lama" variant="outline" loading={memuatLagi} onPress={() => void muat((meta.current_page ?? 1) + 1)} /> : null}
      {galat && baris.length > 0 ? <Text variant="meta" tone="danger" align="center">{galat.message}</Text> : null}
    </TabScroll>
  );
}

const s = StyleSheet.create({
  baris: { flexDirection: 'row', gap: 12, padding: 14, alignItems: 'flex-start' },
});
