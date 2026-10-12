/**
 * Daftar workspace — direktori dari GET /workspace (grup pribadi, divisi &
 * tim, proyek, lainnya; keempat grup selalu ada). Ketuk baris → layar
 * workspace (Papan · Catatan · Tugas).
 */
import { Ionicons } from '@/ui/Ionicons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { daftarWorkspace } from '@/api/endpoints';
import type { WorkspaceGroups } from '@/api/types';
import { Badge, Card, EmptyState, ErrorState, Loading, Meta, Row, Screen } from '@/components/ui';
import { useTheme } from '@/lib/theme';

export default function LayarDaftarWorkspace(): React.JSX.Element {
  const { colors } = useTheme();
  const [grup, setGrup] = useState<WorkspaceGroups | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);

  const muat = useCallback(async (): Promise<void> => {
    setMemuat(true);
    setGalat(null);
    try {
      setGrup(await daftarWorkspace());
    } catch (err) {
      setGalat(err instanceof ApiError ? err.message : 'Tidak dapat memuat workspace.');
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pemuatan data saat layar dibuka
    void muat();
  }, [muat]);

  const berisi = (grup?.groups ?? []).some((g) => g.items.length > 0);

  return (
    <Screen refreshing={memuat && grup !== null} onRefresh={() => void muat()}>
      <Text style={[gaya.judul, { color: colors.text }]}>Workspace</Text>
      <Meta>Semua workspace yang terlihat untuk Anda.</Meta>

      {memuat && !grup ? (
        <Loading label="Memuat workspace…" />
      ) : galat && !grup ? (
        <ErrorState message={galat} onRetry={() => void muat()} />
      ) : !berisi ? (
        <EmptyState
          icon="grid-outline"
          title="Belum ada workspace"
          description="Workspace yang terlihat untuk Anda akan tampil di sini."
        />
      ) : (
        (grup?.groups ?? []).map((bagian) => (
          <View key={bagian.jenis} style={gaya.bagian}>
            <Text style={[gaya.labelBagian, { color: colors.muted }]}>{bagian.label}</Text>
            <Card style={{ paddingVertical: 4, paddingHorizontal: 12 }}>
              {bagian.items.map((ruang, indeks) => (
                <View key={ruang.id}>
                  {indeks > 0 ? (
                    <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 36 }} />
                  ) : null}
                  <Row
                    title={ruang.name}
                    subtitle={ruang.key}
                    onPress={() => router.push(`/workspace/${ruang.id}`)}
                    accessibilityLabel={`Buka workspace ${ruang.name}`}
                    right={
                      <View style={gaya.kanan}>
                        {ruang.arsip ? <Badge tone="neutral">Diarsipkan</Badge> : null}
                        <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
                      </View>
                    }
                  />
                </View>
              ))}
              {bagian.items.length === 0 ? (
                <Meta>Tidak ada workspace pada grup ini.</Meta>
              ) : null}
            </Card>
          </View>
        ))
      )}
    </Screen>
  );
}

const gaya = StyleSheet.create({
  judul: { fontSize: 26, fontWeight: '800', marginBottom: 2 },
  bagian: { gap: 6 },
  labelBagian: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  kanan: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
