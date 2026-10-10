/**
 * Detail tugas — deskripsi, checklist (baca), penerima, dan tombol
 * Selesai/Buka (PATCH /tugas/{id}/status {done}).
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { detailTugas, ubahStatusTugas } from '@/api/endpoints';
import type { TaskDetail } from '@/api/types';
import { Badge, Body, Button, Card, CardTitle, Divider, ErrorState, Field, Loading, Meta, Screen } from '@/components/ui';
import { tanggalDariYMD } from '@/lib/format';
import { useTheme } from '@/lib/theme';

export default function LayarDetailTugas(): React.JSX.Element {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [tugas, setTugas] = useState<TaskDetail | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [galatAksi, setGalatAksi] = useState<string | null>(null);
  const [menyibuk, setMenyibuk] = useState(false);

  const muat = useCallback(async (): Promise<void> => {
    if (typeof id !== 'string') {
      setGalat('Tugas tidak ditemukan.');
      setMemuat(false);
      return;
    }
    setMemuat(true);
    setGalat(null);
    try {
      setTugas(await detailTugas(id));
    } catch (err) {
      setGalat(err instanceof ApiError ? err.message : 'Tidak dapat memuat tugas.');
    } finally {
      setMemuat(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pemuatan data saat layar dibuka
    void muat();
  }, [muat]);

  async function ubahSelesai(target: boolean): Promise<void> {
    if (menyibuk || typeof id !== 'string') {
      return;
    }
    setMenyibuk(true);
    setGalatAksi(null);
    try {
      await ubahStatusTugas(id, { done: target });
      await muat();
    } catch (err) {
      setGalatAksi(err instanceof ApiError ? (err.firstValidationError ?? err.message) : 'Gagal memindah tugas.');
    } finally {
      setMenyibuk(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Kembali"
        style={[detail.punggung, { paddingTop: insets.top + 10 }]}
        hitSlop={8}
      >
        <Ionicons name="arrow-back" size={24} color={colors.text} />
        <Text style={[detail.judulAtas, { color: colors.text }]}>Detail tugas</Text>
      </Pressable>

      {memuat && !tugas ? (
        <Loading label="Memuat tugas…" />
      ) : galat && !tugas ? (
        <ErrorState message={galat} onRetry={() => void muat()} />
      ) : tugas ? (
        <Screen contentStyle={{ paddingBottom: 120 }}>
          <View style={{ gap: 6 }}>
            <View style={detail.lencanaBaris}>
              <Badge tone={tugas.status.is_done ? 'success' : 'primary'}>{tugas.status.name}</Badge>
              <Badge tone={tugas.priority.value === 'urgent' ? 'danger' : 'neutral'}>{tugas.priority.label}</Badge>
              {tugas.source === 'attendance' ? <Badge tone="info">dari absen</Badge> : null}
            </View>
            <Text style={[detail.judul, { color: colors.text }]}>{tugas.title}</Text>
            <Meta>
              {tugas.key} · {tugas.workspace.name}
            </Meta>
          </View>

          <Card>
            <CardTitle>Ringkasan</CardTitle>
            <Field label="Jatuh tempo">
              <Body muted>{tanggalDariYMD(tugas.due_date)}</Body>
            </Field>
            {tugas.start_date ? (
              <Field label="Mulai">
                <Body muted>{tanggalDariYMD(tugas.start_date)}</Body>
              </Field>
            ) : null}
            <Field label="Penerima">
              <Body muted>{tugas.assignees.length > 0 ? tugas.assignees.join(', ') : 'Belum ada'}</Body>
            </Field>
            {tugas.completed_at ? (
              <Field label="Selesai pada">
                <Body muted>{tanggalDariYMD(tugas.completed_at.slice(0, 10))}</Body>
              </Field>
            ) : null}
          </Card>

          {tugas.description_text ? (
            <Card>
              <CardTitle>Deskripsi</CardTitle>
              <Body muted>{tugas.description_text}</Body>
            </Card>
          ) : null}

          {tugas.checklist ? (
            <Card>
              <CardTitle>Checklist</CardTitle>
              <View style={detail.progresWrap}>
                <View style={[detail.progresLatar, { backgroundColor: colors.surface2 }]}>
                  <View
                    style={[
                      detail.progresIsi,
                      {
                        backgroundColor: colors.primary,
                        width: `${Math.round((tugas.checklist.done / Math.max(tugas.checklist.total, 1)) * 100)}%`,
                      },
                    ]}
                  />
                </View>
                <Meta>
                  {tugas.checklist.done}/{tugas.checklist.total} selesai (hanya-baca)
                </Meta>
              </View>
              <Meta>Mengubah checklist belum didukung aplikasi.</Meta>
            </Card>
          ) : null}

          {galatAksi ? (
            <Card>
              <Text style={{ color: colors.danger, fontSize: 14 }}>{galatAksi}</Text>
            </Card>
          ) : null}
        </Screen>
      ) : null}

      {tugas ? (
        <View
          style={[
            detail.aksiBar,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
          {galatAksi ? (
            <Text style={{ color: colors.danger, fontSize: 13, textAlign: 'center' }}>{galatAksi}</Text>
          ) : null}
          <Divider />
          {tugas.status.is_done ? (
            <Button
              title="Buka kembali tugas"
              variant="secondary"
              icon="refresh"
              loading={menyibuk}
              disabled={menyibuk}
              onPress={() => void ubahSelesai(false)}
            />
          ) : (
            <Button
              title="Tandai selesai"
              icon="checkmark"
              loading={menyibuk}
              disabled={menyibuk}
              onPress={() => void ubahSelesai(true)}
            />
          )}
        </View>
      ) : null}
    </View>
  );
}

const detail = StyleSheet.create({
  punggung: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  judulAtas: { fontSize: 17, fontWeight: '700' },
  judul: { fontSize: 21, fontWeight: '800', lineHeight: 28 },
  lencanaBaris: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  progresWrap: { gap: 6 },
  progresLatar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progresIsi: { height: 8, borderRadius: 4 },
  aksiBar: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 10, gap: 8 },
});
