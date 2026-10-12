/**
 * Sheet Workspace dari tombol tengah tab bar: grup Pribadi · Divisi & tim ·
 * Proyek (dan Lainnya, lihat saja) dari GET workspace; ketuk → buka
 * workspace. Dimuat saat sheet dibuka.
 */
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { daftarWorkspace } from '@/api/endpoints';
import type { WorkspaceGroups } from '@/api/types';
import { radius, useTheme, type GradientName } from '@/theme';

import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { Gradient } from './Gradient';
import { Badge } from './Indicators';
import { Pressable } from './Pressable';
import { ErrorState, Loading } from './States';
import { Text } from './Text';

const GRADIEN: Record<string, GradientName> = { pribadi: 'slate', divisi: 'merek', proyek: 'indigo', lainnya: 'slate' };

export function WorkspaceSheet({ visible, onClose }: { visible: boolean; onClose: () => void }): React.JSX.Element {
  const { colors } = useTheme();
  const [data, setData] = useState<WorkspaceGroups | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [memuat, setMemuat] = useState(false);

  const muat = useCallback(async (): Promise<void> => {
    setMemuat(true);
    setGalat(null);
    try {
      setData(await daftarWorkspace());
    } catch (err) {
      setGalat(err instanceof ApiError ? err.message : 'Tidak dapat memuat workspace.');
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- memuat saat sheet dibuka
      void muat();
    }
  }, [visible, muat]);

  const buka = (id: string): void => {
    onClose();
    router.push(`/workspace/${id}`);
  };

  const grup = (data?.groups ?? []).filter((g) => g.items.length > 0);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Workspace" scrollable>
      {memuat && !data ? (
        <Loading label="Memuat workspace…" rows={3} />
      ) : galat && !data ? (
        <ErrorState message={galat} onRetry={() => void muat()} />
      ) : grup.length === 0 ? (
        <Text variant="body" tone="muted">
          Belum ada workspace yang terlihat untuk Anda.
        </Text>
      ) : (
        grup.map((g) => (
          <View key={g.jenis} style={{ gap: 4 }}>
            <Text variant="meta" weight={700} style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
              {g.label}
            </Text>
            {g.items.map((w) => (
              <Pressable key={w.id} onPress={() => buka(w.id)} scaleTo={1} accessibilityRole="button" accessibilityLabel={`Buka workspace ${w.name}`} style={s.baris}>
                <Gradient name={GRADIEN[g.jenis] ?? 'slate'} style={s.ubin}>
                  <Text variant="label" weight={800} style={{ color: '#FFFFFF' }}>
                    {w.name.slice(0, 1).toUpperCase()}
                  </Text>
                </Gradient>
                <View style={{ flex: 1 }}>
                  <Text variant="title" numberOfLines={1}>
                    {w.name}
                  </Text>
                  <Text variant="meta" numberOfLines={1} style={{ color: colors.muted }}>
                    {w.key}
                  </Text>
                </View>
                {w.arsip ? <Badge tone="neutral">Diarsipkan</Badge> : null}
              </Pressable>
            ))}
          </View>
        ))
      )}
      <Button
        title="Semua workspace"
        variant="outline"
        icon="layout-grid"
        onPress={() => {
          onClose();
          router.push('/workspace');
        }}
      />
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  baris: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 6 },
  ubin: { width: 44, height: 44, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
});
